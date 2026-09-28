/** "Asia/Manila" → "Manila", "America/Mexico_City" → "Mexico City" */
export const zoneCity = (timeZone: string) => (timeZone.split("/").pop() ?? timeZone).replace(/_/g, " ");

/** The current time in `timeZone`, e.g. "3:42 PM". Falls back to UTC for unknown zones. */
export function localTime(timeZone: string, now: number | Date = Date.now()) {
  const format = (zone: string) =>
    new Intl.DateTimeFormat("en-US", { timeZone: zone, hour: "numeric", minute: "2-digit" }).format(now);
  try {
    return format(timeZone);
  } catch {
    return format("UTC");
  }
}
