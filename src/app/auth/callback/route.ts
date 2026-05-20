import { createServerClient } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const otpType = url.searchParams.get("type") as EmailOtpType | null;
  const next = url.searchParams.get("next") ?? "/dashboard";

  // Honour x-forwarded-host so cookies are scoped to the public domain
  // (e.g. mtgvault.app), not Vercel's internal hostname.
  const forwardedHost = req.headers.get("x-forwarded-host");
  const forwardedProto = req.headers.get("x-forwarded-proto") ?? "https";
  const publicOrigin = forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : url.origin;

  if (!code && !tokenHash) {
    return NextResponse.redirect(`${publicOrigin}/login?error=no_code`);
  }

  // Pre-construct the redirect response so the Supabase client can write
  // session cookies directly onto the response we're returning.
  const response = NextResponse.redirect(`${publicOrigin}${next}`);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Two possible link formats depending on the Supabase email template:
  //   1. ?code=<auth_code>            (PKCE flow — default for @supabase/ssr)
  //   2. ?token_hash=<hash>&type=...  (older verify flow — what the default
  //      email template emits unless customised)
  let authError: { message: string } | null = null;
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    authError = error;
  } else if (tokenHash && otpType) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: otpType,
    });
    authError = error;
  } else {
    authError = { message: "Missing type parameter" };
  }

  if (authError) {
    console.error("[auth/callback] failed:", authError);
    return NextResponse.redirect(
      `${publicOrigin}/login?error=callback_failed&detail=${encodeURIComponent(authError.message)}`,
    );
  }

  return response;
}
