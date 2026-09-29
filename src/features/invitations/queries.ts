import "server-only";
import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { invitationState, joinUrl, type InvitationState } from "./constants";

export type InvitationRow = {
  id: string;
  code: string;
  link: string;
  email: string | null;
  name: string | null;
  applicantId: string | null;
  state: InvitationState;
  sentAt: string | null;
  expiresAt: string;
  acceptedBy: string | null;
};

type Row = {
  id: string;
  code: string;
  email: string | null;
  full_name: string | null;
  applicant_id: string | null;
  sent_at: string | null;
  expires_at: string;
  accepted_at: string | null;
  accepted_by: string | null;
  revoked_at: string | null;
};

const toRow = (invitation: Row, now: number): InvitationRow => ({
  id: invitation.id,
  code: invitation.code,
  link: joinUrl(env.siteUrl, invitation.code),
  email: invitation.email,
  name: invitation.full_name,
  applicantId: invitation.applicant_id,
  state: invitationState(invitation, now),
  sentAt: invitation.sent_at,
  expiresAt: invitation.expires_at,
  acceptedBy: invitation.accepted_by,
});

const COLUMNS = "id, code, email, full_name, applicant_id, sent_at, expires_at, accepted_at, accepted_by, revoked_at";

/** Invitations nobody has used yet (expired ones included, so they can be resent). Admins only (RLS). */
export async function getOpenInvitations() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("workspace_invitations")
    .select(COLUMNS)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });
  const now = Date.now();
  return (data ?? []).map((row) => toRow(row, now));
}

/** The most recent invitation sent to an applicant, if any. */
export async function getApplicantInvitation(applicantId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("workspace_invitations")
    .select(COLUMNS)
    .eq("applicant_id", applicantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? toRow(data, Date.now()) : null;
}
