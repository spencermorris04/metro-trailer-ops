import {
  ExistingTelematicsTracker,
  enrichTelematicsAddress,
  fetchExistingTelematicsTrackers,
  getBcAccessToken,
  resolveCompanyId,
  runWithConcurrency,
  upsertTelematicsTracker,
} from "./shared";

type Options = {
  write: boolean;
  limit: number | null;
  provider: string;
  concurrency: number;
};

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const get = (name: string) => {
    const prefix = `--${name}=`;
    return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length).trim() ?? "";
  };

  return {
    write: args.includes("--write"),
    limit: get("limit") ? Number(get("limit")) : null,
    provider: get("provider"),
    concurrency: Number(get("concurrency") || process.env.TELEMATICS_REVERSE_GEOCODE_CONCURRENCY || "5"),
  };
}

async function main() {
  const options = parseArgs();
  const accessToken = await getBcAccessToken();
  const companyId = await resolveCompanyId(accessToken);
  const existingState = await fetchExistingTelematicsTrackers(accessToken, companyId);
  if (!existingState.apiAvailable) {
    throw new Error("Telematics API is not available in Business Central. Upload the Telematics extension first.");
  }

  const candidates = [...existingState.existing.values()]
    .filter((row) => rowNeedsAddress(row))
    .filter((row) => !options.provider || row.provider === options.provider);
  const limited = options.limit ? candidates.slice(0, options.limit) : candidates;
  const counters = {
    candidates: candidates.length,
    processed: limited.length,
    updated: 0,
    skipped: 0,
    failed: 0,
  };
  let completed = 0;

  console.log(
    JSON.stringify({
      event: "telematics-reverse-geocode-start",
      write: options.write,
      companyId,
      candidates: counters.candidates,
      processed: counters.processed,
      provider: options.provider || "all",
      concurrency: options.concurrency,
    }),
  );

  await runWithConcurrency(limited, options.concurrency, async (row) => {
    try {
      const enriched = await enrichTelematicsAddress(row);
      if (!enriched.address) {
        counters.skipped += 1;
        return;
      }

      const result = await upsertTelematicsTracker(accessToken, companyId, existingState.existing, enriched, options.write);
      if (result === "updated") {
        counters.updated += 1;
      } else {
        counters.skipped += 1;
      }
    } catch (error) {
      counters.failed += 1;
      console.error(
        `[telematics] Reverse geocode failed for ${row.provider}/${row.providerTrackerId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      completed += 1;
      if (completed % 25 === 0 || completed === limited.length) {
        console.log(
          JSON.stringify({
            event: "telematics-reverse-geocode-progress",
            completed,
            processed: counters.processed,
            updated: counters.updated,
            skipped: counters.skipped,
            failed: counters.failed,
          }),
        );
      }
    }
  });

  console.log(JSON.stringify({ write: options.write, companyId, ...counters }, null, 2));
}

function rowNeedsAddress(row: ExistingTelematicsTracker) {
  return !row.address &&
    typeof row.latitude === "number" &&
    typeof row.longitude === "number" &&
    Number.isFinite(row.latitude) &&
    Number.isFinite(row.longitude) &&
    (row.latitude !== 0 || row.longitude !== 0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
