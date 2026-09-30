/**
 * Abilities an owner or admin can hand to an editor from the People page.
 * Owners and admins have all of them. The database checks the same keys
 * with has_permission() (migration 20261001000006_access), so keep the two
 * lists in step.
 */

export type PermissionGroup = "work" | "people" | "workspace" | "company";

export const PERMISSIONS = [
  {
    key: "tasks.status",
    group: "work",
    label: "Change any task status",
    description: "Move tasks to any status, including Done and Revisions, and reopen finished work.",
  },
  {
    key: "tasks.manage",
    group: "work",
    label: "Manage projects and tasks",
    description: "See every project and task; create, edit, assign and delete them.",
  },
  {
    key: "statuses.manage",
    group: "work",
    label: "Customize statuses",
    description: "Add, rename, recolour, reorder and remove task and project statuses.",
  },
  {
    key: "editors.manage",
    group: "people",
    label: "Hire and onboard editors",
    description: "Applicants, invites, the test edit, interviews and approvals, plus the editor roster and rates.",
  },
  {
    key: "clients.manage",
    group: "people",
    label: "Manage clients and leads",
    description: "The client pipeline, contacts, contracts, payment status, portal links and client messages.",
  },
  {
    key: "attendance.view",
    group: "people",
    label: "See team attendance",
    description: "Everyone's live status, timesheets and hours, CSV export, and ending a forgotten shift.",
  },
  {
    key: "workspace.brand",
    group: "workspace",
    label: "Brand and workspace details",
    description: "Name, logo, accent colour, the application link and attendance rules.",
  },
  {
    key: "workspace.forms",
    group: "workspace",
    label: "Application and intake forms",
    description: "Edit the questions on the public apply and client intake forms.",
  },
  {
    key: "workspace.contract",
    group: "workspace",
    label: "Contract and NDA",
    description: "Set the contract and NDA new editors download and sign.",
  },
  {
    key: "workspace.links",
    group: "workspace",
    label: "Frame.io and asset links",
    description: "Set the Frame.io invite and asset pack links new editors get.",
  },
  {
    key: "announcements.post",
    group: "company",
    label: "Post announcements",
    description: "Write, pin and remove announcements for the whole team.",
  },
  {
    key: "sops.manage",
    group: "company",
    label: "Write and edit SOPs",
    description: "Create, edit and remove standard operating procedures.",
  },
] as const satisfies readonly { key: string; group: PermissionGroup; label: string; description: string }[];

export type Permission = (typeof PERMISSIONS)[number]["key"];

export const PERMISSION_KEYS: Permission[] = PERMISSIONS.map((p) => p.key);

export const PERMISSION_GROUPS: { key: PermissionGroup; label: string; description: string }[] = [
  { key: "work", label: "Work", description: "Projects, tasks and statuses" },
  { key: "people", label: "People", description: "Editors, clients and attendance" },
  { key: "workspace", label: "Workspace", description: "Details, forms and onboarding links" },
  { key: "company", label: "Company", description: "Announcements and SOPs" },
];

/** What stays with owners and admins whatever an editor is given. */
export const ADMIN_ONLY = ["People and access", "ClickUp", "the team inbox", "editors' payment details"];

export const isPermission = (value: string): value is Permission => (PERMISSION_KEYS as string[]).includes(value);

/** Known keys only, once each, in catalogue order. */
export const normalizePermissions = (values: readonly string[]): Permission[] =>
  PERMISSION_KEYS.filter((key) => values.includes(key));

/** Starting points in the Access dialog: a title and a set of abilities. */
export const ACCESS_PRESETS: { title: string; permissions: Permission[] }[] = [
  { title: "Editor", permissions: [] },
  { title: "Senior editor", permissions: ["tasks.status"] },
  { title: "Project manager", permissions: ["tasks.status", "tasks.manage", "statuses.manage", "attendance.view"] },
  { title: "Hiring manager", permissions: ["editors.manage", "workspace.forms", "workspace.contract", "workspace.links"] },
  { title: "Operational control", permissions: PERMISSION_KEYS.filter((key) => key !== "workspace.brand") },
];

export const TITLE_MAX = 40;
