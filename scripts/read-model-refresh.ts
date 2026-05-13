import "dotenv/config";

import { pool } from "@/lib/db";
import { refreshAllReadModels } from "@/lib/server/read-model-refresh";

async function main() {
  const result = await refreshAllReadModels();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main()
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
