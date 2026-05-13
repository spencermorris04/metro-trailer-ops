import "dotenv/config";

import { processProjectionEvents } from "@/lib/server/projections";

const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.slice("--limit=".length)) : 500;

async function main() {
  const result = await processProjectionEvents(Number.isFinite(limit) ? limit : 500);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
