import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { CORRELATION_HEADER, createCorrelationId } from "@/lib/correlation";
import { getPublicEnv, isAuthAllowlistConfigured, isSupabaseConfigured } from "@/lib/env";

const PUBLIC_PATHS = [
  "/login",
  "/denied",
  "/auth/callback",
  "/auth/signout",
  "/api/health",
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export async function middleware(request: NextRequest) {
  const correlationId =
    request.headers.get(CORRELATION_HEADER) ?? createCorrelationId();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(CORRELATION_HEADER, correlationId);

  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    const response = NextResponse.next({
      request: { headers: requestHeaders },
    });
    response.headers.set(CORRELATION_HEADER, correlationId);
    return response;
  }

  if (!isSupabaseConfigured() || !isAuthAllowlistConfigured()) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("reason", "configuration");
    const response = NextResponse.redirect(loginUrl);
    response.headers.set(CORRELATION_HEADER, correlationId);
    return response;
  }

  const env = getPublicEnv();
  let supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  });

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL!,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          supabaseResponse = NextResponse.next({
            request: { headers: requestHeaders },
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  supabaseResponse.headers.set(CORRELATION_HEADER, correlationId);

  if (!user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    const redirectResponse = NextResponse.redirect(loginUrl);
    redirectResponse.headers.set(CORRELATION_HEADER, correlationId);
    return redirectResponse;
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
