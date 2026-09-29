import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isAuthApiError } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { safeNextPath } from "@/lib/utils";
import type { Database } from "@/types/database";

/** Paths reachable without signing in. */
// /portal is a client's private link; /api/jobs checks its own shared secret.
const PUBLIC_PATHS = ["/login", "/signup", "/forgot-password", "/auth", "/intake", "/apply", "/thanks", "/portal", "/api/jobs"];

const isPublicPath = (path: string) =>
  PUBLIC_PATHS.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));

/**
 * Refreshes the Supabase session cookie on every request and redirects
 * signed-out visitors to /login. This is an optimistic check only; pages
 * and server actions verify the user (and role) again.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(env.supabaseUrl, env.supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        // Keeps CDNs from caching a response that carries a session cookie.
        for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value);
      },
    },
  });

  // Do not run code between createServerClient and getClaims(): it is what
  // refreshes an expired session.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);
  const { pathname, search } = request.nextUrl;

  const redirectTo = (path: string) => {
    const url = new URL(path, request.nextUrl.origin);
    if (path === "/login" && pathname !== "/") url.searchParams.set("next", pathname + search);
    const redirect = NextResponse.redirect(url);
    // Carry over any refreshed session cookies.
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  };

  // Never redirect a server action POST: the client can't follow it and shows
  // "An unexpected response was received from the server". Actions check the
  // user themselves and answer with a redirect the client does understand.
  if (request.headers.has("next-action")) return response;

  if (!signedIn && !isPublicPath(pathname)) return redirectTo("/login");
  // Already signed in: carry on to where they were going. (People without a
  // workspace are sent on to /welcome by the app.)
  if (signedIn && (pathname === "/login" || pathname === "/signup" || pathname === "/")) {
    // A session can outlive its account (a deleted user, or a local db
    // reset). The app sends those to /login, so check with Supabase Auth
    // before sending them back, or the two redirect each other forever.
    const { error } = await supabase.auth.getUser();
    if (!error || !isAuthApiError(error)) {
      return redirectTo(safeNextPath(request.nextUrl.searchParams.get("next")));
    }
    await supabase.auth.signOut({ scope: "local" });
    if (pathname === "/") return redirectTo("/login");
  }

  return response;
}
