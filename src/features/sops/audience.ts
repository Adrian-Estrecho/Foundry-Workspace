/**
 * Who can see an SOP: either group, both (everyone), and/or named people.
 * People who write SOPs see every one. The database applies the same rule
 * (can_read_sop in migration 20261017000001_sop_audience).
 */

export type AudienceGroup = "admins" | "editors";

export type Audience = { admins: boolean; editors: boolean; people: string[] };

export const EVERYONE: Audience = { admins: true, editors: true, people: [] };

export const AUDIENCE_GROUPS: Record<AudienceGroup, { label: string; description: string; empty: string }> = {
  admins: {
    label: "Admins & managers",
    description: "Owners, admins, and editors given extra access on the People page.",
    empty: "Nobody here yet.",
  },
  editors: {
    label: "Editors",
    description: "Everyone else, new editors still onboarding included.",
    empty: "No editors yet.",
  },
};

/** Someone who might read SOPs, as the picker lists them. */
export type Reader = {
  id: string;
  name: string;
  avatarUrl: string | null;
  /** Their access title, or the role ("Project manager", "Editor"). */
  title: string;
  group: AudienceGroup;
  /** Writes SOPs, so sees every one. */
  seesAll: boolean;
  onboarding: boolean;
};

type Member = { role: "owner" | "admin" | "editor"; status: string; permissions: readonly string[] };

/** "Admins & managers": owners, admins, and active editors with any extra ability. */
export const groupOf = ({ role, status, permissions }: Member): AudienceGroup =>
  role !== "editor" || (status === "active" && permissions.length > 0) ? "admins" : "editors";

export const seesAllSops = ({ role, status, permissions }: Member) =>
  role !== "editor" || (status === "active" && permissions.includes("sops.manage"));

export const canSee = (audience: Audience, reader: Pick<Reader, "id" | "group" | "seesAll">) =>
  reader.seesAll || audience[reader.group] || audience.people.includes(reader.id);

/** Named people the groups don't already cover. */
export const namedPeople = (audience: Audience, readers: Reader[]) =>
  readers.filter((reader) => !reader.seesAll && !audience[reader.group] && audience.people.includes(reader.id));

/** "Everyone", "Admins & managers and Lucas", "3 people"… */
export function audienceSummary(audience: Audience, readers: Reader[]) {
  if (audience.admins && audience.editors) return "Everyone";
  const named = namedPeople(audience, readers);
  const group = audience.admins ? AUDIENCE_GROUPS.admins.label : audience.editors ? AUDIENCE_GROUPS.editors.label : null;
  const names = named.length <= 2 ? named.map((reader) => reader.name).join(" and ") : null;
  if (!group) return names || (named.length ? `${named.length} people` : "Only people who write SOPs");
  if (!named.length) return group;
  return `${group} and ${names ?? `${named.length} more people`}`;
}

export const audienceOf = (sop: { visible_to_admins: boolean; visible_to_editors: boolean; shared_with: string[] }): Audience => ({
  admins: sop.visible_to_admins,
  editors: sop.visible_to_editors,
  people: sop.shared_with,
});
