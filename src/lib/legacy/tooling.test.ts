import assert from "node:assert/strict";
import test from "node:test";

import {
  buildParityReport,
  normalizeLegacyImport,
  parseCsv,
  renderParityReportMarkdown,
} from "@/lib/legacy/tooling";

test("parseCsv handles quoted commas and escaped quotes", () => {
  const rows = parseCsv('id,name\n1,"Metro, Inc."\n2,"Bob ""The Dispatcher"""');
  assert.equal(rows.length, 2);
  assert.equal(rows[0]?.name, "Metro, Inc.");
  assert.equal(rows[1]?.name, 'Bob "The Dispatcher"');
});

test("normalizeLegacyImport creates summary counts and balances", () => {
  const snapshot = normalizeLegacyImport({
    assets: [{ id: "A1", asset_number: "TR-1", branch: "DAL", status: "active" }],
    customers: [{ id: "C1", customer_number: "CUST-1", name: "Acme" }],
    contracts: [
      {
        id: "R1",
        contract_number: "CTR-1",
        customer_number: "CUST-1",
        branch: "DAL",
        status: "active",
      },
    ],
    contractLines: [],
    invoices: [
      {
        id: "I1",
        invoice_number: "INV-1",
        customer_number: "CUST-1",
        total_amount: "125.50",
        balance_amount: "25.50",
        status: "overdue",
      },
    ],
    invoiceLines: [],
  });

  assert.equal(snapshot.summary.assetCount, 1);
  assert.equal(snapshot.summary.openContractCount, 1);
  assert.equal(snapshot.summary.invoiceTotalAmount, 125.5);
  assert.equal(snapshot.summary.invoiceBalanceAmount, 25.5);
});

test("buildParityReport highlights missing production records", () => {
  const legacy = normalizeLegacyImport({
    assets: [{ id: "A1", asset_number: "TR-1", branch: "DAL", status: "active" }],
    customers: [{ id: "C1", customer_number: "CUST-1", name: "Acme" }],
    contracts: [
      {
        id: "R1",
        contract_number: "CTR-1",
        customer_number: "CUST-1",
        branch: "DAL",
        status: "active",
      },
    ],
    contractLines: [],
    invoices: [
      {
        id: "I1",
        invoice_number: "INV-1",
        customer_number: "CUST-1",
        total_amount: "125.50",
        balance_amount: "25.50",
        status: "overdue",
      },
    ],
    invoiceLines: [],
  });

  const report = buildParityReport(legacy, {
    assets: [],
    contracts: [],
    invoices: [],
  });

  assert.equal(report.pass, false);
  assert.deepEqual(report.samples.missingAssetsInProduction, ["TR-1"]);
  assert.match(renderParityReportMarkdown(report), /Missing assets in production: TR-1/);
});
