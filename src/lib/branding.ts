import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_ACCENT } from "@/lib/theme";

/**
 * Company name and default accent. Readable before sign-in (via the
 * public_branding() function), for the login and public form pages.
 */
export const getBranding = cache(async () => {
  try {
    const supabase = await createClient();
    const { data } = await supabase.rpc("public_branding").maybeSingle();
    return {
      companyName: data?.company_name ?? "Foundry Media",
      defaultAccent: data?.default_accent ?? DEFAULT_ACCENT,
    };
  } catch {
    return { companyName: "Foundry Media", defaultAccent: DEFAULT_ACCENT };
  }
});
