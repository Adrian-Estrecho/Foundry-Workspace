"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  MegaphoneIcon,
  MessageSquareIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PinIcon,
  PinOffIcon,
  PlusIcon,
  SendIcon,
  SmilePlusIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { EmptyState } from "@/components/shared/panel";
import { UserAvatar } from "@/components/shared/user-avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useNow } from "@/hooks/use-now";
import { timeAgo } from "@/lib/dates";
import { cn } from "@/lib/utils";
import {
  addAnnouncementComment,
  deleteAnnouncement,
  deleteAnnouncementComment,
  markAnnouncementsSeen,
  setAnnouncementPinned,
  toggleReaction,
} from "../actions";
import { REACTIONS } from "../constants";
import type { AnnouncementView } from "../queries";
import { AnnouncementDialog } from "./announcement-dialog";
import { Linkified } from "./chat";

/**
 * The team's announcements, pinned first. Everyone reacts and comments;
 * admins post, edit, pin and remove. Opening the feed clears the badge,
 * while "New" marks stay for this visit.
 */
export function AnnouncementFeed({
  announcements,
  seenAt,
  renderedAt,
  viewer,
}: {
  announcements: AnnouncementView[];
  seenAt: string;
  renderedAt: number;
  /** canPost: write, pin and remove announcements. isAdmin: also remove anyone's comments. */
  viewer: { id: string; isAdmin: boolean; canPost: boolean };
}) {
  const [composeOpen, setComposeOpen] = React.useState(false);
  const [seenBefore] = React.useState(seenAt);
  const hasNew = announcements.some((a) => a.createdAt > seenAt);

  React.useEffect(() => {
    if (hasNew) void markAnnouncementsSeen();
  }, [hasNew]);

  return (
    <div className="mx-auto grid max-w-3xl gap-4">
      {viewer.canPost && (
        <button
          type="button"
          onClick={() => setComposeOpen(true)}
          className="flex items-center gap-3 rounded-xl border border-dashed bg-card p-4 text-left text-muted-foreground transition-colors hover:border-foreground/25 hover:text-foreground"
        >
          <span className="grid size-9 place-items-center rounded-lg bg-primary/12 text-primary">
            <PlusIcon className="size-4" />
          </span>
          Share an update with the team…
        </button>
      )}

      {announcements.length === 0 ? (
        <div className="rounded-xl border bg-card">
          <EmptyState
            icon={MegaphoneIcon}
            title="No announcements yet"
            description={viewer.canPost ? "Post the first one: everyone gets a notification." : "Updates from the admins show up here."}
          />
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4">
          {announcements.map((announcement) => (
            <AnnouncementCard
              key={announcement.id}
              announcement={announcement}
              isNew={announcement.createdAt > seenBefore && announcement.author?.id !== viewer.id}
              renderedAt={renderedAt}
              viewer={viewer}
            />
          ))}
        </ul>
      )}

      <AnnouncementDialog open={composeOpen} onOpenChange={setComposeOpen} />
    </div>
  );
}

const COMMENTS_SHOWN = 3;

function AnnouncementCard({
  announcement,
  isNew,
  renderedAt,
  viewer,
}: {
  announcement: AnnouncementView;
  isNew: boolean;
  renderedAt: number;
  /** canPost: write, pin and remove announcements. isAdmin: also remove anyone's comments. */
  viewer: { id: string; isAdmin: boolean; canPost: boolean };
}) {
  const router = useRouter();
  const now = useNow(renderedAt);
  const [pending, startTransition] = React.useTransition();
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [reactOpen, setReactOpen] = React.useState(false);
  const [showAll, setShowAll] = React.useState(false);
  const [comment, setComment] = React.useState("");
  const comments = showAll ? announcement.comments : announcement.comments.slice(-COMMENTS_SHOWN);
  const hidden = announcement.comments.length - comments.length;

  const run = (action: () => Promise<{ ok: boolean; error?: string }>, success?: string) =>
    startTransition(async () => {
      const result = await action();
      if (!result.ok) return void toast.error(result.error ?? "Something went wrong.");
      if (success) toast.success(success);
      router.refresh();
    });

  const react = (emoji: string) => {
    setReactOpen(false);
    run(() => toggleReaction(announcement.id, emoji));
  };

  const postComment = (event: React.FormEvent) => {
    event.preventDefault();
    const body = comment.trim();
    if (!body) return;
    startTransition(async () => {
      const result = await addAnnouncementComment(announcement.id, body);
      if (!result.ok) return void toast.error(result.error);
      setComment("");
      setShowAll(true);
      router.refresh();
    });
  };

  return (
    <li className={cn("rounded-xl border bg-card", announcement.isPinned && "border-primary/35")}>
      <article className="p-5" aria-labelledby={`announcement-${announcement.id}`}>
        <header className="flex items-start gap-3">
          <UserAvatar name={announcement.author?.name ?? "Admin"} src={announcement.author?.avatarUrl} className="size-9" />
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-x-2 text-sm">
              <span className="font-medium">{announcement.author?.name ?? "An admin"}</span>
              <span className="text-muted-foreground">
                {timeAgo(announcement.createdAt, now)}
              </span>
            </p>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
              {announcement.isPinned && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/12 px-2 py-0.5 text-xs font-medium text-primary">
                  <PinIcon className="size-3" /> Pinned
                </span>
              )}
              {isNew && <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">New</span>}
            </div>
          </div>
          {viewer.canPost && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Announcement actions" disabled={pending}>
                  <MoreHorizontalIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-xl">
                <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                  <PencilIcon /> Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() =>
                    run(() => setAnnouncementPinned(announcement.id, !announcement.isPinned), announcement.isPinned ? "Unpinned" : "Pinned to the top")
                  }
                >
                  {announcement.isPinned ? <PinOffIcon /> : <PinIcon />}
                  {announcement.isPinned ? "Unpin" : "Pin to the top"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
                  <Trash2Icon /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </header>

        <h2 id={`announcement-${announcement.id}`} className="mt-4 font-heading text-lg font-medium text-balance">
          {announcement.title}
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed break-words whitespace-pre-line text-muted-foreground">
          <Linkified text={announcement.body} />
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          {announcement.reactions.map((reaction) => (
            <Tooltip key={reaction.emoji}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => react(reaction.emoji)}
                  disabled={pending}
                  aria-pressed={reaction.mine}
                  aria-label={`${reaction.emoji} ${reaction.count}${reaction.mine ? ", including you" : ""}`}
                  className={cn(
                    "inline-flex h-7 items-center gap-1 rounded-full px-2 text-sm ring-1 transition-colors tabular",
                    reaction.mine ? "bg-primary/12 ring-primary/40" : "bg-surface ring-border hover:bg-accent",
                  )}
                >
                  <span>{reaction.emoji}</span>
                  <span className="text-xs">{reaction.count}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent>{reaction.names.join(", ")}</TooltipContent>
            </Tooltip>
          ))}
          <Popover open={reactOpen} onOpenChange={setReactOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="rounded-full text-muted-foreground" aria-label="Add a reaction">
                <SmilePlusIcon />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto flex-row gap-1 rounded-full p-1">
              {REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => react(emoji)}
                  className="grid size-8 place-items-center rounded-full text-lg transition-transform hover:scale-110 hover:bg-accent"
                  aria-label={`React with ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </PopoverContent>
          </Popover>
          <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
            <MessageSquareIcon className="size-3.5" />
            {announcement.comments.length}
          </span>
        </div>
      </article>

      <div className="border-t bg-surface/50 px-5 py-3">
        {hidden > 0 && (
          <button type="button" onClick={() => setShowAll(true)} className="mb-2 text-xs text-muted-foreground hover:text-foreground">
            Show {hidden} earlier {hidden === 1 ? "comment" : "comments"}
          </button>
        )}
        {comments.length > 0 && (
          <ul className="mb-3 grid gap-3">
            {comments.map((c) => (
              <li key={c.id} className="group flex items-start gap-2.5">
                <UserAvatar name={c.author?.name ?? "Someone"} src={c.author?.avatarUrl} className="size-7" />
                <div className="min-w-0 flex-1 text-sm">
                  <p>
                    <span className="font-medium">{c.author?.name ?? "Former member"}</span>{" "}
                    <span className="text-xs text-muted-foreground">{timeAgo(c.createdAt, now)}</span>
                  </p>
                  <p className="break-words whitespace-pre-line">
                    <Linkified text={c.body} />
                  </p>
                </div>
                {(viewer.isAdmin || c.author?.id === viewer.id) && (
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="text-muted-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                    aria-label="Remove comment"
                    onClick={() => run(() => deleteAnnouncementComment(c.id), "Comment removed")}
                  >
                    <XIcon />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={postComment} className="flex items-center gap-2">
          <Input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Write a comment…"
            aria-label={`Comment on ${announcement.title}`}
            maxLength={2000}
            className="h-9"
          />
          <Button type="submit" size="icon" variant="secondary" disabled={pending || !comment.trim()} aria-label="Post comment">
            <SendIcon />
          </Button>
        </form>
      </div>

      {editOpen && (
        <AnnouncementDialog
          open
          onOpenChange={setEditOpen}
          announcement={{ id: announcement.id, title: announcement.title, body: announcement.body, isPinned: announcement.isPinned }}
        />
      )}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this announcement?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{announcement.title}&rdquo; and its comments and reactions will be gone for everyone. It can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={(event) => {
                event.preventDefault();
                startTransition(async () => {
                  const result = await deleteAnnouncement(announcement.id);
                  if (!result.ok) return void toast.error(result.error);
                  toast.success("Announcement deleted");
                  setDeleteOpen(false);
                  router.refresh();
                });
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}
