"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { subscribeAsUser } from "@/lib/supabase/realtime";

const CHANNEL = "presence:team";
const HEARTBEAT_MS = 2 * 60 * 1000;

type PresenceContextValue = {
  /** User ids currently connected to Foundry. */
  onlineIds: ReadonlySet<string>;
  /** False until the first presence sync, so callers can fall back to last_seen_at. */
  ready: boolean;
};

const PresenceContext = React.createContext<PresenceContextValue>({ onlineIds: new Set(), ready: false });

/**
 * Marks the signed-in user as Online while Foundry is open, and tells
 * everyone who else is. Uses a private Realtime channel (policies in
 * 0003_rls.sql) plus a periodic `touch_presence()` so the server also knows
 * when someone was last seen.
 */
export function PresenceProvider({ userId, children }: { userId: string; children: React.ReactNode }) {
  const [state, setState] = React.useState<PresenceContextValue>({ onlineIds: new Set([userId]), ready: false });

  React.useEffect(() => {
    const supabase = createClient();
    const touch = () => {
      if (document.visibilityState === "visible") void supabase.rpc("touch_presence");
    };

    const unsubscribe = subscribeAsUser(
      CHANNEL,
      (channel) =>
        channel.on("presence", { event: "sync" }, () => {
          const ids = new Set(Object.keys(channel.presenceState()));
          ids.add(userId);
          setState({ onlineIds: ids, ready: true });
        }),
      {
        config: { private: true, presence: { key: userId } },
        onStatus: (status, channel) => {
          if (status === "SUBSCRIBED") void channel.track({ online_at: new Date().toISOString() });
        },
      },
    );

    touch();
    const interval = window.setInterval(touch, HEARTBEAT_MS);
    document.addEventListener("visibilitychange", touch);

    return () => {
      unsubscribe();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", touch);
    };
  }, [userId]);

  return <PresenceContext.Provider value={state}>{children}</PresenceContext.Provider>;
}

export const usePresence = () => React.useContext(PresenceContext);

/**
 * Until the first presence sync, fall back to the server's view (last seen
 * within a few minutes, computed when the page was rendered).
 */
export function useIsOnline(userId: string, recentlySeen: boolean) {
  const { onlineIds, ready } = usePresence();
  return ready ? onlineIds.has(userId) : recentlySeen;
}
