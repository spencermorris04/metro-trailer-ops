import { mkdir, writeFile } from "node:fs/promises";
import * as path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

import { fetchOrbcommAssetStatus } from "./orbcomm-client";

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (name: string) => {
    const prefix = `--${name}=`;
    return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? "";
  };
  const limitArg = get("limit");
  return {
    assetName: get("asset-name") || get("assetid"),
    from: get("from"),
    to: get("to"),
    limit: args.includes("--full") ? 0 : Number(limitArg || "100"),
    outputPath: get("output") || "artifacts/orbcomm/status-sample.json",
    csvOutputPath: get("csv-output"),
    windowChunkMinutes: Number(get("window-chunk-minutes") || "0"),
    sleepBetweenWindowsSeconds: Number(get("sleep-between-windows-seconds") || "0"),
    maxWindowCount: get("max-window-count") ? Number(get("max-window-count")) : null,
    flushEachWindow: args.includes("--flush-each-window"),
  };
}

async function main() {
  const options = parseArgs();
  const noLimit = options.limit <= 0;
  const all: unknown[] = [];
  const windows = buildWindows(options.from, options.to, options.windowChunkMinutes).slice(0, options.maxWindowCount ?? undefined);
  let csvColumns = 0;
  for (let windowIndex = 0; windowIndex < windows.length; windowIndex += 1) {
    const window = windows[windowIndex];
    let watermark: unknown = null;
    do {
      const body: Record<string, unknown> = {
        assetNames: options.assetName ? [options.assetName] : [],
        assetGroupNames: [],
        watermark,
      };
      if (window.from || window.to) {
        body.fromDate = window.from;
        body.toDate = window.to;
      }

      const page = await fetchOrbcommAssetStatus(body);
      const records = page.data ?? [];
      all.push(...records);
      watermark = page.watermark ?? null;
      console.log(
        JSON.stringify({
          windowFrom: window.from,
          windowTo: window.to,
          pageRecords: records.length,
          recordsFetched: all.length,
          hasMore: Boolean(watermark),
        }),
      );
    } while (watermark && (noLimit || all.length < options.limit));

    if (!noLimit && all.length >= options.limit) {
      break;
    }
    if (options.flushEachWindow) {
      csvColumns = await writeOutputs(noLimit ? all : all.slice(0, options.limit), options);
    }
    if (options.sleepBetweenWindowsSeconds > 0 && windowIndex < windows.length - 1) {
      console.log(JSON.stringify({ sleepingSeconds: options.sleepBetweenWindowsSeconds, nextWindowIndex: windowIndex + 1 }));
      await sleep(options.sleepBetweenWindowsSeconds * 1000);
    }
  }

  const outputRecords = noLimit ? all : all.slice(0, options.limit);
  csvColumns = await writeOutputs(outputRecords, options);

  console.log(
    JSON.stringify(
      {
        recordsReturned: all.length,
        recordsWritten: outputRecords.length,
        jsonOutputPath: options.outputPath,
        csvOutputPath: options.csvOutputPath || null,
        csvColumns,
      },
      null,
      2,
    ),
  );
}

async function writeOutputs(records: unknown[], options: ReturnType<typeof parseArgs>) {
  await mkdir(path.dirname(options.outputPath), { recursive: true });
  await writeFile(options.outputPath, JSON.stringify(records, null, 2));

  if (!options.csvOutputPath) {
    return 0;
  }

  await mkdir(path.dirname(options.csvOutputPath), { recursive: true });
  const csv = toCsv(records);
  await writeFile(options.csvOutputPath, csv.text);
  return csv.columnCount;
}

function toCsv(records: unknown[]) {
  const flatRows = records.map((record) => {
    const flattened: Record<string, string> = {};
    flatten(record, "", flattened);
    return flattened;
  });
  const headers = sortHeaders([...new Set(flatRows.flatMap((row) => Object.keys(row).filter((key) => row[key] !== "")))]);
  const lines = [headers.map(csvCell).join(",")];
  for (const row of flatRows) {
    lines.push(headers.map((header) => csvCell(row[header] ?? "")).join(","));
  }
  return { text: `${lines.join("\r\n")}\r\n`, columnCount: headers.length };
}

function buildWindows(from: string, to: string, windowChunkMinutes: number) {
  if (!from || !to || windowChunkMinutes <= 0) {
    return [{ from, to }];
  }

  const windows: Array<{ from: string; to: string }> = [];
  const end = new Date(to);
  let cursor = new Date(from);
  while (cursor < end) {
    const next = new Date(Math.min(cursor.getTime() + windowChunkMinutes * 60 * 1000, end.getTime()));
    windows.push({ from: cursor.toISOString(), to: next.toISOString() });
    cursor = next;
  }
  return windows;
}

function flatten(value: unknown, prefix: string, output: Record<string, string>) {
  if (value === null || value === undefined) {
    return;
  }

  if (Array.isArray(value)) {
    if (value.length > 0) {
      output[prefix] = JSON.stringify(value);
    }
    return;
  }

  if (typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      flatten(child, prefix ? `${prefix}.${key}` : key, output);
    }
    return;
  }

  const text = String(value);
  if (text.trim() !== "") {
    output[prefix] = text;
  }
}

function sortHeaders(headers: string[]) {
  const priority = [
    "messageId",
    "assetStatus.assetName",
    "assetStatus.deviceSN",
    "assetStatus.assetType",
    "assetStatus.productType",
    "assetStatus.messageStamp",
    "assetStatus.messageReceivedStamp",
    "positionStatus.latitude",
    "positionStatus.longitude",
    "positionStatus.address",
    "positionStatus.city",
    "positionStatus.state",
    "positionStatus.country",
    "assetStatus.batteryStatus",
    "assetStatus.batteryVoltage",
    "assetStatus.powerSource",
    "assetStatus.speed",
    "positionStatus.direction",
    "positionStatus.geofenceStatus",
    "positionStatus.nearestGeofence",
    "positionStatus.geofenceName",
  ];
  const priorityIndex = new Map(priority.map((name, index) => [name, index]));
  return headers.sort((a, b) => {
    const aIndex = priorityIndex.get(a);
    const bIndex = priorityIndex.get(b);
    if (aIndex !== undefined || bIndex !== undefined) {
      return (aIndex ?? Number.MAX_SAFE_INTEGER) - (bIndex ?? Number.MAX_SAFE_INTEGER);
    }
    return a.localeCompare(b);
  });
}

function csvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
