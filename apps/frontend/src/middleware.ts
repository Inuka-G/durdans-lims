import { NextRequest, NextResponse } from "next/server";

/**
 * Server-side gate for protected routes. Runs before any protected page is
 * served, so the app shell is never delivered to a request with no session —
 * a defense-in-depth layer on top of the client RoleGuard and the backend,
 * which validates the JWT on every API call.
 *
 * The gate checks the presence of the `kc_session` cookie set by AuthProvider
 * after a successful Keycloak login. (Full server-side JWT signature
 * verification — token-in-cookie + JWKS via `jose` — is the planned hardening
 * follow-up; this already closes the "navigate straight to a protected URL with
 * no session" hole the client-only guard left open.)
 */
const PUBLIC_PATHS = ["/login"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only genuine static-asset extensions are public — NOT any path containing a
  // dot (a dynamic id like /verification/review/RES.123 must still be gated).
  const isStaticAsset =
    /\.(?:png|jpe?g|gif|svg|ico|css|js|mjs|map|woff2?|ttf|eot|webp|avif|html|txt|json)$/i.test(pathname);

  const isPublic =
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/")) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    isStaticAsset;

  if (isPublic) {
    return NextResponse.next();
  }

  const hasSession = request.cookies.get("kc_session")?.value === "1";
  if (!hasSession) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Run on everything except Next internals and the favicon.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
