import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const publicPagePrefixes = ["/login", "/sign", "/esign/bc-preview"];
const sessionCookieNames = [
  "better-auth.session_token",
  "__Secure-better-auth.session_token",
];

function getOrCreateHeaderValue(request: NextRequest, key: string) {
  return request.headers.get(key) ?? crypto.randomUUID();
}

function hasSessionCookie(request: NextRequest) {
  return sessionCookieNames.some((name) => Boolean(request.cookies.get(name)?.value));
}

function isPublicPage(pathname: string) {
  return publicPagePrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function shouldGate(pathname: string) {
  return (
    !pathname.startsWith("/api/") &&
    !isPublicPage(pathname) &&
    !/\.[^/]+$/.test(pathname)
  );
}

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const requestHeaders = new Headers(request.headers);
  const requestId = getOrCreateHeaderValue(request, "x-request-id");
  const correlationId = getOrCreateHeaderValue(request, "x-correlation-id");

  requestHeaders.set("x-request-id", requestId);
  requestHeaders.set("x-correlation-id", correlationId);
  requestHeaders.set("x-metro-pathname", pathname);

  if (shouldGate(pathname) && !hasSessionCookie(request)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", `${pathname}${request.nextUrl.search}`);
    const response = NextResponse.redirect(loginUrl);
    response.headers.set("x-request-id", requestId);
    response.headers.set("x-correlation-id", correlationId);
    return response;
  }

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  response.headers.set("x-request-id", requestId);
  response.headers.set("x-correlation-id", correlationId);

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
