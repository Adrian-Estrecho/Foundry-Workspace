"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon, PlusIcon } from "lucide-react";
import { EmptyState } from "@/components/shared/panel";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDay } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { rescheduleTask } from "../actions";
import { monthGrid, monthLabel, shiftMonth } from "../calendar";
import { priorityRank, taskStatusMeta } from "../constants";
import type { TaskSummary } from "../queries";
import { PriorityFlag, TaskStatusChip } from "./task-bits";
import { taskContext } from "./task-card";
import { taskHref } from "./task-menu";
import { useTaskWorkspace } from "./task-workspace";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const VISIBLE_PER_DAY = 3;
const DAY_PREFIX = "day:";

/**
 * Month calendar by due date. Admins drag a task to another day to
 * reschedule it, or use + on a day to add one. Phones get a day-by-day
 * agenda instead of the grid.
 */
export function TaskCalendar({
  tasks,
  month,
  onMonthChange,
}: {
  tasks: TaskSummary[];
  month: string;
  onMonthChange: (month: string) => void;
}) {
  const router = useRouter();
  const workspace = useTaskWorkspace();
  const grid = monthGrid(month);

  // Optimistic due dates while a reschedule saves; cleared when fresh data arrives.
  const [moved, setMoved] = React.useState<Record<string, string>>({});
  const [synced, setSynced] = React.useState(tasks);
  if (synced !== tasks) {
    setSynced(tasks);
    setMoved({});
  }
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const suppressClick = React.useRef(false);

  const byDay = React.useMemo(() => {
    const map = new Map<string, TaskSummary[]>();
    for (const task of tasks) {
      const day = moved[task.id] ?? task.dueDate;
      if (!day) continue;
      map.set(day, [...(map.get(day) ?? []), task]);
    }
    for (const list of map.values()) {
      list.sort((a, b) => Number(a.status === "done") - Number(b.status === "done") || priorityRank(b.priority) - priorityRank(a.priority));
    }
    return map;
  }, [tasks, moved]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
  );

  const onDragEnd = async ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    setTimeout(() => (suppressClick.current = false), 150);
    if (!over) return;
    const task = tasks.find((t) => t.id === String(active.id));
    const day = String(over.id).slice(DAY_PREFIX.length);
    if (!task || day === (moved[task.id] ?? task.dueDate)) return;

    setMoved((m) => ({ ...m, [task.id]: day }));
    const result = await rescheduleTask(task.id, day);
    if (!result.ok) {
      toast.error(result.error);
      setMoved((m) => Object.fromEntries(Object.entries(m).filter(([id]) => id !== task.id)));
      return;
    }
    toast.success(`${task.title} is now due ${formatDay(day)}`);
    router.refresh();
  };

  const dndId = React.useId();
  const activeTask = activeId ? tasks.find((t) => t.id === activeId) : undefined;
  const monthDays = grid.days.filter((day) => day >= grid.first && day <= grid.last);
  const agendaDays = monthDays.filter((day) => byDay.has(day) || day === workspace.today);

  return (
    <section aria-label={`Calendar, ${monthLabel(month)}`}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="mr-auto font-heading text-lg font-medium">{monthLabel(month)}</h2>
        <Button variant="outline" size="sm" onClick={() => onMonthChange(workspace.today.slice(0, 7))}>
          Today
        </Button>
        <Button variant="outline" size="icon-sm" onClick={() => onMonthChange(shiftMonth(month, -1))} aria-label="Previous month">
          <ChevronLeftIcon />
        </Button>
        <Button variant="outline" size="icon-sm" onClick={() => onMonthChange(shiftMonth(month, 1))} aria-label="Next month">
          <ChevronRightIcon />
        </Button>
      </div>

      {/* Grid (tablet and up) */}
      <DndContext
        id={dndId}
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={({ active }) => {
          suppressClick.current = true;
          setActiveId(String(active.id));
        }}
        onDragCancel={() => {
          setActiveId(null);
          suppressClick.current = false;
        }}
        onDragEnd={onDragEnd}
      >
        <div
          className="hidden overflow-hidden rounded-xl border bg-card md:block"
          onClickCapture={(event) => {
            if (suppressClick.current) {
              event.preventDefault();
              event.stopPropagation();
            }
          }}
        >
          <div className="grid grid-cols-7 border-b text-xs text-muted-foreground">
            {WEEKDAYS.map((day) => (
              <div key={day} className="px-2 py-2 font-medium">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 [&>*:nth-child(7n)]:border-r-0">
            {grid.days.map((day) => (
              <DayCell
                key={day}
                day={day}
                inMonth={day >= grid.first && day <= grid.last}
                isToday={day === workspace.today}
                tasks={byDay.get(day) ?? []}
              />
            ))}
          </div>
        </div>
        <DragOverlay dropAnimation={null}>{activeTask ? <ChipBody task={activeTask} today={workspace.today} overlay /> : null}</DragOverlay>
      </DndContext>

      {/* Agenda (phones) */}
      <div className="md:hidden">
        {!monthDays.some((day) => byDay.has(day)) ? (
          <div className="rounded-xl border bg-card">
            <EmptyState icon={CalendarDaysIcon} title="Nothing due this month" description="Tasks with a due date show up here." />
          </div>
        ) : (
          <ol className="grid grid-cols-1 gap-4">
            {agendaDays.map((day) => (
              <li key={day}>
                <p className={cn("mb-1.5 px-1 text-sm font-medium", day === workspace.today && "text-primary")}>
                  {formatDay(day, { weekday: "long", month: "short", day: "numeric" })}
                  {day === workspace.today && " · Today"}
                </p>
                {byDay.has(day) ? (
                  <ul className="grid grid-cols-1 gap-1.5">
                    {byDay.get(day)!.map((task) => (
                      <li key={task.id}>
                        <Link
                          href={taskHref(task, workspace.isAdmin)}
                          className="flex items-center gap-3 rounded-lg bg-card px-3 py-2.5 ring-1 ring-border hover:bg-accent/50"
                        >
                          <span className="min-w-0 flex-1">
                            <span className={cn("block truncate text-sm font-medium", task.status === "done" && "text-muted-foreground line-through")}>
                              {task.title}
                            </span>
                            <span className="flex items-center gap-2 truncate text-xs text-muted-foreground">
                              <PriorityFlag priority={task.priority} /> <span className="truncate">{taskContext(task)}</span>
                            </span>
                          </span>
                          {task.assignee && <UserAvatar name={task.assignee.name} src={task.assignee.avatarUrl} className="size-6" />}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-1 text-sm text-muted-foreground">Nothing due.</p>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

function DayCell({ day, inMonth, isToday, tasks }: { day: string; inMonth: boolean; isToday: boolean; tasks: TaskSummary[] }) {
  const workspace = useTaskWorkspace();
  const { setNodeRef, isOver } = useDroppable({ id: DAY_PREFIX + day, disabled: !workspace.isAdmin });
  const hidden = tasks.length - VISIBLE_PER_DAY;
  const label = formatDay(day, { weekday: "long", month: "long", day: "numeric" });

  return (
    <div
      ref={setNodeRef}
      aria-label={label}
      className={cn(
        "group/day flex min-h-32 min-w-0 flex-col gap-1 border-r border-b p-1.5 transition-colors",
        !inMonth && "bg-surface",
        isOver && "bg-accent/70",
      )}
    >
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "grid size-6 place-items-center rounded-full text-xs tabular",
            isToday && "bg-primary font-semibold text-primary-foreground",
            !inMonth && !isToday && "text-muted-foreground/60",
          )}
        >
          {Number(day.slice(8))}
        </span>
        {workspace.isAdmin && (
          <Button
            variant="ghost"
            size="icon-xs"
            className="rounded-full text-muted-foreground opacity-0 group-hover/day:opacity-100 focus-visible:opacity-100"
            aria-label={`New task due ${label}`}
            onClick={() => workspace.newTask({ dueDate: day })}
          >
            <PlusIcon />
          </Button>
        )}
      </div>
      {tasks.slice(0, VISIBLE_PER_DAY).map((task) => (
        <CalendarChip key={task.id} task={task} />
      ))}
      {hidden > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <button type="button" className="rounded px-1.5 text-left text-xs text-muted-foreground hover:text-foreground">
              +{hidden} more
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 p-2">
            <p className="px-1.5 pb-1.5 text-xs font-medium text-muted-foreground">{label}</p>
            <ul className="grid grid-cols-1 gap-1">
              {tasks.map((task) => (
                <li key={task.id}>
                  <Link
                    href={taskHref(task, workspace.isAdmin)}
                    className="flex items-center gap-2 rounded-md px-1.5 py-1.5 text-sm hover:bg-accent"
                  >
                    <span className="min-w-0 flex-1 truncate">{task.title}</span>
                    <TaskStatusChip status={task.status} />
                  </Link>
                </li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

function CalendarChip({ task }: { task: TaskSummary }) {
  const workspace = useTaskWorkspace();
  const { listeners, setNodeRef, isDragging } = useDraggable({ id: task.id, disabled: !workspace.isAdmin });
  return (
    <Link ref={setNodeRef} href={taskHref(task, workspace.isAdmin)} draggable={false} className={cn("block rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring", isDragging && "opacity-35")} {...listeners}>
      <ChipBody task={task} today={workspace.today} />
    </Link>
  );
}

function ChipBody({ task, today, overlay }: { task: TaskSummary; today: string; overlay?: boolean }) {
  const done = task.status === "done";
  const overdue = !done && task.dueDate !== null && task.dueDate < today;
  return (
    <span
      className={cn(
        "flex min-w-0 items-center gap-1.5 rounded-md bg-surface px-1.5 py-1 text-xs ring-1 ring-border transition-colors hover:bg-accent",
        overdue && "text-danger ring-danger/30",
        done && "text-muted-foreground",
        overlay && "w-44 cursor-grabbing bg-popover shadow-lg",
      )}
      title={`${task.title} · ${taskStatusMeta(task.status).label}${task.assignee ? ` · ${task.assignee.name}` : ""}`}
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", taskStatusMeta(task.status).dot)} />
      <span className={cn("truncate", done && "line-through decoration-muted-foreground/40")}>{task.title}</span>
    </span>
  );
}
