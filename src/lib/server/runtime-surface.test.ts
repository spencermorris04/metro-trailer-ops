import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  getRuntimeMode,
  isDemoRuntime,
  isProductionRuntime,
} from "@/lib/server/runtime";

const repoRoot = path.resolve(process.cwd());

test("runtime defaults to production and only enters demo when explicitly configured", () => {
  const original = process.env.METRO_TRAILER_RUNTIME_MODE;

  delete process.env.METRO_TRAILER_RUNTIME_MODE;
  assert.equal(getRuntimeMode(), "production");
  assert.equal(isProductionRuntime(), true);
  assert.equal(isDemoRuntime(), false);

  process.env.METRO_TRAILER_RUNTIME_MODE = "demo";
  assert.equal(getRuntimeMode(), "demo");
  assert.equal(isProductionRuntime(), false);
  assert.equal(isDemoRuntime(), true);

  process.env.METRO_TRAILER_RUNTIME_MODE = "production";
  assert.equal(getRuntimeMode(), "production");

  if (original === undefined) {
    delete process.env.METRO_TRAILER_RUNTIME_MODE;
  } else {
    process.env.METRO_TRAILER_RUNTIME_MODE = original;
  }
});

test("platform request surface is a production-only composition layer", async () => {
  const source = await readFile(
    path.join(repoRoot, "src/lib/server/platform.ts"),
    "utf8",
  );

  assert.equal(source.includes("platform-service\""), false);
  assert.equal(source.includes("isProductionRuntime"), false);
  assert.equal(source.includes("callDemo"), false);
  assert.match(source, /platform\/assets/);
  assert.match(source, /platform\/work-orders/);
});

test("esign request surface is a production-only composition layer", async () => {
  const source = await readFile(
    path.join(repoRoot, "src/lib/server/esign.ts"),
    "utf8",
  );

  assert.equal(source.includes("esign-service\""), false);
  assert.equal(source.includes("isProductionRuntime"), false);
  assert.equal(source.includes("callService"), false);
  assert.match(source, /esign\/documents/);
  assert.match(source, /esign\/signatures/);
});
