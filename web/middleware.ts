import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options as any)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;

  const isAuth         = pathname.startsWith("/login") || pathname.startsWith("/signup") || pathname.startsWith("/admin-login") || pathname.startsWith("/update-password");
  const isApp          = pathname.startsWith("/dashboard") || pathname.startsWith("/onboarding") || pathname.startsWith("/guide") || pathname.startsWith("/guide-suggestions");
  const isAdmin        = pathname === "/admin" || pathname.startsWith("/admin/");
  const isPortal       = pathname.startsWith("/portal");

  // Unauthenticated users hitting /admin go to the admin login page.
  if (isAdmin && !user) {
    return NextResponse.redirect(new URL("/admin-login", request.url));
  }

  // Unauthenticated users hitting other protected routes go to the regular login.
  if ((isApp || isPortal) && !user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Authenticated users don't need the auth pages (except update-password which needs a session).
  if ((pathname.startsWith("/login") || pathname.startsWith("/signup") || pathname.startsWith("/admin-login")) && user) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Admin routes get a second server-side role check in the layout (defense in depth).
  // Middleware only enforces the auth session — role enforcement lives in requireAdmin().

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)"],
};
