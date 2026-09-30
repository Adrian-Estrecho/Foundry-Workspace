import { memberLabel } from "@/features/workspaces/constants";
import { PERMISSIONS } from "@/lib/permissions";
import type { Person } from "./queries";

/** What their access is called: their title, or the role ("Editor", "Admin"…). */
export const accessTitle = (person: Pick<Person, "title" | "role" | "status">) => person.title ?? memberLabel(person.role, person.status);

/** One line on what they can do, for the People table. */
export function accessSummary(person: Pick<Person, "role" | "status" | "permissions">) {
  if (person.role === "owner") return "Owner · full access";
  if (person.role === "admin") return "Full access";
  const n = person.permissions.length;
  if (n === 0) return person.status === "onboarding" ? "Onboarding only" : "Standard editor";
  const abilities = `${n} extra ${n === 1 ? "ability" : "abilities"}`;
  return person.status === "onboarding" ? `${abilities} once approved` : abilities;
}

/** Their abilities' names, in catalogue order. */
export const abilityNames = (person: Pick<Person, "permissions">) =>
  PERMISSIONS.filter((p) => person.permissions.includes(p.key)).map((p) => p.label);
