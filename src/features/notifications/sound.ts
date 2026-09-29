"use client";

/**
 * The chime for a new notification: two soft notes made with Web Audio, so
 * there's no file to load. Browsers only allow sound after the person has
 * interacted with the page, so the audio context is created on their first
 * click or key press. It's on by default and can be turned off per device
 * in Settings.
 */

const STORAGE_KEY = "foundry-notification-sound";
const CHANGE_EVENT = "foundry-notification-sound";

let context: AudioContext | null = null;
let lastPlayed = 0;

function unlock() {
  try {
    context ??= new AudioContext();
    void context.resume();
  } catch {
    // No Web Audio: stay silent.
  }
}

/** Gets the audio ready on the first interaction. Returns a cleanup. */
export function primeNotificationSound() {
  const options = { once: true, capture: true } as const;
  window.addEventListener("pointerdown", unlock, options);
  window.addEventListener("keydown", unlock, options);
  return () => {
    window.removeEventListener("pointerdown", unlock, options);
    window.removeEventListener("keydown", unlock, options);
  };
}

export function isSoundOn() {
  try {
    return localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setSoundOn(on: boolean) {
  try {
    if (on) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, "off");
  } catch {
    // Storage blocked: the setting just won't stick.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** For useSyncExternalStore: the setting changed here or in another tab. */
export function subscribeToSound(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/**
 * Plays the chime, at most once every 1.5 s so a burst of notifications
 * sounds once. `force` plays it even when turned off (the Settings preview).
 */
export function playNotificationSound({ force = false } = {}) {
  if (!force && !isSoundOn()) return;
  if (force) unlock();
  if (!context) return;
  const now = Date.now();
  if (now - lastPlayed < 1500) return;
  if (context.state === "running") {
    lastPlayed = now;
    chime(context);
  } else if (force) {
    lastPlayed = now;
    const ready = context;
    void ready.resume().then(() => chime(ready));
  }
}

function chime(audio: AudioContext) {
  const start = audio.currentTime + 0.01;
  // A5 then E6: a bright, short rise.
  for (const [frequency, delay] of [
    [880, 0],
    [1318.51, 0.1],
  ]) {
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, start + delay);
    gain.gain.exponentialRampToValueAtTime(0.14, start + delay + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + delay + 0.45);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(start + delay);
    oscillator.stop(start + delay + 0.5);
  }
}
