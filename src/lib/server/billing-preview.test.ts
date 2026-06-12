import test from "node:test";
import assert from "node:assert/strict";

import {
  buildBillingPreviewLine,
  buildBillingPreviewResult,
  inferBillingProfile,
} from "@/lib/server/billing-preview";

test("infers monthly advance fixed-asset rental from INMOA", () => {
  const profile = inferBillingProfile({
    documentNo: "RI1249119",
    lineNo: 10000,
    lineType: "Rental",
    type: "Fixed Asset",
    dealCode: "INMOA",
    billingFor: "Standard Term",
  });

  assert.equal(profile.category, "rental_fixed_asset");
  assert.equal(profile.cadence, "monthly");
  assert.equal(profile.timing, "advance");
});

test("replays standard monthly billing without prorating by month length", () => {
  const preview = buildBillingPreviewLine({
    documentNo: "RI1249119",
    lineNo: 10000,
    lineType: "Rental",
    type: "Fixed Asset",
    itemNo: "3037290DD",
    description: "40' Double Door Container",
    quantity: "1.0000",
    unitPrice: "100.00",
    grossAmount: "100.00",
    taxAmount: "8.00",
    invoiceFromDate: new Date("2026-06-09T00:00:00.000Z"),
    invoiceThruDate: new Date("2026-07-08T00:00:00.000Z"),
    previousNo: "34893",
    dealCode: "INMOA",
    billingFor: "Standard Term",
    sourcePayload: {
      BillingPeriodsBilled: 1,
    },
  });

  assert.equal(preview.servicePeriod.inclusiveDays, 30);
  assert.equal(preview.preview.grossAmount, 100);
  assert.equal(preview.preview.totalAmount, 108);
  assert.equal(preview.comparison.status, "matched");
  assert.equal(preview.nextCandidate?.invoiceFromDate, "2026-07-09T00:00:00.000Z");
  assert.equal(preview.nextCandidate?.invoiceThruDate, "2026-08-08T00:00:00.000Z");
});

test("replays standard monthly arrears on the same formula as monthly advance", () => {
  const preview = buildBillingPreviewLine({
    documentNo: "RI1249124",
    lineNo: 10000,
    lineType: "Rental",
    type: "Fixed Asset",
    itemNo: "536486",
    quantity: "1.0000",
    unitPrice: "350.00",
    grossAmount: "350.00",
    taxAmount: "29.31",
    invoiceFromDate: new Date("2026-05-10T00:00:00.000Z"),
    invoiceThruDate: new Date("2026-06-09T00:00:00.000Z"),
    previousNo: "RO23269",
    dealCode: "INMOR",
    billingFor: "Standard Term",
    sourcePayload: {
      BillingPeriodsBilled: 1,
    },
  });

  assert.equal(preview.profile.timing, "arrears");
  assert.equal(preview.servicePeriod.inclusiveDays, 31);
  assert.equal(preview.preview.grossAmount, 350);
  assert.equal(preview.comparison.status, "matched");
});

test("daily deal treats both invoice period endpoints as billable days", () => {
  const preview = buildBillingPreviewLine({
    documentNo: "RI1249244",
    lineNo: 10000,
    lineType: "Rental",
    type: "Fixed Asset",
    itemNo: "48A2403",
    quantity: "1.0000",
    unitPrice: "45.00",
    grossAmount: "1395.00",
    taxAmount: "83.70",
    invoiceFromDate: new Date("2026-05-10T00:00:00.000Z"),
    invoiceThruDate: new Date("2026-06-09T00:00:00.000Z"),
    previousNo: "RO70186",
    dealCode: "INDADA",
    billingFor: "Standard Term",
  });

  assert.equal(preview.profile.cadence, "daily");
  assert.equal(preview.servicePeriod.inclusiveDays, 31);
  assert.equal(preview.preview.grossAmount, 1395);
  assert.equal(preview.comparison.status, "matched");
});

test("sale resource lines replay as quantity times unit price", () => {
  const preview = buildBillingPreviewLine({
    documentNo: "RI-MILEAGE",
    lineNo: 10000,
    lineType: "Sale",
    type: "Resource",
    itemNo: "MILEAGE",
    description: "MILEAGE .04",
    quantity: "6000.0000",
    unitPrice: "0.04",
    grossAmount: "240.00",
    taxAmount: "0.00",
  });

  assert.equal(preview.profile.category, "sale_resource");
  assert.equal(preview.preview.grossAmount, 240);
  assert.equal(preview.comparison.status, "matched");
});

test("zero-dollar rental notes are supported but not financially billed", () => {
  const preview = buildBillingPreviewLine({
    documentNo: "RC21596",
    lineNo: 10000,
    lineType: "Rental",
    type: null,
    description: "BILL TEAR DOWN & PICK UP @ END OF TERM",
    quantity: "0.0000",
    unitPrice: "0.00",
    grossAmount: "0.00",
    taxAmount: "0.00",
  });

  assert.equal(preview.profile.category, "note");
  assert.equal(preview.preview.grossAmount, 0);
  assert.equal(preview.comparison.status, "matched");
});

test("non-daily final monthly terms are surfaced as unsupported first-pass lines", () => {
  const preview = buildBillingPreviewLine({
    documentNo: "RI1239981",
    lineNo: 10000,
    lineType: "Rental",
    type: "Fixed Asset",
    itemNo: "5621760",
    quantity: "1.0000",
    unitPrice: "595.00",
    grossAmount: "595.00",
    invoiceFromDate: new Date("2026-03-08T00:00:00.000Z"),
    invoiceThruDate: new Date("2026-04-03T00:00:00.000Z"),
    returnDate: new Date("2026-04-03T00:00:00.000Z"),
    dealCode: "BP-MOMOR",
    billingFor: "Final Term",
  });

  assert.equal(preview.profile.cadence, "monthly");
  assert.equal(preview.comparison.status, "unsupported");
});

test("aggregates billing replay validation at document level", () => {
  const result = buildBillingPreviewResult(
    { documentNo: "RI-SAMPLE" },
    [
      {
        documentNo: "RI-SAMPLE",
        lineNo: 10000,
        lineType: "Rental",
        type: "Fixed Asset",
        quantity: "1.0000",
        unitPrice: "100.00",
        grossAmount: "100.00",
        taxAmount: "8.00",
        invoiceFromDate: new Date("2026-06-01T00:00:00.000Z"),
        invoiceThruDate: new Date("2026-06-30T00:00:00.000Z"),
        dealCode: "INMOA",
        billingFor: "Standard Term",
      },
      {
        documentNo: "RI-SAMPLE",
        lineNo: 20000,
        lineType: "Rental",
        type: "Fixed Asset",
        quantity: "1.0000",
        unitPrice: "100.00",
        grossAmount: "99.00",
        taxAmount: "0.00",
        invoiceFromDate: new Date("2026-06-01T00:00:00.000Z"),
        invoiceThruDate: new Date("2026-06-30T00:00:00.000Z"),
        dealCode: "INMOA",
        billingFor: "Standard Term",
      },
    ],
  );

  assert.equal(result.summary.sourceLineCount, 2);
  assert.equal(result.summary.matchedLineCount, 1);
  assert.equal(result.summary.mismatchedLineCount, 1);
  assert.equal(result.summary.actualGrossAmount, 199);
  assert.equal(result.summary.previewGrossAmount, 200);
});
