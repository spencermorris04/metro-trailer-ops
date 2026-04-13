import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

function getOrCreateHeaderValue(request: NextRequest, key: string) {
  return request.headers.get(key) ?? crypto.randomUUID();
}

export function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  const requestId = getOrCreateHeaderValue(request, "x-request-id");
  const correlationId = getOrCreateHeaderValue(request, "x-correlation-id");

  requestHeaders.set("x-request-id", requestId);
  requestHeaders.set("x-correlation-id", correlationId);

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
