"use client";

import { WifiIcon } from "lucide-react";
import { usePresence } from "@/components/presence/presence-provider";
import { KpiTile } from "@/components/shared/kpi-tile";

/** "Editors online": live from presence, not from the last page load. */
export function OnlineKpi({ editorIds, recentlySeen }: { editorIds: string[]; recentlySeen: number }) {
  const { onlineIds, ready } = usePresence();
  const online = ready ? editorIds.filter((id) => onlineIds.has(id)).length : recentlySeen;

  return (
    <KpiTile
      label="Editors online"
      value={online}
      icon={WifiIcon}
      tone={online > 0 ? "success" : "default"}
      hint={`of ${editorIds.length} active`}
      href="/attendance"
    />
  );
}
