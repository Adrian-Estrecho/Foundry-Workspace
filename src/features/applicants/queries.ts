import "server-only";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ApplicantStage } from "./constants";
import { testSubmissionLink } from "./links";

export type PipelineApplicant = {
  id: string;
  column: ApplicantStage;
  position: number;
  name: string;
  email: string;
  portfolioUrl: string | null;
  software: string[];
  specialties: string[];
  timezone: string | null;
  hourlyRate: number | null;
  weeklyHours: number | null;
  rating: number | null;
  stageChangedAt: string;
  testEditUrl: string | null;
  testSubmissionUrl: string | null;
  editorId: string | null;
};

/** The test brief sent most recently: the default for the next one. */
async function getLastTestEditUrl() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("applicants")
    .select("test_edit_url")
    .not("test_edit_url", "is", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.test_edit_url ?? null;
}

export async function getApplicantPipeline() {
  const supabase = await createClient();
  const [{ data, error }, lastTestEditUrl] = await Promise.all([
    supabase
      .from("applicants")
      .select(
        `id, stage, position, full_name, email, portfolio_url, software, specialties, timezone,
         hourly_rate, weekly_hours, rating, stage_changed_at, test_edit_url, test_submission_url, editor_id`,
      )
      .order("position"),
    getLastTestEditUrl(),
  ]);
  if (error) throw error;

  const applicants: PipelineApplicant[] = (data ?? []).map((a) => ({
    id: a.id,
    column: a.stage,
    position: a.position,
    name: a.full_name,
    email: a.email,
    portfolioUrl: a.portfolio_url,
    software: a.software,
    specialties: a.specialties,
    timezone: a.timezone,
    hourlyRate: a.hourly_rate,
    weeklyHours: a.weekly_hours,
    rating: a.rating,
    stageChangedAt: a.stage_changed_at,
    testEditUrl: a.test_edit_url,
    testSubmissionUrl: a.test_submission_url,
    editorId: a.editor_id,
  }));

  return { applicants, lastTestEditUrl };
}

export async function getApplicantDetail(id: string) {
  const supabase = await createClient();
  const [{ data: applicant }, { data: activity }, lastTestEditUrl] = await Promise.all([
    supabase.from("applicants").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("activity_log")
      .select("id, summary, created_at, actor:profiles(full_name, avatar_url)")
      .eq("entity_id", id)
      .order("created_at", { ascending: false })
      .limit(12),
    getLastTestEditUrl(),
  ]);
  if (!applicant) notFound();

  return {
    applicant,
    activity: activity ?? [],
    submitLink: testSubmissionLink(applicant.id),
    lastTestEditUrl,
    renderedAt: Date.now(),
  };
}
