/** "FDRYKWAME234" → "FDRY-KWAM-E234", how people see and type codes. */
export const formatInviteCode = (code: string) => code.match(/.{1,4}/g)?.join("-") ?? code;

/** The link in the invitation email: opens the join screen with the code filled in. */
export const joinUrl = (siteUrl: string, code: string) => `${siteUrl}/join?code=${formatInviteCode(code)}`;

export type InvitationState = "pending" | "accepted" | "revoked" | "expired";

export function invitationState(
  invitation: { accepted_at: string | null; revoked_at: string | null; expires_at: string },
  now = Date.now(),
): InvitationState {
  if (invitation.accepted_at) return "accepted";
  if (invitation.revoked_at) return "revoked";
  return new Date(invitation.expires_at).getTime() < now ? "expired" : "pending";
}

export const INVITATION_STATE_LABEL: Record<InvitationState, string> = {
  pending: "Waiting to join",
  accepted: "Joined",
  revoked: "Revoked",
  expired: "Expired",
};

/** How long a new or resent invitation lasts (matches the database default). */
export const INVITATION_DAYS = 14;
