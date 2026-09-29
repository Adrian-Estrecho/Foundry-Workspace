import "server-only";
import { notFound } from "next/navigation";
import { getApplicantInvitation } from "@/features/invitations/queries";
import { createClient } from "@/lib/supabase/server";
import type { ApplicantStage } from "./constants";

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
  editorId: string | null;
};

export async function getApplicantPipeline() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("applicants")
    .select(
      `id, stage, position, full_name, email, portfolio_url, software, specialties, timezone,
       hourly_rate, weekly_hours, rating, stage_changed_at, editor_id`,
    )
    .order("position");
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
    editorId: a.editor_id,
  }));

  return { applicants };
}

export async function getApplicantDetail(id: string) {
  const supabase = await createClient();
  const [{ data: applicant }, { data: activity }, invitation] = await Promise.all([
    supabase.from("applicants").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("activity_log")
      .select("id, summary, created_at, actor:profiles(full_name, avatar_url)")
      .eq("entity_id", id)
      .order("created_at", { ascending: false })
      .limit(12),
    getApplicantInvitation(id),
  ]);
  if (!applicant) notFound();

  return {
    applicant,
    activity: activity ?? [],
    invitation,
    renderedAt: Date.now(),
  };
}
