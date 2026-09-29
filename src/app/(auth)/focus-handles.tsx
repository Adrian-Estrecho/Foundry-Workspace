"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const CORNERS = ["-top-1 -left-1", "-top-1 -right-1", "-bottom-1 -left-1", "-bottom-1 -right-1"];

/** Text-like fields get the handles; buttons and checkboxes don't. */
const FIELD = "input:not([type=hidden],[type=checkbox],[type=radio],[type=submit],[type=button]), textarea";

/**
 * Selection handles, like the logo's, that glide to whichever field has
 * focus: the page "selects" the element you're editing. Put it inside a
 * positioned container; it follows focus within that container. A field's
 * wrapper marked `data-frame` (e.g. input plus its show-password button) is
 * framed as one.
 */
export function FocusHandles() {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const frame = ref.current;
    const container = frame?.parentElement;
    if (!frame || !container) return;
    let target: HTMLElement | null = null;

    const place = () => {
      if (!target || !container.contains(target)) {
        frame.style.opacity = "0";
        return;
      }
      const box = container.getBoundingClientRect();
      const rect = target.getBoundingClientRect();
      // Appearing: fade in where the field is instead of flying in from the corner.
      const appearing = frame.style.opacity !== "1";
      if (appearing) frame.style.transitionProperty = "opacity";
      frame.style.transform = `translate(${rect.left - box.left}px, ${rect.top - box.top}px)`;
      frame.style.width = `${rect.width}px`;
      frame.style.height = `${rect.height}px`;
      frame.style.opacity = "1";
      if (appearing) requestAnimationFrame(() => frame.style.removeProperty("transition-property"));
    };

    const pick = (element: Element | null) => {
      const framed = element?.closest<HTMLElement>("[data-frame]");
      target = framed && container.contains(framed) ? framed : element?.matches(FIELD) ? (element as HTMLElement) : null;
      place();
    };
    const onFocusIn = (event: FocusEvent) => pick(event.target as Element);
    const onFocusOut = (event: FocusEvent) => {
      if (!container.contains(event.relatedTarget as Node | null)) pick(null);
    };

    pick(document.activeElement); // autofocus happens before this runs
    container.addEventListener("focusin", onFocusIn);
    container.addEventListener("focusout", onFocusOut);
    // Error messages and the strength meter move fields around.
    const observer = new ResizeObserver(place);
    observer.observe(container);
    window.addEventListener("resize", place);
    return () => {
      container.removeEventListener("focusin", onFocusIn);
      container.removeEventListener("focusout", onFocusOut);
      observer.disconnect();
      window.removeEventListener("resize", place);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute top-0 left-0 z-10 opacity-0 transition-[transform,width,height,opacity] duration-300 ease-out motion-reduce:transition-none"
    >
      {CORNERS.map((corner) => (
        <span
          key={corner}
          className={cn("absolute size-2 rounded-[2px] border-[1.5px] border-primary bg-card", corner)}
        />
      ))}
    </div>
  );
}
