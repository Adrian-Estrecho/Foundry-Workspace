import type * as React from "react";
import { cn } from "@/lib/utils";
import { Scrubber } from "./scrubber";
import { Timecode } from "./timecode";

/** Timeline scale: 24px per second, a two-minute cut that loops. */
const PX = 24;
const LOOP = 120;
const COPIES = 3;

type Clip = { at: number; len: number; label?: string; accent?: boolean };

/** `extra` tracks give way on short screens, so the page fits without scrolling. */
const TRACKS: { kind: "video" | "audio"; extra?: boolean; clips: Clip[] }[] = [
  // V2: titles and graphics
  {
    kind: "video",
    extra: true,
    clips: [
      { at: 3, len: 9, label: "Title" },
      { at: 31, len: 12, label: "Lower third" },
      { at: 58, len: 7, label: "Logo sting" },
      { at: 84, len: 15, label: "Captions" },
    ],
  },
  // V1: the edit
  {
    kind: "video",
    clips: [
      { at: 0, len: 21.5, label: "Interview_A.mov" },
      { at: 22, len: 13.5, label: "B-roll_city.mp4" },
      { at: 36, len: 26, label: "Interview_B.mov", accent: true },
      { at: 62.5, len: 11, label: "Product_03.mp4" },
      { at: 74, len: 27.5, label: "Interview_A.mov" },
      { at: 102, len: 17.5, label: "Outro.mov" },
    ],
  },
  // A1: dialogue
  {
    kind: "audio",
    clips: [
      { at: 0, len: 21.5 },
      { at: 36, len: 26 },
      { at: 74, len: 27.5 },
    ],
  },
  // A2: music
  {
    kind: "audio",
    extra: true,
    clips: [
      { at: 0, len: 57.5, label: "Score_v2.wav" },
      { at: 60, len: 59.5, label: "Score_v2.wav" },
    ],
  },
];

/** A strip of waveform bars, used as a mask so the bars take the theme's colour. */
const WAVEFORM = (() => {
  const bars = Array.from({ length: 80 }, (_, i) => {
    const swell = (Math.sin((i / 80) * Math.PI * 4) + 1) / 2;
    const noise = Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
    const height = Math.max(2, Math.round((0.2 + 0.45 * swell + 0.35 * noise) * 16));
    return `<rect x='${i * 3}' y='${(16 - height) / 2}' width='2' height='${height}' rx='1'/>`;
  }).join("");
  return `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='240' height='16'>${bars}</svg>`)}")`;
})();

const TICK = "color-mix(in oklch, var(--muted-foreground) 45%, transparent)";

const timecode = (seconds: number) =>
  `00:${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}:00`;

/**
 * The auth pages' backdrop: an editing timeline that plays under a fixed
 * playhead. Three copies of the cut sit side by side and the strip slides
 * one copy's width per loop, so it never runs out on either side. People
 * can scrub it and select clips (see Scrubber).
 */
export function Timeline({ className }: { className?: string }) {
  const loopWidth = LOOP * PX;
  const copies = Array.from({ length: COPIES }, (_, copy) => copy * loopWidth);

  return (
    <div data-timeline aria-hidden="true" className={cn("relative mt-9 select-none", className)}>
      <Scrubber pxPerSecond={PX} loopSeconds={LOOP}>
        <div className="overflow-hidden [mask-image:linear-gradient(to_right,transparent,#000_18%,#000_82%,transparent)]">
          <div
            data-timeline-strip
            className="animate-timeline will-change-transform motion-reduce:animate-none"
            style={
              {
                width: loopWidth * COPIES,
                marginLeft: `calc(50% - ${loopWidth}px)`,
                "--timeline-loop": `${loopWidth}px`,
                animationDuration: `${LOOP}s`,
              } as React.CSSProperties
            }
          >
            {/* Ruler: a tick a second, a timecode every five */}
            <div
              className="relative h-7 border-y bg-card"
              style={{
                backgroundImage: `repeating-linear-gradient(to right, ${TICK} 0 1px, transparent 1px ${PX}px), repeating-linear-gradient(to right, ${TICK} 0 1px, transparent 1px ${PX * 5}px)`,
                backgroundSize: "100% 5px, 100% 11px",
                backgroundPosition: "0 100%, 0 100%",
                backgroundRepeat: "no-repeat",
              }}
            >
              {copies.flatMap((offset) =>
                Array.from({ length: LOOP / 5 }, (_, i) => (
                  <span
                    key={`${offset}-${i}`}
                    className="absolute top-1 font-mono text-[10px] leading-none text-muted-foreground/80"
                    style={{ left: offset + i * 5 * PX + 4 }}
                  >
                    {timecode(i * 5)}
                  </span>
                )),
              )}
            </div>

            {/* Tracks */}
            <div className="grid gap-[3px] py-[3px]">
              {TRACKS.map((track, t) => (
                <div key={t} className={cn("relative h-5", track.extra && "[@media(max-height:820px)]:hidden")}>
                  {copies.flatMap((offset) =>
                    track.clips.map((clip) => (
                      <ClipBlock
                        key={`${offset}-${clip.at}`}
                        clip={clip}
                        kind={track.kind}
                        left={offset + clip.at * PX}
                      />
                    )),
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </Scrubber>

      {/* Playhead */}
      <div className="pointer-events-none absolute inset-y-0 left-1/2">
        <div className="absolute inset-y-0 w-px -translate-x-1/2 bg-primary" />
        <svg viewBox="0 0 12 15" className="absolute top-0 h-[15px] w-3 -translate-x-1/2 fill-primary">
          <path d="M1 0h10a1 1 0 0 1 1 1v8.2L6 15 0 9.2V1a1 1 0 0 1 1-1Z" />
        </svg>
        <span className="tabular absolute bottom-full mb-2 -translate-x-1/2 rounded-md bg-primary px-2 py-1 font-mono text-[11px] leading-none font-medium text-primary-foreground">
          <Timecode loopSeconds={LOOP} />
        </span>
      </div>
    </div>
  );
}

function ClipBlock({ clip, kind, left }: { clip: Clip; kind: "video" | "audio"; left: number }) {
  return (
    <div
      data-clip
      className={cn(
        "group/clip absolute inset-y-0 flex items-center overflow-hidden rounded-[5px] ring-1 ring-inset transition-[background-color,color,box-shadow] hover:ring-primary/50",
        "data-selected:bg-primary/25 data-selected:text-primary data-selected:ring-2 data-selected:ring-primary",
        clip.accent
          ? "bg-primary/20 text-primary ring-primary/40"
          : "bg-surface-strong text-muted-foreground ring-border",
        kind === "audio" && "bg-surface",
      )}
      style={{ left, width: clip.len * PX }}
    >
      {kind === "audio" && (
        <span
          className="absolute inset-x-1 inset-y-[3px] bg-muted-foreground/35 group-data-selected/clip:bg-primary/70"
          style={{
            maskImage: WAVEFORM,
            WebkitMaskImage: WAVEFORM,
            maskSize: "auto 100%",
            WebkitMaskSize: "auto 100%",
          }}
        />
      )}
      {clip.label && (
        <span
          className={cn(
            "relative truncate px-1.5 text-[10px] leading-none",
            kind === "audio" && "rounded-sm bg-surface py-0.5 group-data-selected/clip:bg-transparent",
          )}
        >
          {clip.label}
        </span>
      )}
    </div>
  );
}
