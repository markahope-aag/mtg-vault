import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  isAllowedEmail,
  isAuthRoutePath,
  parseAllowedEmails,
  shouldBypassAuth,
} from "@/lib/auth/allowlist";

export async function proxy(req: NextRequest) {
  let res = NextResponse.next({ request: req });

  const path = req.nextUrl.pathname;
  if (shouldBypassAuth(path)) return res;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            req.cookies.set(name, value),
          );
          res = NextResponse.next({ request: req });
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const allowList = parseAllowedEmails(process.env.ALLOWED_EMAIL);
  if (allowList.length === 0) {
    // Fail loud server-side. Empty ALLOWED_EMAIL silently locks every
    // user out — login still works, magic links still send, but every
    // authenticated request gets signed-out + redirected with
    // ?error=not_allowed. Surface that as a real config error so the
    // deploy is obviously broken instead of mysteriously empty.
    console.error(
      "[proxy] ALLOWED_EMAIL is empty or unset. No user will be allowed past auth. Set it to a comma-separated list of allowed emails in .env.local (and on Vercel).",
    );
  }
  const isAllowed = isAllowedEmail(user?.email, allowList);

  if (isAuthRoutePath(path)) {
    if (isAllowed) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return res;
  }

  if (!user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (!isAllowed) {
    await supabase.auth.signOut();
    return NextResponse.redirect(
      new URL("/login?error=not_allowed", req.url),
    );
  }

  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
