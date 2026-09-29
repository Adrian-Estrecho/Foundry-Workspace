"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeftIcon, CheckIcon, ChevronDownIcon, GlobeIcon, MoreHorizontalIcon, PencilIcon, Trash2Icon } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { deleteProject, setProjectStatus } from "../actions";
import { PROJECT_STATUSES, projectStatusMeta, type ProjectStatus } from "../constants";
import { ProjectFormDialog, type ClientChoice, type EditorOption, type ProjectEditable } from "./project-form-dialog";
import { ProjectStatusChip } from "./project-status";

export function ProjectHeader({
  project,
  client,
  isAdmin,
  taskCount,
  clients,
  editors,
  portal = null,
  siteUrl = "",
}: {
  project: ProjectEditable;
  client: { id: string; name: string };
  isAdmin: boolean;
  taskCount: number;
  clients: ClientChoice[];
  editors: EditorOption[];
  /** The client's portal link (admins), for "Share with client". */
  portal?: PortalInfo;
  siteUrl?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [shareOpen, setShareOpen] = React.useState(false);
  const current = projectStatusMeta(project.status);

  const changeStatus = (status: ProjectStatus) =>
    startTransition(async () => {
      const result = await setProjectStatus(project.id, status);
      if (!result.ok) return void toast.error(result.error);
      toast.success(`Moved to ${projectStatusMeta(status).label}`);
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
            {isAdmin ? (
              <Link href={`/clients/${client.id}`} className="hover:text-foreground">
                {client.name}
              </Link>
            ) : (
              client.name
            )}
          </p>
          <h1 className="mt-0.5 font-heading text-3xl font-semibold tracking-tight break-words">{project.name}</h1>
        </div>

        {isAdmin ? (
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="lg" className="bg-surface ring-1 ring-border" disabled={pending}>
                  <span className={cn("size-2.5 rounded-full", current.dot)} />
                  {current.label}
                  <ChevronDownIcon className="text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-2xl">
                <DropdownMenuLabel>Project status</DropdownMenuLabel>
                {PROJECT_STATUSES.map((status) => (
                  <DropdownMenuItem key={status.value} onSelect={() => status.value !== project.status && changeStatus(status.value)}>
                    <span className={cn("size-2 rounded-full", status.dot)} />
                    {status.label}
                    {status.value === project.status && <CheckIcon className="ml-auto" />}
                  </DropdownMenuItem>
                ))}
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
                <DropdownMenuItem onSelect={() => setShareOpen(true)}>
                  <GlobeIcon /> Share with client
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
                  <Trash2Icon /> Delete project
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : (
          <ProjectStatusChip status={project.status} className="px-3 py-1 text-sm" />
        )}
      </div>

      {isAdmin && (
        <ProjectPortalDialog
          open={shareOpen}
          onOpenChange={setShareOpen}
          client={client}
          projectId={project.id}
          portal={portal}
          siteUrl={siteUrl}
        />
      )}

      {isAdmin && editOpen && (
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
