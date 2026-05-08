import "dotenv/config";

import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required before running Drizzle Kit commands.");
}

function normalizePostgresConnectionString(connectionString: string) {
  const url = new URL(connectionString);

  if (url.searchParams.get("sslrootcert") === "system") {
    url.searchParams.delete("sslrootcert");
  }

  return url.toString();
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: normalizePostgresConnectionString(databaseUrl),
  },
  casing: "snake_case",
  breakpoints: true,
});
