"use client";

import { ListFilterIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type StatusFilterOption = {
  id: string;
  label: string;
  /** Colour class for the dot, as on a board column. */
  dot?: string;
  count?: number;
};

/**
 * Pick which statuses to show; nothing ticked means all of them. The menu
 * stays open while ticking, so several can be chosen in one go.
 */
export function StatusFilter({
  options,
  value,
  onChange,
  noun = "statuses",
  className,
}: {
  options: StatusFilterOption[];
  /** Ticked ids. Ids that aren't in `options` are ignored. */
  value: string[];
  onChange: (value: string[]) => void;
  /** Plural, e.g. "stages": "All stages", "3 stages". */
  noun?: string;
  className?: string;
}) {
  const selected = options.filter((option) => value.includes(option.id));
  const toggle = (id: string, checked: boolean) =>
    onChange(options.filter((option) => (option.id === id ? checked : value.includes(option.id))).map((option) => option.id));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className={cn("h-9 max-w-full rounded-lg bg-card", selected.length > 0 && "border-primary/50", className)}>
          <ListFilterIcon className="text-muted-foreground" />
          {selected.length === 1 && selected[0].dot && <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", selected[0].dot)} />}
          <span className="truncate">
            {selected.length === 0 ? `All ${noun}` : selected.length === 1 ? selected[0].label : `${selected.length} ${noun}`}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-96 w-60 overflow-y-auto rounded-2xl">
        <DropdownMenuLabel>Show {noun}</DropdownMenuLabel>
        {options.map((option) => (
          <DropdownMenuCheckboxItem
            key={option.id}
            checked={value.includes(option.id)}
            onCheckedChange={(checked) => toggle(option.id, checked)}
            onSelect={(event) => event.preventDefault()}
          >
            {option.dot && <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", option.dot)} />}
            <span className="truncate">{option.label}</span>
            {option.count !== undefined && <span className="ml-auto text-xs text-muted-foreground tabular">{option.count}</span>}
          </DropdownMenuCheckboxItem>
        ))}
        {selected.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onChange([])}>Show all {noun}</DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
