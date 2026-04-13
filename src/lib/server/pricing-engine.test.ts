import test from "node:test";
import assert from "node:assert/strict";

import {
  applyPaymentToInvoice,
  buildInvoiceLinesFromFinancialEvents,
  buildReversalEvent,
  calculateInvoiceTotals,
  createRecurringRentEvents,
  deriveInvoiceStatus,
  resolveApplicableRateCard,
  resolveUnitPrice,
} from "@/lib/server/pricing-engine";

const baseRateCards = [
  {
    id: "rate_standard",
    name: "Standard Box Trailer",
    scope: "standard" as const,
    assetType: "commercial_box_trailer" as const,
    monthlyRate: 1000,
    weeklyRate: 350,
    dailyRate: 75,
    effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
    effectiveTo: null,
    active: true,
  },
  {
    id: "rate_branch",
    name: "Atlanta Branch Box Trailer",
    scope: "branch" as const,
    branchId: "branch_atl",
    assetType: "commercial_box_trailer" as const,
    monthlyRate: 950,
    weeklyRate: 325,
    dailyRate: 70,
    effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
    effectiveTo: null,
    active: true,
  },
  {
    id: "rate_customer",
    name: "Metro Builders Preferred",
    scope: "customer" as const,
    customerId: "cust_1",
    assetType: "commercial_box_trailer" as const,
    monthlyRate: 900,
    weeklyRate: 300,
    dailyRate: 65,
    effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
    effectiveTo: null,
    active: true,
  },
  {
    id: "rate_promo",
    name: "Spring Promo",
    scope: "promotional" as const,
    assetType: "commercial_box_trailer" as const,
    monthlyRate: 800,
    weeklyRate: 275,
    dailyRate: 60,
    effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
    effectiveTo: null,
    active: true,
  },
];

test("pricing precedence resolves promotional, then customer, then branch, then standard", () => {
  const common = {
    rateCards: baseRateCards,
    contractDate: new Date("2026-02-15T00:00:00.000Z"),
    customerId: "cust_1",
    branchId: "branch_atl",
    assetType: "commercial_box_trailer" as const,
  };

  const promotional = resolveApplicableRateCard({
    ...common,
    adjustments: { promotionalRateCardId: "rate_promo" },
  });
  assert.equal(promotional.source, "promotional");
  assert.equal(promotional.card?.id, "rate_promo");

  const customer = resolveApplicableRateCard(common);
  assert.equal(customer.source, "customer");
  assert.equal(customer.card?.id, "rate_customer");

  const branch = resolveApplicableRateCard({
    ...common,
    customerId: "cust_other",
  });
  assert.equal(branch.source, "branch");
  assert.equal(branch.card?.id, "rate_branch");

  const standard = resolveApplicableRateCard({
    ...common,
    customerId: "cust_other",
    branchId: "branch_other",
  });
  assert.equal(standard.source, "standard");
  assert.equal(standard.card?.id, "rate_standard");
});

test("contract override beats resolved rate card", () => {
  const resolved = resolveApplicableRateCard({
    rateCards: baseRateCards,
    contractDate: new Date("2026-02-15T00:00:00.000Z"),
    customerId: "cust_1",
    branchId: "branch_atl",
    assetType: "commercial_box_trailer",
  });

  const pricing = resolveUnitPrice({
    unit: "month",
    contractLineUnitPrice: 1234,
    resolvedRateCard: resolved,
    adjustments: {
      pricingOverride: {
        unitPrice: 777,
      },
    },
  });

  assert.equal(pricing.source, "contract_override");
  assert.equal(pricing.unitPrice, 777);
});

test("recurring rent generation is monthly in arrears and does not duplicate existing periods", () => {
  const events = createRecurringRentEvents({
    contractLineId: "cline_1",
    assetId: "asset_1",
    description: "Unit A",
    unit: "month",
    quantity: 1,
    contractLineUnitPrice: 1200,
    startDate: new Date("2026-01-15T00:00:00.000Z"),
    endDate: new Date("2026-03-15T00:00:00.000Z"),
    contractDate: new Date("2026-01-15T00:00:00.000Z"),
    contractCadence: "monthly_arrears",
    customerId: "cust_1",
    branchId: "branch_atl",
    assetType: "commercial_box_trailer",
    rateCards: baseRateCards,
    existingEvents: [
      {
        eventType: "rent",
        metadata: {
          contractLineId: "cline_1",
          periodStart: "2026-01-15T00:00:00.000Z",
          periodEnd: "2026-02-15T00:00:00.000Z",
        },
      },
    ],
    invoiceDate: new Date("2026-03-31T00:00:00.000Z"),
  });

  assert.equal(events.length, 1);
  assert.equal(events[0]?.metadata.periodStart, "2026-02-15T00:00:00.000Z");
  assert.equal(events[0]?.metadata.periodEnd, "2026-03-15T00:00:00.000Z");
  assert.equal(events[0]?.amount, 900);
});

test("invoice lines retain financial event traceability and totals are derived from events", () => {
  const lines = buildInvoiceLinesFromFinancialEvents([
    {
      id: "fe_1",
      description: "January rent",
      amount: 900,
    },
    {
      id: "fe_2",
      description: "Delivery",
      amount: 125,
    },
  ]);

  assert.deepEqual(
    lines.map((line) => line.sourceFinancialEventId),
    ["fe_1", "fe_2"],
  );
  assert.equal(lines[0]?.totalAmount, 900);
  assert.equal(lines[1]?.totalAmount, 125);

  const totals = calculateInvoiceTotals(lines);
  assert.equal(totals.subtotal, 1025);
  assert.equal(totals.totalAmount, 1025);
});

test("payment application updates balance and invoice status without overpaying", () => {
  const partial = applyPaymentToInvoice({
    totalAmount: 1000,
    balanceAmount: 1000,
    paymentAmount: 400,
    dueDate: new Date("2026-05-01T00:00:00.000Z"),
    asOf: new Date("2026-04-01T00:00:00.000Z"),
  });
  assert.equal(partial.balanceAmount, 600);
  assert.equal(partial.status, "partially_paid");

  const paid = applyPaymentToInvoice({
    totalAmount: 1000,
    balanceAmount: 600,
    paymentAmount: 600,
    dueDate: new Date("2026-05-01T00:00:00.000Z"),
    asOf: new Date("2026-04-01T00:00:00.000Z"),
  });
  assert.equal(paid.balanceAmount, 0);
  assert.equal(paid.status, "paid");

  assert.throws(
    () =>
      applyPaymentToInvoice({
        totalAmount: 1000,
        balanceAmount: 100,
        paymentAmount: 150,
        dueDate: new Date("2026-05-01T00:00:00.000Z"),
      }),
    /cannot exceed the remaining balance/i,
  );
});

test("overdue status and reversal event creation are deterministic", () => {
  const overdue = deriveInvoiceStatus({
    totalAmount: 1000,
    balanceAmount: 1000,
    dueDate: new Date("2026-03-01T00:00:00.000Z"),
    asOf: new Date("2026-04-01T00:00:00.000Z"),
  });
  assert.equal(overdue, "overdue");

  const reversal = buildReversalEvent({
    originalEvent: {
      id: "fe_original",
      contractLineId: "cline_1",
      assetId: "asset_1",
      eventType: "damage",
      description: "Damage surcharge",
      amount: 250,
      eventDate: new Date("2026-03-05T00:00:00.000Z"),
      metadata: {
        source: "inspection",
      },
    },
    reversalDate: new Date("2026-03-06T00:00:00.000Z"),
    reason: "Inspector corrected the damage charge",
  });

  assert.equal(reversal.amount, -250);
  assert.equal(reversal.metadata.reversalForEventId, "fe_original");
  assert.equal(reversal.status, "posted");
});
