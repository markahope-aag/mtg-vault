import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(req: NextRequest) {
  let res = NextResponse.next({ request: req });

  const path = req.nextUrl.pathname;
  if (path.startsWith("/api/cron")) return res;

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

  const allowList = (process.env.ALLOWED_EMAIL ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const userEmail = user?.email?.toLowerCase() ?? null;
  const isAllowed = userEmail !== null && allowList.includes(userEmail);

  const isAuthRoute =
    path.startsWith("/login") || path.startsWith("/auth/");

  if (isAuthRoute) {
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
