import { z } from "zod";

/** What app server actions return: success (optionally with data) or an error for a toast/form. */
export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export const fail = (error: string, fieldErrors?: Record<string, string>) => ({ ok: false as const, error, fieldErrors });

/** First message per field, keyed by field name. */
export function fieldErrorsOf(error: z.ZodError) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
  return fieldErrors;
}

export const blankToNull = (value: unknown) => (typeof value === "string" && value.trim() === "" ? null : value);

/** Optional trimmed text; blank becomes null. */
export const optionalText = (max: number) => z.preprocess(blankToNull, z.string().trim().max(max).nullable());

/** Optional http(s) link; blank becomes null. */
export const optionalUrl = (message = "Enter a full link starting with https://") =>
  z.preprocess(blankToNull, z.url({ protocol: /^https?$/, error: message }).max(500).nullable());

export const isTimeZone = (value: string) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
};
