import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Spam protection for public forms. The page embeds a signed timestamp; on
 * submit we require that it's genuine and that a human-plausible amount of
 * time has passed. Bots posting straight to the action, or filling the form
 * in milliseconds, fail this check.
 */

const MIN_FILL_MS = 3_000;
const MAX_AGE_MS = 6 * 60 * 60 * 1000;

function secret() {
  return process.env.FORM_TOKEN_SECRET ?? process.env.SUPABASE_SECRET_KEY ?? "foundry-dev-form-secret";
}

const sign = (form: string, issuedAt: string) =>
  createHmac("sha256", secret()).update(`${form}:${issuedAt}`).digest("base64url");

export function issueFormToken(form: string) {
  const issuedAt = Date.now().toString(36);
  return `${issuedAt}.${sign(form, issuedAt)}`;
}

export type FormTokenResult = "ok" | "invalid" | "too_fast" | "expired";

export function checkFormToken(form: string, token: unknown): FormTokenResult {
  if (typeof token !== "string") return "invalid";
  const [issuedAt, signature] = token.split(".");
  if (!issuedAt || !signature) return "invalid";

  const expected = Buffer.from(sign(form, issuedAt));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return "invalid";

  const age = Date.now() - parseInt(issuedAt, 36);
  if (age < MIN_FILL_MS) return "too_fast";
  if (age > MAX_AGE_MS) return "expired";
  return "ok";
}

/**
 * Signature for links emailed to people without an account (e.g. an
 * applicant's test-edit submission link), so the id in the link can't be
 * swapped for someone else's.
 */
export const signLink = (purpose: string, id: string) => sign(`link:${purpose}`, id);

export function checkLinkSignature(purpose: string, id: unknown, signature: unknown) {
  if (typeof id !== "string" || typeof signature !== "string") return false;
  const expected = Buffer.from(signLink(purpose, id));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
