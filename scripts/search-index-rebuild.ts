import "dotenv/config";

import { performance } from "node:perf_hooks";

import { pool } from "@/lib/db";
import { rebuildGlobalSearchIndex } from "@/lib/server/search-index";

async function main() {
  const start = performance.now();
  const count = await rebuildGlobalSearchIndex();
  const durationMs = Number((performance.now() - start).toFixed(2));

  process.stdout.write(
    `${JSON.stringify({ indexedDocuments: count, durationMs }, null, 2)}\n`,
  );
}

main()
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
