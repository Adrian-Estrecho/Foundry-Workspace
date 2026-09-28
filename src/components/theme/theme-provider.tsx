"use client";

import * as React from "react";
import { THEME_STORAGE_KEY, type ThemeMode } from "@/lib/theme";

type ThemeContextValue = {
  theme: ThemeMode;
  resolvedTheme: "dark" | "light";
  setTheme: (theme: ThemeMode) => void;
};

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

// ---- A tiny external store over localStorage + the OS colour scheme ---------
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

function readStoredTheme(): ThemeMode {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "system" ? stored : "dark";
  } catch {
    return "dark";
  }
}

const prefersDark = () => window.matchMedia("(prefers-color-scheme: dark)").matches;
const resolve = (theme: ThemeMode) => (theme === "system" ? (prefersDark() ? "dark" : "light") : theme);

function subscribe(listener: () => void) {
  listeners.add(listener);
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const onStorage = (event: StorageEvent) => event.key === THEME_STORAGE_KEY && listener();
  media.addEventListener("change", listener);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    media.removeEventListener("change", listener);
    window.removeEventListener("storage", onStorage);
  };
}

/**
 * Light/dark mode. The first paint is handled by `themeInitScript`; this
 * keeps <html> in sync with toggles, OS changes and other tabs.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = React.useSyncExternalStore(subscribe, readStoredTheme, () => "dark" as const);
  const resolvedTheme = React.useSyncExternalStore(
    subscribe,
    () => resolve(readStoredTheme()),
    () => "dark" as const,
  );

  React.useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", resolvedTheme === "dark");
    root.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  const setTheme = React.useCallback((next: ThemeMode) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Storage unavailable (private mode): the change still applies this session.
    }
    notify();
  }, []);

  const value = React.useMemo(() => ({ theme, resolvedTheme, setTheme }), [theme, resolvedTheme, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = React.useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside <ThemeProvider>");
  return context;
}
