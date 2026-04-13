import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  normalizeLegacyImport,
  parseCsv,
  type LegacyFlatRecord,
  type LegacyImportBundle,
} from "../src/lib/legacy/tooling";

function getArg(flag: string, fallback?: string) {
  const index = process.argv.indexOf(flag);
  if (index >= 0) {
    return process.argv[index + 1] ?? fallback;
  }

  return fallback;
}

function hasFlag(flag: string) {
  return process.argv.includes(flag);
}

async function readStructuredFile(filePath: string) {
  const file = await readFile(filePath, "utf8");
  if (filePath.endsWith(".json")) {
    return JSON.parse(file) as LegacyFlatRecord[];
  }

  return parseCsv(file);
}

async function readEntity(directory: string, baseName: string) {
  const candidates = [`${baseName}.json`, `${baseName}.csv`];

  for (const candidate of candidates) {
    const filePath = path.join(directory, candidate);
    try {
      return await readStructuredFile(filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }

  return [];
}

async function main() {
  const sourceDirectory =
    getArg("--source", path.join(process.cwd(), "legacy-export")) ??
    path.join(process.cwd(), "legacy-export");
  const outputDirectory =
    getArg("--out") ??
    path.join(
      process.cwd(),
      "artifacts",
      "legacy-import",
      new Date().toISOString().replace(/[:.]/g, "-"),
    );
  const dryRun = !hasFlag("--write");

  const bundle: LegacyImportBundle = {
    assets: await readEntity(sourceDirectory, "assets"),
    customers: await readEntity(sourceDirectory, "customers"),
    contracts: await readEntity(sourceDirectory, "contracts"),
    contractLines: await readEntity(sourceDirectory, "contract_lines"),
    invoices: await readEntity(sourceDirectory, "invoices"),
    invoiceLines: await readEntity(sourceDirectory, "invoice_lines"),
  };

  const snapshot = normalizeLegacyImport(bundle);
  await mkdir(outputDirectory, { recursive: true });

  const summary = {
    sourceDirectory,
    outputDirectory,
    dryRun,
    summary: snapshot.summary,
    inputCounts: {
      assets: bundle.assets.length,
      customers: bundle.customers.length,
      contracts: bundle.contracts.length,
      contractLines: bundle.contractLines.length,
      invoices: bundle.invoices.length,
      invoiceLines: bundle.invoiceLines.length,
    },
  };

  await writeFile(
    path.join(outputDirectory, "summary.json"),
    JSON.stringify(summary, null, 2),
    "utf8",
  );
  await writeFile(
    path.join(outputDirectory, "normalized-snapshot.json"),
    JSON.stringify(snapshot, null, 2),
    "utf8",
  );

  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
