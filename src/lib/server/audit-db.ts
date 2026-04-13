import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "@/db/schema";

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

function createAuditPool() {
  const connectionString = getAuditConnectionString();

  if (!connectionString) {
    throw new Error(
      "AUDIT_DATABASE_URL or DATABASE_URL must be set before using the audit client.",
    );
  }

  return new Pool({
    connectionString,
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
