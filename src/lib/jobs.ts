import "server-only";
import { timingSafeEqual } from "node:crypto";

// Development only: the secret seed.sql stores in the local Vault.
const LOCAL_SECRET = "foundry-local-jobs-secret";

/**
 * Whether a request to /api/jobs/* carries the shared secret the database's
 * scheduled jobs send (JOBS_SECRET, the same value as foundry_jobs_secret in
 * Vault).
 */
export function authorizedJob(request: Request) {
  const secret = process.env.JOBS_SECRET || (process.env.NODE_ENV === "development" ? LOCAL_SECRET : "");
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "");
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
