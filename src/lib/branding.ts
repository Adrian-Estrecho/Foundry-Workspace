import "server-only";
import { cache } from "react";
import { workspaceLogoUrl } from "@/features/workspaces/constants";
import { createClient } from "@/lib/supabase/server";

export type Branding = {
  workspaceId: string;
  name: string;
  defaultAccent: string;
  acceptingApplications: boolean;
  logoUrl: string | null;
};

/**
 * A workspace's public face, found by the slug in its links (/apply/<slug>,
 * /intake/<slug>). Readable before sign-in through the public_branding()
 * function. Null for an unknown slug.
 */
export const getBranding = cache(async (slug: string): Promise<Branding | null> => {
  try {
    const supabase = await createClient();
    const { data } = await supabase.rpc("public_branding", { p_slug: slug }).maybeSingle();
    if (!data) return null;
    return {
      workspaceId: data.workspace_id,
      name: data.name,
      defaultAccent: data.default_accent,
      acceptingApplications: data.accepting_applications,
      logoUrl: workspaceLogoUrl(data.logo_path),
    };
  } catch {
    return null;
  }
});
