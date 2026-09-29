import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** 20260929T153000Z */
const icsTime = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** Escapes text for an iCalendar value (RFC 5545). */
const icsText = (value: string) => value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/[,;]/g, (c) => `\\${c}`);

/**
 * The signed-in editor's booked interview as a calendar file, for the "Add
 * to calendar" button on their onboarding page.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Sign in first.", { status: 401 });

  const supabase = await createClient();
  const { data: interview } = await supabase
    .from("editor_interviews")
    .select("id, scheduled_at, duration_minutes, meeting_url, note_to_editor")
    .eq("editor_id", user.id)
    .eq("outcome", "scheduled")
    .order("scheduled_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!interview) return new NextResponse("No interview is booked.", { status: 404 });

  const start = new Date(interview.scheduled_at);
  const end = new Date(start.getTime() + interview.duration_minutes * 60_000);
  const description = [interview.note_to_editor, interview.meeting_url && `Join: ${interview.meeting_url}`]
    .filter(Boolean)
    .join("\n\n");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ReEdit//Onboarding//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${interview.id}@foundry`,
    `DTSTAMP:${icsTime(new Date())}`,
    `DTSTART:${icsTime(start)}`,
    `DTEND:${icsTime(end)}`,
    `SUMMARY:${icsText(`Interview with ${user.workspace.name}`)}`,
    description && `DESCRIPTION:${icsText(description)}`,
    interview.meeting_url && `LOCATION:${icsText(interview.meeting_url)}`,
    interview.meeting_url && `URL:${interview.meeting_url}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);

  return new NextResponse(lines.join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="interview.ics"',
      "Cache-Control": "private, no-store",
    },
  });
}
