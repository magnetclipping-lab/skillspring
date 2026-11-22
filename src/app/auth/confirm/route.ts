import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/utils";

/**
 * Handles links from Supabase Auth emails (sign-up verification, password reset,
 * email change). Supports both the token_hash template and the PKCE `code` flow.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = safeRedirectPath(url.searchParams.get("next"), "/dashboard");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const code = url.searchParams.get("code");
  const supabase = await createClient();

  let ok = false;
  if (tokenHash && type) ok = !(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error;
  else if (code) ok = !(await supabase.auth.exchangeCodeForSession(code)).error;

  const dest = request.nextUrl.clone();
  dest.search = "";
  if (ok) {
    dest.pathname = next;
    return NextResponse.redirect(dest);
  }
  dest.pathname = "/login";
  dest.searchParams.set("error", "link");
  return NextResponse.redirect(dest);
}
