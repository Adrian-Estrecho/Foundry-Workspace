import type { Enums } from "@/types/database";

/** "Owner", "Admin", "Editor", or "Onboarding" for an editor not yet approved. */
export function memberLabel(role: Enums<"member_role">, status: Enums<"member_status">) {
  if (role === "owner") return "Owner";
  if (role === "admin") return "Admin";
  return status === "onboarding" ? "Onboarding" : "Editor";
}

/** "Northwind Studio" → "northwind-studio", trimmed to a valid slug. */
export function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
}

export const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

/** Tells other tabs that the active workspace changed, so they reload. */
export const WORKSPACE_CHANNEL = "foundry-workspace";
