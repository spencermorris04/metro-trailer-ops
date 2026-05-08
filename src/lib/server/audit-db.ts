import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "@/db/schema";
import { isProductionRuntime } from "@/lib/server/runtime";

declare global {
  var __metroTrailerAuditPool: Pool | undefined;
}

function getAuditConnectionString() {
  return (
    process.env.AUDIT_DATABASE_URL?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    null
  );
}

function normalizeConnectionString(connectionString: string | null) {
  if (!connectionString) {
    return null;
  }

  try {
    const url = new URL(connectionString);
    url.hash = "";
    url.searchParams.sort();
    return url.toString();
  } catch {
    return connectionString.trim();
  }
}

function normalizePostgresConnectionString(connectionString: string) {
  const url = new URL(connectionString);

  if (url.searchParams.get("sslrootcert") === "system") {
    url.searchParams.delete("sslrootcert");
  }

  return url.toString();
}

function getDatabasePoolMax() {
  const configured = Number(process.env.DATABASE_POOL_MAX ?? "");
  if (Number.isInteger(configured) && configured > 0) {
    return configured;
  }

  return process.env.VERCEL || process.env.NODE_ENV === "production" ? 1 : 5;
}

export function getAuditStoreReadiness() {
  const auditUrl = process.env.AUDIT_DATABASE_URL?.trim() || null;
  const primaryUrl = process.env.DATABASE_URL?.trim() || null;
  const auditConfigured = Boolean(auditUrl);
  const sameDatabase =
    normalizeConnectionString(auditUrl) !== null &&
    normalizeConnectionString(auditUrl) === normalizeConnectionString(primaryUrl);

  return {
    auditConfigured,
    sameDatabase,
    productionSafe: auditConfigured && !sameDatabase,
    requiredInProduction: isProductionRuntime(),
  };
}

function createAuditPool() {
  const connectionString = getAuditConnectionString();

  if (!connectionString) {
    throw new Error(
      "AUDIT_DATABASE_URL or DATABASE_URL must be set before using the audit client.",
    );
  }

  return new Pool({
    connectionString: normalizePostgresConnectionString(connectionString),
    max: getDatabasePoolMax(),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    allowExitOnIdle: true,
  });
}

export const auditPool = globalThis.__metroTrailerAuditPool ?? createAuditPool();

if (process.env.NODE_ENV !== "production") {
  globalThis.__metroTrailerAuditPool = auditPool;
}

export const auditDb = drizzle(auditPool, {
  schema,
  casing: "snake_case",
});

export function isDedicatedAuditStoreConfigured() {
  return Boolean(process.env.AUDIT_DATABASE_URL?.trim());
}
