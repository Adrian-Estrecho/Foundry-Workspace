"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRightIcon, ExternalLinkIcon, LinkIcon, MoreHorizontalIcon, PlusIcon, SearchIcon, Trash2Icon } from "lucide-react";
import { KanbanBoard } from "@/components/shared/kanban-board";
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
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ProjectFormDialog, type EditorOption } from "@/features/projects/components/project-form-dialog";
import { deleteClientRecord, moveClient, setClientStage } from "../actions";
import { CLIENT_STAGES, stageLabel, type ClientStage } from "../constants";
import type { PipelineClient } from "../queries";
import { ClientCard } from "./client-card";
import { NewClientDialog } from "./new-client-dialog";

const COLUMNS = CLIENT_STAGES.map((stage) => ({ id: stage.value, label: stage.label, dot: stage.dot }));

export function ClientPipeline({
  clients,
  editors,
  today,
}: {
  clients: PipelineClient[];
  editors: EditorOption[];
  today: string;
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [newOpen, setNewOpen] = React.useState(false);
  const [kickoff, setKickoff] = React.useState<PipelineClient | null>(null);
  const [toDelete, setToDelete] = React.useState<PipelineClient | null>(null);
  const [deleting, startDelete] = React.useTransition();

  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) =>
      [c.name, c.contactName, c.email, c.projectType].some((value) => value?.toLowerCase().includes(q)),
    );
  }, [clients, query]);

  /** After any stage change: confirm, and prompt for the first project at Kickoff. */
  const afterStageChange = (client: PipelineClient, stage: ClientStage) => {
    if (stage === client.column) return;
    toast.success(`${client.name} moved to ${stageLabel(stage)}`);
    if (stage === "kickoff" && client.projectCount === 0) setKickoff(client);
  };

  const onMove = async (client: PipelineClient, column: string, position: number) => {
    const result = await moveClient(client.id, column, position);
    if (!result.ok) {
      toast.error(result.error);
      return false;
    }
    afterStageChange(client, column as ClientStage);
    return true;
  };

  const moveTo = async (client: PipelineClient, stage: ClientStage) => {
    const result = await setClientStage(client.id, stage);
    if (!result.ok) return void toast.error(result.error);
    afterStageChange(client, stage);
    router.refresh();
  };

  const copyIntakeLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/intake`);
      toast.success("Intake form link copied");
    } catch {
      toast.error("Couldn't copy the link.");
    }
  };

  const confirmDelete = () =>
    startDelete(async () => {
      if (!toDelete) return;
      const result = await deleteClientRecord(toDelete.id);
      if (result.ok) {
        toast.success(`${toDelete.name} deleted`);
        setToDelete(null);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search clients"
            aria-label="Search clients"
            className="rounded-full bg-surface pl-9"
          />
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="secondary" onClick={copyIntakeLink} className="bg-surface ring-1 ring-border">
            <LinkIcon /> Intake form link
          </Button>
          <Button onClick={() => setNewOpen(true)}>
            <PlusIcon /> New client
          </Button>
        </div>
      </div>

      <KanbanBoard
        ariaLabel="Client pipeline"
        scrollbarAtWindowBottom
        columns={COLUMNS}
        items={visible}
        onMove={onMove}
        itemLabel={(client) => client.name}
        emptyText={query ? "No matches" : "Drag a client here"}
        renderCard={(client, { overlay }) => (
          <ClientCard
            client={client}
            today={today}
            overlay={overlay}
            menu={
              overlay ? null : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="rounded-full opacity-60 group-hover:opacity-100 focus-visible:opacity-100"
                      aria-label={`Actions for ${client.name}`}
                    >
                      <MoreHorizontalIcon />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52 rounded-2xl">
                    <DropdownMenuItem asChild>
                      <Link href={`/clients/${client.id}`}>
                        <ExternalLinkIcon /> Open client
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <ArrowRightIcon /> Move to
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="rounded-2xl">
                        {CLIENT_STAGES.filter((s) => s.value !== client.column).map((stage) => (
                          <DropdownMenuItem key={stage.value} onSelect={() => void moveTo(client, stage.value)}>
                            <span className={`size-2 rounded-full ${stage.dot}`} /> {stage.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onSelect={() => setToDelete(client)}>
                      <Trash2Icon /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )
            }
          />
        )}
      />

      <NewClientDialog open={newOpen} onOpenChange={setNewOpen} />

      {kickoff && (
        <ProjectFormDialog
          open
          onOpenChange={(open) => !open && setKickoff(null)}
          client={{ id: kickoff.id, name: kickoff.name, driveFolderUrl: kickoff.driveFolderUrl, deadline: kickoff.deadline }}
          editors={editors}
          title={`Kick off ${kickoff.name}`}
          description="They're at Kickoff. Create their first project now so the team can start."
        />
      )}

      <AlertDialog open={!!toDelete} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {toDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the client, their checklist, contract file and original enquiry. It can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleting}
              onClick={(event) => {
                event.preventDefault();
                confirmDelete();
              }}
            >
              Delete client
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
