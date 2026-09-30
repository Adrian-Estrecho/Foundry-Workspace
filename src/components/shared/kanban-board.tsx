"use client";

import * as React from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  getFirstCollision,
  pointerWithin,
  rectIntersection,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";

/**
 * Generic drag-and-drop board used by the client pipeline, the applicant
 * pipeline and the task board. Items move optimistically; `onMove` persists
 * and the board rolls back if it fails. Mouse, touch (press and hold) and
 * keyboard (space to pick up, arrows to move) all work.
 */

export type KanbanItem = { id: string; column: string; position: number };
export type KanbanColumn = {
  id: string;
  label: string;
  dot?: string;
  /** Replaces the dot, e.g. an avatar on the By Editor board. */
  icon?: React.ReactNode;
  /** Extra detail after the count, e.g. "2 overdue". */
  meta?: React.ReactNode;
  /** Button shown at the right of the header, e.g. "Add task". */
  action?: React.ReactNode;
};

type Board<T> = Record<string, T[]>;

const COLUMN_PREFIX = "column:";

type KeyHandler = (typeof KeyboardSensor.activators)[number]["handler"];

/**
 * Keyboard dragging only when the card itself has focus, so Enter/Space on
 * a link or button inside the card still does what it normally does.
 */
class CardKeyboardSensor extends KeyboardSensor {
  static activators: typeof KeyboardSensor.activators = [
    {
      eventName: "onKeyDown",
      handler: (...args: Parameters<KeyHandler>) =>
        args[0].target === args[0].currentTarget && KeyboardSensor.activators[0].handler(...args),
    },
  ];
}

/** Position that sorts between two neighbours (either may be missing). */
export function positionBetween(before?: number, after?: number) {
  if (before === undefined && after === undefined) return 0;
  if (before === undefined) return after! - 1;
  if (after === undefined) return before + 1;
  return (before + after) / 2;
}

function toBoard<T extends KanbanItem>(columns: KanbanColumn[], items: T[]): Board<T> {
  const board: Board<T> = Object.fromEntries(columns.map((c) => [c.id, [] as T[]]));
  for (const item of items) (board[item.column] ??= []).push(item);
  for (const list of Object.values(board)) list.sort((a, b) => a.position - b.position);
  return board;
}

function columnOf<T extends KanbanItem>(board: Board<T>, id: UniqueIdentifier) {
  const key = String(id);
  if (key.startsWith(COLUMN_PREFIX)) return key.slice(COLUMN_PREFIX.length);
  return Object.keys(board).find((column) => board[column].some((item) => item.id === key));
}

export function KanbanBoard<T extends KanbanItem>({
  columns,
  items,
  renderCard,
  onMove,
  itemLabel,
  emptyText = "Drop here",
  ariaLabel,
  scrollbarAtWindowBottom = false,
  trailing,
}: {
  columns: KanbanColumn[];
  items: T[];
  renderCard: (item: T, state: { overlay: boolean }) => React.ReactNode;
  /** Persist the move; resolve `false` to roll it back. */
  onMove: (item: T, column: string, position: number) => Promise<boolean>;
  /** Human name for screen-reader announcements. */
  itemLabel: (item: T) => string;
  emptyText?: string;
  ariaLabel: string;
  /** Keep the scrollbar on the bottom edge of the window. Only for boards that end the page. */
  scrollbarAtWindowBottom?: boolean;
  /** After the last column, e.g. "Add status". */
  trailing?: React.ReactNode;
}) {
  const [board, setBoard] = React.useState(() => toBoard(columns, items));
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [syncedItems, setSyncedItems] = React.useState(items);
  const columnKey = columns.map((c) => c.id).join();
  const [syncedColumns, setSyncedColumns] = React.useState(columnKey);
  // New server data (refresh, realtime) or columns replace local state, but never mid-drag.
  if ((items !== syncedItems || columnKey !== syncedColumns) && activeId === null) {
    setSyncedItems(items);
    setSyncedColumns(columnKey);
    setBoard(toBoard(columns, items));
  }

  // Stable id so dnd-kit's accessibility ids match between server and client.
  const dndId = React.useId();
  const boardRef = React.useRef<HTMLDivElement>(null);
  const beforeDrag = React.useRef<Board<T> | null>(null);
  const suppressClick = React.useRef(false);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(CardKeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const findItem = (id: UniqueIdentifier, from: Board<T> = board) =>
    Object.values(from)
      .flat()
      .find((item) => item.id === String(id));
  const columnLabel = (id: string | undefined) => columns.find((c) => c.id === id)?.label ?? "";

  const onDragStart = ({ active }: DragStartEvent) => {
    beforeDrag.current = board;
    lastOverId.current = null;
    suppressClick.current = true;
    setActiveId(String(active.id));
  };

  /**
   * What the card is over: whatever is under the pointer (or overlapping,
   * for keyboard drags), narrowed to the nearest card inside a column. Right
   * after a card jumps to a new column the layout hasn't settled, so the last
   * target is kept; otherwise two columns can keep handing the card back and
   * forth (dnd-kit's multi-container recipe).
   */
  const lastOverId = React.useRef<UniqueIdentifier | null>(null);
  const recentlyMoved = React.useRef(false);
  React.useEffect(() => {
    const frame = requestAnimationFrame(() => (recentlyMoved.current = false));
    return () => cancelAnimationFrame(frame);
  }, [board]);

  const collisionDetection: CollisionDetection = (args) => {
    const underPointer = pointerWithin(args);
    let overId = getFirstCollision(underPointer.length > 0 ? underPointer : rectIntersection(args), "id");
    if (overId != null) {
      const key = String(overId);
      if (key.startsWith(COLUMN_PREFIX)) {
        const cards = new Set((board[key.slice(COLUMN_PREFIX.length)] ?? []).map((item) => item.id));
        if (cards.size > 0) {
          overId =
            closestCenter({ ...args, droppableContainers: args.droppableContainers.filter((c) => cards.has(String(c.id))) })[0]?.id ??
            overId;
        }
      }
      lastOverId.current = overId;
      return [{ id: overId }];
    }
    if (recentlyMoved.current) lastOverId.current = activeId;
    return lastOverId.current != null ? [{ id: lastOverId.current }] : [];
  };

  // Crossing into another column: move the card there straight away so the
  // column opens a gap for it.
  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return;
    if (columnOf(board, active.id) !== columnOf(board, over.id)) recentlyMoved.current = true;
    setBoard((previous) => {
      const from = columnOf(previous, active.id);
      const to = columnOf(previous, over.id);
      if (!from || !to || from === to) return previous;
      const moving = previous[from].find((item) => item.id === String(active.id));
      if (!moving) return previous;
      const target = previous[to];
      const overIndex = target.findIndex((item) => item.id === String(over.id));
      const index = overIndex >= 0 ? overIndex : target.length;
      return {
        ...previous,
        [from]: previous[from].filter((item) => item.id !== moving.id),
        [to]: [...target.slice(0, index), moving, ...target.slice(index)],
      };
    });
  };

  const finish = () => {
    setActiveId(null);
    // The browser fires a click after the drop; don't let it open the card.
    setTimeout(() => (suppressClick.current = false), 150);
  };

  const onDragCancel = () => {
    if (beforeDrag.current) setBoard(beforeDrag.current);
    beforeDrag.current = null;
    finish();
  };

  const onDragEnd = async ({ active, over }: DragEndEvent) => {
    const before = beforeDrag.current;
    beforeDrag.current = null;
    finish();
    if (!before) return;
    if (!over) {
      setBoard(before);
      return;
    }

    const column = columnOf(board, active.id);
    const original = findItem(active.id, before);
    if (!column || !original) return;

    let list = board[column];
    const oldIndex = list.findIndex((item) => item.id === original.id);
    const overIndex = String(over.id).startsWith(COLUMN_PREFIX)
      ? list.length - 1
      : list.findIndex((item) => item.id === String(over.id));
    if (overIndex >= 0 && overIndex !== oldIndex) list = arrayMove(list, oldIndex, overIndex);

    const index = list.findIndex((item) => item.id === original.id);
    const unchanged =
      original.column === column && before[column].findIndex((item) => item.id === original.id) === index;
    if (unchanged) {
      setBoard(before);
      return;
    }

    const position = positionBetween(list[index - 1]?.position, list[index + 1]?.position);
    const moved = { ...original, column, position };
    setBoard({ ...board, [column]: list.map((item) => (item.id === moved.id ? moved : item)) });

    if (!(await onMove(original, column, position))) setBoard(before);
  };

  const announcements: Announcements = {
    onDragStart: ({ active }) => {
      const item = findItem(active.id);
      return item ? `Picked up ${itemLabel(item)} in ${columnLabel(columnOf(board, active.id))}.` : "";
    },
    onDragOver: ({ active, over }) => {
      const item = findItem(active.id);
      return item && over ? `${itemLabel(item)} is over ${columnLabel(columnOf(board, over.id))}.` : "";
    },
    onDragEnd: ({ active, over }) => {
      const item = findItem(active.id);
      return item && over ? `Moved ${itemLabel(item)} to ${columnLabel(columnOf(board, over.id))}.` : "";
    },
    onDragCancel: ({ active }) => {
      const item = findItem(active.id);
      return item ? `Cancelled. ${itemLabel(item)} stays where it was.` : "";
    },
  };

  const activeItem = activeId ? findItem(activeId) : undefined;

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable: "Press space to pick up the card, arrow keys to move it, space again to drop, or escape to cancel.",
        },
      }}
    >
      <div>
        <div
          ref={boardRef}
          role="region"
          aria-label={ariaLabel}
          onClickCapture={(event) => {
            if (suppressClick.current) {
              event.preventDefault();
              event.stopPropagation();
            }
          }}
          className="-mx-4 flex snap-x snap-mandatory items-start gap-4 overflow-x-auto px-4 pb-6 sm:-mx-6 sm:px-6 lg:mx-0 lg:snap-none lg:px-0 lg:scrollbar-none"
        >
          {columns.map((column) => (
            <Column key={column.id} column={column} items={board[column.id] ?? []} emptyText={emptyText}>
              {(board[column.id] ?? []).map((item) => (
                <SortableCard key={item.id} id={item.id}>
                  {renderCard(item, { overlay: false })}
                </SortableCard>
              ))}
            </Column>
          ))}
          {trailing}
        </div>
        <PinnedScrollbar board={boardRef} columnCount={columns.length} atWindowBottom={scrollbarAtWindowBottom} />
      </div>
      <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.2, 0, 0, 1)" }}>
        {activeItem ? <div className="rotate-2 cursor-grabbing rounded-xl shadow-lg">{renderCard(activeItem, { overlay: true })}</div> : null}
      </DragOverlay>
    </DndContext>
  );
}

/**
 * The board's horizontal scrollbar, pinned to the bottom of the screen rather
 * than sitting under the tallest column. It mirrors the board's scroll
 * position both ways. Below lg the board snaps and keeps its own scrollbar.
 *
 * By default it settles under the board once the board's end is on screen;
 * `atWindowBottom` keeps it on the window's bottom edge, lined up with the board.
 */
function PinnedScrollbar({
  board,
  columnCount,
  atWindowBottom,
}: {
  board: React.RefObject<HTMLDivElement | null>;
  columnCount: number;
  atWindowBottom: boolean;
}) {
  const bar = React.useRef<HTMLDivElement>(null);
  const track = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const content = board.current;
    const scroller = bar.current;
    if (!content || !scroller || !track.current) return;
    const inner = track.current;

    const measure = () => {
      if (atWindowBottom) {
        const { left, width } = content.getBoundingClientRect();
        scroller.style.left = `${left}px`;
        scroller.style.width = `${width}px`;
      }
      inner.style.width = `${content.scrollWidth}px`;
      scroller.hidden = content.scrollWidth <= content.clientWidth + 1;
      scroller.scrollLeft = content.scrollLeft;
    };
    // The 1px slack stops fractional scroll positions bouncing between the two.
    const follow = (from: HTMLElement, to: HTMLElement) => () => {
      if (Math.abs(to.scrollLeft - from.scrollLeft) > 1) to.scrollLeft = from.scrollLeft;
    };
    const fromBoard = follow(content, scroller);
    const fromBar = follow(scroller, content);

    const observer = new ResizeObserver(measure);
    observer.observe(content);
    for (const column of content.children) observer.observe(column);
    content.addEventListener("scroll", fromBoard, { passive: true });
    scroller.addEventListener("scroll", fromBar, { passive: true });
    return () => {
      observer.disconnect();
      content.removeEventListener("scroll", fromBoard);
      scroller.removeEventListener("scroll", fromBar);
    };
  }, [board, columnCount, atWindowBottom]);

  return (
    <div
      ref={bar}
      aria-hidden="true"
      tabIndex={-1}
      className={cn(
        "bottom-0 hidden overflow-x-auto bg-background lg:block",
        atWindowBottom ? "fixed z-20" : "sticky z-10",
      )}
    >
      <div ref={track} className="h-px" />
    </div>
  );
}

function Column<T extends KanbanItem>({
  column,
  items,
  emptyText,
  children,
}: {
  column: KanbanColumn;
  items: T[];
  emptyText: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: COLUMN_PREFIX + column.id });

  return (
    <section aria-label={column.label} className="flex w-[82vw] max-w-80 shrink-0 snap-start flex-col sm:w-72">
      <header className="px-1 pb-3">
        <div className="flex min-h-7 items-center gap-2">
          {column.icon ?? <span className={cn("size-2 shrink-0 rounded-full", column.dot ?? "bg-muted-foreground")} />}
          <h2 className="truncate text-sm font-medium">{column.label}</h2>
          <span className="text-sm text-muted-foreground tabular">{items.length}</span>
          {column.action && <span className="ml-auto">{column.action}</span>}
        </div>
        {column.meta && <div className="mt-0.5 min-h-4 truncate pl-8 text-xs">{column.meta}</div>}
      </header>
      <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={cn(
            "-mx-1 flex min-h-28 flex-1 flex-col gap-2 rounded-xl p-1 transition-colors",
            isOver && "bg-accent/60",
          )}
        >
          {children}
          {items.length === 0 && (
            <div className="grid flex-1 place-items-center rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
              {emptyText}
            </div>
          )}
        </div>
      </SortableContext>
    </section>
  );
}

function SortableCard({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isDragging && "opacity-35",
      )}
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  );
}
