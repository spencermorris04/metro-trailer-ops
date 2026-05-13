import "dotenv/config";

import { rebuildServingFacts } from "@/lib/server/projections";
import { refreshAllReadModels } from "@/lib/server/read-model-refresh";

async function main() {
  const readModels = await refreshAllReadModels();
  const serving = await rebuildServingFacts();
  console.log(JSON.stringify({ readModels, serving }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
