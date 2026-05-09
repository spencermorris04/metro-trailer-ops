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
  assert.match(text, /\/assets\/fleet/);
  assert.match(text, /\/leases/);
  assert.match(text, /\/ar\/invoices/);
  assert.match(text, /Pending ledger import/);
});

test("fleet and asset drilldown routes surface imported BC/RMI history", async () => {
  const [fleet, detail] = await Promise.all([
    source("src/app/assets/fleet/page.tsx"),
    source("src/app/assets/[assetId]/page.tsx"),
  ]);

  assert.match(fleet, /getFleetListView/);
  assert.match(fleet, /Fleet/);
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
  assert.match(register, /Pending ledger import/);
  assert.match(detail, /getInvoiceDetailView/);
  assert.match(detail, /Raw source snapshot/);
});

test("financial dashboard uses optimized rental history summaries", async () => {
  const text = await source("src/app/financial/page.tsx");

  assert.match(text, /getFinancialDashboardOptimizedView/);
  assert.doesNotMatch(text, /getFinancialDashboardView/);
  assert.doesNotMatch(text, /getInvoiceRegisterView/);
  assert.match(text, /BC customer ledger/);
});
