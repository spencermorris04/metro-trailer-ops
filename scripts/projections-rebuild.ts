import "dotenv/config";

import { rebuildServingFacts } from "@/lib/server/projections";
import { refreshAllReadModels } from "@/lib/server/read-model-refresh";

const servingOnly = process.argv.includes("--serving-only");
const includeReadModels = process.argv.includes("--include-read-models");

async function main() {
  const readModels = servingOnly && !includeReadModels ? null : await refreshAllReadModels();
  const serving = await rebuildServingFacts();
  console.log(JSON.stringify({ readModels, serving }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
