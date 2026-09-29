"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { formatTimecode } from "./timecode";

type Drag = { x: number; time: number; moved: boolean; animation: Animation };

/**
 * Makes the timeline hands-on. Drag it to scrub (playback pauses while you
 * hold it), hover to see the timecode under the pointer, click a clip to
 * select it. It drives the strip's own CSS animation, so the playhead and
 * its timecode follow along. With reduced motion there's nothing to drive.
 */
export function Scrubber({
  pxPerSecond,
  loopSeconds,
  children,
}: {
  pxPerSecond: number;
  loopSeconds: number;
  children: React.ReactNode;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const hover = React.useRef<HTMLDivElement>(null);
  const hoverLabel = React.useRef<HTMLSpanElement>(null);
  const drag = React.useRef<Drag | null>(null);
  const pointerX = React.useRef<number | null>(null);
  const frame = React.useRef(0);
  const [dragging, setDragging] = React.useState(false);
  const loopMs = loopSeconds * 1000;

  const animation = React.useCallback(() => {
    const found = ref.current?.querySelector("[data-timeline-strip]")?.getAnimations()[0];
    return found && typeof found.currentTime === "number" ? found : null;
  }, []);

  /** The time under a point of the timeline (the playhead sits at its centre). */
  const timeAt = (clientX: number, animation: Animation) => {
    const rect = ref.current!.getBoundingClientRect();
    const offset = clientX - (rect.left + rect.width / 2);
    return wrap((animation.currentTime as number) + (offset / pxPerSecond) * 1000, loopMs);
  };

  // While hovered, keep the hover line and its timecode current (the strip plays under it).
  const follow = () => {
    const x = pointerX.current;
    const found = animation();
    if (x !== null && found && ref.current && hover.current && hoverLabel.current) {
      hover.current.style.transform = `translateX(${x - ref.current.getBoundingClientRect().left}px)`;
      hoverLabel.current.textContent = formatTimecode(timeAt(x, found));
      frame.current = requestAnimationFrame(follow);
    }
  };
  React.useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const release = () => {
    drag.current?.animation.play();
    drag.current = null;
    setDragging(false);
  };

  return (
    <div
      ref={ref}
      className={cn(
        "group/scrub relative touch-pan-y motion-safe:cursor-grab",
        dragging && "motion-safe:cursor-grabbing",
      )}
      onPointerEnter={(event) => {
        if (!animation()) return;
        pointerX.current = event.clientX;
        cancelAnimationFrame(frame.current);
        follow();
      }}
      onPointerLeave={() => {
        pointerX.current = null;
        cancelAnimationFrame(frame.current);
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        const found = animation();
        if (!found) return;
        found.pause();
        drag.current = { x: event.clientX, time: found.currentTime as number, moved: false, animation: found };
        event.currentTarget.setPointerCapture(event.pointerId);
        setDragging(true);
      }}
      onPointerMove={(event) => {
        pointerX.current = event.clientX;
        const current = drag.current;
        if (!current) return;
        const dx = event.clientX - current.x;
        if (Math.abs(dx) > 3) current.moved = true;
        // The film moves with the pointer: dragging right goes back in time.
        current.animation.currentTime = wrap(current.time - (dx / pxPerSecond) * 1000, loopMs);
      }}
      onPointerUp={(event) => {
        if (drag.current && !drag.current.moved) selectClipAt(ref.current!, event.clientX, event.clientY);
        release();
      }}
      onPointerCancel={release}
    >
      {children}
      {/* Hover line with the timecode under the pointer */}
      <div
        ref={hover}
        className="pointer-events-none absolute inset-y-0 left-0 w-px bg-foreground/50 opacity-0 transition-opacity group-hover/scrub:opacity-100"
      >
        <span
          ref={hoverLabel}
          className="tabular absolute top-1 left-1 rounded-sm bg-foreground px-1 py-0.5 font-mono text-[10px] leading-none text-background"
        />
      </div>
    </div>
  );
}

const wrap = (ms: number, loopMs: number) => ((ms % loopMs) + loopMs) % loopMs;

/**
 * Clicking a clip selects it (click again to let go); one at a time. The
 * `data-selected:` variant matches `data-selected="true"` in this project.
 */
function selectClipAt(timeline: HTMLElement, x: number, y: number) {
  const clip = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-clip]");
  const wasSelected = clip?.hasAttribute("data-selected");
  for (const selected of timeline.querySelectorAll("[data-selected]")) selected.removeAttribute("data-selected");
  if (clip && !wasSelected) clip.setAttribute("data-selected", "true");
}
