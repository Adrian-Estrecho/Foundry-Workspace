"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AtSignIcon, Loader2Icon, MessageSquareIcon, SendIcon, Trash2Icon } from "lucide-react";
import { MentionText, MentionTextarea, type Mentionable } from "@/components/shared/mention-textarea";
import { EmptyState, Panel } from "@/components/shared/panel";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { timeAgo } from "@/lib/dates";
import { addComment, deleteComment } from "../../actions";

export type TaskComment = {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; name: string; avatarUrl: string | null; isAdmin: boolean } | null;
};

/** The task's conversation, oldest first. @Name notifies admins or the assignee. */
export function CommentsPanel({
  taskId,
  comments,
  people,
  currentUserId,
  isAdmin,
  canComment,
  renderedAt,
}: {
  taskId: string;
  comments: TaskComment[];
  /** Who can be @mentioned: admins and the assignee. */
  people: Mentionable[];
  currentUserId: string;
  isAdmin: boolean;
  canComment: boolean;
  renderedAt: number;
}) {
  const router = useRouter();
  const [body, setBody] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const mentionable = people.filter((p) => p.id !== currentUserId);
  const names = [...people.map((p) => p.name), ...comments.map((c) => c.author?.name ?? "")];

  const post = () =>
    startTransition(async () => {
      if (!body.trim()) return;
      const result = await addComment(taskId, body);
      if (!result.ok) return void toast.error(result.error);
      setBody("");
      router.refresh();
    });

  const remove = (id: string) =>
    startTransition(async () => {
      const result = await deleteComment(id);
      if (!result.ok) return void toast.error(result.error);
      toast.success("Comment deleted");
      router.refresh();
    });

  return (
    <Panel title="Comments" description={comments.length ? `${comments.length} ${comments.length === 1 ? "comment" : "comments"}` : undefined}>
      {comments.length === 0 ? (
        <EmptyState icon={MessageSquareIcon} title="No comments yet" description={canComment ? "Questions, feedback and updates go here." : undefined} />
      ) : (
        <ol className="grid grid-cols-1 gap-4">
          {comments.map((comment) => (
            <li key={comment.id} className="group flex items-start gap-3">
              <UserAvatar name={comment.author?.name ?? "?"} src={comment.author?.avatarUrl} className="size-8" />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{comment.author?.name ?? "Former member"}</span>
                  {comment.author?.isAdmin && <span className="rounded bg-muted px-1.5 py-px text-[10px] font-medium uppercase">Admin</span>}
                  <span>{timeAgo(comment.createdAt, renderedAt)}</span>
                  {(isAdmin || comment.author?.id === currentUserId) && (
                    <button
                      type="button"
                      onClick={() => remove(comment.id)}
                      disabled={pending}
                      className="ml-auto rounded p-1 text-muted-foreground opacity-100 hover:text-danger focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                      aria-label="Delete comment"
                    >
                      <Trash2Icon className="size-3.5" />
                    </button>
                  )}
                </p>
                <p className="mt-1 rounded-xl bg-surface px-3 py-2 text-sm break-words whitespace-pre-line ring-1 ring-border">
                  <MentionText text={comment.body} names={names} />
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}

      {canComment && (
        <form
          className="mt-5 grid gap-2"
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
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <AtSignIcon className="size-3" /> Mentions notify {isAdmin ? "the assignee or other admins" : "the admins"}
            </p>
            <Button type="submit" size="sm" disabled={pending || !body.trim()}>
              {pending ? <Loader2Icon className="animate-spin" /> : <SendIcon />} Comment
            </Button>
          </div>
        </form>
      )}
    </Panel>
  );
}
