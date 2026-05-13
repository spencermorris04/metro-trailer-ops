import "dotenv/config";

import { syncTypesenseDocuments } from "@/lib/server/search/search-provider";

async function main() {
  const count = await syncTypesenseDocuments({
    full: process.argv.includes("--full"),
  });
  console.log(JSON.stringify({ syncedDocuments: count }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
