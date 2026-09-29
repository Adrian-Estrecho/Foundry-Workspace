import { z } from "zod";
import { isTimeZone } from "@/lib/action-result";
import { builtinOf, type Answer, type BuiltinField, type FormField, type FormKind } from "./fields";

/** What a public form sent, as typed, for putting back after a failed attempt. */
export type FormValues = Record<string, string | string[]>;
export type PublicFormState = { error?: string; fieldErrors?: Record<string, string>; values?: FormValues } | undefined;

type Value = string | string[] | number | null;
type Result = { value: Value } | { error: string };

const email = z.email().max(200);
const link = z.url({ protocol: /^https?$/ }).max(500);
const day = z.iso.date();

/**
 * Checks a submitted public form against its field list. Built-in fields
 * come back in `values` (typed; null or [] when blank or not on the form),
 * ready for the applicant or lead record. The workspace's own questions come
 * back as `answers`, with their label at the time. Errors are keyed by
 * field id.
 */
export function readSubmission(kind: FormKind, fields: FormField[], formData: FormData) {
  const echo: FormValues = {};
  const values: Record<string, Value> = {};
  const answers: Answer[] = [];
  const fieldErrors: Record<string, string> = {};

  for (const field of fields) {
    if (field.type === "section") continue;
    const raw =
      field.type === "multi_select" ? formData.getAll(field.id).map(String) : String(formData.get(field.id) ?? "").trim();
    echo[field.id] = raw;

    const builtin = builtinOf(kind, field.id);
    const result = parse(field, raw, builtin);
    if ("error" in result) {
      fieldErrors[field.id] = result.error;
    } else if (builtin) {
      values[field.id] = result.value;
    } else if (result.value !== null && !(Array.isArray(result.value) && result.value.length === 0)) {
      answers.push({
        id: field.id,
        label: field.label,
        type: field.type,
        value: Array.isArray(result.value) ? result.value : String(result.value),
      });
    }
  }

  return { echo, values, answers, fieldErrors };
}

function parse(field: FormField, raw: string | string[], rules: BuiltinField | undefined): Result {
  if (Array.isArray(raw)) {
    if (raw.length === 0) return field.required ? { error: "Pick at least one." } : { value: [] };
    const picked = [...new Set(raw)];
    return picked.every((option) => field.options?.includes(option)) ? { value: picked } : { error: "Pick from the options." };
  }

  if (raw === "") {
    if (field.required) return { error: field.type === "select" || field.type === "timezone" ? "Pick one." : "This is required." };
    return { value: field.type === "links" ? [] : null };
  }

  switch (field.type) {
    case "short_text":
    case "long_text":
    case "phone": {
      const max = rules?.maxLength ?? (field.type === "long_text" ? 4000 : field.type === "phone" ? 40 : 200);
      if (rules?.minLength && raw.length < rules.minLength) return { error: `Use at least ${rules.minLength} characters.` };
      if (raw.length > max) return { error: `Keep it under ${max} characters.` };
      return { value: raw };
    }
    case "email":
      return email.safeParse(raw).success ? { value: raw } : { error: "Enter a valid email address." };
    case "url":
      return link.safeParse(raw).success ? { value: raw } : { error: "Enter a full link starting with https://" };
    case "number": {
      const number = Number(raw);
      if (!Number.isFinite(number)) return { error: "Enter a number." };
      if (rules?.integer && !Number.isInteger(number)) return { error: "Use a whole number." };
      if (rules?.min !== undefined && rules.max !== undefined && (number < rules.min || number > rules.max)) {
        return { error: `Use a number from ${rules.min} to ${rules.max}.` };
      }
      return { value: number };
    }
    case "date":
      return day.safeParse(raw).success ? { value: raw } : { error: "Pick a valid date." };
    case "select":
      return field.options?.includes(raw) ? { value: raw } : { error: "Pick one of the options." };
    case "links": {
      const links = raw.split(/\s+/).filter(Boolean);
      if (links.length > 10) return { error: "Add up to 10 links." };
      return links.every((l) => link.safeParse(l).success)
        ? { value: links }
        : { error: "Each link must start with http:// or https://" };
    }
    case "timezone":
      return isTimeZone(raw) ? { value: raw } : { error: "Pick your timezone." };
    default:
      return { value: null };
  }
}
