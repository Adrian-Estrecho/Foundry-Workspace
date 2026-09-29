import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/utils";

/**
 * /w/<workspace id>?next=/path: links in emails and notifications. Switches
 * to that workspace first (the reader may be working in another one), then
 * opens the page. Someone who isn't a member just lands on their dashboard.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/w/[workspaceId]">) {
  const { workspaceId } = await ctx.params;
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  const supabase = await createClient();

  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) {
    const login = new URL("/login", request.nextUrl.origin);
    login.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(login);
  }

  const { error } = await supabase.rpc("set_active_workspace", { p_workspace_id: workspaceId });
  return NextResponse.redirect(new URL(error ? "/dashboard" : next, request.nextUrl.origin));
}
