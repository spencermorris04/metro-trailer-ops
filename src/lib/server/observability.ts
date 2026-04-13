import { randomUUID } from "node:crypto";

type LogLevel = "info" | "warn" | "error";

type LogContext = Record<string, unknown>;

function getHeader(headers: Headers, key: string) {
  return headers.get(key) ?? null;
}

export function getRequestTelemetry(request?: Request | Headers) {
  const headers = request instanceof Headers ? request : request?.headers;
  const requestId =
    (headers ? getHeader(headers, "x-request-id") : null) ?? randomUUID();
  const correlationId =
    (headers ? getHeader(headers, "x-correlation-id") : null) ?? requestId;

  return {
    requestId,
    correlationId,
  };
}

export function getResponseTelemetryHeaders(request?: Request | Headers) {
  const telemetry = getRequestTelemetry(request);
  return {
    "x-request-id": telemetry.requestId,
    "x-correlation-id": telemetry.correlationId,
  };
}

export function logEvent(
  level: LogLevel,
  message: string,
  context: LogContext = {},
  request?: Request | Headers,
) {
  const telemetry = getRequestTelemetry(request);
  const payload = {
    level,
    message,
    requestId: telemetry.requestId,
    correlationId: telemetry.correlationId,
    timestamp: new Date().toISOString(),
    ...context,
  };

  const serialized = JSON.stringify(payload);
  if (level === "error") {
    console.error(serialized);
    return;
  }
  if (level === "warn") {
    console.warn(serialized);
    return;
  }
  console.info(serialized);
}

export function getObservabilityConfig() {
  return {
    sentry: {
      configured: Boolean(process.env.SENTRY_DSN),
      environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? "development",
    },
    cloudWatch: {
      configured: Boolean(
        process.env.AWS_REGION && process.env.METRO_TRAILER_CLOUDWATCH_NAMESPACE,
      ),
      region: process.env.AWS_REGION ?? null,
      namespace: process.env.METRO_TRAILER_CLOUDWATCH_NAMESPACE ?? null,
    },
  };
}

export function captureException(
  error: unknown,
  context: LogContext = {},
  request?: Request | Headers,
) {
  const message = error instanceof Error ? error.message : String(error);
  logEvent(
    "error",
    "Unhandled application error",
    {
      ...context,
      errorMessage: message,
      stack: error instanceof Error ? error.stack : undefined,
      sentryConfigured: getObservabilityConfig().sentry.configured,
    },
    request,
  );
}
