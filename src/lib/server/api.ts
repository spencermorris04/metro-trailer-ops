import { ZodError } from "zod";

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function ok(data: unknown, init?: ResponseInit) {
  return Response.json(data, init);
}

export function created(data: unknown) {
  return Response.json(data, { status: 201 });
}

export function noContent() {
  return new Response(null, { status: 204 });
}

export function errorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return Response.json(
      {
        error: error.message,
        details: error.details ?? null,
      },
      { status: error.status },
    );
  }

  if (error instanceof ZodError) {
    return Response.json(
      {
        error: "Validation error",
        details: error.flatten(),
      },
      { status: 400 },
    );
  }

  return Response.json(
    {
      error: "Unexpected server error",
    },
    { status: 500 },
  );
}

export async function readJson<T>(request: Request) {
  return (await request.json()) as T;
}
