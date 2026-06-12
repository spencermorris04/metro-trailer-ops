import { numericToNumber, toIso } from "@/lib/server/production-utils";

export type BillingPreviewQuery = {
  documentNo?: string;
  orderNo?: string;
  assetNumber?: string;
  limit?: number;
};

export type BillingTiming = "advance" | "arrears" | "immediate" | "unknown";
export type BillingCadence =
  | "daily"
  | "weekly"
  | "monthly"
  | "quarterly"
  | "one_time"
  | "note"
  | "unsupported";

export type BillingReplayStatus = "matched" | "mismatch" | "unsupported";

export type BillingPreviewLineInput = {
  id?: string | null;
  documentType?: string | null;
  documentNo: string;
  lineNo: number;
  lineType?: string | null;
  type?: string | null;
  itemNo?: string | null;
  description?: string | null;
  quantity?: string | number | null;
  unitPrice?: string | number | null;
  grossAmount?: string | number | null;
  taxAmount?: string | number | null;
  damageWaiverAmount?: string | number | null;
  invoiceFromDate?: Date | string | null;
  invoiceThruDate?: Date | string | null;
  shipmentDate?: Date | string | null;
  returnDate?: Date | string | null;
  postingDate?: Date | string | null;
  previousNo?: string | null;
  dealCode?: string | null;
  dealLength?: string | number | null;
  billingFor?: string | null;
  locationCode?: string | null;
  shortcutDimension1Code?: string | null;
  shortcutDimension2Code?: string | null;
  taxGroupCode?: string | null;
  sourcePayload?: Record<string, unknown> | null;
  headerSellToCustomerNo?: string | null;
  headerBillToCustomerNo?: string | null;
  headerDueDate?: Date | string | null;
};

export type BillingProfileInference = {
  dealCode: string | null;
  normalizedDealCode: string | null;
  cadence: BillingCadence;
  timing: BillingTiming;
  category:
    | "rental_fixed_asset"
    | "rental_resource"
    | "sale_fixed_asset"
    | "sale_resource"
    | "sale_gl"
    | "note"
    | "unsupported";
  billingFor: string | null;
  confidence: "high" | "medium" | "low";
  reason: string;
};

export type BillingPreviewLine = {
  sourceLineId: string | null;
  documentType: string | null;
  documentNo: string;
  lineNo: number;
  orderNo: string | null;
  assetNumber: string | null;
  description: string | null;
  profile: BillingProfileInference;
  servicePeriod: {
    from: string | null;
    thru: string | null;
    inclusiveDays: number | null;
  };
  actual: {
    quantity: number;
    unitPrice: number;
    grossAmount: number;
    taxAmount: number;
    damageWaiverAmount: number;
    totalAmount: number;
  };
  preview: {
    quantity: number;
    unitPrice: number;
    grossAmount: number | null;
    taxAmount: number | null;
    damageWaiverAmount: number | null;
    totalAmount: number | null;
    formula: string;
    assumptions: string[];
  };
  comparison: {
    status: BillingReplayStatus;
    grossDelta: number | null;
    tolerance: number;
    reason: string;
  };
  nextCandidate: BillingNextChargeCandidate | null;
};

export type BillingNextChargeCandidate = {
  invoiceFromDate: string;
  invoiceThruDate: string;
  grossAmount: number;
  formula: string;
};

export type BillingPreviewResult = {
  generatedAt: string;
  query: Required<Pick<BillingPreviewQuery, "limit">> &
    Omit<BillingPreviewQuery, "limit">;
  summary: {
    sourceLineCount: number;
    supportedLineCount: number;
    matchedLineCount: number;
    mismatchedLineCount: number;
    unsupportedLineCount: number;
    actualGrossAmount: number;
    previewGrossAmount: number;
    actualTaxAmount: number;
    nextCandidateCount: number;
  };
  lines: BillingPreviewLine[];
};

export type BillingValidationResult = {
  generatedAt: string;
  sampledDocumentNos: string[];
  documentCount: number;
  sourceLineCount: number;
  supportedLineCount: number;
  matchedLineCount: number;
  mismatchedLineCount: number;
  unsupportedLineCount: number;
  actualGrossAmount: number;
  previewGrossAmount: number;
  mismatches: Array<{
    documentNo: string;
    lineNo: number;
    itemNo: string | null;
    dealCode: string | null;
    actualGrossAmount: number;
    previewGrossAmount: number | null;
    grossDelta: number | null;
    reason: string;
  }>;
};

const MONEY_TOLERANCE = 0.01;
const MAX_QUERY_LIMIT = 500;
const DEFAULT_QUERY_LIMIT = 100;

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

function compactText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizedUpper(value: string | null | undefined) {
  return compactText(value)?.toUpperCase() ?? null;
}

function startOfUtcDay(value: Date) {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}

function toDate(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function addMonthsClamped(value: Date, months: number) {
  const year = value.getUTCFullYear();
  const month = value.getUTCMonth();
  const day = value.getUTCDate();
  const target = new Date(Date.UTC(year, month + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target;
}

function inclusiveDaysBetween(
  startValue: Date | string | null | undefined,
  endValue: Date | string | null | undefined,
) {
  const start = toDate(startValue);
  const end = toDate(endValue);
  if (!start || !end) {
    return null;
  }

  const startDay = startOfUtcDay(start);
  const endDay = startOfUtcDay(end);
  const diff = endDay.getTime() - startDay.getTime();
  if (diff < 0) {
    return null;
  }

  return Math.floor(diff / 86_400_000) + 1;
}

function payloadNumber(
  payload: Record<string, unknown> | null | undefined,
  keys: string[],
) {
  if (!payload) {
    return null;
  }

  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}

function inferLineCategory(line: BillingPreviewLineInput) {
  const lineType = normalizedUpper(line.lineType);
  const type = normalizedUpper(line.type);
  const quantity = numericToNumber(line.quantity, 0);
  const gross = numericToNumber(line.grossAmount, 0);

  if (lineType === "RENTAL" && !type && quantity === 0 && gross === 0) {
    return "note" as const;
  }
  if (lineType === "RENTAL" && type === "FIXED ASSET") {
    return "rental_fixed_asset" as const;
  }
  if (lineType === "RENTAL" && type === "RESOURCE") {
    return "rental_resource" as const;
  }
  if (lineType === "SALE" && type === "FIXED ASSET") {
    return "sale_fixed_asset" as const;
  }
  if (lineType === "SALE" && type === "RESOURCE") {
    return "sale_resource" as const;
  }
  if (lineType === "SALE" && type === "G/L ACCOUNT") {
    return "sale_gl" as const;
  }

  return "unsupported" as const;
}

export function inferBillingProfile(
  line: BillingPreviewLineInput,
): BillingProfileInference {
  const dealCode = compactText(line.dealCode);
  const normalizedDealCode = normalizedUpper(dealCode);
  const withoutPrefix = normalizedDealCode?.replace(/^BP-/, "") ?? null;
  const category = inferLineCategory(line);
  const billingFor = compactText(line.billingFor);

  if (category === "note") {
    return {
      dealCode,
      normalizedDealCode,
      cadence: "note",
      timing: "immediate",
      category,
      billingFor,
      confidence: "high",
      reason: "Zero-quantity, zero-amount rental line treated as an operational note.",
    };
  }

  if (category.startsWith("sale_")) {
    return {
      dealCode,
      normalizedDealCode,
      cadence: "one_time",
      timing: "immediate",
      category,
      billingFor,
      confidence: "medium",
      reason: "Sale line is replayed as unit price times quantity.",
    };
  }

  if (!withoutPrefix) {
    return {
      dealCode,
      normalizedDealCode,
      cadence: "unsupported",
      timing: "unknown",
      category,
      billingFor,
      confidence: "low",
      reason: "Rental line has no deal code mapping yet.",
    };
  }

  if (withoutPrefix.includes("BAD CODE")) {
    return {
      dealCode,
      normalizedDealCode,
      cadence: "unsupported",
      timing: "unknown",
      category,
      billingFor,
      confidence: "low",
      reason: "Deal code is explicitly marked bad in historical data.",
    };
  }

  const timing: BillingTiming = withoutPrefix.endsWith("A")
    ? "advance"
    : withoutPrefix.endsWith("R")
      ? "arrears"
      : "unknown";

  const cadence: BillingCadence = (() => {
    if (withoutPrefix === "ONE-TIME") {
      return "one_time";
    }
    if (withoutPrefix.includes("QTR")) {
      return "quarterly";
    }
    if (withoutPrefix.includes("WK") || withoutPrefix.includes("WI")) {
      return "weekly";
    }
    if (withoutPrefix.includes("DA")) {
      return "daily";
    }
    if (withoutPrefix.includes("MO")) {
      return "monthly";
    }
    return "unsupported";
  })();

  return {
    dealCode,
    normalizedDealCode,
    cadence,
    timing,
    category,
    billingFor,
    confidence: cadence === "unsupported" ? "low" : "medium",
    reason:
      cadence === "unsupported"
        ? "Deal code has not been mapped to a billing cadence."
        : `Mapped ${normalizedDealCode} to ${timing} ${cadence} billing.`,
  };
}

function canReplayProfile(profile: BillingProfileInference) {
  if (profile.cadence === "note" || profile.cadence === "one_time") {
    return true;
  }

  if (profile.billingFor && profile.billingFor !== "Standard Term") {
    return profile.cadence === "daily";
  }

  return profile.cadence === "monthly" || profile.cadence === "daily";
}

function calculatePreviewGross(line: BillingPreviewLineInput) {
  const profile = inferBillingProfile(line);
  const quantity = numericToNumber(line.quantity, 0);
  const unitPrice = numericToNumber(line.unitPrice, 0);
  const inclusiveDays = inclusiveDaysBetween(
    line.invoiceFromDate,
    line.invoiceThruDate,
  );
  const billingPeriodsBilled =
    payloadNumber(line.sourcePayload, ["BillingPeriodsBilled"]) ?? 1;

  if (!canReplayProfile(profile)) {
    return {
      profile,
      grossAmount: null,
      formula: "unsupported",
      assumptions: [profile.reason],
    };
  }

  if (profile.cadence === "note") {
    return {
      profile,
      grossAmount: 0,
      formula: "0 for non-billable note line",
      assumptions: ["RMI zero-dollar notes are preserved but not financially billed."],
    };
  }

  if (profile.cadence === "one_time") {
    return {
      profile,
      grossAmount: roundMoney(quantity * unitPrice),
      formula: "quantity * unit_price",
      assumptions: ["One-time sale/resource line replayed directly from quantity and rate."],
    };
  }

  if (profile.cadence === "daily") {
    if (inclusiveDays === null) {
      return {
        profile,
        grossAmount: null,
        formula: "unit_price * quantity * inclusive_days",
        assumptions: ["Daily line is missing a valid service period."],
      };
    }
    return {
      profile,
      grossAmount: roundMoney(unitPrice * quantity * inclusiveDays),
      formula: "unit_price * quantity * inclusive_days",
      assumptions: ["RMI daily deals treat both invoice period endpoints as billable days."],
    };
  }

  if (profile.cadence === "monthly") {
    return {
      profile,
      grossAmount: roundMoney(unitPrice * quantity * billingPeriodsBilled),
      formula: "unit_price * quantity * billing_periods_billed",
      assumptions: [
        "Standard monthly rent bills the contracted monthly rate independent of month length.",
      ],
    };
  }

  return {
    profile,
    grossAmount: null,
    formula: "unsupported",
    assumptions: [`${profile.cadence} cadence requires a specific formula mapping.`],
  };
}

function buildNextCandidate(
  line: BillingPreviewLineInput,
  profile: BillingProfileInference,
) {
  if (
    profile.cadence !== "monthly" &&
    profile.cadence !== "daily" &&
    profile.cadence !== "weekly"
  ) {
    return null;
  }

  const currentThru = toDate(line.invoiceThruDate);
  if (!currentThru) {
    return null;
  }

  const nextFrom = addDays(startOfUtcDay(currentThru), 1);
  const previousDays =
    inclusiveDaysBetween(line.invoiceFromDate, line.invoiceThruDate) ?? 30;
  const quantity = numericToNumber(line.quantity, 0);
  const unitPrice = numericToNumber(line.unitPrice, 0);

  if (profile.cadence === "monthly") {
    const nextThru = addDays(addMonthsClamped(nextFrom, 1), -1);
    return {
      invoiceFromDate: nextFrom.toISOString(),
      invoiceThruDate: nextThru.toISOString(),
      grossAmount: roundMoney(quantity * unitPrice),
      formula: "next monthly standard period: unit_price * quantity",
    };
  }

  const nextThru = addDays(nextFrom, Math.max(previousDays, 1) - 1);
  return {
    invoiceFromDate: nextFrom.toISOString(),
    invoiceThruDate: nextThru.toISOString(),
    grossAmount: roundMoney(quantity * unitPrice * Math.max(previousDays, 1)),
    formula: `next ${profile.cadence} period repeats prior inclusive day count`,
  };
}

export function buildBillingPreviewLine(
  line: BillingPreviewLineInput,
): BillingPreviewLine {
  const actualQuantity = numericToNumber(line.quantity, 0);
  const actualUnitPrice = numericToNumber(line.unitPrice, 0);
  const actualGross = roundMoney(numericToNumber(line.grossAmount, 0));
  const actualTax = roundMoney(numericToNumber(line.taxAmount, 0));
  const actualDamageWaiver = roundMoney(
    numericToNumber(line.damageWaiverAmount, 0),
  );
  const calculation = calculatePreviewGross(line);
  const previewGross =
    calculation.grossAmount === null ? null : roundMoney(calculation.grossAmount);
  const grossDelta =
    previewGross === null ? null : roundMoney(previewGross - actualGross);
  const status: BillingReplayStatus =
    previewGross === null
      ? "unsupported"
      : Math.abs(grossDelta ?? 0) <= MONEY_TOLERANCE
        ? "matched"
        : "mismatch";
  const profile = calculation.profile;

  return {
    sourceLineId: line.id ?? null,
    documentType: line.documentType ?? null,
    documentNo: line.documentNo,
    lineNo: line.lineNo,
    orderNo: line.previousNo ?? null,
    assetNumber: line.type === "Fixed Asset" ? line.itemNo ?? null : null,
    description: line.description ?? null,
    profile,
    servicePeriod: {
      from: toIso(line.invoiceFromDate),
      thru: toIso(line.invoiceThruDate),
      inclusiveDays: inclusiveDaysBetween(
        line.invoiceFromDate,
        line.invoiceThruDate,
      ),
    },
    actual: {
      quantity: actualQuantity,
      unitPrice: actualUnitPrice,
      grossAmount: actualGross,
      taxAmount: actualTax,
      damageWaiverAmount: actualDamageWaiver,
      totalAmount: roundMoney(actualGross + actualTax + actualDamageWaiver),
    },
    preview: {
      quantity: actualQuantity,
      unitPrice: actualUnitPrice,
      grossAmount: previewGross,
      taxAmount: previewGross === null ? null : actualTax,
      damageWaiverAmount: previewGross === null ? null : actualDamageWaiver,
      totalAmount:
        previewGross === null
          ? null
          : roundMoney(previewGross + actualTax + actualDamageWaiver),
      formula: calculation.formula,
      assumptions: calculation.assumptions,
    },
    comparison: {
      status,
      grossDelta,
      tolerance: MONEY_TOLERANCE,
      reason:
        status === "matched"
          ? "Calculated gross amount matches posted BC/RMI line."
          : status === "unsupported"
            ? "Line is surfaced for review but not replayed by the first-pass engine."
            : "Calculated gross amount differs from posted BC/RMI line.",
    },
    nextCandidate: buildNextCandidate(line, profile),
  };
}

export function buildBillingPreviewResult(
  query: BillingPreviewQuery,
  sourceLines: BillingPreviewLineInput[],
): BillingPreviewResult {
  const lines = sourceLines.map(buildBillingPreviewLine);
  const supported = lines.filter((line) => line.comparison.status !== "unsupported");
  const matched = lines.filter((line) => line.comparison.status === "matched");
  const mismatched = lines.filter((line) => line.comparison.status === "mismatch");
  const unsupported = lines.filter(
    (line) => line.comparison.status === "unsupported",
  );
  const previewGrossAmount = roundMoney(
    lines.reduce((sum, line) => sum + (line.preview.grossAmount ?? 0), 0),
  );

  return {
    generatedAt: new Date().toISOString(),
    query: {
      ...query,
      limit: normalizeLimit(query.limit),
    },
    summary: {
      sourceLineCount: lines.length,
      supportedLineCount: supported.length,
      matchedLineCount: matched.length,
      mismatchedLineCount: mismatched.length,
      unsupportedLineCount: unsupported.length,
      actualGrossAmount: roundMoney(
        lines.reduce((sum, line) => sum + line.actual.grossAmount, 0),
      ),
      previewGrossAmount,
      actualTaxAmount: roundMoney(
        lines.reduce((sum, line) => sum + line.actual.taxAmount, 0),
      ),
      nextCandidateCount: lines.filter((line) => line.nextCandidate).length,
    },
    lines,
  };
}

function normalizeLimit(limit: number | null | undefined) {
  if (!Number.isInteger(limit) || !limit || limit <= 0) {
    return DEFAULT_QUERY_LIMIT;
  }
  return Math.min(limit, MAX_QUERY_LIMIT);
}

function requirePreviewFilter(query: BillingPreviewQuery) {
  const filters = [query.documentNo, query.orderNo, query.assetNumber].filter(Boolean);
  if (filters.length !== 1) {
    throw new Error("Provide exactly one of documentNo, orderNo, or assetNumber.");
  }
}

type BillingPreviewDbRow = BillingPreviewLineInput & {
  headerSellToCustomerNo: string | null;
  headerBillToCustomerNo: string | null;
  headerDueDate: Date | null;
};

export async function getBillingPreview(query: BillingPreviewQuery) {
  requirePreviewFilter(query);
  const { pool } = await import("@/lib/db");

  const limit = normalizeLimit(query.limit);
  const params: Array<string | number> = [];
  const where: string[] = [];

  if (query.documentNo) {
    params.push(query.documentNo);
    where.push(`l.document_no = $${params.length}`);
  }
  if (query.orderNo) {
    params.push(query.orderNo);
    where.push(`l.previous_no = $${params.length}`);
  }
  if (query.assetNumber) {
    params.push(query.assetNumber);
    where.push(`l.item_no = $${params.length}`);
  }
  params.push(limit);

  const result = await pool.query<BillingPreviewDbRow>(
    `
      select
        l.id,
        l.document_type as "documentType",
        l.document_no as "documentNo",
        l.line_no as "lineNo",
        l.line_type as "lineType",
        l.type,
        l.item_no as "itemNo",
        l.description,
        l.quantity,
        l.unit_price as "unitPrice",
        l.gross_amount as "grossAmount",
        l.tax_amount as "taxAmount",
        l.damage_waiver_amount as "damageWaiverAmount",
        l.invoice_from_date as "invoiceFromDate",
        l.invoice_thru_date as "invoiceThruDate",
        l.shipment_date as "shipmentDate",
        l.return_date as "returnDate",
        l.posting_date as "postingDate",
        l.previous_no as "previousNo",
        l.deal_code as "dealCode",
        l.deal_length as "dealLength",
        l.billing_for as "billingFor",
        l.location_code as "locationCode",
        l.shortcut_dimension1_code as "shortcutDimension1Code",
        l.shortcut_dimension2_code as "shortcutDimension2Code",
        l.tax_group_code as "taxGroupCode",
        l.source_payload as "sourcePayload",
        h.sell_to_customer_no as "headerSellToCustomerNo",
        h.bill_to_customer_no as "headerBillToCustomerNo",
        h.due_date as "headerDueDate"
      from bc_rmi_posted_rental_lines l
      left join bc_rmi_posted_rental_invoice_headers h
        on h.document_type = l.document_type and h.document_no = l.document_no
      where ${where.join(" and ")}
      order by l.posting_date desc nulls last, l.document_no desc, l.line_no asc
      limit $${params.length}
    `,
    params,
  );

  return buildBillingPreviewResult(query, result.rows);
}

export async function getBillingValidationSampleDocumentNos(sampleSize: number) {
  const { pool } = await import("@/lib/db");
  const limit = normalizeLimit(sampleSize);
  const result = await pool.query<{ document_no: string }>(
    `
      select l.document_no
      from bc_rmi_posted_rental_lines l
      where l.line_type = 'Rental'
        and l.type = 'Fixed Asset'
        and l.billing_for = 'Standard Term'
        and l.deal_code in ('INMOA', 'INMOR', 'BP-INMOR', 'INDADA')
        and l.document_no is not null
        and l.posting_date is not null
      group by l.document_no
      order by max(l.posting_date) desc nulls last, l.document_no desc
      limit $1
    `,
    [limit],
  );

  return result.rows.map((row) => row.document_no);
}

export async function validateBillingPreviewDocuments(documentNos: string[]) {
  const previews = await Promise.all(
    documentNos.map((documentNo) =>
      getBillingPreview({
        documentNo,
        limit: MAX_QUERY_LIMIT,
      }),
    ),
  );
  const lines = previews.flatMap((preview) => preview.lines);
  const supported = lines.filter((line) => line.comparison.status !== "unsupported");
  const matched = lines.filter((line) => line.comparison.status === "matched");
  const mismatched = lines.filter((line) => line.comparison.status === "mismatch");
  const unsupported = lines.filter(
    (line) => line.comparison.status === "unsupported",
  );

  return {
    generatedAt: new Date().toISOString(),
    sampledDocumentNos: documentNos,
    documentCount: previews.length,
    sourceLineCount: lines.length,
    supportedLineCount: supported.length,
    matchedLineCount: matched.length,
    mismatchedLineCount: mismatched.length,
    unsupportedLineCount: unsupported.length,
    actualGrossAmount: roundMoney(
      lines.reduce((sum, line) => sum + line.actual.grossAmount, 0),
    ),
    previewGrossAmount: roundMoney(
      lines.reduce((sum, line) => sum + (line.preview.grossAmount ?? 0), 0),
    ),
    mismatches: mismatched.slice(0, 50).map((line) => ({
      documentNo: line.documentNo,
      lineNo: line.lineNo,
      itemNo: line.assetNumber,
      dealCode: line.profile.dealCode,
      actualGrossAmount: line.actual.grossAmount,
      previewGrossAmount: line.preview.grossAmount,
      grossDelta: line.comparison.grossDelta,
      reason: line.comparison.reason,
    })),
  } satisfies BillingValidationResult;
}

export async function validateBillingPreviewSample(sampleSize: number) {
  const documentNos = await getBillingValidationSampleDocumentNos(sampleSize);
  return validateBillingPreviewDocuments(documentNos);
}
