import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";

import {
  generateSyntheticFleet,
  runSyntheticBenchmarks,
  summarizeBenchmarkResults,
} from "../src/lib/testing/perf-harness";

function getArg(flag: string, fallback?: string) {
  const index = process.argv.indexOf(flag);
  if (index >= 0) {
    return process.argv[index + 1] ?? fallback;
  }

  return fallback;
}

async function benchmarkEndpoint(baseUrl: string, endpoint: string, iterations: number) {
  const durations: number[] = [];

  for (let index = 0; index < iterations; index += 1) {
    const start = performance.now();
    const response = await fetch(new URL(endpoint, baseUrl), {
      headers: process.env.PERF_AUTH_COOKIE
        ? { cookie: process.env.PERF_AUTH_COOKIE }
        : undefined,
    });

    if (!response.ok) {
      throw new Error(`Request failed for ${endpoint}: ${response.status}`);
    }

    await response.text();
    durations.push(Number((performance.now() - start).toFixed(2)));
  }

  const sorted = durations.toSorted((left, right) => left - right);
  const p50 = sorted[Math.floor(sorted.length * 0.5)] ?? 0;
  const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;

  return {
    endpoint,
    iterations,
    p50,
    p95,
    max: sorted.at(-1) ?? 0,
  };
}

async function main() {
  const outputDirectory =
    getArg("--out") ??
    path.join(
      process.cwd(),
      "artifacts",
      "performance",
      new Date().toISOString().replace(/[:.]/g, "-"),
    );
  const dataset = generateSyntheticFleet({
    branchCount: Number(getArg("--branches", "12")),
    assetCount: Number(getArg("--assets", "50000")),
    contractCount: Number(getArg("--contracts", "18000")),
    invoiceCount: Number(getArg("--invoices", "24000")),
    dispatchTaskCount: Number(getArg("--dispatch", "2400")),
  });

  const synthetic = summarizeBenchmarkResults(runSyntheticBenchmarks(dataset));
  const baseUrl = getArg("--base-url");
  const live = baseUrl
    ? await Promise.all([
        benchmarkEndpoint(baseUrl, "/api/assets", 5),
        benchmarkEndpoint(baseUrl, "/api/contracts", 5),
        benchmarkEndpoint(baseUrl, "/api/invoices", 5),
        benchmarkEndpoint(baseUrl, "/api/dispatch-tasks", 5),
      ])
    : [];

  const report = {
    generatedAt: new Date().toISOString(),
    synthetic,
    live,
    budgetsMs: {
      assets: 350,
      contracts: 350,
      invoices: 350,
      dispatchTasks: 350,
    },
  };

  await mkdir(outputDirectory, { recursive: true });
  await writeFile(
    path.join(outputDirectory, "report.json"),
    JSON.stringify(report, null, 2),
    "utf8",
  );

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
