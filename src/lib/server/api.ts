import { ZodError } from "zod";

import { getResponseTelemetryHeaders } from "@/lib/server/observability";

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

function mergeHeaders(init?: ResponseInit, telemetryHeaders?: Record<string, string>) {
  const headers = new Headers(init?.headers);
  if (telemetryHeaders) {
    Object.entries(telemetryHeaders).forEach(([key, value]) => {
      headers.set(key, value);
    });
  }

  return headers;
}

export function ok(
  data: unknown,
  init?: ResponseInit,
  request?: Request | Headers,
) {
  return Response.json(data, {
    ...init,
    headers: mergeHeaders(init, request ? getResponseTelemetryHeaders(request) : undefined),
  });
}

export function created(data: unknown, request?: Request | Headers) {
  return Response.json(data, {
    status: 201,
    headers: mergeHeaders(undefined, request ? getResponseTelemetryHeaders(request) : undefined),
  });
}

export function noContent() {
  return new Response(null, { status: 204 });
}

export function errorResponse(error: unknown, request?: Request | Headers) {
  const telemetry = request ? getResponseTelemetryHeaders(request) : undefined;
  if (error instanceof ApiError) {
    return Response.json(
      {
        error: error.message,
        details: error.details ?? null,
      },
      { status: error.status, headers: mergeHeaders(undefined, telemetry) },
    );
  }

  if (error instanceof ZodError) {
    return Response.json(
      {
        error: "Validation error",
        details: error.flatten(),
      },
      { status: 400, headers: mergeHeaders(undefined, telemetry) },
    );
  }

  return Response.json(
    {
      error: "Unexpected server error",
    },
    { status: 500, headers: mergeHeaders(undefined, telemetry) },
  );
}

export async function readJson<T>(request: Request) {
  return (await request.json()) as T;
}

export function getIdempotencyKey(request: Request) {
  return (
    request.headers.get("Idempotency-Key") ??
    request.headers.get("X-Idempotency-Key") ??
    undefined
  );
}
