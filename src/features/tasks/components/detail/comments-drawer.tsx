"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AtSignIcon, ChevronsRightIcon, HistoryIcon, Loader2Icon, MessageSquareIcon, SendIcon, Trash2Icon } from "lucide-react";
import { MentionText, MentionTextarea, type Mentionable } from "@/components/shared/mention-textarea";
import { EmptyState } from "@/components/shared/panel";
import { Segmented } from "@/components/shared/segmented";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { ClickUpMark } from "@/features/clickup/components/clickup-mark";
import { timeAgo } from "@/lib/dates";
import { addComment, deleteComment, refreshClickUpComments } from "../../actions";
import { useCommentsDrawer } from "./task-detail-shell";

export type TaskComment = {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; name: string; avatarUrl: string | null; isAdmin: boolean } | null;
  /** Written in ClickUp. */
  fromClickUp: boolean;
  /** ClickUp's name for a writer who isn't a member here. */
  clickupAuthor: { name: string; avatarUrl: string | null } | null;
  /** The same comment is in ClickUp (it came from there, or was posted there). */
  inClickUp: boolean;
};

export type HistoryEntry = {
  id: number;
  summary: string;
  created_at: string;
  actor: { full_name: string; avatar_url: string | null } | null;
};

type Item = { kind: "comment"; at: string; comment: TaskComment } | { kind: "history"; at: string; entry: HistoryEntry };

/**
 * The task's conversation, oldest first, in the side panel. @Name notifies
 * admins or the assignee. On a task synced with ClickUp, comments written
 * there show here and comments written here are posted there; opening the
 * task catches up with ClickUp first. People who see the task's history can
 * mix it in.
 */
export function CommentsDrawer({
  taskId,
  comments,
  people,
  currentUserId,
  isAdmin,
  canComment,
  synced,
  history,
  renderedAt,
}: {
  taskId: string;
  comments: TaskComment[];
  /** Who can be @mentioned: admins and the assignee. */
  people: Mentionable[];
  currentUserId: string;
  isAdmin: boolean;
  canComment: boolean;
  /** Synced with ClickUp. */
  synced: boolean;
  /** The task's history, newest first, for people who may see it. */
  history: HistoryEntry[] | null;
  renderedAt: number;
}) {
  const router = useRouter();
  const { open, setOpen } = useCommentsDrawer();
  const [body, setBody] = React.useState("");
  const [show, setShow] = React.useState<"comments" | "all">("comments");
  const [pending, startTransition] = React.useTransition();
  const [catchingUp, setCatchingUp] = React.useState(synced);
  const list = React.useRef<HTMLDivElement>(null);
  const composer = React.useRef<HTMLDivElement>(null);
  const mentionable = people.filter((p) => p.id !== currentUserId);
  const names = [...people.map((p) => p.name), ...comments.map((c) => c.author?.name ?? c.clickupAuthor?.name ?? "")];

  // ClickUp comments written before the webhook (or while it was down). When
  // some come in, the action revalidates this page, which redraws it.
  React.useEffect(() => {
    if (!synced) return;
    let live = true;
    void refreshClickUpComments(taskId).then(() => {
      if (live) setCatchingUp(false);
    });
    return () => {
      live = false;
    };
  }, [synced, taskId]);

  const items: Item[] = [
    ...comments.map((comment) => ({ kind: "comment" as const, at: comment.createdAt, comment })),
    ...(show === "all" && history ? history.map((entry) => ({ kind: "history" as const, at: entry.created_at, entry })) : []),
  ].sort((a, b) => a.at.localeCompare(b.at));

  // Newest at the bottom, in view when the panel opens or something arrives.
  React.useEffect(() => {
    if (open && list.current) list.current.scrollTop = list.current.scrollHeight;
  }, [open, items.length]);

  // Ready to type with a keyboard; phones would pop theirs up over the comments.
  React.useEffect(() => {
    if (open && canComment && window.matchMedia("(pointer: fine)").matches) {
      composer.current?.querySelector("textarea")?.focus({ preventScroll: true });
    }
  }, [open, canComment]);

  const post = () =>
    startTransition(async () => {
      if (!body.trim()) return;
      const result = await addComment(taskId, body);
      if (!result.ok) return void toast.error(result.error);
      setBody("");
      router.refresh();
    });

  const remove = (comment: TaskComment) =>
    startTransition(async () => {
      const result = await deleteComment(comment.id);
      if (!result.ok) return void toast.error(result.error);
      toast.success(comment.inClickUp ? "Comment deleted here and in ClickUp" : "Comment deleted");
      router.refresh();
    });

  return (
    <>
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <Button variant="ghost" size="icon-sm" onClick={() => setOpen(false)} aria-label="Hide comments" className="-ml-1.5 text-muted-foreground">
          <ChevronsRightIcon />
        </Button>
        <h2 className="font-heading text-base font-medium">Comments</h2>
        {comments.length > 0 && <span className="text-sm text-muted-foreground tabular">{comments.length}</span>}
        {history && (
          <Segmented
            value={show}
            onChange={setShow}
            label="Show"
            options={[
              { value: "comments", label: "Comments" },
              { value: "all", label: "All activity" },
            ]}
            className="ml-auto [&_button]:px-2 [&_button]:py-0.5 [&_button]:text-xs"
          />
        )}
      </header>

      {synced && (
        <p className="flex shrink-0 items-center gap-1.5 border-b bg-surface px-4 py-2 text-xs text-muted-foreground">
          <ClickUpMark className="size-3.5" />
          {catchingUp ? "Checking ClickUp for new comments…" : "Comments here and in ClickUp are the same conversation."}
          {catchingUp && <Loader2Icon className="ml-auto size-3.5 animate-spin" />}
        </p>
      )}

      <div ref={list} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        {items.length === 0 ? (
          <EmptyState
            icon={MessageSquareIcon}
            title="No comments yet"
            description={canComment ? "Questions, feedback and updates go here." : undefined}
            className="h-full"
          />
        ) : (
          <ol className="grid grid-cols-1 gap-4">
            {items.map((item) =>
              item.kind === "history" ? (
                <HistoryLine key={`h-${item.entry.id}`} entry={item.entry} renderedAt={renderedAt} />
              ) : (
                <CommentItem
                  key={item.comment.id}
                  comment={item.comment}
                  names={names}
                  renderedAt={renderedAt}
                  canDelete={isAdmin || item.comment.author?.id === currentUserId}
                  onDelete={() => remove(item.comment)}
                  pending={pending}
                />
              ),
            )}
          </ol>
        )}
      </div>

      {canComment && (
        <div ref={composer} className="shrink-0 border-t bg-background p-3">
          <form
            className="grid gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              post();
            }}
          >
            <MentionTextarea
              value={body}
              onChange={setBody}
              people={mentionable}
              onSubmit={post}
              rows={3}
              maxLength={8000}
              placeholder={mentionable.length ? `Write a comment… Type @ to mention ${mentionable[0].name.split(" ")[0]}` : "Write a comment…"}
              aria-label="Write a comment"
            />
            <div className="flex items-center justify-between gap-2">
              <p className="flex min-w-0 items-center gap-1 truncate text-xs text-muted-foreground">
                <AtSignIcon className="size-3 shrink-0" />
                <span className="truncate">
                  {synced ? "Also posted in ClickUp under your name" : `Mentions notify ${isAdmin ? "the assignee or admins" : "the admins"}`}
                </span>
              </p>
              <Button type="submit" size="sm" disabled={pending || !body.trim()}>
                {pending ? <Loader2Icon className="animate-spin" /> : <SendIcon />} Comment
              </Button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

function CommentItem({
  comment,
  names,
  renderedAt,
  canDelete,
  onDelete,
  pending,
}: {
  comment: TaskComment;
  names: string[];
  renderedAt: number;
  canDelete: boolean;
  onDelete: () => void;
  pending: boolean;
}) {
  const name = comment.author?.name ?? comment.clickupAuthor?.name ?? "Former member";
  const avatar = comment.author?.avatarUrl ?? comment.clickupAuthor?.avatarUrl ?? null;
  return (
    <li className="group flex items-start gap-3">
      <UserAvatar name={name} src={avatar} className="size-8" />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="truncate font-medium text-foreground">{name}</span>
          {comment.author?.isAdmin && <span className="rounded bg-muted px-1.5 py-px text-[10px] font-medium uppercase">Admin</span>}
          {comment.fromClickUp && (
            <span className="inline-flex items-center gap-0.5 rounded bg-muted px-1 py-px text-[10px] font-medium" title="Written in ClickUp">
              <ClickUpMark className="size-3" /> ClickUp
            </span>
          )}
          <span className="shrink-0">{timeAgo(comment.createdAt, renderedAt)}</span>
          {canDelete && (
            <button
              type="button"
              onClick={onDelete}
              disabled={pending}
              className="ml-auto rounded p-1 text-muted-foreground opacity-100 hover:text-danger focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
              aria-label="Delete comment"
            >
              <Trash2Icon className="size-3.5" />
            </button>
          )}
        </p>
        <p className="mt-1 rounded-xl bg-card px-3 py-2 text-sm break-words whitespace-pre-line ring-1 ring-border">
          <MentionText text={comment.body} names={names} />
        </p>
      </div>
    </li>
  );
}

function HistoryLine({ entry, renderedAt }: { entry: HistoryEntry; renderedAt: number }) {
  return (
    <li className="flex items-start gap-3 text-xs text-muted-foreground">
      <span className="grid size-8 shrink-0 place-items-center">
        <HistoryIcon className="size-3.5" />
      </span>
      <p className="min-w-0 pt-0.5 leading-snug">
        {entry.summary} <span className="whitespace-nowrap">· {timeAgo(entry.created_at, renderedAt)}</span>
      </p>
    </li>
  );
}
