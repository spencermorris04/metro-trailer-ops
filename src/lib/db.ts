import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "@/db/schema";

declare global {
  var __metroTrailerPool: Pool | undefined;
}

function createPool() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL must be set before using the Drizzle client.");
  }

  return new Pool({
    connectionString: normalizePostgresConnectionString(connectionString),
    max: getDatabasePoolMax(),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    allowExitOnIdle: true,
  });
}

function getDatabasePoolMax() {
  const configured = Number(process.env.DATABASE_POOL_MAX ?? "");
  if (Number.isInteger(configured) && configured > 0) {
    return configured;
  }

  return process.env.VERCEL || process.env.NODE_ENV === "production" ? 1 : 5;
}

function normalizePostgresConnectionString(connectionString: string) {
  const url = new URL(connectionString);

  // PlanetScale supplies sslrootcert=system for libpq-style clients. node-postgres
  // treats sslrootcert as a filesystem path, so keep verify-full TLS but drop the
  // pseudo-root value before creating the pool.
  if (url.searchParams.get("sslrootcert") === "system") {
    url.searchParams.delete("sslrootcert");
  }

  return url.toString();
}

export const pool = globalThis.__metroTrailerPool ?? createPool();

if (process.env.NODE_ENV !== "production") {
  globalThis.__metroTrailerPool = pool;
}

export const db = drizzle(pool, {
  schema,
  casing: "snake_case",
});

export { schema };
