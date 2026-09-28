"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { subscribeAsUser } from "@/lib/supabase/realtime";

/**
 * Re-renders the current page's Server Components when any of `tables`
 * changes. Changes are batched so a burst of updates causes one refresh.
 * RLS applies to the change stream, so users only hear about rows they can see.
 */
export function RealtimeRefresh({ tables, channel }: { tables: string; channel: string }) {
  const router = useRouter();

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => router.refresh(), 500);
    };

    const unsubscribe = subscribeAsUser(`refresh:${channel}`, (subscription) => {
      for (const table of tables.split(",")) {
        subscription = subscription.on("postgres_changes", { event: "*", schema: "public", table: table.trim() }, refresh);
      }
      return subscription;
    });

    return () => {
      clearTimeout(timeout);
      unsubscribe();
    };
  }, [tables, channel, router]);

  return null;
}
