import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  buildParityReport,
  renderParityReportMarkdown,
  type NormalizedLegacySnapshot,
  type ParitySnapshot,
} from "../src/lib/legacy/tooling";

function getArg(flag: string, fallback?: string) {
  const index = process.argv.indexOf(flag);
  if (index >= 0) {
    return process.argv[index + 1] ?? fallback;
  }

  return fallback;
}

async function loadJson<T>(filePath: string) {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

async function loadProductionSnapshotFromDatabase(): Promise<ParitySnapshot> {
  const [{ db, schema }, { eq }] = await Promise.all([
    import("../src/lib/db"),
    import("drizzle-orm"),
  ]);

  const [assets, contracts, invoices] = await Promise.all([
    db
      .select({
        assetNumber: schema.assets.assetNumber,
        branchCode: schema.branches.code,
        status: schema.assets.status,
      })
      .from(schema.assets)
      .leftJoin(schema.branches, eq(schema.assets.branchId, schema.branches.id)),
    db
      .select({
        contractNumber: schema.contracts.contractNumber,
        customerNumber: schema.customers.customerNumber,
        status: schema.contracts.status,
      })
      .from(schema.contracts)
      .leftJoin(schema.customers, eq(schema.contracts.customerId, schema.customers.id)),
    db
      .select({
        invoiceNumber: schema.invoices.invoiceNumber,
        customerNumber: schema.customers.customerNumber,
        totalAmount: schema.invoices.totalAmount,
        balanceAmount: schema.invoices.balanceAmount,
        status: schema.invoices.status,
      })
      .from(schema.invoices)
      .leftJoin(schema.customers, eq(schema.invoices.customerId, schema.customers.id)),
  ]);

  const openContractStatuses = new Set(["quoted", "reserved", "active"]);
  const openInvoiceStatuses = new Set(["draft", "sent", "partially_paid", "overdue"]);

  return {
    assets: assets.map((asset) => ({
      assetNumber: asset.assetNumber,
      branchCode: asset.branchCode,
      status: asset.status,
    })),
    contracts: contracts.map((contract) => ({
      contractNumber: contract.contractNumber,
      customerNumber: contract.customerNumber,
      status: contract.status,
      open: openContractStatuses.has(contract.status),
    })),
    invoices: invoices.map((invoice) => ({
      invoiceNumber: invoice.invoiceNumber,
      customerNumber: invoice.customerNumber,
      totalAmount: Number(invoice.totalAmount ?? 0),
      balanceAmount: Number(invoice.balanceAmount ?? 0),
      open:
        openInvoiceStatuses.has(invoice.status) || Number(invoice.balanceAmount ?? 0) > 0,
    })),
  };
}

async function main() {
  const legacySnapshotPath = getArg(
    "--legacy-snapshot",
    path.join(process.cwd(), "artifacts", "legacy-import", "latest", "normalized-snapshot.json"),
  ) ?? path.join(process.cwd(), "artifacts", "legacy-import", "latest", "normalized-snapshot.json");
  const productionSnapshotPath = getArg("--production-snapshot");
  const outputDirectory =
    getArg("--out") ??
    path.join(
      process.cwd(),
      "artifacts",
      "legacy-reconcile",
      new Date().toISOString().replace(/[:.]/g, "-"),
    );

  const legacySnapshot = await loadJson<NormalizedLegacySnapshot>(legacySnapshotPath);
  const productionSnapshot = productionSnapshotPath
    ? await loadJson<ParitySnapshot>(productionSnapshotPath)
    : await loadProductionSnapshotFromDatabase();

  const report = buildParityReport(legacySnapshot, productionSnapshot);
  const markdown = renderParityReportMarkdown(report);

  await mkdir(outputDirectory, { recursive: true });
  await writeFile(
    path.join(outputDirectory, "report.json"),
    JSON.stringify(report, null, 2),
    "utf8",
  );
  await writeFile(path.join(outputDirectory, "report.md"), markdown, "utf8");

  process.stdout.write(`${markdown}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
