import { SOFTWARE_OPTIONS, SPECIALTY_OPTIONS } from "@/features/applicants/constants";
import { BUDGET_RANGES, PROJECT_TYPES } from "@/features/clients/constants";

/**
 * The public forms a workspace can edit: the editor application
 * (/apply/<slug>) and the project form (/intake/<slug>). A form is an ordered
 * list of fields. Built-in fields fill the applicant or lead record; any
 * other field is the workspace's own question, kept with the submission's
 * answers.
 */
export const FORM_KINDS = ["apply", "intake"] as const;
export type FormKind = (typeof FORM_KINDS)[number];
export const isFormKind = (value: unknown): value is FormKind => FORM_KINDS.includes(value as FormKind);

export const FORM_NAMES: Record<FormKind, string> = { apply: "Application form", intake: "Project request form" };

export const FIELD_TYPES = [
  "section",
  "short_text",
  "long_text",
  "select",
  "multi_select",
  "url",
  "number",
  "date",
  "email",
  "phone",
  "links",
  "timezone",
] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export type FormField = {
  id: string;
  type: FieldType;
  label: string;
  help?: string;
  placeholder?: string;
  required?: boolean;
  options?: string[];
};

export const FIELD_TYPE_INFO: Record<FieldType, { label: string; description: string }> = {
  section: { label: "Section", description: "A heading for the questions below it" },
  short_text: { label: "Short answer", description: "One line of text" },
  long_text: { label: "Paragraph", description: "A few lines of text" },
  select: { label: "Dropdown", description: "Pick one option" },
  multi_select: { label: "Checkboxes", description: "Pick any of the options" },
  url: { label: "Link", description: "A web address" },
  number: { label: "Number", description: "A number" },
  date: { label: "Date", description: "A day" },
  email: { label: "Email", description: "An email address" },
  phone: { label: "Phone", description: "A phone number" },
  links: { label: "Links", description: "Several web addresses, one per line" },
  timezone: { label: "Timezone", description: "Their timezone" },
};

/** What an admin can add from the builder, in palette order. */
export const ADDABLE_TYPES = [
  "short_text",
  "long_text",
  "select",
  "multi_select",
  "url",
  "number",
  "date",
  "email",
  "phone",
  "section",
] as const satisfies FieldType[];

export const CHOICE_TYPES: FieldType[] = ["select", "multi_select"];
export const isChoice = (type: FieldType) => CHOICE_TYPES.includes(type);
/** Types that take the full width of a two-column form. */
export const WIDE_TYPES: FieldType[] = ["section", "long_text", "multi_select", "links"];
/** Types that show a placeholder in their box. */
export const PLACEHOLDER_TYPES: FieldType[] = ["short_text", "long_text", "url", "number", "email", "phone", "links"];

export const MAX_FIELDS = 60;
export const MAX_OPTIONS = 40;
export const FIELD_ID = /^[a-z][a-z0-9_]{1,39}$/;

/** A built-in field: its default, and the rules that come with the record it fills. */
export type BuiltinField = {
  field: FormField;
  /** Always on the form and always required (e.g. email). */
  locked?: boolean;
  /** Admins can change the choices. */
  optionsEditable?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  step?: number;
  integer?: boolean;
  autoComplete?: string;
  /** Where the answer ends up, shown in the builder. */
  note: string;
};

const APPLY_BUILTINS: BuiltinField[] = [
  {
    field: { id: "full_name", type: "short_text", label: "Full name", required: true },
    locked: true,
    minLength: 2,
    maxLength: 120,
    autoComplete: "name",
    note: "Their name on the applicant card.",
  },
  {
    field: { id: "email", type: "email", label: "Email", required: true },
    locked: true,
    maxLength: 200,
    autoComplete: "email",
    note: "Where the invitation to join goes.",
  },
  {
    field: {
      id: "portfolio_url",
      type: "url",
      label: "Portfolio or reel",
      help: "Vimeo, YouTube, your site or a Drive folder.",
      placeholder: "https://",
      required: true,
    },
    maxLength: 500,
    note: "The Portfolio button on the applicant card.",
  },
  {
    field: { id: "timezone", type: "timezone", label: "Timezone", required: true },
    note: "Shows their local time on the applicant card.",
  },
  {
    field: {
      id: "software",
      type: "multi_select",
      label: "Software you edit in",
      required: true,
      options: [...SOFTWARE_OPTIONS],
    },
    optionsEditable: true,
    note: "Listed on the applicant card.",
  },
  {
    field: {
      id: "specialties",
      type: "multi_select",
      label: "What you're best at",
      help: "Pick as many as fit.",
      options: [...SPECIALTY_OPTIONS],
    },
    optionsEditable: true,
    note: "Listed on the applicant card.",
  },
  {
    field: { id: "hourly_rate", type: "number", label: "Hourly rate (USD)", placeholder: "25", required: true },
    min: 1,
    max: 1000,
    step: 0.5,
    note: "Their rate on the applicant card.",
  },
  {
    field: { id: "weekly_hours", type: "number", label: "Hours per week", placeholder: "30", required: true },
    min: 1,
    max: 80,
    integer: true,
    note: "Their hours on the applicant card.",
  },
  {
    field: {
      id: "availability_notes",
      type: "long_text",
      label: "Availability",
      help: "Usual working hours, start date, anything we should know.",
    },
    maxLength: 2000,
    note: "Shown under Availability on the applicant card.",
  },
];

const INTAKE_BUILTINS: BuiltinField[] = [
  {
    field: { id: "name", type: "short_text", label: "Your name", required: true },
    locked: true,
    minLength: 2,
    maxLength: 120,
    autoComplete: "name",
    note: "The contact on the new client card.",
  },
  {
    field: { id: "company", type: "short_text", label: "Company" },
    maxLength: 120,
    autoComplete: "organization",
    note: "The name on the client card.",
  },
  {
    field: { id: "email", type: "email", label: "Email", required: true },
    locked: true,
    maxLength: 200,
    autoComplete: "email",
    note: "How you reach them. Replies to the lead email go here.",
  },
  {
    field: { id: "phone", type: "phone", label: "Phone" },
    maxLength: 40,
    autoComplete: "tel",
    note: "Saved with the client's contact details.",
  },
  {
    field: { id: "project_type", type: "select", label: "Project type", options: [...PROJECT_TYPES] },
    optionsEditable: true,
    note: "Saved as the client's project type.",
  },
  {
    field: { id: "budget_range", type: "select", label: "Budget", options: [...BUDGET_RANGES] },
    optionsEditable: true,
    note: "Saved as the client's budget.",
  },
  {
    field: { id: "deadline", type: "date", label: "Deadline", help: "When do you need the first delivery?" },
    note: "Saved as the client's deadline.",
  },
  {
    field: {
      id: "reference_links",
      type: "links",
      label: "Reference links",
      help: "Videos you like, your channel, brand guidelines. One per line.",
      placeholder: "https://youtube.com/…\nhttps://instagram.com/…",
    },
    note: "Listed under the original enquiry.",
  },
  {
    field: {
      id: "notes",
      type: "long_text",
      label: "Anything else?",
      placeholder: "Goals, number of videos, style, platforms…",
    },
    maxLength: 4000,
    note: "Shown as their notes on the original enquiry.",
  },
];

export const BUILTINS: Record<FormKind, BuiltinField[]> = { apply: APPLY_BUILTINS, intake: INTAKE_BUILTINS };

export const builtinOf = (kind: FormKind, id: string) => BUILTINS[kind].find((b) => b.field.id === id);

const section = (id: string, label: string): FormField => ({ id, type: "section", label });
const pick = (kind: FormKind, id: string) => ({ ...builtinOf(kind, id)!.field });

/** The form a workspace starts with. */
export function defaultFields(kind: FormKind): FormField[] {
  if (kind === "apply") {
    return [
      section("s_about", "About you"),
      ...["full_name", "email", "portfolio_url", "timezone"].map((id) => pick(kind, id)),
      section("s_work", "Your work"),
      ...["software", "specialties"].map((id) => pick(kind, id)),
      section("s_rate", "Rate and availability"),
      ...["hourly_rate", "weekly_hours", "availability_notes"].map((id) => pick(kind, id)),
    ];
  }
  return [
    section("s_about", "About you"),
    ...["name", "company", "email", "phone"].map((id) => pick(kind, id)),
    section("s_project", "Your project"),
    ...["project_type", "budget_range", "deadline", "reference_links", "notes"].map((id) => pick(kind, id)),
  ];
}

const text = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");

function cleanOptions(value: unknown) {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const options: string[] = [];
  for (const item of value) {
    const option = text(item, 80);
    if (option && !seen.has(option.toLowerCase())) {
      seen.add(option.toLowerCase());
      options.push(option);
    }
  }
  return options.slice(0, MAX_OPTIONS);
}

/**
 * A saved field list, made safe to render and to check submissions against:
 * built-in fields keep their type and rules, locked ones are always there
 * and required, unknown or broken entries are dropped. Anything that isn't
 * a list gives the default form.
 */
export function normalizeFields(kind: FormKind, saved: unknown): FormField[] {
  if (!Array.isArray(saved)) return defaultFields(kind);

  const fields: FormField[] = [];
  const seen = new Set<string>();
  for (const raw of saved.slice(0, MAX_FIELDS)) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const id = typeof item.id === "string" ? item.id : "";
    if (!FIELD_ID.test(id) || seen.has(id)) continue;

    const builtin = builtinOf(kind, id);
    const type = builtin ? builtin.field.type : (item.type as FieldType);
    if (!builtin && !(ADDABLE_TYPES as readonly FieldType[]).includes(type)) continue;

    const field: FormField = {
      id,
      type,
      label: text(item.label, 120) || builtin?.field.label || FIELD_TYPE_INFO[type].label,
    };
    const help = text(item.help, 300);
    if (help) field.help = help;
    const placeholder = PLACEHOLDER_TYPES.includes(type) ? text(item.placeholder, 200) : "";
    if (placeholder) field.placeholder = placeholder;
    if (type !== "section") field.required = builtin?.locked ? true : item.required === true;
    if (isChoice(type)) {
      const options = builtin && !builtin.optionsEditable ? builtin.field.options! : cleanOptions(item.options);
      if (options.length === 0) continue;
      field.options = options;
    }

    seen.add(id);
    fields.push(field);
  }

  // Locked fields can't go missing: put back any that did, at the top.
  const missing = BUILTINS[kind].filter((b) => b.locked && !seen.has(b.field.id)).map((b) => ({ ...b.field }));
  return [...missing, ...fields];
}

/** A new id for an admin's own field or section. */
export function newFieldId(type: FieldType) {
  return `${type === "section" ? "s" : "f"}_${Math.random().toString(36).slice(2, 10)}`;
}

/** An answer to a workspace's own question, as kept on the submission. */
export type Answer = { id: string; label: string; type: FieldType; value: string | string[] };

/** Answers read back from the database, ignoring anything malformed. */
export function readAnswers(value: unknown): Answer[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const item = raw as Record<string, unknown>;
    const answer = item.value;
    const valid = typeof answer === "string" || (Array.isArray(answer) && answer.every((v) => typeof v === "string"));
    if (typeof item.label !== "string" || !valid) return [];
    const type = FIELD_TYPES.includes(item.type as FieldType) ? (item.type as FieldType) : "short_text";
    return [{ id: String(item.id ?? ""), label: item.label, type, value: answer as string | string[] }];
  });
}
