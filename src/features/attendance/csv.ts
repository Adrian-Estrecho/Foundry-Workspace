/**
 * CSV for spreadsheets. Text that starts like a formula gets a leading
 * apostrophe, so a task title or report can't run as a formula when the
 * file is opened in Excel or Sheets.
 */
function cell(value: unknown) {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: unknown[][]) {
  // The byte-order mark makes Excel read the file as UTF-8.
  return "﻿" + rows.map((row) => row.map(cell).join(",")).join("\r\n") + "\r\n";
}

/** "2026-09-28 09:02" in `timeZone`. */
export function localDateTime(iso: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
}

/** Seconds → hours with two decimals, for sums in a spreadsheet. */
export const csvHours = (seconds: number) => Math.round((seconds / 3600) * 100) / 100;
