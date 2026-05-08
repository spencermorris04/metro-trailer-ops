import "dotenv/config";

import { performance } from "node:perf_hooks";

import { pool } from "@/lib/db";
import { searchWorkspace } from "@/lib/server/global-search";
import { getInventoryOverview, listAssetsPage } from "@/lib/server/platform";

type TimedResult = {
  name: string;
  iterations: number;
  p50: number;
  p75: number;
  p95: number;
  min: number;
  max: number;
};

function percentile(sorted: number[], pct: number) {
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * pct))] ?? 0;
}

async function timeScenario(
  name: string,
  iterations: number,
  fn: () => Promise<unknown>,
): Promise<TimedResult> {
  await fn();

  const durations: number[] = [];
  for (let index = 0; index < iterations; index += 1) {
    const start = performance.now();
    await fn();
    durations.push(Number((performance.now() - start).toFixed(2)));
  }

  const sorted = durations.toSorted((left, right) => left - right);
  return {
    name,
    iterations,
    p50: percentile(sorted, 0.5),
    p75: percentile(sorted, 0.75),
    p95: percentile(sorted, 0.95),
    min: sorted[0] ?? 0,
    max: sorted.at(-1) ?? 0,
  };
}

async function main() {
  const iterations = Number(process.env.PERF_ITERATIONS ?? "9");
  const scenarios = await Promise.all([
    timeScenario("listAssetsPage:first-page", iterations, () =>
      listAssetsPage({ page: 1, pageSize: 25 }),
    ),
    timeScenario("dashboard:inventory-overview", iterations, () => getInventoryOverview()),
    timeScenario("search:asset", iterations, () =>
      searchWorkspace({ query: "trailer", store: "all" }),
    ),
    timeScenario("search:customer", iterations, () =>
      searchWorkspace({ query: "metro", store: "all" }),
    ),
  ]);

  process.stdout.write(
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        budgetMs: {
          warmP75: 200,
        },
        scenarios,
      },
      null,
      2,
    )}\n`,
  );
}

main()
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
