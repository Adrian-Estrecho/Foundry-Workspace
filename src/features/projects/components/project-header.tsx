"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeftIcon, CheckIcon, ChevronDownIcon, GlobeIcon, MoreHorizontalIcon, PencilIcon, Settings2Icon, Trash2Icon } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProjectPortalDialog, type PortalInfo } from "@/features/portal/components/portal-admin";
import { StatusDot } from "@/features/statuses/components/status-chip";
import { StatusManagerDialog } from "@/features/statuses/components/status-manager";
import type { StatusBadge } from "@/features/statuses/constants";
import { deleteProject, setProjectStatus } from "../actions";
import type { ProjectAccess } from "../access";
import type { ProjectStatusDef } from "../constants";
import { ProjectFormDialog, type ClientChoice, type EditorOption, type ProjectEditable } from "./project-form-dialog";
import { ProjectStatusChip } from "./project-status";

export function ProjectHeader({
  project,
  statusInfo,
  statuses,
  client,
  access,
  taskCount,
  clients,
  editors,
  portal = null,
  siteUrl = "",
}: {
  project: ProjectEditable;
  /** The status the project is in, and the workspace's statuses to move it to. */
  statusInfo: StatusBadge;
  statuses: ProjectStatusDef[];
  client: { id: string; name: string };
  access: ProjectAccess;
  taskCount: number;
  clients: ClientChoice[];
  editors: EditorOption[];
  /** The client's portal link (people who manage clients), for "Share with client". */
  portal?: PortalInfo;
  siteUrl?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [shareOpen, setShareOpen] = React.useState(false);
  const [editingStatuses, setEditingStatuses] = React.useState(false);
  const current = statusInfo;

  const changeStatus = (status: ProjectStatusDef) =>
    startTransition(async () => {
      const result = await setProjectStatus(project.id, status.id);
      if (!result.ok) return void toast.error(result.error);
      toast.success(`Moved to ${status.name}`);
      router.refresh();
    });

  const remove = () =>
    startTransition(async () => {
      const result = await deleteProject(project.id);
      if (!result.ok) return void toast.error(result.error);
      toast.success(`${project.name} deleted`);
      router.push("/projects");
    });

  return (
    <div className="mb-6">
      <Link href="/projects" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> Projects
      </Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-sm text-muted-foreground">
            {access.clients ? (
              <Link href={`/clients/${client.id}`} className="hover:text-foreground">
                {client.name}
              </Link>
            ) : (
              client.name
            )}
          </p>
          <h1 className="mt-0.5 font-heading text-3xl font-semibold tracking-tight break-words">{project.name}</h1>
        </div>

        {access.manage ? (
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="lg" className="bg-surface ring-1 ring-border" disabled={pending}>
                  <StatusDot color={current.color} className="size-2.5" />
                  {current.name}
                  <ChevronDownIcon className="text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-96 w-56 overflow-y-auto rounded-2xl">
                <DropdownMenuLabel>Project status</DropdownMenuLabel>
                {statuses.map((status) => (
                  <DropdownMenuItem key={status.id} onSelect={() => status.id !== current.id && changeStatus(status)}>
                    <StatusDot color={status.color} />
                    <span className="truncate">{status.name}</span>
                    {status.id === current.id && <CheckIcon className="ml-auto" />}
                  </DropdownMenuItem>
                ))}
                {access.statuses && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => setEditingStatuses(true)}>
                      <Settings2Icon /> Edit statuses
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="secondary" size="lg" className="bg-surface ring-1 ring-border" onClick={() => setEditOpen(true)}>
              <PencilIcon /> Edit
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon-lg" aria-label="More actions">
                  <MoreHorizontalIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-2xl">
                <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                  <PencilIcon /> Edit project
                </DropdownMenuItem>
                {access.clients && (
                  <DropdownMenuItem onSelect={() => setShareOpen(true)}>
                    <GlobeIcon /> Share with client
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
                  <Trash2Icon /> Delete project
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : (
          <ProjectStatusChip status={statusInfo} className="px-3 py-1 text-sm" />
        )}
      </div>

      {access.clients && (
        <ProjectPortalDialog
          open={shareOpen}
          onOpenChange={setShareOpen}
          client={client}
          projectId={project.id}
          portal={portal}
          siteUrl={siteUrl}
        />
      )}

      {access.statuses && <StatusManagerDialog kind="project" open={editingStatuses} onOpenChange={setEditingStatuses} />}

      {access.manage && editOpen && (
        <ProjectFormDialog open onOpenChange={setEditOpen} project={project} clients={clients} editors={editors} />
      )}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {project.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {taskCount > 0
                ? `This also deletes its ${taskCount} ${taskCount === 1 ? "task" : "tasks"}, with their comments and files. `
                : ""}
              Logged time stays in the timesheets. It can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={(event) => {
                event.preventDefault();
                remove();
              }}
            >
              Delete project
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
