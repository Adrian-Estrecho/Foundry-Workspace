"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { subscribeAsUser } from "@/lib/supabase/realtime";

const HEARTBEAT_MS = 2 * 60 * 1000;

type PresenceContextValue = {
  /** User ids currently connected to ReEdit. */
  onlineIds: ReadonlySet<string>;
  /** False until the first presence sync, so callers can fall back to last_seen_at. */
  ready: boolean;
};

const PresenceContext = React.createContext<PresenceContextValue>({ onlineIds: new Set(), ready: false });

/**
 * Marks the signed-in user as Online while ReEdit is open, and tells their
 * workspace who else is. Uses the workspace's private Realtime channel,
 * "presence:<workspace id>" (policies in 0009_workspace_access.sql), plus a
 * periodic `touch_presence()` so the server also knows when someone was last
 * seen. Candidates still onboarding don't join the channel.
 */
export function PresenceProvider({
  userId,
  workspaceId,
  enabled,
  children,
}: {
  userId: string;
  workspaceId: string;
  enabled: boolean;
  children: React.ReactNode;
}) {
  const [state, setState] = React.useState<PresenceContextValue>({ onlineIds: new Set([userId]), ready: false });

  React.useEffect(() => {
    const supabase = createClient();
    const touch = () => {
      if (document.visibilityState === "visible") void supabase.rpc("touch_presence");
    };

    const unsubscribe = enabled
      ? subscribeAsUser(
          `presence:${workspaceId}`,
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
        )
      : () => {};

    touch();
    const interval = window.setInterval(touch, HEARTBEAT_MS);
    document.addEventListener("visibilitychange", touch);

    return () => {
      unsubscribe();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", touch);
    };
  }, [userId, workspaceId, enabled]);

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
