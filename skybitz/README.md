# SkyBitz

This folder contains the SkyBitz API documentation and the Metro Trailer SkyBitz sync tooling.

## What lives here

- `docs/Skybitz_XML_JSON_Data_Delivery_2_76_v18.pdf`
  Vendor API reference for SkyBitz XML/JSON Data Delivery v2.76.
- `scripts/fetch-latest-locations.ts`
  Authenticates with OAuth2 client credentials and pulls latest tracker positions.
- `scripts/test-auth.ts`
  Auth diagnostics helper for the SkyBitz token flow.
- `scripts/skybitz-sync-bc.ts`
  Fetches SkyBitz positions, matches them to BC fixed assets, and upserts the custom SkyBitz BC API tables.

Generated outputs land in `artifacts/skybitz/` at the repo root.

## Methodology

There are two distinct SkyBitz pull patterns:

1. latest-state polling
2. incremental history polling

### Latest-state polling

This is the simple snapshot mode:

- `QueryPositions?assetid=ALL`
- omit `from` and `to`
- SkyBitz returns the most recent position for the requested asset scope

This is what `scripts/fetch-latest-locations.ts` uses.

### Incremental history polling

This is the more reliable production sync pattern for Business Central.

The vendor docs support `QueryPositions` with `from` and `to` date windows. For nightly operation, the sync script now uses:

1. a bounded `from` / `to` window against `QueryPositions`
2. small fixed chunk windows during catch-up, not one giant replay query
3. a small overlap on every run
4. a small safety lag on the window end
5. client-side dedupe by `mtsn + time`
6. collapse to the newest message per `mtsn`
7. BC upsert only for the resulting latest-per-tracker set

That avoids reprocessing the entire `30k+` asset snapshot every night and is the correct way to consume SkyBitz movement updates reliably.

The practical windowing modes are:

- explicit:
  - `--from=... --to=...`
- derived from BC state:
  - `--since-last-successful-run`

If there is no prior successful BC sync run yet, the script falls back to a bootstrap lookback window. Each successful BC sync run now stores `sourceWindowStart` and `sourceWindowEnd`, and the next incremental run uses that explicit source watermark rather than inferring state from `finishedAt`.

One implementation detail that mattered in practice: the latest-position snapshot query works with `assetid=ALL`, while the ranged history query is currently using `assetid=All`. That matches the live behavior we observed against v2.76.

## What the API appears to provide

From the documented `QueryPositions` response, the latest-position pull can provide:

- `assetid`
- `mtsn`
- `assettype`
- `owner`
- group membership when present
- `latitude` / `longitude`
- observation `time`
- `speed`
- `heading`
- `battery`
- location quality
- landmark/geofence context
- some sensor/serial payloads when present

## What this endpoint does not appear to provide cleanly

Based on the API spec reviewed so far:

- no documented pagination for `QueryPositions?assetid=ALL`
- no documented server-side `limit` parameter for latest-position polling
- no dedicated "list all active tracked assets" endpoint in the sections used for this first pass
- no guarantee that uninstalled/inactive trackers appear in `QueryPositions`
- no historical data beyond the retained message window without using explicit `from` / `to`

For inventory-like questions, the PDF also documents adjacent APIs such as:

- `QueryAssetMtsn`
- `QueryInstalledMTs`
- `QueryUnInstalledMTs`
- `QueryTransferredMTs`

Those are likely the next place to extend if we need a more complete tracker catalog.

## Environment

The scripts read:

- `SKYBITZ_CLIENT_ID`
- `SKYBITZ_CLIENT_SECRET`
- optional `SKYBITZ_TOKEN_URL`
- optional `SKYBITZ_SERVICE_URL`

Defaults:

- token URL: `https://prodssoidp.skybitz.com/oauth2/token`
- service URL: `https://xml-gen2.skybitz.com/`

## Usage

Run the auth diagnostics:

```bash
npm run skybitz:test-auth
```

Run the initial latest-location pull:

```bash
npm run skybitz:latest-locations
```

Limit the returned local batch:

```bash
npm run skybitz:latest-locations -- --max-results=100
```

Export the full returned location set to CSV while still using the first 100 rows as the sample for displayed JSON:

```bash
npm run skybitz:latest-locations -- --max-results=100 --csv-output=artifacts/skybitz/latest-locations.csv
```

Dry-run the BC sync:

```bash
npm run skybitz:sync:bc -- --limit=100
```

Write the BC sync:

```bash
npm run skybitz:sync:bc -- --write
```

Run an explicit incremental window:

```bash
npm run skybitz:sync:bc -- --from=2026-04-27T23:00:00Z --to=2026-04-28T00:00:00Z
```

Run using the last successful BC sync run as the watermark source:

```bash
npm run skybitz:sync:bc -- --since-last-successful-run
```

Optional controls for the incremental mode:

- `--window-chunk-minutes=60`
- `--overlap-minutes=15`
- `--safety-lag-minutes=5`
- `--bootstrap-lookback-hours=24`
- `--rematch-unmatched`

## Current status

The OAuth2 client credentials flow is working in this workspace against:

- `https://prodssoidp.skybitz.com/oauth2/token`

The Business Central sync now supports:

- full latest-state snapshot writes
- explicit windowed history pulls
- `since-last-successful-run` watermark mode
- chunked catch-up windows with explicit source-window persistence
- overlap and safety-lag controls
- BC-side retry/backoff for throttling

Large historical windows can still be slow on the SkyBitz side. In practice, the nightly job should use a short rolling window rather than a full-day replay unless you are backfilling.
