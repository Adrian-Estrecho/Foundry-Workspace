"use client";

import * as React from "react";
import { SearchIcon, SlidersHorizontalIcon, XIcon } from "lucide-react";
import { NativeSelect } from "@/components/shared/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { DUE_FILTERS, TASK_PRIORITIES, TASK_STATUSES } from "../constants";
import { activeFilterCount, type TaskFilters } from "../filters";
import type { TaskFormOptions } from "../queries";

/**
 * Editor, client, project, status, priority and due-date filters plus a
 * title search. Every change updates the URL; the page re-renders on the
 * server with the matching tasks.
 */
export function TaskFilterBar({
  filters,
  options,
  onChange,
  hide = [],
}: {
  filters: TaskFilters;
  options: TaskFormOptions;
  onChange: (patch: Partial<TaskFilters>) => void;
  /** Filters that don't apply to the current view. */
  hide?: ("status" | "due")[];
}) {
  const [query, setQuery] = React.useState(filters.q);
  const [expanded, setExpanded] = React.useState(false);
  const count = activeFilterCount(filters);

  // Keep the box in step with the URL (back button, "Clear").
  const [syncedQ, setSyncedQ] = React.useState(filters.q);
  if (filters.q !== syncedQ) {
    setSyncedQ(filters.q);
    setQuery(filters.q);
  }

  // Search after a short pause in typing.
  const onChangeRef = React.useRef(onChange);
  React.useEffect(() => {
    onChangeRef.current = onChange;
  });
  React.useEffect(() => {
    if (query.trim() === filters.q) return;
    const timeout = setTimeout(() => onChangeRef.current({ q: query.trim() }), 300);
    return () => clearTimeout(timeout);
  }, [query, filters.q]);

  const clients = [...new Map(options.projects.map((p) => [p.clientId, p.clientName])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const projects = options.projects.filter((p) => !filters.client || p.clientId === filters.client);
  const editors = options.editors.filter((e) => e.isActive || e.id === filters.editor);

  const select = "h-9 w-full rounded-lg bg-card sm:w-auto sm:min-w-36";

  return (
    <div className="mb-5 grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-72">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search tasks"
            aria-label="Search tasks"
            className="h-9 rounded-full bg-card pl-9"
          />
        </div>
        <Button
          variant="outline"
          className="sm:hidden"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-controls="task-filters"
        >
          <SlidersHorizontalIcon /> Filters{count > 0 && ` · ${count}`}
        </Button>
        {count > 0 && (
          <Button
            variant="ghost"
            className="hidden text-muted-foreground sm:inline-flex"
            onClick={() => onChange({ editor: null, client: null, project: null, status: null, priority: null, due: null, q: "" })}
          >
            <XIcon /> Clear filters
          </Button>
        )}
      </div>

      <div id="task-filters" className={cn("grid grid-cols-2 gap-2 sm:flex sm:flex-wrap", !expanded && "hidden sm:flex")}>
        <NativeSelect
          aria-label="Editor"
          className={select}
          value={filters.editor ?? ""}
          onChange={(event) => onChange({ editor: event.target.value || null })}
        >
          <option value="">All editors</option>
          <option value="none">Unassigned</option>
          {editors.map((editor) => (
            <option key={editor.id} value={editor.id}>
              {editor.name}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label="Client"
          className={select}
          value={filters.client ?? ""}
          onChange={(event) => onChange({ client: event.target.value || null, project: null })}
        >
          <option value="">All clients</option>
          {clients.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label="Project"
          className={select}
          value={filters.project ?? ""}
          onChange={(event) => onChange({ project: event.target.value || null })}
        >
          <option value="">All projects</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {filters.client ? project.name : `${project.clientName} · ${project.name}`}
            </option>
          ))}
        </NativeSelect>
        {!hide.includes("status") && (
          <NativeSelect
            aria-label="Status"
            className={select}
            value={filters.status ?? ""}
            onChange={(event) => onChange({ status: (event.target.value || null) as TaskFilters["status"] })}
          >
            <option value="">Any status</option>
            {TASK_STATUSES.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </NativeSelect>
        )}
        <NativeSelect
          aria-label="Priority"
          className={select}
          value={filters.priority ?? ""}
          onChange={(event) => onChange({ priority: (event.target.value || null) as TaskFilters["priority"] })}
        >
          <option value="">Any priority</option>
          {TASK_PRIORITIES.map((priority) => (
            <option key={priority.value} value={priority.value}>
              {priority.label}
            </option>
          ))}
        </NativeSelect>
        {!hide.includes("due") && (
          <NativeSelect
            aria-label="Due date"
            className={select}
            value={filters.due ?? ""}
            onChange={(event) => onChange({ due: (event.target.value || null) as TaskFilters["due"] })}
          >
            <option value="">Any due date</option>
            {DUE_FILTERS.map((due) => (
              <option key={due.value} value={due.value}>
                {due.label}
              </option>
            ))}
          </NativeSelect>
        )}
        {count > 0 && (
          <Button
            variant="ghost"
            className="text-muted-foreground sm:hidden"
            onClick={() => onChange({ editor: null, client: null, project: null, status: null, priority: null, due: null, q: "" })}
          >
            <XIcon /> Clear
          </Button>
        )}
      </div>
    </div>
  );
}
