"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeftIcon, CheckIcon, ChevronDownIcon, MoreHorizontalIcon, Trash2Icon } from "lucide-react";
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
import { ProjectFormDialog, type EditorOption } from "@/features/projects/components/project-form-dialog";
import { cn } from "@/lib/utils";
import { deleteClientRecord, setClientStage } from "../../actions";
import { CLIENT_STAGES, stageLabel, type ClientStage } from "../../constants";

export function ClientHeader({
  client,
  projectCount,
  editors,
}: {
  client: { id: string; name: string; contactName: string; email: string | null; stage: ClientStage; driveFolderUrl: string | null; deadline: string | null };
  projectCount: number;
  editors: EditorOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [kickoffOpen, setKickoffOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const current = CLIENT_STAGES.find((s) => s.value === client.stage)!;

  const changeStage = (stage: ClientStage) =>
    startTransition(async () => {
      const result = await setClientStage(client.id, stage);
      if (!result.ok) return void toast.error(result.error);
      toast.success(`Moved to ${stageLabel(stage)}`);
      if (stage === "kickoff" && projectCount === 0) setKickoffOpen(true);
      router.refresh();
    });

  const remove = () =>
    startTransition(async () => {
      const result = await deleteClientRecord(client.id);
      if (!result.ok) return void toast.error(result.error);
      toast.success(`${client.name} deleted`);
      router.push("/clients");
    });

  return (
    <div className="mb-6">
      <Link href="/clients" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> Pipeline
      </Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate font-heading text-3xl font-semibold tracking-tight">{client.name}</h1>
          <p className="mt-1 text-muted-foreground">
            {[client.name !== client.contactName && client.contactName, client.email].filter(Boolean).join(" · ")}
          </p>
        </div>
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
              <DropdownMenuLabel>Pipeline stage</DropdownMenuLabel>
              {CLIENT_STAGES.map((stage) => (
                <DropdownMenuItem key={stage.value} onSelect={() => stage.value !== client.stage && changeStage(stage.value)}>
                  <span className={cn("size-2 rounded-full", stage.dot)} />
                  {stage.label}
                  {stage.value === client.stage && <CheckIcon className="ml-auto" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon-lg" aria-label="More actions">
                <MoreHorizontalIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-2xl">
              <DropdownMenuItem onSelect={() => setKickoffOpen(true)}>New project</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
                <Trash2Icon /> Delete client
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <ProjectFormDialog
        open={kickoffOpen}
        onOpenChange={setKickoffOpen}
        client={{ id: client.id, name: client.name, driveFolderUrl: client.driveFolderUrl, deadline: client.deadline }}
        editors={editors}
        title={client.stage === "kickoff" && projectCount === 0 ? `Kick off ${client.name}` : "New project"}
        description={
          client.stage === "kickoff" && projectCount === 0
            ? "They're at Kickoff. Create their first project now so the team can start."
            : undefined
        }
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {client.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the client, their checklist, contract file and original enquiry. It can&apos;t be undone.
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
              Delete client
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
