import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(process.cwd());

async function source(relativePath: string) {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

test("assets overview is wired to the rental management read model", async () => {
  const text = await source("src/app/assets/page.tsx");

  assert.match(text, /getAssetsOverviewView/);
  assert.match(text, /\/equipment/);
  assert.match(text, /\/leases/);
  assert.match(text, /\/ar\/invoices/);
  assert.match(text, /Pending ledger import/);
});

test("fleet and asset drilldown routes surface imported BC/RMI history", async () => {
  const [fleet, detail] = await Promise.all([
    source("src/app/assets/fleet/page.tsx"),
    source("src/app/assets/[assetId]/page.tsx"),
  ]);

  assert.match(fleet, /getEquipmentListView/);
  assert.match(fleet, /Equipment/);
  assert.match(detail, /getAssetRentalDetailView/);
  assert.match(detail, /Imported invoice history/);
  assert.match(detail, /\/ar\/invoices\//);
});

test("leases replace contracts as the primary rental agreement register", async () => {
  const [register, detail, contracts, contractDetail] = await Promise.all([
    source("src/app/leases/page.tsx"),
    source("src/app/leases/[leaseId]/page.tsx"),
    source("src/app/contracts/page.tsx"),
    source("src/app/contracts/[contractId]/page.tsx"),
  ]);

  assert.match(register, /getLeaseRegisterView/);
  assert.match(register, /Leases/);
  assert.match(detail, /getLeaseDetailView/);
  assert.match(contracts, /redirect\("\/leases"\)/);
  assert.match(contractDetail, /redirect\(`\/leases\/\$\{contractId\}`\)/);
});

test("AR invoice routes use BC/RMI invoice register and detail read models", async () => {
  const [register, detail] = await Promise.all([
    source("src/app/ar/invoices/page.tsx"),
    source("src/app/ar/invoices/[invoiceNo]/page.tsx"),
  ]);

  assert.match(register, /getInvoiceRegisterView/);
  assert.match(register, /business_central/);
  assert.match(register, /BC ledger balances/);
  assert.match(detail, /getInvoiceDetailView/);
  assert.match(detail, /Raw source snapshot/);
});

test("financial dashboard uses period accounting metrics instead of all-time rental history", async () => {
  const [financial, revenue, arAging, glHistory, reconciliation] = await Promise.all([
    source("src/app/financial/page.tsx"),
    source("src/app/reports/revenue/page.tsx"),
    source("src/app/reports/ar-aging/page.tsx"),
    source("src/app/reports/gl-history/page.tsx"),
    source("src/app/reports/reconciliation/page.tsx"),
  ]);

  assert.match(financial, /getAccountingDashboardView/);
  assert.doesNotMatch(financial, /getTrailerRevenueDashboardView/);
  assert.match(financial, /PeriodSelector/);
  assert.match(financial, /\/reports\/revenue/);
  assert.match(financial, /\/reports\/ar-aging/);
  assert.match(revenue, /getRevenueReportView/);
  assert.match(arAging, /getArAgingReportView/);
  assert.match(glHistory, /getGlHistoryReportView/);
  assert.match(reconciliation, /getReconciliationReportView/);
});
