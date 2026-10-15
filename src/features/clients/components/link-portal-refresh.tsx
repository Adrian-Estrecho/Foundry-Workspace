"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { markLinkPortalViewed } from "../link-portal-actions";

const EVERY_MS = 120_000;

/**
 * The links portal has no login, so no Realtime: it re-fetches every two
 * minutes while the tab is visible, and straight away when it comes back
 * into view. Opening it tells the team it was used.
 */
export function LinkPortalRefresh({ token }: { token: string }) {
  const router = useRouter();

  React.useEffect(() => {
    void markLinkPortalViewed(token);
  }, [token]);

  React.useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const interval = window.setInterval(refresh, EVERY_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router]);

  return null;
}
