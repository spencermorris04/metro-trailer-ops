import "dotenv/config";

import fs from "node:fs/promises";
import path from "node:path";

const statusFile = path.join(process.cwd(), "artifacts", "local-postgres", "status.json");

async function main() {
  try {
    const content = await fs.readFile(statusFile, "utf8");
    const parsed = JSON.parse(content) as { pid?: number };

    if (!parsed.pid) {
      console.log("No local Postgres PID was recorded.");
      return;
    }

    if (process.platform === "win32") {
      const { spawnSync } = await import("node:child_process");
      spawnSync("taskkill", ["/pid", String(parsed.pid), "/f", "/t"], {
        stdio: "inherit",
      });
    } else {
      process.kill(parsed.pid, "SIGTERM");
    }

    await fs.rm(statusFile, { force: true });
    console.log("Local Postgres stop signal sent.");
  } catch (error) {
    console.log("No local Postgres status file found.");
    if (error instanceof Error && !/ENOENT/.test(error.message)) {
      throw error;
    }
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
