# Record360

This folder contains the Record360 ingestion workflow for Metro Trailer.

## What lives here

- `scripts/test-record360-fetch.ts`
  Fetches Record360 API data into a local JSON export.
- `scripts/record360-sync-bc.ts`
  Normalizes Record360 inspections, matches them to Business Central fixed assets, and upserts the custom `record360Inspections`, `record360SyncRuns`, and `record360SyncErrors` API pages.

Generated outputs still land in `artifacts/record360/` at the repo root so the rest of the app can keep using a stable artifacts location.

## Overall methodology

The integration is intentionally split into two phases:

1. Fetch source data from Record360.
2. Normalize and sync inspections into Business Central.

The sync logic is designed around the Business Central inspection table, not the raw Record360 JSON shape. The source payload is treated as input, then mapped into the BC business object:

- one BC row per Record360 inspection
- resolved trailer number when a unique fixed-asset match is found
- explicit `Match Status`, `Matched By`, `Sync Status`, and `Last Error`

The general integration pattern is:

1. fetch a bounded source slice
2. normalize into the BC business object
3. dedupe client-side if the source can overlap
4. match only when needed
5. upsert BC rows idempotently
6. persist run-level observability in BC

That methodology is what the SkyBitz sync now follows as well, except SkyBitz uses time-window polling while Record360 will eventually be best served by webhooks or smaller created/updated windows.

## Record360 fetch script

`scripts/test-record360-fetch.ts` supports:

- resource selection: `units`, `tasks`, `inspections`
- paging controls
- inspection date windows via `--created-after` and `--created-before`
- JSON export output

Typical usage:

```bash
npm run record360:test-fetch -- --resources=inspections --created-after=2026-04-28T04:00:00Z
```

Record360 date filtering only applies to `inspections`, because that endpoint supports `created_after` / `created_before`.

## BC sync script

`scripts/record360-sync-bc.ts` reads a local Record360 export and pushes inspection rows into Business Central using app-only OAuth.

Key behaviors:

- exact matching by:
  - `Serial_No`
  - `No`
  - `RMI_Service_Item_No`
- safe fallback matching, always unique-hit-only:
  - alphanumeric prefix matching on `No` / `RMI_Service_Item_No`
  - VIN suffix matching on `Serial_No`
  - numeric suffix matching on `No` / `RMI_Service_Item_No`
- dry-run or write mode
- inspection date filtering with `--created-after` / `--created-before`
- retry mode for only the currently unmatched BC rows via `--only-bc-unmatched`
- on-demand fixed-asset filtering via `--trailer-no`

Typical usage:

```bash
npm run record360:sync:bc -- --write --input=artifacts/record360/record360-inspections-created-today-2026-04-28.json
```

Retry only unmatched BC rows:

```bash
npm run record360:sync:bc -- --write --only-bc-unmatched
```

Run a narrow on-demand sync for one fixed asset number:

```bash
npm run record360:sync:bc -- --write --trailer-no=533442
```

The on-demand mode filters by Record360 unit reference number and customer unit number before matching/upserting. It is intentionally narrow so a FactBox button request does not reprocess the full inspection history.

## Environment

Record360 fetch uses:

- `RECORD360_API_KEY_ID`
- `RECORD360_API_KEY_SECRET`

Business Central sync uses:

- `METRO_GRAPH_TENANT_ID`
- `METRO_GRAPH_CLIENT_ID`
- `METRO_GRAPH_CLIENT_SECRET`
- `METRO_BC_ENVIRONMENT`
- `METRO_BC_COMPANY`
- optional `METRO_BC_COMPANY_ID`

## Current working pattern

For initial seeding:

1. fetch a broad inspections export
2. sync into BC
3. rerun unmatched-only retries when matching logic improves

For forward-going operation:

1. fetch only new inspections by date window or webhook-driven slice
2. keep small source slices instead of broad reseeds
3. sync only that smaller payload into BC
