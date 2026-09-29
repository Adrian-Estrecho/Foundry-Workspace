import { NextResponse, type NextRequest } from "next/server";
import { csvHours, localDateTime, toCsv } from "@/features/attendance/csv";
import { getHours, getShiftLog } from "@/features/attendance/queries";
import { getCurrentUser } from "@/lib/auth";
import { addDays, daysBetween } from "@/lib/dates";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Attendance as CSV: shifts (with reports), a timesheet (hours per person
 * per day), or hours per client, project and task. Admins get the team,
 * editors themselves (RLS decides).
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.memberStatus !== "active") return new NextResponse("Sign in first.", { status: 401 });

  const search = request.nextUrl.searchParams;
  const type = search.get("type");
  const from = search.get("from") ?? "";
  const to = search.get("to") ?? "";
  if (!["shifts", "timesheet", "hours"].includes(type ?? "") || !DATE.test(from) || !DATE.test(to) || from > to) {
    return new NextResponse("Pick a report type and a valid date range.", { status: 400 });
  }
  if (daysBetween(from, to) > 366) return new NextResponse("Export a year or less at a time.", { status: 400 });

  let rows: unknown[][];
  if (type === "hours") {
    const { projects } = await getHours(user, from, to);
    rows = [["Client", "Project", "Task", "Editor", "Hours"]];
    for (const project of projects) {
      for (const task of project.tasks) {
        for (const editor of task.editors) {
          rows.push([project.clientName ?? "", project.projectName, task.title, editor.name, csvHours(editor.seconds)]);
        }
      }
    }
  } else {
    const { shifts } = await getShiftLog(user, from, to);
    if (type === "shifts") {
      rows = [
        ["Date", "Editor", "Time zone", "Started", "Stopped", "Hours worked", "Break minutes", "Ended by", "Task", "Progress %", "Work done", "Blockers"],
      ];
      for (const shift of [...shifts].reverse()) {
        rows.push([
          shift.workDate,
          shift.editorName,
          shift.timeZone,
          localDateTime(shift.clockInAt, shift.timeZone),
          shift.clockOutAt ? localDateTime(shift.clockOutAt, shift.timeZone) : "(still working)",
          csvHours(shift.workSeconds),
          Math.round(shift.breakSeconds / 60),
          shift.endedBy === "admin" ? "Admin" : shift.clockOutAt ? "Editor" : "",
          shift.report?.taskTitle ?? "",
          shift.report?.progress ?? "",
          shift.report?.workDone ?? "",
          shift.report?.blockers ?? "",
        ]);
      }
    } else {
      const days: string[] = [];
      for (let day = from; day <= to; day = addDays(day, 1)) days.push(day);
      const people = new Map<string, { name: string; perDay: Map<string, number> }>();
      for (const shift of shifts) {
        const person = people.get(shift.editorId) ?? { name: shift.editorName, perDay: new Map() };
        person.perDay.set(shift.workDate, (person.perDay.get(shift.workDate) ?? 0) + shift.workSeconds);
        people.set(shift.editorId, person);
      }
      rows = [["Editor", ...days, "Total hours"]];
      for (const person of [...people.values()].sort((a, b) => a.name.localeCompare(b.name))) {
        const total = [...person.perDay.values()].reduce((sum, s) => sum + s, 0);
        rows.push([person.name, ...days.map((day) => csvHours(person.perDay.get(day) ?? 0)), csvHours(total)]);
      }
    }
  }

  const slug = user.workspace.slug;
  const filename = `${slug}-${type}-${from}${from === to ? "" : `-to-${to}`}.csv`;
  return new NextResponse(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
