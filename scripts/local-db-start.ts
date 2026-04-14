import "dotenv/config";

import fs from "node:fs";
import fsp from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const rootDir = process.cwd();
const runtimeDir = path.join(rootDir, "artifacts", "local-postgres");
const statusFile = path.join(runtimeDir, "status.json");
const logFile = path.join(runtimeDir, "server.log");
const errorFile = path.join(runtimeDir, "server.err.log");
const require = createRequire(import.meta.url);

function getPort() {
  const url = new URL(
    process.env.DATABASE_URL ??
      "postgresql://postgres:postgres@127.0.0.1:5432/metro_trailer?schema=public",
  );

  return Number(url.port || 5432);
}

function isPortOpen(port: number) {
  return new Promise<boolean>((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });

    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });

    socket.once("error", () => resolve(false));
    socket.setTimeout(1_000, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function waitForReady(port: number, timeoutMs = 45_000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if ((await isPortOpen(port)) && fs.existsSync(statusFile)) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 750));
  }

  throw new Error("Timed out waiting for the local Postgres server to start.");
}

async function main() {
  const port = getPort();

  await fsp.mkdir(runtimeDir, { recursive: true });

  if (await isPortOpen(port)) {
    console.log(`Local Postgres already responds on port ${port}.`);
    return;
  }

  const tsxPackageJson = require.resolve("tsx/package.json");
  const tsxCli = path.join(path.dirname(tsxPackageJson), "dist", "cli.mjs");

  const out = fs.openSync(logFile, "a");
  const err = fs.openSync(errorFile, "a");

  const child = spawn(process.execPath, [tsxCli, "scripts/local-db-serve.ts"], {
    cwd: rootDir,
    detached: true,
    stdio: ["ignore", out, err],
    env: process.env,
  });

  child.unref();

  await waitForReady(port);

  console.log(`Local Postgres started on port ${port}.`);
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
