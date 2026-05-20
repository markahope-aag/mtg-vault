import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/dashboard";

  // Behind a proxy (Vercel), req.url's origin can be the internal host.
  // Use the forwarded host so cookies are set for the domain the browser sees.
  const forwardedHost = req.headers.get("x-forwarded-host");
  const forwardedProto = req.headers.get("x-forwarded-proto") ?? "https";
  const publicOrigin = forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : url.origin;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${publicOrigin}${next}`);
    }
    console.error("[auth/callback] exchangeCodeForSession failed:", error);
    return NextResponse.redirect(
      `${publicOrigin}/login?error=callback_failed&detail=${encodeURIComponent(error.message)}`,
    );
  }

  return NextResponse.redirect(`${publicOrigin}/login?error=no_code`);
}
