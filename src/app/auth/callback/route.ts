import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/dashboard";

  // Honour x-forwarded-host so cookies land on the domain the browser sees
  // (mtgvault.app) rather than Vercel's internal hostname.
  const forwardedHost = req.headers.get("x-forwarded-host");
  const forwardedProto = req.headers.get("x-forwarded-proto") ?? "https";
  const publicOrigin = forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : url.origin;

  if (!code) {
    return NextResponse.redirect(`${publicOrigin}/login?error=no_code`);
  }

  // Pre-construct the redirect response so the Supabase client can write
  // session cookies directly onto the response we're returning. This is the
  // pattern that survives Next.js's request/response boundary cleanly under
  // both `middleware`/`proxy` and route handlers in Next 16.
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

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("[auth/callback] exchangeCodeForSession failed:", error);
    return NextResponse.redirect(
      `${publicOrigin}/login?error=callback_failed&detail=${encodeURIComponent(error.message)}`,
    );
  }

  return response;
}
