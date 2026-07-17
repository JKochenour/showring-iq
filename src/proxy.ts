import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// "/shows" (exact) is the PUBLIC find-shows directory; the staff-side
// show pages all live under "/shows/<id>/..." — hence the trailing slash.
const PROTECTED_PREFIXES = ["/dashboard", "/organizations", "/shows/"];
const AUTH_PAGES = ["/login", "/signup"];

export default async function proxy(request: NextRequest) {
  // Pre-launch site gate. When SITE_GATE_PASSWORD is set (production, while
  // the app isn't public yet) every route sits behind one shared HTTP Basic
  // Auth password. Unset (local dev) = no gate. Remove the env var — or this
  // block — at public launch. Runs before anything else so bots never even
  // reach Supabase. Any username is accepted; only the password is checked.
  const gate = process.env.SITE_GATE_PASSWORD;
  if (gate) {
    const header = request.headers.get("authorization") ?? "";
    let ok = false;
    if (header.startsWith("Basic ")) {
      try {
        const decoded = atob(header.slice(6));
        ok = decoded.slice(decoded.indexOf(":") + 1) === gate;
      } catch {
        ok = false;
      }
    }
    if (!ok) {
      return new NextResponse("Private preview — authentication required.", {
        status: 401,
        headers: {
          "WWW-Authenticate": 'Basic realm="ShowRing IQ private preview"',
        },
      });
    }
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the session token. Do not run code between createServerClient
  // and getUser() — it can cause random logouts.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some((p) => path.startsWith(p));
  const isAuthPage = AUTH_PAGES.includes(path);

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (user && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    // Everything except static assets and images
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
