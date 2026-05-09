import assert from "node:assert/strict";
import test from "node:test";

import {
  getBusinessCentralInvoiceAmount,
  getBusinessCentralInvoiceStatus,
  payloadText,
  readLineImportState,
} from "@/lib/server/rental-history-core";

test("Business Central invoice status reflects line import completeness", () => {
  assert.equal(
    getBusinessCentralInvoiceStatus({
      documentType: "Posted Invoice",
      lineCount: 0,
      lineImportComplete: false,
    }),
    "Lines pending",
  );
  assert.equal(
    getBusinessCentralInvoiceStatus({
      documentType: "Posted Invoice",
      lineCount: 2,
      lineImportComplete: false,
    }),
    "Lines partial",
  );
  assert.equal(
    getBusinessCentralInvoiceStatus({
      documentType: "Posted Invoice",
      lineCount: 2,
      lineImportComplete: true,
    }),
    "Lines imported",
  );
  assert.equal(
    getBusinessCentralInvoiceStatus({
      documentType: "Posted Credit Memo",
      lineCount: 2,
      lineImportComplete: true,
    }),
    "Credit Memo",
  );
});

test("Business Central invoice amount prefers imported RMI lines over header payload", () => {
  assert.deepEqual(
    getBusinessCentralInvoiceAmount({
      lineCount: 2,
      lineTotal: "500.00",
      sourcePayload: { AmountIncludingVAT: "999.00" },
    }),
    { amount: 500, source: "rmi_lines" },
  );
  assert.deepEqual(
    getBusinessCentralInvoiceAmount({
      lineCount: 0,
      lineTotal: null,
      sourcePayload: { AmountIncludingVAT: "119.75" },
    }),
    { amount: 119.75, source: "header_payload" },
  );
});

test("RI1012922 fixture follows the documented RMI join shape", () => {
  const header = {
    documentType: "Posted Invoice",
    documentNo: "RI1012922",
    previousDocType: "Order",
    previousNo: "RO58815",
    billToCustomerNo: "C27252",
    sourcePayload: { BilltoName: "Buckley HVAC" },
  };
  const lines = [
    { documentNo: "RI1012922", type: "Fixed Asset", itemNo: "7019380", grossAmount: "250.00" },
    { documentNo: "RI1012922", type: "Fixed Asset", itemNo: "5551307", grossAmount: "250.00" },
  ];

  assert.equal(header.previousDocType, "Order");
  assert.equal(header.previousNo, "RO58815");
  assert.deepEqual(
    lines.map((line) => line.itemNo),
    ["7019380", "5551307"],
  );
  assert.equal(payloadText(header.sourcePayload, ["BilltoName"]), "Buckley HVAC");
  assert.deepEqual(
    getBusinessCentralInvoiceAmount({
      lineCount: lines.length,
      lineTotal: lines.reduce((sum, line) => sum + Number(line.grossAmount), 0),
      sourcePayload: header.sourcePayload,
    }),
    { amount: 500, source: "rmi_lines" },
  );
});

test("line import checkpoint exposes pending accounting certainty", () => {
  assert.deepEqual(readLineImportState(null), {
    done: false,
    recordsSeen: 0,
    total: null,
  });
  assert.deepEqual(
    readLineImportState({ done: false, recordsSeen: 365000, total: 4039808 }),
    {
      done: false,
      recordsSeen: 365000,
      total: 4039808,
    },
  );
});
