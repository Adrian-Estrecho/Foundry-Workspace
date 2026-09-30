import "server-only";
import { notFound } from "next/navigation";
import type { CurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Enums } from "@/types/database";

/**
 * Messages: announcements for everyone, a private thread per editor (the
 * editor and the admins) and per client (the client, through their portal,
 * and the admins). RLS limits editors to their own thread.
 */

type Supabase = Awaited<ReturnType<typeof createClient>>;
export type Sender = Enums<"message_sender">;
export type ThreadKind = Enums<"message_thread_kind">;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Unread counts for the Messages tabs. */
export async function getInboxCounts(user: CurrentUser) {
  const supabase = await createClient();
  const [threads, announcements] = await Promise.all([
    supabase.rpc("unread_threads"),
    supabase.from("announcements").select("id", { count: "exact", head: true }).gt("created_at", user.announcementsSeenAt),
  ]);
  const unread = threads.data ?? [];
  return {
    announcements: announcements.count ?? 0,
    team: unread.filter((t) => t.kind === "editor").length,
    clients: unread.filter((t) => t.kind === "client").length,
    unreadThreadIds: new Set(unread.map((t) => t.thread_id)),
    renderedAt: Date.now(),
  };
}

// -----------------------------------------------------------------------------
// Inbox lists (admins)
// -----------------------------------------------------------------------------
export type InboxItem = {
  /** The editor's or the client's id (threads are addressed by who they're with). */
  id: string;
  name: string;
  avatarUrl: string | null;
  subtitle: string | null;
  preview: string | null;
  lastSender: Sender | null;
  lastMessageAt: string | null;
  unread: boolean;
};

const byRecent = (a: InboxItem, b: InboxItem) =>
  (b.lastMessageAt ?? "").localeCompare(a.lastMessageAt ?? "") || a.name.localeCompare(b.name);

/** Every approved editor, with their thread if there is one. */
export async function getEditorInbox(unreadIds: Set<string>): Promise<InboxItem[]> {
  const supabase = await createClient();
  const [{ data: editors }, { data: threads }] = await Promise.all([
    supabase
      .from("editors")
      .select(
        `id, is_active, profile:profiles!editors_id_fkey(full_name, avatar_url),
         member:workspace_members!editors_member_fkey!inner(status)`,
      )
      .eq("member.status", "active"),
    supabase.from("message_threads").select("id, editor_id, last_message_at, last_message_preview, last_sender").eq("kind", "editor"),
  ]);

  return (editors ?? [])
    .map((editor) => {
      const thread = threads?.find((t) => t.editor_id === editor.id);
      return {
        id: editor.id,
        name: editor.profile?.full_name ?? "Editor",
        avatarUrl: editor.profile?.avatar_url ?? null,
        subtitle: editor.is_active ? null : "Inactive",
        preview: thread?.last_message_preview ?? null,
        lastSender: thread?.last_sender ?? null,
        lastMessageAt: thread?.last_message_at ?? null,
        unread: thread ? unreadIds.has(thread.id) : false,
      };
    })
    .sort(byRecent);
}

const clientName = (c: { company: string | null; contact_name: string }) => c.company?.trim() || c.contact_name;

/** Clients with a portal or a conversation. */
export async function getClientInbox(unreadIds: Set<string>): Promise<InboxItem[]> {
  const supabase = await createClient();
  const [{ data: portals }, { data: threads }] = await Promise.all([
    supabase.from("client_portals").select("client_id, enabled"),
    supabase.from("message_threads").select("id, client_id, last_message_at, last_message_preview, last_sender").eq("kind", "client"),
  ]);
  const ids = [...new Set([...(portals ?? []).map((p) => p.client_id), ...(threads ?? []).map((t) => t.client_id!)])];
  if (ids.length === 0) return [];
  const { data: clients } = await supabase.from("clients").select("id, company, contact_name").in("id", ids);

  return (clients ?? [])
    .map((client) => {
      const thread = threads?.find((t) => t.client_id === client.id);
      const portal = portals?.find((p) => p.client_id === client.id);
      return {
        id: client.id,
        name: clientName(client),
        avatarUrl: null,
        subtitle: !portal ? "No portal" : portal.enabled ? client.contact_name : "Portal off",
        preview: thread?.last_message_preview ?? null,
        lastSender: thread?.last_sender ?? null,
        lastMessageAt: thread?.last_message_at ?? null,
        unread: thread ? unreadIds.has(thread.id) : false,
      };
    })
    .sort(byRecent);
}

// -----------------------------------------------------------------------------
// One conversation
// -----------------------------------------------------------------------------
export type ChatMessage = {
  id: string;
  body: string;
  sender: Sender;
  authorId: string | null;
  authorName: string;
  authorAvatar: string | null;
  createdAt: string;
};

export type Conversation = {
  kind: ThreadKind;
  subjectId: string;
  threadId: string | null;
  title: string;
  subtitle: string | null;
  avatarUrl: string | null;
  messages: ChatMessage[];
  /** The caller's read marker from before this visit (for the "New" divider). */
  lastReadAt: string | null;
  /** Clients only: their portal, and whether they've seen the latest reply. */
  portal: { enabled: boolean; token: string } | null;
  clientEmail: string | null;
  clientLastReadAt: string | null;
};

const MESSAGE_LIMIT = 300;

async function loadMessages(supabase: Supabase, threadId: string, clientLabel: string) {
  const { data } = await supabase
    .from("messages")
    .select("id, body, sender, author_id, created_at, author:profiles(full_name, avatar_url)")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: false })
    .limit(MESSAGE_LIMIT);
  return (data ?? []).reverse().map<ChatMessage>((m) => ({
    id: m.id,
    body: m.body,
    sender: m.sender,
    authorId: m.author_id,
    authorName: m.sender === "client" ? clientLabel : (m.author?.full_name ?? "Former member"),
    authorAvatar: m.author?.avatar_url ?? null,
    createdAt: m.created_at,
  }));
}

/** A conversation with an editor (admins: any; editors: their own). */
export async function getEditorConversation(user: CurrentUser, editorId: string): Promise<Conversation> {
  if (!UUID.test(editorId) || (user.role !== "admin" && editorId !== user.id)) notFound();
  const supabase = await createClient();
  const [{ data: profile }, { data: thread }] = await Promise.all([
    supabase.from("profiles").select("full_name, avatar_url").eq("id", editorId).maybeSingle(),
    supabase.from("message_threads").select("id").eq("kind", "editor").eq("editor_id", editorId).maybeSingle(),
  ]);
  if (user.role === "admin") {
    const { data: editor } = await supabase.from("editors").select("id").eq("id", editorId).maybeSingle();
    if (!editor || !profile) notFound();
  }

  const [messages, read] = thread
    ? await Promise.all([
        loadMessages(supabase, thread.id, "Client"),
        supabase.from("message_reads").select("last_read_at").eq("thread_id", thread.id).eq("user_id", user.id).maybeSingle(),
      ])
    : [[], { data: null }];

  return {
    kind: "editor",
    subjectId: editorId,
    threadId: thread?.id ?? null,
    title: user.role === "admin" ? (profile?.full_name ?? "Editor") : `${user.workspace.name} admins`,
    subtitle: user.role === "admin" ? "Private: only this editor and the admins see this." : "Private: only you and the admins see this.",
    avatarUrl: user.role === "admin" ? (profile?.avatar_url ?? null) : null,
    messages,
    lastReadAt: read.data?.last_read_at ?? null,
    portal: null,
    clientEmail: null,
    clientLastReadAt: null,
  };
}

/** A conversation with a client (people who manage clients). */
export async function getClientConversation(user: CurrentUser, clientId: string): Promise<Conversation> {
  if (!UUID.test(clientId) || !user.permissions.includes("clients.manage")) notFound();
  const supabase = await createClient();
  const [{ data: client }, { data: thread }, { data: portal }] = await Promise.all([
    supabase.from("clients").select("id, company, contact_name, email").eq("id", clientId).maybeSingle(),
    supabase.from("message_threads").select("id, client_last_read_at").eq("kind", "client").eq("client_id", clientId).maybeSingle(),
    supabase.from("client_portals").select("enabled, token").eq("client_id", clientId).maybeSingle(),
  ]);
  if (!client) notFound();

  const label = clientName(client);
  const [messages, read] = thread
    ? await Promise.all([
        loadMessages(supabase, thread.id, client.contact_name || label),
        supabase.from("message_reads").select("last_read_at").eq("thread_id", thread.id).eq("user_id", user.id).maybeSingle(),
      ])
    : [[], { data: null }];

  return {
    kind: "client",
    subjectId: clientId,
    threadId: thread?.id ?? null,
    title: label,
    subtitle: client.company?.trim() ? client.contact_name : null,
    avatarUrl: null,
    messages,
    lastReadAt: read.data?.last_read_at ?? null,
    portal: portal ? { enabled: portal.enabled, token: portal.token } : null,
    clientEmail: client.email,
    clientLastReadAt: thread?.client_last_read_at ?? null,
  };
}

// -----------------------------------------------------------------------------
// Announcements
// -----------------------------------------------------------------------------
export type AnnouncementView = {
  id: string;
  title: string;
  body: string;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  author: { id: string; name: string; avatarUrl: string | null } | null;
  reactions: { emoji: string; count: number; mine: boolean; names: string[] }[];
  comments: { id: string; body: string; createdAt: string; author: { id: string; name: string; avatarUrl: string | null } | null }[];
};

export async function getAnnouncements(user: CurrentUser) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("announcements")
    .select(
      `id, title, body, is_pinned, created_at, updated_at,
       author:profiles!announcements_author_id_fkey(id, full_name, avatar_url),
       reactions:announcement_reactions(emoji, user_id, user:profiles(full_name)),
       comments:announcement_comments(id, body, created_at, author:profiles(id, full_name, avatar_url))`,
    )
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(60);

  const announcements: AnnouncementView[] = (data ?? []).map((a) => {
    const reactions = new Map<string, AnnouncementView["reactions"][number]>();
    for (const r of a.reactions) {
      const entry = reactions.get(r.emoji) ?? { emoji: r.emoji, count: 0, mine: false, names: [] };
      entry.count += 1;
      entry.mine ||= r.user_id === user.id;
      if (r.user?.full_name) entry.names.push(r.user.full_name);
      reactions.set(r.emoji, entry);
    }
    return {
      id: a.id,
      title: a.title,
      body: a.body,
      isPinned: a.is_pinned,
      createdAt: a.created_at,
      updatedAt: a.updated_at,
      author: a.author ? { id: a.author.id, name: a.author.full_name, avatarUrl: a.author.avatar_url } : null,
      reactions: [...reactions.values()],
      comments: [...a.comments]
        .sort((x, y) => x.created_at.localeCompare(y.created_at))
        .map((c) => ({
          id: c.id,
          body: c.body,
          createdAt: c.created_at,
          author: c.author ? { id: c.author.id, name: c.author.full_name, avatarUrl: c.author.avatar_url } : null,
        })),
    };
  });

  return { announcements, seenAt: user.announcementsSeenAt, renderedAt: Date.now() };
}
