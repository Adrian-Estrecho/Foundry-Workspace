import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { homePath } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/utils";

const OTP_TYPES: EmailOtpType[] = ["invite", "recovery", "magiclink", "signup", "email", "email_change"];

/**
 * Where to go next. Sign-up confirmation emails carry the full redirect URL
 * given to Supabase; only a link back into this site is followed.
 */
function nextPath(next: string | null, origin: string, fallback: string) {
  if (next && /^https?:\/\//.test(next)) {
    try {
      const url = new URL(next);
      return url.origin === origin ? safeNextPath(url.pathname + url.search, fallback) : fallback;
    } catch {
      return fallback;
    }
  }
  return safeNextPath(next, fallback);
}

/**
 * Landing point for links in auth emails (sign-up confirmation, password
 * reset) and for Google sign-in. Supports both the token-hash links used by
 * ReEdit's email templates and PKCE `?code=` redirects. New accounts carry
 * on to the welcome page (create or join a workspace).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;

  // Supabase reports a failed Google sign-in here as ?error=…&error_code=….
  if (searchParams.has("error")) {
    return NextResponse.redirect(new URL("/login?error=google", origin));
  }

  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const supabase = await createClient();
  // Without a destination: set-password for resets, otherwise their home
  // (the welcome page for someone new, e.g. a first Google sign-in).
  const go = async (userId: string) => {
    const fallback = type === "invite" || type === "recovery" ? "/set-password" : await homePath(supabase, userId);
    return NextResponse.redirect(new URL(nextPath(searchParams.get("next"), origin, fallback), origin));
  };

  if (tokenHash && type && OTP_TYPES.includes(type)) {
    const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error && data.user) return go(data.user.id);
  } else if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return go(data.user.id);
  }

  return NextResponse.redirect(new URL("/login?error=link", origin));
}
