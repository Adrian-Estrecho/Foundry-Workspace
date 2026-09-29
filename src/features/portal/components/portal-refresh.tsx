"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { markPortalViewed } from "../actions";

const EVERY_MS = 30_000;

/**
 * The portal has no login, so no Realtime: it re-fetches every 30 seconds
 * while the tab is visible, and straight away when it comes back into view.
 * Opening it tells the team the client has looked (and read the replies,
 * on Messages).
 */
export function PortalRefresh({ token, onMessages }: { token: string; onMessages: boolean }) {
  const router = useRouter();

  React.useEffect(() => {
    void markPortalViewed(token, { messages: onMessages });
  }, [token, onMessages]);

  React.useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      router.refresh();
      if (onMessages) void markPortalViewed(token, { messages: true });
    };
    const interval = window.setInterval(refresh, EVERY_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router, token, onMessages]);

  return null;
}
