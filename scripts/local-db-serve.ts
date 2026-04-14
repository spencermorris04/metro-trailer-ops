import "dotenv/config";

import fs from "node:fs/promises";
import path from "node:path";

import EmbeddedPostgres from "embedded-postgres";

const rootDir = process.cwd();
const runtimeDir = path.join(rootDir, "artifacts", "local-postgres");
const dataDir = path.join(runtimeDir, "data");
const statusFile = path.join(runtimeDir, "status.json");

function getDatabaseConfig() {
  const url = new URL(
    process.env.DATABASE_URL ??
      "postgresql://postgres:postgres@127.0.0.1:5432/metro_trailer?schema=public",
  );

  return {
    host: url.hostname || "127.0.0.1",
    port: Number(url.port || 5432),
    user: decodeURIComponent(url.username || "postgres"),
    password: decodeURIComponent(url.password || "postgres"),
    database: url.pathname.replace(/^\//, "") || "metro_trailer",
  };
}

async function ensureDatabaseExists(
  pg: EmbeddedPostgres,
  database: string,
  host: string,
) {
  const client = pg.getPgClient("postgres", host);
  await client.connect();

  try {
    const result = await client.query<{ present: number }>(
      "select 1 as present from pg_database where datname = $1 limit 1",
      [database],
    );

    if (result.rowCount === 0) {
      await client.query(`create database "${database.replace(/"/g, "\"\"")}"`);
    }
  } finally {
    await client.end();
  }
}

async function writeStatus(payload: Record<string, unknown>) {
  await fs.mkdir(runtimeDir, { recursive: true });
  await fs.writeFile(statusFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function removeStatusFile() {
  await fs.rm(statusFile, { force: true });
}

async function main() {
  const config = getDatabaseConfig();

  await fs.mkdir(runtimeDir, { recursive: true });

  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: config.user,
    password: config.password,
    port: config.port,
    persistent: true,
    onLog(message) {
      console.log(`[embedded-postgres] ${message}`);
    },
    onError(message) {
      console.error(`[embedded-postgres] ${String(message)}`);
    },
  });

  const shutdown = async (signal: string) => {
    console.log(`[embedded-postgres] shutting down on ${signal}`);
    try {
      await pg.stop();
    } finally {
      await removeStatusFile();
      process.exit(0);
    }
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  await pg.initialise();
  await pg.start();
  await ensureDatabaseExists(pg, config.database, config.host);

  await writeStatus({
    pid: process.pid,
    host: config.host,
    port: config.port,
    user: config.user,
    database: config.database,
    startedAt: new Date().toISOString(),
    dataDir,
  });

  console.log(
    `[embedded-postgres] ready on postgresql://${config.user}:***@${config.host}:${config.port}/${config.database}`,
  );

  setInterval(() => {
    void writeStatus({
      pid: process.pid,
      host: config.host,
      port: config.port,
      user: config.user,
      database: config.database,
      startedAt: new Date().toISOString(),
      dataDir,
    });
  }, 30_000).unref();

  await new Promise(() => undefined);
}

void main().catch(async (error) => {
  console.error(error);
  await removeStatusFile();
  process.exit(1);
});
