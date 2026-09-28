"use client";

import { useSyncExternalStore } from "react";

// One shared 1-second clock for every live timer on the page.
const listeners = new Set<() => void>();
let now = Date.now();
let timer: ReturnType<typeof setInterval> | undefined;

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!timer) {
    now = Date.now();
    timer = setInterval(() => {
      now = Date.now();
      listeners.forEach((l) => l());
    }, 1000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

/**
 * Current time in ms, updated every second. `serverNow` is the time the
 * server rendered with, so hydration matches before the clock takes over.
 */
export function useNow(serverNow: number) {
  return useSyncExternalStore(
    subscribe,
    () => now,
    () => serverNow,
  );
}
