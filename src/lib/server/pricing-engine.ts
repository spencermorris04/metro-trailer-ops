import type {
  AssetRecord,
  BillingUnitKey,
  FinancialEventStatusKey,
  FinancialEventTypeKey,
  InvoiceStatusKey,
} from "@/lib/domain/models";
import { numericToNumber, toDate } from "@/lib/server/production-utils";

export type BillingCadence = "immediate" | "weekly_arrears" | "monthly_arrears";
export type RateScope = "standard" | "customer" | "branch" | "promotional";

export type RateCardInput = {
  id: string;
  name: string;
  scope: RateScope;
  customerId?: string | null;
  branchId?: string | null;
  assetType?: AssetRecord["type"] | null;
  dailyRate?: string | number | null;
  weeklyRate?: string | number | null;
  monthlyRate?: string | number | null;
  mileageRate?: string | number | null;
  deliveryFee?: string | number | null;
  pickupFee?: string | number | null;
  effectiveFrom: string | Date;
  effectiveTo?: string | Date | null;
  active: boolean;
};

export type PricingAdjustmentConfig = {
  promotionalRateCardId?: string;
  billingCadence?: BillingCadence;
  mileage?: number;
  deliveryFee?: number;
  pickupFee?: number;
  pricingOverride?: Partial<{
    unitPrice: number;
    dailyRate: number;
    weeklyRate: number;
    monthlyRate: number;
    mileageRate: number;
    deliveryFee: number;
    pickupFee: number;
  }>;
};

export type ResolvedRateCard = {
  card: RateCardInput | null;
  source: "contract_override" | RateScope | "contract_line";
};

export type InvoiceLineDraft = {
  description: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  sourceFinancialEventId: string;
};

export type FinancialEventDraft = {
  contractLineId?: string | null;
  assetId?: string | null;
  eventType: FinancialEventTypeKey;
  description: string;
  amount: number;
  eventDate: Date;
  status: FinancialEventStatusKey;
  externalReference?: string | null;
  metadata: Record<string, unknown>;
};

type BillingPeriod = {
  start: Date;
  end: Date;
};

function startOfDay(value: Date) {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function addMonths(value: Date, months: number) {
  const next = new Date(value);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

function sameInstant(left: Date, right: Date) {
  return left.getTime() === right.getTime();
}

function isWithinWindow(
  referenceDate: Date,
  effectiveFrom: string | Date,
  effectiveTo?: string | Date | null,
) {
  const startsAt = toDate(effectiveFrom);
  const endsAt = toDate(effectiveTo);
  if (!startsAt) {
    return false;
  }
  if (referenceDate < startsAt) {
    return false;
  }
  if (endsAt && referenceDate > endsAt) {
    return false;
  }
  return true;
}

function sortRateCards(cards: RateCardInput[]) {
  return [...cards].sort((left, right) => {
    const assetTypeScore = Number(Boolean(right.assetType)) - Number(Boolean(left.assetType));
    if (assetTypeScore !== 0) {
      return assetTypeScore;
    }

    const leftFrom = toDate(left.effectiveFrom)?.getTime() ?? 0;
    const rightFrom = toDate(right.effectiveFrom)?.getTime() ?? 0;
    return rightFrom - leftFrom;
  });
}

export function parsePricingAdjustments(
  adjustments: unknown,
): PricingAdjustmentConfig {
  if (!adjustments || typeof adjustments !== "object") {
    return {};
  }

  const source = adjustments as Record<string, unknown>;
  const pricingOverride =
    source.pricingOverride && typeof source.pricingOverride === "object"
      ? (source.pricingOverride as PricingAdjustmentConfig["pricingOverride"])
      : undefined;

  const billingCadence =
    source.billingCadence === "immediate" ||
    source.billingCadence === "weekly_arrears" ||
    source.billingCadence === "monthly_arrears"
      ? source.billingCadence
      : undefined;

  return {
    promotionalRateCardId:
      typeof source.promotionalRateCardId === "string"
        ? source.promotionalRateCardId
        : undefined,
    billingCadence,
    mileage:
      typeof source.mileage === "number" && Number.isFinite(source.mileage)
        ? source.mileage
        : undefined,
    deliveryFee:
      typeof source.deliveryFee === "number" && Number.isFinite(source.deliveryFee)
        ? source.deliveryFee
        : undefined,
    pickupFee:
      typeof source.pickupFee === "number" && Number.isFinite(source.pickupFee)
        ? source.pickupFee
        : undefined,
    pricingOverride,
  };
}

export function resolveApplicableRateCard(args: {
  rateCards: RateCardInput[];
  contractDate: Date;
  customerId: string;
  branchId: string;
  assetType?: AssetRecord["type"] | null;
  adjustments?: PricingAdjustmentConfig;
}) {
  const scopedCandidates = args.rateCards.filter(
    (card) =>
      card.active &&
      isWithinWindow(args.contractDate, card.effectiveFrom, card.effectiveTo) &&
      (!card.assetType || !args.assetType || card.assetType === args.assetType),
  );

  const promotionalId = args.adjustments?.promotionalRateCardId;
  if (promotionalId) {
    const promotional = sortRateCards(
      scopedCandidates.filter(
        (card) => card.scope === "promotional" && card.id === promotionalId,
      ),
    )[0];
    if (promotional) {
      return { card: promotional, source: "promotional" } satisfies ResolvedRateCard;
    }
  }

  const customer = sortRateCards(
    scopedCandidates.filter(
      (card) => card.scope === "customer" && card.customerId === args.customerId,
    ),
  )[0];
  if (customer) {
    return { card: customer, source: "customer" } satisfies ResolvedRateCard;
  }

  const branch = sortRateCards(
    scopedCandidates.filter(
      (card) => card.scope === "branch" && card.branchId === args.branchId,
    ),
  )[0];
  if (branch) {
    return { card: branch, source: "branch" } satisfies ResolvedRateCard;
  }

  const standard = sortRateCards(
    scopedCandidates.filter((card) => card.scope === "standard"),
  )[0];
  if (standard) {
    return { card: standard, source: "standard" } satisfies ResolvedRateCard;
  }

  return { card: null, source: "contract_line" } satisfies ResolvedRateCard;
}

export function resolveUnitPrice(args: {
  unit: BillingUnitKey;
  contractLineUnitPrice: number;
  resolvedRateCard: ResolvedRateCard;
  adjustments?: PricingAdjustmentConfig;
}) {
  const override = args.adjustments?.pricingOverride;
  if (override?.unitPrice !== undefined) {
    return { unitPrice: override.unitPrice, source: "contract_override" as const };
  }

  const rateCard = args.resolvedRateCard.card;
  const fromCard = (() => {
    switch (args.unit) {
      case "day":
        return override?.dailyRate ?? numericToNumber(rateCard?.dailyRate, NaN);
      case "week":
        return override?.weeklyRate ?? numericToNumber(rateCard?.weeklyRate, NaN);
      case "month":
        return override?.monthlyRate ?? numericToNumber(rateCard?.monthlyRate, NaN);
      case "mileage":
        return override?.mileageRate ?? numericToNumber(rateCard?.mileageRate, NaN);
      default:
        return Number.NaN;
    }
  })();

  if (Number.isFinite(fromCard)) {
    return {
      unitPrice: fromCard,
      source: args.resolvedRateCard.source,
    };
  }

  return {
    unitPrice: args.contractLineUnitPrice,
    source: "contract_line" as const,
  };
}

export function resolveOneTimeCharges(args: {
  contractLineDeliveryFee?: number | null;
  contractLinePickupFee?: number | null;
  resolvedRateCard: ResolvedRateCard;
  adjustments?: PricingAdjustmentConfig;
}) {
  const override = args.adjustments?.pricingOverride;
  return {
    deliveryFee:
      args.adjustments?.deliveryFee ??
      override?.deliveryFee ??
      args.contractLineDeliveryFee ??
      numericToNumber(args.resolvedRateCard.card?.deliveryFee, 0),
    pickupFee:
      args.adjustments?.pickupFee ??
      override?.pickupFee ??
      args.contractLinePickupFee ??
      numericToNumber(args.resolvedRateCard.card?.pickupFee, 0),
  };
}

export function resolveBillingCadence(
  adjustments?: PricingAdjustmentConfig,
  contractCadence?: BillingCadence | null,
) {
  return adjustments?.billingCadence ?? contractCadence ?? "monthly_arrears";
}

export function deriveBillingPeriods(args: {
  startDate: Date;
  endDate?: Date | null;
  invoiceDate: Date;
  cadence: BillingCadence;
}) {
  const periods: BillingPeriod[] = [];
  const anchor = args.startDate;
  const absoluteEnd = args.endDate ?? args.invoiceDate;

  if (args.cadence === "immediate") {
    if (anchor <= args.invoiceDate) {
      periods.push({
        start: anchor,
        end: anchor,
      });
    }
    return periods;
  }

  let periodStart = anchor;
  while (periodStart < absoluteEnd) {
    const nextBoundary =
      args.cadence === "weekly_arrears"
        ? addDays(periodStart, 7)
        : addMonths(periodStart, 1);
    const periodEnd = nextBoundary < absoluteEnd ? nextBoundary : absoluteEnd;
    if (periodEnd <= args.invoiceDate) {
      periods.push({ start: periodStart, end: periodEnd });
    }

    if (sameInstant(periodEnd, absoluteEnd)) {
      break;
    }

    periodStart = periodEnd;
  }

  return periods;
}

export function createRecurringRentEvents(args: {
  contractLineId: string;
  assetId?: string | null;
  description: string;
  unit: BillingUnitKey;
  quantity: number;
  contractLineUnitPrice: number;
  startDate: Date;
  endDate?: Date | null;
  contractDate: Date;
  contractCadence?: BillingCadence | null;
  customerId: string;
  branchId: string;
  assetType?: AssetRecord["type"] | null;
  rateCards: RateCardInput[];
  existingEvents: Array<{
    eventType: FinancialEventTypeKey;
    metadata?: Record<string, unknown> | null;
  }>;
  adjustments?: PricingAdjustmentConfig;
  invoiceDate: Date;
}) {
  const resolvedRateCard = resolveApplicableRateCard({
    rateCards: args.rateCards,
    contractDate: args.contractDate,
    customerId: args.customerId,
    branchId: args.branchId,
    assetType: args.assetType,
    adjustments: args.adjustments,
  });
  const price = resolveUnitPrice({
    unit: args.unit,
    contractLineUnitPrice: args.contractLineUnitPrice,
    resolvedRateCard,
    adjustments: args.adjustments,
  });
  const cadence = resolveBillingCadence(args.adjustments, args.contractCadence);
  const periods = deriveBillingPeriods({
    startDate: args.startDate,
    endDate: args.endDate,
    invoiceDate: args.invoiceDate,
    cadence,
  });

  return periods
    .filter((period) => {
      return !args.existingEvents.some((event) => {
        const metadata = event.metadata ?? {};
        return (
          event.eventType === "rent" &&
          metadata.contractLineId === args.contractLineId &&
          metadata.periodStart === period.start.toISOString() &&
          metadata.periodEnd === period.end.toISOString()
        );
      });
    })
    .map((period) => ({
      contractLineId: args.contractLineId,
      assetId: args.assetId ?? null,
      eventType: "rent" as const,
      description: `${args.description} rent ${period.start.toISOString().slice(0, 10)} to ${period.end.toISOString().slice(0, 10)}`,
      amount: Number((price.unitPrice * args.quantity).toFixed(2)),
      eventDate: period.end,
      status: "posted" as const,
      externalReference: null,
      metadata: {
        cadence,
        pricingSource: price.source,
        rateCardId: resolvedRateCard.card?.id ?? null,
        contractLineId: args.contractLineId,
        periodStart: period.start.toISOString(),
        periodEnd: period.end.toISOString(),
      },
    })) satisfies FinancialEventDraft[];
}

export function createOneTimeChargeEvents(args: {
  contractLineId: string;
  assetId?: string | null;
  description: string;
  startDate: Date;
  endDate?: Date | null;
  contractDate: Date;
  customerId: string;
  branchId: string;
  assetType?: AssetRecord["type"] | null;
  rateCards: RateCardInput[];
  existingEvents: Array<{
    eventType: FinancialEventTypeKey;
    metadata?: Record<string, unknown> | null;
  }>;
  adjustments?: PricingAdjustmentConfig;
  contractLineDeliveryFee?: number | null;
  contractLinePickupFee?: number | null;
}) {
  const resolvedRateCard = resolveApplicableRateCard({
    rateCards: args.rateCards,
    contractDate: args.contractDate,
    customerId: args.customerId,
    branchId: args.branchId,
    assetType: args.assetType,
    adjustments: args.adjustments,
  });
  const charges = resolveOneTimeCharges({
    contractLineDeliveryFee: args.contractLineDeliveryFee,
    contractLinePickupFee: args.contractLinePickupFee,
    resolvedRateCard,
    adjustments: args.adjustments,
  });

  const drafts: FinancialEventDraft[] = [];
  if (
    charges.deliveryFee > 0 &&
    !args.existingEvents.some(
      (event) =>
        event.eventType === "delivery" &&
        event.metadata?.contractLineId === args.contractLineId,
    )
  ) {
    drafts.push({
      contractLineId: args.contractLineId,
      assetId: args.assetId ?? null,
      eventType: "delivery",
      description: `${args.description} delivery`,
      amount: Number(charges.deliveryFee.toFixed(2)),
      eventDate: args.startDate,
      status: "posted",
      externalReference: null,
      metadata: {
        contractLineId: args.contractLineId,
        rateCardId: resolvedRateCard.card?.id ?? null,
        pricingSource: resolvedRateCard.source,
      },
    });
  }

  if (
    charges.pickupFee > 0 &&
    args.endDate &&
    !args.existingEvents.some(
      (event) =>
        event.eventType === "pickup" &&
        event.metadata?.contractLineId === args.contractLineId,
    )
  ) {
    drafts.push({
      contractLineId: args.contractLineId,
      assetId: args.assetId ?? null,
      eventType: "pickup",
      description: `${args.description} pickup`,
      amount: Number(charges.pickupFee.toFixed(2)),
      eventDate: args.endDate,
      status: "posted",
      externalReference: null,
      metadata: {
        contractLineId: args.contractLineId,
        rateCardId: resolvedRateCard.card?.id ?? null,
        pricingSource: resolvedRateCard.source,
      },
    });
  }

  return drafts;
}

export function selectInvoiceableFinancialEvents(args: {
  events: Array<{
    id: string;
    eventType: FinancialEventTypeKey;
    description: string;
    amount: string | number;
    eventDate: Date | string;
    status: FinancialEventStatusKey;
    invoiceId?: string | null;
    metadata?: Record<string, unknown> | null;
  }>;
  invoiceDate: Date;
}) {
  return args.events.filter((event) => {
    if (event.invoiceId || event.status !== "posted") {
      return false;
    }

    if (numericToNumber(event.amount) === 0) {
      return false;
    }

    if (event.metadata?.reversalForEventId) {
      return true;
    }

    const eventDate = toDate(event.eventDate);
    if (!eventDate || eventDate > args.invoiceDate) {
      return false;
    }

    return true;
  });
}

export function buildInvoiceLinesFromFinancialEvents(
  events: Array<{
    id: string;
    description: string;
    amount: string | number;
  }>,
) {
  return events.map((event) => {
    const amount = numericToNumber(event.amount);
    return {
      description: event.description,
      quantity: 1,
      unitPrice: amount,
      totalAmount: amount,
      sourceFinancialEventId: event.id,
    } satisfies InvoiceLineDraft;
  });
}

export function calculateInvoiceTotals(lines: InvoiceLineDraft[]) {
  const subtotal = Number(
    lines.reduce((sum, line) => sum + line.totalAmount, 0).toFixed(2),
  );
  return {
    subtotal,
    taxAmount: 0,
    totalAmount: subtotal,
    balanceAmount: subtotal,
  };
}

export function applyPaymentToInvoice(args: {
  totalAmount: number;
  balanceAmount: number;
  paymentAmount: number;
  dueDate: Date;
  asOf?: Date;
}) {
  if (args.paymentAmount <= 0) {
    throw new Error("Payment amount must be greater than zero.");
  }

  if (args.paymentAmount > args.balanceAmount) {
    throw new Error("Payment amount cannot exceed the remaining balance.");
  }

  const nextBalance = Number((args.balanceAmount - args.paymentAmount).toFixed(2));
  return {
    balanceAmount: nextBalance,
    status: deriveInvoiceStatus({
      totalAmount: args.totalAmount,
      balanceAmount: nextBalance,
      dueDate: args.dueDate,
      asOf: args.asOf,
    }),
  };
}

export function deriveInvoiceStatus(args: {
  totalAmount: number;
  balanceAmount: number;
  dueDate: Date;
  asOf?: Date;
}): InvoiceStatusKey {
  if (args.balanceAmount <= 0) {
    return "paid";
  }

  if (args.balanceAmount < args.totalAmount) {
    return args.dueDate < (args.asOf ?? new Date())
      ? "overdue"
      : "partially_paid";
  }

  return args.dueDate < (args.asOf ?? new Date()) ? "overdue" : "sent";
}

export function buildReversalEvent(args: {
  originalEvent: {
    id: string;
    contractLineId?: string | null;
    assetId?: string | null;
    eventType: FinancialEventTypeKey;
    description: string;
    amount: string | number;
    eventDate: Date | string;
    metadata?: Record<string, unknown> | null;
  };
  reversalDate: Date;
  reason: string;
}) {
  return {
    contractLineId: args.originalEvent.contractLineId ?? null,
    assetId: args.originalEvent.assetId ?? null,
    eventType: args.originalEvent.eventType,
    description: `Reversal: ${args.originalEvent.description}`,
    amount: Number((-1 * numericToNumber(args.originalEvent.amount)).toFixed(2)),
    eventDate: args.reversalDate,
    status: "posted" as const,
    metadata: {
      ...(args.originalEvent.metadata ?? {}),
      reversalForEventId: args.originalEvent.id,
      reversalReason: args.reason,
      reversedEventDate: toDate(args.originalEvent.eventDate)?.toISOString() ?? null,
    },
  } satisfies FinancialEventDraft;
}

export function normalizeInvoiceDate(value?: Date) {
  return startOfDay(value ?? new Date());
}
