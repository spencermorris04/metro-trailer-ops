import assert from "node:assert/strict";
import test from "node:test";

import {
  generateSyntheticFleet,
  runSyntheticBenchmarks,
  summarizeBenchmarkResults,
} from "@/lib/testing/perf-harness";

test("generateSyntheticFleet produces a 50k asset dataset", () => {
  const dataset = generateSyntheticFleet({
    branchCount: 12,
    assetCount: 50_000,
    contractCount: 18_000,
    invoiceCount: 24_000,
    dispatchTaskCount: 2_400,
  });

  assert.equal(dataset.assets.length, 50_000);
  assert.equal(dataset.contracts.length, 18_000);
  assert.equal(dataset.invoices.length, 24_000);
});

test("synthetic benchmark summary returns named measurements", () => {
  const dataset = generateSyntheticFleet({
    branchCount: 6,
    assetCount: 5_000,
    contractCount: 2_000,
    invoiceCount: 3_000,
    dispatchTaskCount: 400,
  });

  const summary = summarizeBenchmarkResults(runSyntheticBenchmarks(dataset));

  assert.equal(summary.results.length, 4);
  assert.ok(summary.results.every((result) => result.name.length > 0));
  assert.ok(summary.maxDurationMs >= 0);
});
