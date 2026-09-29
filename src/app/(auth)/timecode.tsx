"use client";

import * as React from "react";

const FPS = 24;
const pad = (value: number) => String(value).padStart(2, "0");

/** HH:MM:SS:FF at 24 frames a second. */
export function formatTimecode(ms: number) {
  const seconds = Math.floor(ms / 1000);
  return `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor(seconds / 60) % 60)}:${pad(seconds % 60)}:${pad(Math.floor((ms / 1000) * FPS) % FPS)}`;
}

/**
 * The playhead's timecode. Reads the timeline strip's own animation clock,
 * so it always matches the ruler under the playhead, scrubbing included.
 * Written straight to the DOM: no re-render per frame.
 */
export function Timecode({ loopSeconds }: { loopSeconds: number }) {
  const ref = React.useRef<HTMLSpanElement>(null);

  React.useEffect(() => {
    const strip = ref.current?.closest("[data-timeline]")?.querySelector("[data-timeline-strip]");
    if (!strip || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    const tick = () => {
      const time = strip.getAnimations()[0]?.currentTime;
      if (ref.current) ref.current.textContent = formatTimecode(typeof time === "number" ? time % (loopSeconds * 1000) : 0);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [loopSeconds]);

  return <span ref={ref}>00:00:00:00</span>;
}
