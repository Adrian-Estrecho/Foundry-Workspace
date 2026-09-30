"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeftIcon, PencilIcon } from "lucide-react";
import { useIsOnline } from "@/components/presence/presence-provider";
import { StatusChip } from "@/components/shared/status";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { liveStatus } from "@/lib/status";
import type { Enums } from "@/types/database";
import { setEditorActive } from "../../actions";
import { EditorDetailsDialog, type EditorDetails } from "./editor-details-dialog";

export function EditorHeader({
  editor,
  details,
}: {
  editor: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    subtitle: string;
    isActive: boolean;
    workStatus: Enums<"work_status">;
    recentlySeen: boolean;
    memberStatus: Enums<"member_status">;
    /** Their access title from People, if they have one. */
    title: string | null;
  };
  details: EditorDetails;
}) {
  const router = useRouter();
  const online = useIsOnline(editor.id, editor.recentlySeen);
  const [active, setActive] = React.useOptimistic(editor.isActive);
  const [, startTransition] = React.useTransition();
  const [editOpen, setEditOpen] = React.useState(false);
  const status = liveStatus(editor.workStatus, online);

  const toggleActive = (value: boolean) =>
    startTransition(async () => {
      setActive(value);
      const result = await setEditorActive(editor.id, value);
      if (!result.ok) return void toast.error(result.error);
      toast.success(value ? `${editor.name} is active` : `${editor.name} marked inactive`, {
        description: value ? undefined : "Hidden from assignment and the live board. Their login still works.",
      });
      router.refresh();
    });

  return (
    <div className="mb-6">
      <Link href="/editors" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> Editors
      </Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <UserAvatar name={editor.name} src={editor.avatarUrl} className="size-14 text-lg" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate font-heading text-3xl font-semibold tracking-tight">{editor.name}</h1>
              {editor.memberStatus === "onboarding" ? (
                <span className="rounded-full bg-primary/12 px-2.5 py-1 text-xs font-medium text-primary">Onboarding</span>
              ) : editor.memberStatus !== "active" ? (
                <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">Not taken on</span>
              ) : active ? (
                <StatusChip status={status} />
              ) : (
                <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">Inactive</span>
              )}
              {editor.title && (
                <span className="rounded-full bg-surface px-2.5 py-1 text-xs font-medium ring-1 ring-border">{editor.title}</span>
              )}
            </div>
            <p className="mt-1 truncate text-muted-foreground">{editor.subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {editor.memberStatus === "active" && (
            <label className="flex h-10 cursor-pointer items-center gap-2.5 rounded-lg bg-surface px-3 text-sm ring-1 ring-border">
              <Switch checked={active} onCheckedChange={toggleActive} aria-label="Active editor" />
              Active
            </label>
          )}
          <Button variant="secondary" size="lg" className="bg-surface ring-1 ring-border" onClick={() => setEditOpen(true)}>
            <PencilIcon /> Edit details
          </Button>
        </div>
      </div>

      <EditorDetailsDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        editorId={editor.id}
        details={details}
      />
    </div>
  );
}
