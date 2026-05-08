import { eq, sql } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import { createId, now, toDate } from "@/lib/server/production-utils";

export const businessCentralEntityTypes = [
  "bc_branch",
  "bc_customer",
  "bc_customer_location",
  "bc_asset",
  "bc_contract",
  "bc_contract_line",
  "bc_invoice",
  "bc_invoice_line",
  "bc_vendor",
  "bc_gl_account",
  "bc_customer_card",
  "bc_rmi_posted_rental_header",
  "bc_rmi_posted_rental_line",
  "bc_rmi_rental_ledger_entry",
  "bc_rmi_posted_rental_invoice_header",
  "bc_sales_document",
  "bc_sales_document_line",
  "bc_rmi_invoice_rental_line",
  "bc_rmi_invoice_sales_line",
] as const;

type BusinessCentralEntityType = (typeof businessCentralEntityTypes)[number];

type AddressLike = {
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
};

export interface BcBranchSeedInput {
  externalId: string;
  code: string;
  name: string;
  timezone?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: AddressLike | null;
  payload?: Record<string, unknown>;
}

export interface BcAssetSeedInput {
  externalId: string;
  assetNumber: string;
  branchCode: string;
  branchName?: string | null;
  type: typeof schema.assets.$inferInsert.type;
  subtype?: string | null;
  dimensions?: Record<string, unknown> | null;
  status?: typeof schema.assets.$inferInsert.status;
  availability?: typeof schema.assets.$inferInsert.availability;
  maintenanceStatus?: typeof schema.assets.$inferInsert.maintenanceStatus;
  serialNumber?: string | null;
  manufacturer?: string | null;
  modelYear?: number | null;
  registrationNumber?: string | null;
  faClassCode?: string | null;
  faSubclassCode?: string | null;
  bcLocationCode?: string | null;
  bcDimension1Code?: string | null;
  bcProductNo?: string | null;
  bcServiceItemNo?: string | null;
  isBlocked?: boolean;
  isInactive?: boolean;
  isDisposed?: boolean;
  isOnRent?: boolean;
  isInService?: boolean;
  underMaintenance?: boolean;
  bookValue?: string | number | null;
  manufacturedAt?: string | Date | null;
  purchaseDate?: string | Date | null;
  payload?: Record<string, unknown>;
}

export interface BcCustomerLocationSeedInput {
  externalId: string;
  name: string;
  address?: AddressLike | null;
  contactPerson?: Record<string, unknown> | null;
  deliveryNotes?: string | null;
  isPrimary?: boolean;
  payload?: Record<string, unknown>;
}

export interface BcCustomerSeedInput {
  externalId: string;
  customerNumber: string;
  name: string;
  customerType?: typeof schema.customers.$inferInsert.customerType;
  contactInfo?: Record<string, unknown> | null;
  billingAddress?: AddressLike | null;
  portalEnabled?: boolean;
  branchCoverage?: string[];
  taxExempt?: boolean;
  creditLimit?: string | number | null;
  notes?: string | null;
  responsibilityCenter?: string | null;
  defaultSalesTeam?: string | null;
  defaultDealCode?: string | null;
  damageWaiverDeclined?: boolean | null;
  insuranceCertRequired?: boolean | null;
  insuranceExpirationDate?: string | Date | null;
  insurancePolicyNo?: string | null;
  registrationNumber?: string | null;
  locations?: BcCustomerLocationSeedInput[];
  payload?: Record<string, unknown>;
}

export interface BcCommercialDocumentLineSeedInput {
  externalLineId?: string | null;
  lineNo?: number | null;
  itemNo?: string | null;
  uomCode?: string | null;
  quantity?: string | number | null;
  unitPrice?: string | number | null;
  lineAmount?: string | number | null;
  assetId?: string | null;
  lineKind?: typeof schema.contractLines.$inferInsert.lineKind;
  sourceLineType?: string | null;
  sourceSequenceNo?: number | null;
  sourceDealCode?: string | null;
  sourceDealLength?: string | number | null;
  billingFor?: string | null;
  invoiceFromDate?: string | Date | null;
  invoiceThruDate?: string | Date | null;
  shipmentDate?: string | Date | null;
  returnDate?: string | Date | null;
  taxGroupCode?: string | null;
  damageWaiverPercent?: string | number | null;
  parentItemLineNo?: number | null;
  legacyPostingDate?: string | Date | null;
  serviceBranchId?: string | null;
  serviceLocationCode?: string | null;
  customerLocationId?: string | null;
  legacyOrderNo?: string | null;
  legacyInvoiceNo?: string | null;
  revenueRecognitionBasis?: typeof schema.commercialEvents.$inferInsert.revenueRecognitionBasis;
  payload: Record<string, unknown>;
}

export interface BcCommercialDocumentSeedInput {
  externalDocumentId: string;
  documentType: string;
  documentNo: string;
  customerExternalId?: string | null;
  status?: string | null;
  documentDate?: string | Date | null;
  dueDate?: string | Date | null;
  payload: Record<string, unknown>;
  lines?: BcCommercialDocumentLineSeedInput[];
  contractSnapshot?: Partial<typeof schema.contracts.$inferInsert> & {
    contractNumber: string;
    customerId: string;
    locationId: string;
    branchId: string;
    startDate: Date;
  };
  invoiceSnapshot?: Partial<typeof schema.invoices.$inferInsert> & {
    invoiceNumber: string;
    customerId: string;
    invoiceDate: Date;
    dueDate: Date;
    subtotalAmount: string;
    totalAmount: string;
    balanceAmount: string;
  };
}

export interface BcAccountingHistorySeedInput {
  glAccounts?: Array<{
    accountNo: string;
    name: string;
    accountType?: string | null;
    incomeBalance?: string | null;
    category?: string | null;
    subcategory?: string | null;
    blocked?: boolean;
    payload?: Record<string, unknown>;
  }>;
  vendors?: Array<{
    vendorNo: string;
    name: string;
    status?: string | null;
    locationCode?: string | null;
    payload?: Record<string, unknown>;
  }>;
  dimensionSets?: Array<{
    externalDimensionSetId: string;
    payload?: Record<string, unknown>;
    entries?: Array<{
      dimensionCode: string;
      dimensionValueCode: string;
      payload?: Record<string, unknown>;
    }>;
  }>;
  glEntries?: Array<{
    externalEntryNo: string;
    postingDate?: string | Date | null;
    documentNo?: string | null;
    description?: string | null;
    accountNo?: string | null;
    amount?: string | number | null;
    debitAmount?: string | number | null;
    creditAmount?: string | number | null;
    externalDimensionSetId?: string | null;
    payload: Record<string, unknown>;
  }>;
  bankLedgerEntries?: Array<{
    externalEntryNo: string;
    bankAccountNo?: string | null;
    postingDate?: string | Date | null;
    documentNo?: string | null;
    amount?: string | number | null;
    payload: Record<string, unknown>;
  }>;
  vendorLedgerEntries?: Array<{
    externalEntryNo: string;
    vendorNo?: string | null;
    postingDate?: string | Date | null;
    documentNo?: string | null;
    amount?: string | number | null;
    payload: Record<string, unknown>;
  }>;
  customerLedgerEntries?: Array<{
    externalEntryNo: string;
    customerNo?: string | null;
    postingDate?: string | Date | null;
    documentNo?: string | null;
    amount?: string | number | null;
    payload: Record<string, unknown>;
  }>;
  faLedgerEntries?: Array<{
    externalEntryNo: string;
    assetNo?: string | null;
    postingDate?: string | Date | null;
    documentNo?: string | null;
    amount?: string | number | null;
    payload: Record<string, unknown>;
  }>;
}

export interface BcCustomerCardSeedInput {
  customerNo: string;
  name: string;
  customerType?: string | null;
  parentNo?: string | null;
  parentName?: string | null;
  blocked?: string | null;
  responsibilityCenter?: string | null;
  salespersonCode?: string | null;
  defaultSalesTeam?: string | null;
  defaultDealCode?: string | null;
  damageWaiverDeclined?: boolean | null;
  insuranceCertRequired?: boolean | null;
  insuranceExpirationDate?: string | Date | null;
  insurancePolicyNo?: string | null;
  registrationNumber?: string | null;
  balanceLcy?: string | number | null;
  balanceDueLcy?: string | number | null;
  creditLimitLcy?: string | number | null;
  payload: Record<string, unknown>;
}

export interface BcRmiPostedRentalHeaderSeedInput {
  externalId?: string | null;
  documentType: string;
  documentNo: string;
  previousDocType?: string | null;
  previousNo?: string | null;
  sellToCustomerNo?: string | null;
  billToCustomerNo?: string | null;
  shipToCode?: string | null;
  postingDate?: string | Date | null;
  orderDate?: string | Date | null;
  selectThruDate?: string | Date | null;
  documentDate?: string | Date | null;
  dueDate?: string | Date | null;
  shipmentDate?: string | Date | null;
  returnDate?: string | Date | null;
  locationCode?: string | null;
  responsibilityCenter?: string | null;
  shortcutDimension1Code?: string | null;
  shortcutDimension2Code?: string | null;
  status?: string | null;
  sourceCode?: string | null;
  externalDocumentNo?: string | null;
  dimensionSetId?: number | null;
  payload: Record<string, unknown>;
}

export interface BcRmiPostedRentalLineSeedInput {
  externalId?: string | null;
  documentType: string;
  documentNo: string;
  lineNo: number;
  sequenceNo?: number | null;
  lineType?: string | null;
  type?: string | null;
  itemNo?: string | null;
  description?: string | null;
  quantity?: string | number | null;
  unitOfMeasureCode?: string | null;
  unitPrice?: string | number | null;
  grossAmount?: string | number | null;
  grossAmountLcy?: string | number | null;
  lineDiscountAmount?: string | number | null;
  invoiceDiscountAmount?: string | number | null;
  taxAmount?: string | number | null;
  damageWaiverAmount?: string | number | null;
  fromDate?: string | Date | null;
  thruDate?: string | Date | null;
  invoiceFromDate?: string | Date | null;
  invoiceThruDate?: string | Date | null;
  shipmentDate?: string | Date | null;
  returnDate?: string | Date | null;
  postingDate?: string | Date | null;
  previousDocType?: string | null;
  previousNo?: string | null;
  dealCode?: string | null;
  dealLength?: string | number | null;
  billingFor?: string | null;
  locationCode?: string | null;
  shortcutDimension1Code?: string | null;
  shortcutDimension2Code?: string | null;
  taxGroupCode?: string | null;
  dimensionSetId?: number | null;
  payload: Record<string, unknown>;
}

export interface BcRmiRentalLedgerEntrySeedInput {
  externalEntryNo: string;
  documentType?: string | null;
  documentNo?: string | null;
  orderNo?: string | null;
  postingDate?: string | Date | null;
  billToCustomerNo?: string | null;
  typeOrdered?: string | null;
  noOrdered?: string | null;
  typeShipped?: string | null;
  noShipped?: string | null;
  serialNoShipped?: string | null;
  quantity?: string | number | null;
  fromDate?: string | Date | null;
  thruDate?: string | Date | null;
  rentalDays?: string | number | null;
  unitPrice?: string | number | null;
  grossAmount?: string | number | null;
  grossAmountLcy?: string | number | null;
  lineDiscountAmount?: string | number | null;
  invoiceDiscountAmount?: string | number | null;
  dealCode?: string | null;
  shortcutDimension1Code?: string | null;
  shortcutDimension2Code?: string | null;
  payload: Record<string, unknown>;
}

export interface BcRmiPostedRentalInvoiceHeaderSeedInput {
  documentType: string;
  documentNo: string;
  previousDocType?: string | null;
  previousNo?: string | null;
  sellToCustomerNo?: string | null;
  billToCustomerNo?: string | null;
  postingDate?: string | Date | null;
  documentDate?: string | Date | null;
  dueDate?: string | Date | null;
  locationCode?: string | null;
  responsibilityCenter?: string | null;
  shortcutDimension1Code?: string | null;
  shortcutDimension2Code?: string | null;
  externalDocumentNo?: string | null;
  payload: Record<string, unknown>;
}

export interface BcSalesDocumentSeedInput {
  externalId?: string | null;
  documentType: string;
  documentNo: string;
  sellToCustomerNo?: string | null;
  billToCustomerNo?: string | null;
  status?: string | null;
  orderDate?: string | Date | null;
  postingDate?: string | Date | null;
  documentDate?: string | Date | null;
  dueDate?: string | Date | null;
  shipmentDate?: string | Date | null;
  locationCode?: string | null;
  shortcutDimension1Code?: string | null;
  shortcutDimension2Code?: string | null;
  amount?: string | number | null;
  amountIncludingVat?: string | number | null;
  dimensionSetId?: number | null;
  payload: Record<string, unknown>;
}

export interface BcSalesDocumentLineSeedInput {
  documentType: string;
  documentNo: string;
  lineNo: number;
  sellToCustomerNo?: string | null;
  type?: string | null;
  itemNo?: string | null;
  description?: string | null;
  quantity?: string | number | null;
  outstandingQuantity?: string | number | null;
  qtyToInvoice?: string | number | null;
  unitPrice?: string | number | null;
  amount?: string | number | null;
  lineAmount?: string | number | null;
  amountIncludingVat?: string | number | null;
  locationCode?: string | null;
  shipmentDate?: string | Date | null;
  requestedDeliveryDate?: string | Date | null;
  plannedDeliveryDate?: string | Date | null;
  shortcutDimension1Code?: string | null;
  shortcutDimension2Code?: string | null;
  dimensionSetId?: number | null;
  payload: Record<string, unknown>;
}

export interface BcInvoiceSubformLineSeedInput {
  lineSourceKind: "rental" | "sales";
  documentType: string;
  documentNo: string;
  lineNo: number;
  itemNo?: string | null;
  description?: string | null;
  quantity?: string | number | null;
  unitPrice?: string | number | null;
  lineAmount?: string | number | null;
  payload: Record<string, unknown>;
}

function normalizeAddress(address?: AddressLike | null) {
  return {
    line1: address?.line1 || "Unknown",
    line2: address?.line2 || "",
    city: address?.city || "Unknown",
    state: address?.state || "NA",
    postalCode: address?.postalCode || "00000",
    country: address?.country || "US",
  };
}

function toNumericString(value?: string | number | null, fallback = "0") {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  return typeof value === "number" ? value.toFixed(2) : String(value);
}

function toOptionalNumericString(value?: string | number | null) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  return toNumericString(value);
}

function toTimestamp(value?: string | Date | null) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const normalized = value.trim();
  if (
    !normalized ||
    normalized.startsWith("0001-01-01") ||
    normalized.startsWith("1753-01-01")
  ) {
    return null;
  }

  const parsed = toDate(normalized);
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
}

function getLineDescription(line: BcCommercialDocumentLineSeedInput) {
  const payloadDescription =
    typeof line.payload.Description === "string"
      ? line.payload.Description
      : typeof line.payload.ItemDescription === "string"
        ? line.payload.ItemDescription
        : null;

  return payloadDescription || line.itemNo || "BC imported line";
}

function inferBillingUnit(line: BcCommercialDocumentLineSeedInput) {
  const haystack = `${line.uomCode ?? ""} ${getLineDescription(line)}`
    .toUpperCase()
    .trim();

  if (haystack.includes("DAY")) return "day" as const;
  if (haystack.includes("WEEK")) return "week" as const;
  if (haystack.includes("MONTH") || haystack.includes("MO")) return "month" as const;
  if (haystack.includes("MILE")) return "mileage" as const;
  if (haystack.includes("EVENT")) return "event" as const;

  return "flat" as const;
}

function inferCommercialEventType(line: BcCommercialDocumentLineSeedInput) {
  const haystack = `${line.itemNo ?? ""} ${getLineDescription(line)}`.toUpperCase();

  if (haystack.includes("DELIVERY")) return "delivery" as const;
  if (haystack.includes("PICKUP")) return "pickup" as const;
  if (haystack.includes("TAX")) return "tax" as const;
  if (haystack.includes("CREDIT") || haystack.includes("DISCOUNT")) {
    return "credit" as const;
  }
  if (haystack.includes("DAMAGE")) return "damage" as const;
  if (haystack.includes("SURCHARGE") || haystack.includes("FEE")) {
    return "surcharge" as const;
  }
  if (haystack.includes("DEPOSIT")) return "deposit_request" as const;
  if (haystack.includes("ADJUST")) return "adjustment" as const;

  return "rent" as const;
}

function inferRevenueRecognitionBasis(line: BcCommercialDocumentLineSeedInput) {
  if (line.revenueRecognitionBasis) return line.revenueRecognitionBasis;

  const eventType = inferCommercialEventType(line);
  if (eventType === "tax") return "tax" as const;
  if (eventType === "damage") return "damage" as const;
  if (eventType === "credit") return "credit" as const;
  if (eventType === "delivery" || eventType === "pickup") return "one_time" as const;

  const haystack = `${line.lineKind ?? ""} ${line.itemNo ?? ""} ${getLineDescription(
    line,
  )}`.toUpperCase();
  if (haystack.includes("BUYOUT")) return "buyout" as const;

  return "rental_period" as const;
}

async function upsertExternalMapping(options: {
  entityType: BusinessCentralEntityType;
  internalId: string;
  externalId: string;
  payload?: Record<string, unknown>;
}) {
  const existingByExternalId = await db.query.externalEntityMappings.findFirst({
    where: eq(schema.externalEntityMappings.externalId, options.externalId),
  });

  const existingByInternalId = await db.query.externalEntityMappings.findFirst({
    where: sql`${schema.externalEntityMappings.provider} = 'business_central'
      and ${schema.externalEntityMappings.entityType} = ${options.entityType}
      and ${schema.externalEntityMappings.internalId} = ${options.internalId}`,
  });

  const existing =
    existingByExternalId?.provider === "business_central"
      ? existingByExternalId
      : existingByInternalId?.provider === "business_central"
        ? existingByInternalId
        : undefined;

  if (existing) {
    await db
      .update(schema.externalEntityMappings)
      .set({
        provider: "business_central",
        entityType: options.entityType,
        internalId: options.internalId,
        externalId: options.externalId,
        payload: options.payload ?? existing.payload ?? null,
        updatedAt: now(),
      })
      .where(eq(schema.externalEntityMappings.id, existing.id));
    return existing.id;
  }

  const id = createId("xmap");

  await db
    .insert(schema.externalEntityMappings)
    .values({
      id,
      provider: "business_central",
      entityType: options.entityType,
      internalId: options.internalId,
      externalId: options.externalId,
      payload: options.payload ?? null,
      createdAt: now(),
      updatedAt: now(),
    })
    .onConflictDoUpdate({
      target: schema.externalEntityMappings.id,
      set: {
        provider: "business_central",
        entityType: options.entityType,
        internalId: options.internalId,
        externalId: options.externalId,
        payload: options.payload ?? null,
        updatedAt: now(),
      },
    });

  return id;
}

export async function startBcImportRun(options: {
  entityType: string;
  sourceWindowStart?: Date | null;
  sourceWindowEnd?: Date | null;
  jobVersion?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const runId = createId("bcimp");
  const createdAt = now();

  await db.insert(schema.bcImportRuns).values({
    id: runId,
    provider: "business_central",
    entityType: options.entityType,
    status: "running",
    sourceWindowStart: options.sourceWindowStart ?? null,
    sourceWindowEnd: options.sourceWindowEnd ?? null,
    startedAt: createdAt,
    jobVersion: options.jobVersion ?? null,
    metadata: options.metadata ?? null,
    createdAt,
    updatedAt: createdAt,
  });

  return runId;
}

export async function finishBcImportRun(options: {
  runId: string;
  status: typeof schema.bcImportRuns.$inferInsert.status;
  recordsSeen?: number;
  recordsInserted?: number;
  recordsUpdated?: number;
  recordsSkipped?: number;
  recordsFailed?: number;
  errorSummary?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await db
    .update(schema.bcImportRuns)
    .set({
      status: options.status,
      recordsSeen: options.recordsSeen ?? 0,
      recordsInserted: options.recordsInserted ?? 0,
      recordsUpdated: options.recordsUpdated ?? 0,
      recordsSkipped: options.recordsSkipped ?? 0,
      recordsFailed: options.recordsFailed ?? 0,
      errorSummary: options.errorSummary ?? null,
      metadata: options.metadata ?? null,
      finishedAt: now(),
      updatedAt: now(),
    })
    .where(eq(schema.bcImportRuns.id, options.runId));
}

export async function recordBcImportError(options: {
  runId: string;
  entityType: string;
  message: string;
  externalId?: string | null;
  internalId?: string | null;
  pageCursor?: string | null;
  errorCode?: string | null;
  payload?: Record<string, unknown>;
}) {
  await db.insert(schema.bcImportErrors).values({
    id: createId("bcerr"),
    runId: options.runId,
    entityType: options.entityType,
    externalId: options.externalId ?? null,
    internalId: options.internalId ?? null,
    pageCursor: options.pageCursor ?? null,
    errorCode: options.errorCode ?? null,
    message: options.message,
    payload: options.payload ?? null,
    createdAt: now(),
  });
}

export async function saveBcImportCheckpoint(options: {
  entityType: string;
  runId?: string | null;
  cursor?: string | null;
  pageNumber?: number;
  lastExternalId?: string | null;
  windowStart?: Date | null;
  windowEnd?: Date | null;
  checkpointData?: Record<string, unknown>;
}) {
  const existing = await db.query.bcImportCheckpoints.findFirst({
    where: eq(schema.bcImportCheckpoints.entityType, options.entityType),
  });

  const values: typeof schema.bcImportCheckpoints.$inferInsert = {
    id: existing?.id ?? createId("bccp"),
    entityType: options.entityType,
    runId: options.runId ?? null,
    cursor: options.cursor ?? null,
    pageNumber: options.pageNumber ?? 0,
    lastExternalId: options.lastExternalId ?? null,
    windowStart: options.windowStart ?? null,
    windowEnd: options.windowEnd ?? null,
    checkpointData: options.checkpointData ?? null,
    updatedAt: now(),
  };

  await db.insert(schema.bcImportCheckpoints).values(values).onConflictDoUpdate({
    target: schema.bcImportCheckpoints.id,
    set: {
      runId: values.runId,
      cursor: values.cursor,
      pageNumber: values.pageNumber,
      lastExternalId: values.lastExternalId,
      windowStart: values.windowStart,
      windowEnd: values.windowEnd,
      checkpointData: values.checkpointData,
      updatedAt: values.updatedAt,
    },
  });
}

export async function seedBcCustomerCards(
  inputs: BcCustomerCardSeedInput[],
  runId?: string | null,
) {
  const results: string[] = [];

  for (const input of inputs) {
    const id = `bccustcard:${input.customerNo}`;
    const values: typeof schema.bcCustomerCards.$inferInsert = {
      id,
      runId: runId ?? null,
      customerNo: input.customerNo,
      name: input.name,
      customerType: input.customerType ?? null,
      parentNo: input.parentNo ?? null,
      parentName: input.parentName ?? null,
      blocked: input.blocked ?? null,
      responsibilityCenter: input.responsibilityCenter ?? null,
      salespersonCode: input.salespersonCode ?? null,
      defaultSalesTeam: input.defaultSalesTeam ?? null,
      defaultDealCode: input.defaultDealCode ?? null,
      damageWaiverDeclined: input.damageWaiverDeclined ?? null,
      insuranceCertRequired: input.insuranceCertRequired ?? null,
      insuranceExpirationDate: toTimestamp(input.insuranceExpirationDate),
      insurancePolicyNo: input.insurancePolicyNo ?? null,
      registrationNumber: input.registrationNumber ?? null,
      balanceLcy: toOptionalNumericString(input.balanceLcy),
      balanceDueLcy: toOptionalNumericString(input.balanceDueLcy),
      creditLimitLcy: toOptionalNumericString(input.creditLimitLcy),
      sourcePayload: input.payload,
      importedAt: now(),
    };

    await db.insert(schema.bcCustomerCards).values(values).onConflictDoUpdate({
      target: schema.bcCustomerCards.id,
      set: {
        runId: values.runId,
        name: values.name,
        customerType: values.customerType,
        parentNo: values.parentNo,
        parentName: values.parentName,
        blocked: values.blocked,
        responsibilityCenter: values.responsibilityCenter,
        salespersonCode: values.salespersonCode,
        defaultSalesTeam: values.defaultSalesTeam,
        defaultDealCode: values.defaultDealCode,
        damageWaiverDeclined: values.damageWaiverDeclined,
        insuranceCertRequired: values.insuranceCertRequired,
        insuranceExpirationDate: values.insuranceExpirationDate,
        insurancePolicyNo: values.insurancePolicyNo,
        registrationNumber: values.registrationNumber,
        balanceLcy: values.balanceLcy,
        balanceDueLcy: values.balanceDueLcy,
        creditLimitLcy: values.creditLimitLcy,
        sourcePayload: values.sourcePayload,
        importedAt: values.importedAt,
      },
    });

    await upsertExternalMapping({
      entityType: "bc_customer_card",
      internalId: id,
      externalId: input.customerNo,
      payload: input.payload,
    });

    results.push(id);
  }

  return results;
}

export async function seedBcRmiPostedRentalHeaders(
  inputs: BcRmiPostedRentalHeaderSeedInput[],
  runId?: string | null,
) {
  const results: string[] = [];

  for (const input of inputs) {
    const id = `bcrmih:${input.documentType}:${input.documentNo}`;
    const values: typeof schema.bcRmiPostedRentalHeaders.$inferInsert = {
      id,
      runId: runId ?? null,
      externalId: input.externalId ?? null,
      documentType: input.documentType,
      documentNo: input.documentNo,
      previousDocType: input.previousDocType ?? null,
      previousNo: input.previousNo ?? null,
      sellToCustomerNo: input.sellToCustomerNo ?? null,
      billToCustomerNo: input.billToCustomerNo ?? null,
      shipToCode: input.shipToCode ?? null,
      postingDate: toTimestamp(input.postingDate),
      orderDate: toTimestamp(input.orderDate),
      selectThruDate: toTimestamp(input.selectThruDate),
      documentDate: toTimestamp(input.documentDate),
      dueDate: toTimestamp(input.dueDate),
      shipmentDate: toTimestamp(input.shipmentDate),
      returnDate: toTimestamp(input.returnDate),
      locationCode: input.locationCode ?? null,
      responsibilityCenter: input.responsibilityCenter ?? null,
      shortcutDimension1Code: input.shortcutDimension1Code ?? null,
      shortcutDimension2Code: input.shortcutDimension2Code ?? null,
      status: input.status ?? null,
      sourceCode: input.sourceCode ?? null,
      externalDocumentNo: input.externalDocumentNo ?? null,
      dimensionSetId: input.dimensionSetId ?? null,
      sourcePayload: input.payload,
      importedAt: now(),
    };

    await db.insert(schema.bcRmiPostedRentalHeaders).values(values).onConflictDoUpdate({
      target: schema.bcRmiPostedRentalHeaders.id,
      set: {
        runId: values.runId,
        externalId: values.externalId,
        previousDocType: values.previousDocType,
        previousNo: values.previousNo,
        sellToCustomerNo: values.sellToCustomerNo,
        billToCustomerNo: values.billToCustomerNo,
        shipToCode: values.shipToCode,
        postingDate: values.postingDate,
        orderDate: values.orderDate,
        selectThruDate: values.selectThruDate,
        documentDate: values.documentDate,
        dueDate: values.dueDate,
        shipmentDate: values.shipmentDate,
        returnDate: values.returnDate,
        locationCode: values.locationCode,
        responsibilityCenter: values.responsibilityCenter,
        shortcutDimension1Code: values.shortcutDimension1Code,
        shortcutDimension2Code: values.shortcutDimension2Code,
        status: values.status,
        sourceCode: values.sourceCode,
        externalDocumentNo: values.externalDocumentNo,
        dimensionSetId: values.dimensionSetId,
        sourcePayload: values.sourcePayload,
        importedAt: values.importedAt,
      },
    });

    results.push(id);
  }

  return results;
}

export async function seedBcRmiPostedRentalLines(
  inputs: BcRmiPostedRentalLineSeedInput[],
  runId?: string | null,
) {
  const results: string[] = [];

  for (const input of inputs) {
    const id = `bcrmil:${input.documentType}:${input.documentNo}:${input.lineNo}`;
    const values: typeof schema.bcRmiPostedRentalLines.$inferInsert = {
      id,
      runId: runId ?? null,
      externalId: input.externalId ?? null,
      documentType: input.documentType,
      documentNo: input.documentNo,
      lineNo: input.lineNo,
      sequenceNo: input.sequenceNo ?? null,
      lineType: input.lineType ?? null,
      type: input.type ?? null,
      itemNo: input.itemNo ?? null,
      description: input.description ?? null,
      quantity: toOptionalNumericString(input.quantity),
      unitOfMeasureCode: input.unitOfMeasureCode ?? null,
      unitPrice: toOptionalNumericString(input.unitPrice),
      grossAmount: toOptionalNumericString(input.grossAmount),
      grossAmountLcy: toOptionalNumericString(input.grossAmountLcy),
      lineDiscountAmount: toOptionalNumericString(input.lineDiscountAmount),
      invoiceDiscountAmount: toOptionalNumericString(input.invoiceDiscountAmount),
      taxAmount: toOptionalNumericString(input.taxAmount),
      damageWaiverAmount: toOptionalNumericString(input.damageWaiverAmount),
      fromDate: toTimestamp(input.fromDate),
      thruDate: toTimestamp(input.thruDate),
      invoiceFromDate: toTimestamp(input.invoiceFromDate),
      invoiceThruDate: toTimestamp(input.invoiceThruDate),
      shipmentDate: toTimestamp(input.shipmentDate),
      returnDate: toTimestamp(input.returnDate),
      postingDate: toTimestamp(input.postingDate),
      previousDocType: input.previousDocType ?? null,
      previousNo: input.previousNo ?? null,
      dealCode: input.dealCode ?? null,
      dealLength: toOptionalNumericString(input.dealLength),
      billingFor: input.billingFor ?? null,
      locationCode: input.locationCode ?? null,
      shortcutDimension1Code: input.shortcutDimension1Code ?? null,
      shortcutDimension2Code: input.shortcutDimension2Code ?? null,
      taxGroupCode: input.taxGroupCode ?? null,
      dimensionSetId: input.dimensionSetId ?? null,
      sourcePayload: input.payload,
      importedAt: now(),
    };

    await db.insert(schema.bcRmiPostedRentalLines).values(values).onConflictDoUpdate({
      target: schema.bcRmiPostedRentalLines.id,
      set: {
        runId: values.runId,
        externalId: values.externalId,
        sequenceNo: values.sequenceNo,
        lineType: values.lineType,
        type: values.type,
        itemNo: values.itemNo,
        description: values.description,
        quantity: values.quantity,
        unitOfMeasureCode: values.unitOfMeasureCode,
        unitPrice: values.unitPrice,
        grossAmount: values.grossAmount,
        grossAmountLcy: values.grossAmountLcy,
        lineDiscountAmount: values.lineDiscountAmount,
        invoiceDiscountAmount: values.invoiceDiscountAmount,
        taxAmount: values.taxAmount,
        damageWaiverAmount: values.damageWaiverAmount,
        fromDate: values.fromDate,
        thruDate: values.thruDate,
        invoiceFromDate: values.invoiceFromDate,
        invoiceThruDate: values.invoiceThruDate,
        shipmentDate: values.shipmentDate,
        returnDate: values.returnDate,
        postingDate: values.postingDate,
        previousDocType: values.previousDocType,
        previousNo: values.previousNo,
        dealCode: values.dealCode,
        dealLength: values.dealLength,
        billingFor: values.billingFor,
        locationCode: values.locationCode,
        shortcutDimension1Code: values.shortcutDimension1Code,
        shortcutDimension2Code: values.shortcutDimension2Code,
        taxGroupCode: values.taxGroupCode,
        dimensionSetId: values.dimensionSetId,
        sourcePayload: values.sourcePayload,
        importedAt: values.importedAt,
      },
    });

    results.push(id);
  }

  return results;
}

export async function seedBcRmiRentalLedgerEntries(
  inputs: BcRmiRentalLedgerEntrySeedInput[],
  runId?: string | null,
) {
  const results: string[] = [];

  for (const input of inputs) {
    const id = `bcrle:${input.externalEntryNo}`;
    const values: typeof schema.bcRmiRentalLedgerEntries.$inferInsert = {
      id,
      runId: runId ?? null,
      externalEntryNo: input.externalEntryNo,
      documentType: input.documentType ?? null,
      documentNo: input.documentNo ?? null,
      orderNo: input.orderNo ?? null,
      postingDate: toTimestamp(input.postingDate),
      billToCustomerNo: input.billToCustomerNo ?? null,
      typeOrdered: input.typeOrdered ?? null,
      noOrdered: input.noOrdered ?? null,
      typeShipped: input.typeShipped ?? null,
      noShipped: input.noShipped ?? null,
      serialNoShipped: input.serialNoShipped ?? null,
      quantity: toOptionalNumericString(input.quantity),
      fromDate: toTimestamp(input.fromDate),
      thruDate: toTimestamp(input.thruDate),
      rentalDays: toOptionalNumericString(input.rentalDays),
      unitPrice: toOptionalNumericString(input.unitPrice),
      grossAmount: toOptionalNumericString(input.grossAmount),
      grossAmountLcy: toOptionalNumericString(input.grossAmountLcy),
      lineDiscountAmount: toOptionalNumericString(input.lineDiscountAmount),
      invoiceDiscountAmount: toOptionalNumericString(input.invoiceDiscountAmount),
      dealCode: input.dealCode ?? null,
      shortcutDimension1Code: input.shortcutDimension1Code ?? null,
      shortcutDimension2Code: input.shortcutDimension2Code ?? null,
      sourcePayload: input.payload,
      importedAt: now(),
    };

    await db.insert(schema.bcRmiRentalLedgerEntries).values(values).onConflictDoUpdate({
      target: schema.bcRmiRentalLedgerEntries.id,
      set: {
        runId: values.runId,
        documentType: values.documentType,
        documentNo: values.documentNo,
        orderNo: values.orderNo,
        postingDate: values.postingDate,
        billToCustomerNo: values.billToCustomerNo,
        typeOrdered: values.typeOrdered,
        noOrdered: values.noOrdered,
        typeShipped: values.typeShipped,
        noShipped: values.noShipped,
        serialNoShipped: values.serialNoShipped,
        quantity: values.quantity,
        fromDate: values.fromDate,
        thruDate: values.thruDate,
        rentalDays: values.rentalDays,
        unitPrice: values.unitPrice,
        grossAmount: values.grossAmount,
        grossAmountLcy: values.grossAmountLcy,
        lineDiscountAmount: values.lineDiscountAmount,
        invoiceDiscountAmount: values.invoiceDiscountAmount,
        dealCode: values.dealCode,
        shortcutDimension1Code: values.shortcutDimension1Code,
        shortcutDimension2Code: values.shortcutDimension2Code,
        sourcePayload: values.sourcePayload,
        importedAt: values.importedAt,
      },
    });

    results.push(id);
  }

  return results;
}

export async function seedBcRmiPostedRentalInvoiceHeaders(
  inputs: BcRmiPostedRentalInvoiceHeaderSeedInput[],
  runId?: string | null,
) {
  const results: string[] = [];

  for (const input of inputs) {
    const id = `bcrih:${input.documentType}:${input.documentNo}`;
    const values: typeof schema.bcRmiPostedRentalInvoiceHeaders.$inferInsert = {
      id,
      runId: runId ?? null,
      documentType: input.documentType,
      documentNo: input.documentNo,
      previousDocType: input.previousDocType ?? null,
      previousNo: input.previousNo ?? null,
      sellToCustomerNo: input.sellToCustomerNo ?? null,
      billToCustomerNo: input.billToCustomerNo ?? null,
      postingDate: toTimestamp(input.postingDate),
      documentDate: toTimestamp(input.documentDate),
      dueDate: toTimestamp(input.dueDate),
      locationCode: input.locationCode ?? null,
      responsibilityCenter: input.responsibilityCenter ?? null,
      shortcutDimension1Code: input.shortcutDimension1Code ?? null,
      shortcutDimension2Code: input.shortcutDimension2Code ?? null,
      externalDocumentNo: input.externalDocumentNo ?? null,
      sourcePayload: input.payload,
      importedAt: now(),
    };

    await db.insert(schema.bcRmiPostedRentalInvoiceHeaders).values(values).onConflictDoUpdate({
      target: schema.bcRmiPostedRentalInvoiceHeaders.id,
      set: {
        runId: values.runId,
        previousDocType: values.previousDocType,
        previousNo: values.previousNo,
        sellToCustomerNo: values.sellToCustomerNo,
        billToCustomerNo: values.billToCustomerNo,
        postingDate: values.postingDate,
        documentDate: values.documentDate,
        dueDate: values.dueDate,
        locationCode: values.locationCode,
        responsibilityCenter: values.responsibilityCenter,
        shortcutDimension1Code: values.shortcutDimension1Code,
        shortcutDimension2Code: values.shortcutDimension2Code,
        externalDocumentNo: values.externalDocumentNo,
        sourcePayload: values.sourcePayload,
        importedAt: values.importedAt,
      },
    });

    results.push(id);
  }

  return results;
}

export async function seedBcSalesDocuments(
  inputs: BcSalesDocumentSeedInput[],
  runId?: string | null,
) {
  const results: string[] = [];

  for (const input of inputs) {
    const id = `bcsdoc:${input.documentType}:${input.documentNo}`;
    const values: typeof schema.bcSalesDocuments.$inferInsert = {
      id,
      runId: runId ?? null,
      externalId: input.externalId ?? null,
      documentType: input.documentType,
      documentNo: input.documentNo,
      sellToCustomerNo: input.sellToCustomerNo ?? null,
      billToCustomerNo: input.billToCustomerNo ?? null,
      status: input.status ?? null,
      orderDate: toTimestamp(input.orderDate),
      postingDate: toTimestamp(input.postingDate),
      documentDate: toTimestamp(input.documentDate),
      dueDate: toTimestamp(input.dueDate),
      shipmentDate: toTimestamp(input.shipmentDate),
      locationCode: input.locationCode ?? null,
      shortcutDimension1Code: input.shortcutDimension1Code ?? null,
      shortcutDimension2Code: input.shortcutDimension2Code ?? null,
      amount: toOptionalNumericString(input.amount),
      amountIncludingVat: toOptionalNumericString(input.amountIncludingVat),
      dimensionSetId: input.dimensionSetId ?? null,
      sourcePayload: input.payload,
      importedAt: now(),
    };

    await db.insert(schema.bcSalesDocuments).values(values).onConflictDoUpdate({
      target: schema.bcSalesDocuments.id,
      set: {
        runId: values.runId,
        externalId: values.externalId,
        sellToCustomerNo: values.sellToCustomerNo,
        billToCustomerNo: values.billToCustomerNo,
        status: values.status,
        orderDate: values.orderDate,
        postingDate: values.postingDate,
        documentDate: values.documentDate,
        dueDate: values.dueDate,
        shipmentDate: values.shipmentDate,
        locationCode: values.locationCode,
        shortcutDimension1Code: values.shortcutDimension1Code,
        shortcutDimension2Code: values.shortcutDimension2Code,
        amount: values.amount,
        amountIncludingVat: values.amountIncludingVat,
        dimensionSetId: values.dimensionSetId,
        sourcePayload: values.sourcePayload,
        importedAt: values.importedAt,
      },
    });

    results.push(id);
  }

  return results;
}

export async function seedBcSalesDocumentLines(
  inputs: BcSalesDocumentLineSeedInput[],
  runId?: string | null,
) {
  const results: string[] = [];

  for (const input of inputs) {
    const id = `bcsline:${input.documentType}:${input.documentNo}:${input.lineNo}`;
    const values: typeof schema.bcSalesDocumentLines.$inferInsert = {
      id,
      runId: runId ?? null,
      documentType: input.documentType,
      documentNo: input.documentNo,
      lineNo: input.lineNo,
      sellToCustomerNo: input.sellToCustomerNo ?? null,
      type: input.type ?? null,
      itemNo: input.itemNo ?? null,
      description: input.description ?? null,
      quantity: toOptionalNumericString(input.quantity),
      outstandingQuantity: toOptionalNumericString(input.outstandingQuantity),
      qtyToInvoice: toOptionalNumericString(input.qtyToInvoice),
      unitPrice: toOptionalNumericString(input.unitPrice),
      amount: toOptionalNumericString(input.amount),
      lineAmount: toOptionalNumericString(input.lineAmount),
      amountIncludingVat: toOptionalNumericString(input.amountIncludingVat),
      locationCode: input.locationCode ?? null,
      shipmentDate: toTimestamp(input.shipmentDate),
      requestedDeliveryDate: toTimestamp(input.requestedDeliveryDate),
      plannedDeliveryDate: toTimestamp(input.plannedDeliveryDate),
      shortcutDimension1Code: input.shortcutDimension1Code ?? null,
      shortcutDimension2Code: input.shortcutDimension2Code ?? null,
      dimensionSetId: input.dimensionSetId ?? null,
      sourcePayload: input.payload,
      importedAt: now(),
    };

    await db.insert(schema.bcSalesDocumentLines).values(values).onConflictDoUpdate({
      target: schema.bcSalesDocumentLines.id,
      set: {
        runId: values.runId,
        sellToCustomerNo: values.sellToCustomerNo,
        type: values.type,
        itemNo: values.itemNo,
        description: values.description,
        quantity: values.quantity,
        outstandingQuantity: values.outstandingQuantity,
        qtyToInvoice: values.qtyToInvoice,
        unitPrice: values.unitPrice,
        amount: values.amount,
        lineAmount: values.lineAmount,
        amountIncludingVat: values.amountIncludingVat,
        locationCode: values.locationCode,
        shipmentDate: values.shipmentDate,
        requestedDeliveryDate: values.requestedDeliveryDate,
        plannedDeliveryDate: values.plannedDeliveryDate,
        shortcutDimension1Code: values.shortcutDimension1Code,
        shortcutDimension2Code: values.shortcutDimension2Code,
        dimensionSetId: values.dimensionSetId,
        sourcePayload: values.sourcePayload,
        importedAt: values.importedAt,
      },
    });

    results.push(id);
  }

  return results;
}

export async function seedBcInvoiceSubformLines(
  inputs: BcInvoiceSubformLineSeedInput[],
  runId?: string | null,
) {
  const results: string[] = [];

  for (const input of inputs) {
    const id = `bcinvsub:${input.lineSourceKind}:${input.documentType}:${input.documentNo}:${input.lineNo}`;
    const values = {
      id,
      runId: runId ?? null,
      documentType: input.documentType,
      documentNo: input.documentNo,
      lineNo: input.lineNo,
      itemNo: input.itemNo ?? null,
      description: input.description ?? null,
      quantity: toOptionalNumericString(input.quantity),
      unitPrice: toOptionalNumericString(input.unitPrice),
      lineAmount: toOptionalNumericString(input.lineAmount),
      sourcePayload: input.payload,
      importedAt: now(),
    };

    if (input.lineSourceKind === "rental") {
      await db
        .insert(schema.bcRmiPostedRentalInvoiceRentalLines)
        .values(values)
        .onConflictDoUpdate({
          target: schema.bcRmiPostedRentalInvoiceRentalLines.id,
          set: {
            runId: values.runId,
            itemNo: values.itemNo,
            description: values.description,
            quantity: values.quantity,
            unitPrice: values.unitPrice,
            lineAmount: values.lineAmount,
            sourcePayload: values.sourcePayload,
            importedAt: values.importedAt,
          },
        });
    } else {
      await db
        .insert(schema.bcRmiPostedRentalInvoiceSalesLines)
        .values(values)
        .onConflictDoUpdate({
          target: schema.bcRmiPostedRentalInvoiceSalesLines.id,
          set: {
            runId: values.runId,
            itemNo: values.itemNo,
            description: values.description,
            quantity: values.quantity,
            unitPrice: values.unitPrice,
            lineAmount: values.lineAmount,
            sourcePayload: values.sourcePayload,
            importedAt: values.importedAt,
          },
        });
    }

    results.push(id);
  }

  return results;
}

export async function seedBcBranches(inputs: BcBranchSeedInput[]) {
  const results: string[] = [];

  for (const input of inputs) {
    const existing = await db.query.branches.findFirst({
      where: eq(schema.branches.code, input.code),
    });
    const id = existing?.id ?? createId("branch");

    await db.insert(schema.branches).values({
      id,
      code: input.code,
      name: input.name,
      timezone: input.timezone ?? "America/New_York",
      phone: input.phone ?? null,
      email: input.email ?? null,
      address: normalizeAddress(input.address),
      createdAt: existing?.createdAt ?? now(),
      updatedAt: now(),
    }).onConflictDoUpdate({
      target: schema.branches.id,
      set: {
        code: input.code,
        name: input.name,
        timezone: input.timezone ?? "America/New_York",
        phone: input.phone ?? null,
        email: input.email ?? null,
        address: normalizeAddress(input.address),
        updatedAt: now(),
      },
    });

    await upsertExternalMapping({
      entityType: "bc_branch",
      internalId: id,
      externalId: input.externalId,
      payload: input.payload,
    });

    results.push(id);
  }

  return results;
}

async function requireBranchId(branchCode: string, branchName?: string | null) {
  let branch = await db.query.branches.findFirst({
    where: eq(schema.branches.code, branchCode),
  });

  if (!branch) {
    const id = createId("branch");
    await db.insert(schema.branches).values({
      id,
      code: branchCode,
      name: branchName || branchCode,
      timezone: "America/New_York",
      address: normalizeAddress(null),
      createdAt: now(),
      updatedAt: now(),
    });

    branch = await db.query.branches.findFirst({
      where: eq(schema.branches.id, id),
    });
  }

  if (!branch) {
    throw new Error(`Unable to resolve branch ${branchCode}.`);
  }

  return branch.id;
}

export async function seedBcAssets(inputs: BcAssetSeedInput[]) {
  const results: string[] = [];

  for (const input of inputs) {
    const existing = await db.query.assets.findFirst({
      where: eq(schema.assets.assetNumber, input.assetNumber),
    });
    const id = existing?.id ?? createId("asset");
    const branchId = await requireBranchId(input.branchCode, input.branchName);

    await db.insert(schema.assets).values({
      id,
      assetNumber: input.assetNumber,
      branchId,
      type: input.type,
      subtype: input.subtype ?? null,
      dimensions: input.dimensions ?? null,
      status: input.status ?? "available",
      availability: input.availability ?? "rentable",
      maintenanceStatus: input.maintenanceStatus ?? "clear",
      serialNumber: input.serialNumber ?? null,
      manufacturer: input.manufacturer ?? null,
      modelYear: input.modelYear ?? null,
      registrationNumber: input.registrationNumber ?? null,
      faClassCode: input.faClassCode ?? null,
      faSubclassCode: input.faSubclassCode ?? null,
      bcLocationCode: input.bcLocationCode ?? null,
      bcDimension1Code: input.bcDimension1Code ?? null,
      bcProductNo: input.bcProductNo ?? null,
      bcServiceItemNo: input.bcServiceItemNo ?? null,
      isBlocked: input.isBlocked ?? false,
      isInactive: input.isInactive ?? false,
      isDisposed: input.isDisposed ?? false,
      isOnRent: input.isOnRent ?? false,
      isInService: input.isInService ?? true,
      underMaintenance: input.underMaintenance ?? false,
      bookValue: input.bookValue ? toNumericString(input.bookValue) : null,
      sourcePayload: input.payload ?? null,
      manufacturedAt: toTimestamp(input.manufacturedAt),
      purchaseDate: toTimestamp(input.purchaseDate),
      createdAt: existing?.createdAt ?? now(),
      updatedAt: now(),
    }).onConflictDoUpdate({
      target: schema.assets.id,
      set: {
        assetNumber: input.assetNumber,
        branchId,
        type: input.type,
        subtype: input.subtype ?? null,
        dimensions: input.dimensions ?? null,
        status: input.status ?? "available",
        availability: input.availability ?? "rentable",
        maintenanceStatus: input.maintenanceStatus ?? "clear",
        serialNumber: input.serialNumber ?? null,
        manufacturer: input.manufacturer ?? null,
        modelYear: input.modelYear ?? null,
        registrationNumber: input.registrationNumber ?? null,
        faClassCode: input.faClassCode ?? null,
        faSubclassCode: input.faSubclassCode ?? null,
        bcLocationCode: input.bcLocationCode ?? null,
        bcDimension1Code: input.bcDimension1Code ?? null,
        bcProductNo: input.bcProductNo ?? null,
        bcServiceItemNo: input.bcServiceItemNo ?? null,
        isBlocked: input.isBlocked ?? false,
        isInactive: input.isInactive ?? false,
        isDisposed: input.isDisposed ?? false,
        isOnRent: input.isOnRent ?? false,
        isInService: input.isInService ?? true,
        underMaintenance: input.underMaintenance ?? false,
        bookValue: input.bookValue ? toNumericString(input.bookValue) : null,
        sourcePayload: input.payload ?? null,
        manufacturedAt: toTimestamp(input.manufacturedAt),
        purchaseDate: toTimestamp(input.purchaseDate),
        updatedAt: now(),
      },
    });

    await upsertExternalMapping({
      entityType: "bc_asset",
      internalId: id,
      externalId: input.externalId,
      payload: input.payload,
    });

    results.push(id);
  }

  return results;
}

export async function seedBcCustomers(inputs: BcCustomerSeedInput[]) {
  const results: string[] = [];

  for (const input of inputs) {
    const existing = await db.query.customers.findFirst({
      where: eq(schema.customers.customerNumber, input.customerNumber),
    });
    const id = existing?.id ?? createId("cust");

    await db.insert(schema.customers).values({
      id,
      customerNumber: input.customerNumber,
      name: input.name,
      customerType: input.customerType ?? "commercial",
      contactInfo: input.contactInfo ?? { name: input.name },
      billingAddress: normalizeAddress(input.billingAddress),
      portalEnabled: input.portalEnabled ?? false,
      branchCoverage: input.branchCoverage ?? [],
      taxExempt: input.taxExempt ?? false,
      creditLimit: input.creditLimit ? toNumericString(input.creditLimit) : null,
      notes: input.notes ?? null,
      responsibilityCenter: input.responsibilityCenter ?? null,
      defaultSalesTeam: input.defaultSalesTeam ?? null,
      defaultDealCode: input.defaultDealCode ?? null,
      damageWaiverDeclined: input.damageWaiverDeclined ?? null,
      insuranceCertRequired: input.insuranceCertRequired ?? null,
      insuranceExpirationDate: toTimestamp(input.insuranceExpirationDate),
      insurancePolicyNo: input.insurancePolicyNo ?? null,
      registrationNumber: input.registrationNumber ?? null,
      sourcePayload: input.payload ?? null,
      createdAt: existing?.createdAt ?? now(),
      updatedAt: now(),
    }).onConflictDoUpdate({
      target: schema.customers.id,
      set: {
        customerNumber: input.customerNumber,
        name: input.name,
        customerType: input.customerType ?? "commercial",
        contactInfo: input.contactInfo ?? { name: input.name },
        billingAddress: normalizeAddress(input.billingAddress),
        portalEnabled: input.portalEnabled ?? false,
        branchCoverage: input.branchCoverage ?? [],
        taxExempt: input.taxExempt ?? false,
        creditLimit: input.creditLimit ? toNumericString(input.creditLimit) : null,
        notes: input.notes ?? null,
        responsibilityCenter: input.responsibilityCenter ?? null,
        defaultSalesTeam: input.defaultSalesTeam ?? null,
        defaultDealCode: input.defaultDealCode ?? null,
        damageWaiverDeclined: input.damageWaiverDeclined ?? null,
        insuranceCertRequired: input.insuranceCertRequired ?? null,
        insuranceExpirationDate: toTimestamp(input.insuranceExpirationDate),
        insurancePolicyNo: input.insurancePolicyNo ?? null,
        registrationNumber: input.registrationNumber ?? null,
        sourcePayload: input.payload ?? null,
        updatedAt: now(),
      },
    });

    await upsertExternalMapping({
      entityType: "bc_customer",
      internalId: id,
      externalId: input.externalId,
      payload: input.payload,
    });

    for (const location of input.locations ?? []) {
      const existingLocation = await db.query.customerLocations.findFirst({
        where: eq(schema.customerLocations.name, location.name),
      });
      const locationId = existingLocation?.id ?? createId("cloc");

      await db.insert(schema.customerLocations).values({
        id: locationId,
        customerId: id,
        name: location.name,
        address: normalizeAddress(location.address),
        contactPerson: location.contactPerson ?? null,
        deliveryNotes: location.deliveryNotes ?? null,
        isPrimary: location.isPrimary ?? false,
        sourcePayload: location.payload ?? null,
        createdAt: existingLocation?.createdAt ?? now(),
        updatedAt: now(),
      }).onConflictDoUpdate({
        target: schema.customerLocations.id,
        set: {
          customerId: id,
          name: location.name,
          address: normalizeAddress(location.address),
          contactPerson: location.contactPerson ?? null,
          deliveryNotes: location.deliveryNotes ?? null,
          isPrimary: location.isPrimary ?? false,
          sourcePayload: location.payload ?? null,
          updatedAt: now(),
        },
      });

      await upsertExternalMapping({
        entityType: "bc_customer_location",
        internalId: locationId,
        externalId: location.externalId,
        payload: location.payload,
      });
    }

    results.push(id);
  }

  return results;
}

export async function seedBcCommercialDocuments(
  inputs: BcCommercialDocumentSeedInput[],
  runId?: string,
) {
  const results: string[] = [];

  for (const input of inputs) {
    const documentId = `bcdoc:${input.documentType}:${input.externalDocumentId}`;

    await db.insert(schema.bcSourceDocuments).values({
      id: documentId,
      runId: runId ?? null,
      externalDocumentId: input.externalDocumentId,
      documentType: input.documentType,
      documentNo: input.documentNo,
      customerExternalId: input.customerExternalId ?? null,
      status: input.status ?? null,
      documentDate: toTimestamp(input.documentDate),
      dueDate: toTimestamp(input.dueDate),
      payload: input.payload,
      importedAt: now(),
    }).onConflictDoUpdate({
      target: schema.bcSourceDocuments.id,
      set: {
        runId: runId ?? null,
        documentNo: input.documentNo,
        customerExternalId: input.customerExternalId ?? null,
        status: input.status ?? null,
        documentDate: toTimestamp(input.documentDate),
        dueDate: toTimestamp(input.dueDate),
        payload: input.payload,
        importedAt: now(),
      },
    });

    for (const line of input.lines ?? []) {
      const lineId =
        line.externalLineId ??
        `${documentId}:${line.lineNo ?? results.length + 1}`;

      await db.insert(schema.bcSourceDocumentLines).values({
        id: lineId,
        sourceDocumentId: documentId,
        externalLineId: line.externalLineId ?? null,
        lineNo: line.lineNo ?? null,
        itemNo: line.itemNo ?? null,
        uomCode: line.uomCode ?? null,
        quantity: line.quantity ? toNumericString(line.quantity) : null,
        unitPrice: line.unitPrice ? toNumericString(line.unitPrice) : null,
        lineAmount: line.lineAmount ? toNumericString(line.lineAmount) : null,
        payload: line.payload,
        importedAt: now(),
      }).onConflictDoUpdate({
        target: schema.bcSourceDocumentLines.id,
        set: {
          sourceDocumentId: documentId,
          externalLineId: line.externalLineId ?? null,
          lineNo: line.lineNo ?? null,
          itemNo: line.itemNo ?? null,
          uomCode: line.uomCode ?? null,
          quantity: line.quantity ? toNumericString(line.quantity) : null,
          unitPrice: line.unitPrice ? toNumericString(line.unitPrice) : null,
          lineAmount: line.lineAmount ? toNumericString(line.lineAmount) : null,
          payload: line.payload,
          importedAt: now(),
        },
      });
    }

    let contractId: string | null = null;
    if (input.contractSnapshot) {
      const existingContract = await db.query.contracts.findFirst({
        where: eq(
          schema.contracts.contractNumber,
          input.contractSnapshot.contractNumber,
        ),
      });
      contractId = existingContract?.id ?? createId("ctr");

      await db.insert(schema.contracts).values({
        id: contractId,
        contractNumber: input.contractSnapshot.contractNumber,
        customerId: input.contractSnapshot.customerId,
        locationId: input.contractSnapshot.locationId,
        branchId: input.contractSnapshot.branchId,
        agreementKind: input.contractSnapshot.agreementKind ?? "rental_order",
        legacySourceSystem:
          input.contractSnapshot.legacySourceSystem ?? "business_central",
        legacyDocumentNo:
          input.contractSnapshot.legacyDocumentNo ?? input.documentNo,
        legacyPreviousDocumentNo:
          input.contractSnapshot.legacyPreviousDocumentNo ?? null,
        legacyPreviousDocumentType:
          input.contractSnapshot.legacyPreviousDocumentType ?? null,
        serviceBranchId:
          input.contractSnapshot.serviceBranchId ??
          input.contractSnapshot.branchId,
        serviceLocationCode:
          input.contractSnapshot.serviceLocationCode ?? null,
        agreementState:
          input.contractSnapshot.agreementState ?? input.status ?? null,
        importCompleteness:
          input.contractSnapshot.importCompleteness ?? "header_only",
        legacyOpenedAt: input.contractSnapshot.legacyOpenedAt ?? null,
        legacyClosedAt: input.contractSnapshot.legacyClosedAt ?? null,
        postedAt: input.contractSnapshot.postedAt ?? null,
        startDate: input.contractSnapshot.startDate,
        endDate: input.contractSnapshot.endDate ?? null,
        billingCadence:
          input.contractSnapshot.billingCadence ?? "monthly_arrears",
        paymentTermsDays: input.contractSnapshot.paymentTermsDays ?? 14,
        status: input.contractSnapshot.status ?? "quoted",
        notes: input.contractSnapshot.notes ?? null,
        sourceProvider: "business_central",
        sourceDocumentType: input.documentType,
        sourceDocumentNo: input.documentNo,
        sourceStatus: input.status ?? null,
        sourceSnapshot: input.payload,
        createdAt: existingContract?.createdAt ?? now(),
        updatedAt: now(),
      }).onConflictDoUpdate({
        target: schema.contracts.id,
        set: {
          customerId: input.contractSnapshot.customerId,
          locationId: input.contractSnapshot.locationId,
          branchId: input.contractSnapshot.branchId,
          agreementKind: input.contractSnapshot.agreementKind ?? "rental_order",
          legacySourceSystem:
            input.contractSnapshot.legacySourceSystem ?? "business_central",
          legacyDocumentNo:
            input.contractSnapshot.legacyDocumentNo ?? input.documentNo,
          legacyPreviousDocumentNo:
            input.contractSnapshot.legacyPreviousDocumentNo ?? null,
          legacyPreviousDocumentType:
            input.contractSnapshot.legacyPreviousDocumentType ?? null,
          serviceBranchId:
            input.contractSnapshot.serviceBranchId ??
            input.contractSnapshot.branchId,
          serviceLocationCode:
            input.contractSnapshot.serviceLocationCode ?? null,
          agreementState:
            input.contractSnapshot.agreementState ?? input.status ?? null,
          importCompleteness:
            input.contractSnapshot.importCompleteness ?? "header_only",
          legacyOpenedAt: input.contractSnapshot.legacyOpenedAt ?? null,
          legacyClosedAt: input.contractSnapshot.legacyClosedAt ?? null,
          postedAt: input.contractSnapshot.postedAt ?? null,
          startDate: input.contractSnapshot.startDate,
          endDate: input.contractSnapshot.endDate ?? null,
          billingCadence:
            input.contractSnapshot.billingCadence ?? "monthly_arrears",
          paymentTermsDays: input.contractSnapshot.paymentTermsDays ?? 14,
          status: input.contractSnapshot.status ?? "quoted",
          notes: input.contractSnapshot.notes ?? null,
          sourceProvider: "business_central",
          sourceDocumentType: input.documentType,
          sourceDocumentNo: input.documentNo,
          sourceStatus: input.status ?? null,
          sourceSnapshot: input.payload,
          updatedAt: now(),
        },
      });

      await upsertExternalMapping({
        entityType: "bc_contract",
        internalId: contractId,
        externalId: input.externalDocumentId,
        payload: input.payload,
      });

      const contractLines = input.lines ?? [];
      for (let index = 0; index < contractLines.length; index += 1) {
        const line = contractLines[index]!;
        const lineId = `bcctrline:${input.documentType}:${input.externalDocumentId}:${line.lineNo ?? index + 1}`;
        await db.insert(schema.contractLines).values({
          id: lineId,
          contractId,
          assetId: line.assetId ?? null,
          description: getLineDescription(line),
          unitPrice: toNumericString(line.unitPrice ?? line.lineAmount ?? 0),
          unit: inferBillingUnit(line),
          quantity: toNumericString(line.quantity ?? 1, "1"),
          startDate: input.contractSnapshot.startDate,
          endDate: input.contractSnapshot.endDate ?? null,
          adjustments: null,
          deliveryFee:
            inferCommercialEventType(line) === "delivery"
              ? toNumericString(line.lineAmount ?? line.unitPrice ?? 0)
              : null,
          pickupFee:
            inferCommercialEventType(line) === "pickup"
              ? toNumericString(line.lineAmount ?? line.unitPrice ?? 0)
              : null,
          lineKind: line.lineKind ?? null,
          sourceLineType: line.sourceLineType ?? null,
          sourceSequenceNo: line.sourceSequenceNo ?? null,
          sourceDealCode: line.sourceDealCode ?? null,
          sourceDealLength: toOptionalNumericString(line.sourceDealLength),
          billingFor: line.billingFor ?? null,
          invoiceFromDate: toTimestamp(line.invoiceFromDate),
          invoiceThruDate: toTimestamp(line.invoiceThruDate),
          shipmentDate: toTimestamp(line.shipmentDate),
          returnDate: toTimestamp(line.returnDate),
          taxGroupCode: line.taxGroupCode ?? null,
          damageWaiverPercent: toOptionalNumericString(line.damageWaiverPercent),
          parentItemLineNo: line.parentItemLineNo ?? null,
          legacyPostingDate: toTimestamp(line.legacyPostingDate),
          sourceLineNo: line.lineNo ?? null,
          sourceItemNo: line.itemNo ?? null,
          sourceUomCode: line.uomCode ?? null,
          sourceSnapshot: line.payload,
          createdAt: now(),
          updatedAt: now(),
        }).onConflictDoUpdate({
          target: schema.contractLines.id,
          set: {
            assetId: line.assetId ?? null,
            description: getLineDescription(line),
            unitPrice: toNumericString(line.unitPrice ?? line.lineAmount ?? 0),
            unit: inferBillingUnit(line),
            quantity: toNumericString(line.quantity ?? 1, "1"),
            startDate: input.contractSnapshot.startDate,
            endDate: input.contractSnapshot.endDate ?? null,
            deliveryFee:
              inferCommercialEventType(line) === "delivery"
                ? toNumericString(line.lineAmount ?? line.unitPrice ?? 0)
                : null,
            pickupFee:
              inferCommercialEventType(line) === "pickup"
                ? toNumericString(line.lineAmount ?? line.unitPrice ?? 0)
                : null,
            lineKind: line.lineKind ?? null,
            sourceLineType: line.sourceLineType ?? null,
            sourceSequenceNo: line.sourceSequenceNo ?? null,
            sourceDealCode: line.sourceDealCode ?? null,
            sourceDealLength: toOptionalNumericString(line.sourceDealLength),
            billingFor: line.billingFor ?? null,
            invoiceFromDate: toTimestamp(line.invoiceFromDate),
            invoiceThruDate: toTimestamp(line.invoiceThruDate),
            shipmentDate: toTimestamp(line.shipmentDate),
            returnDate: toTimestamp(line.returnDate),
            taxGroupCode: line.taxGroupCode ?? null,
            damageWaiverPercent: toOptionalNumericString(line.damageWaiverPercent),
            parentItemLineNo: line.parentItemLineNo ?? null,
            legacyPostingDate: toTimestamp(line.legacyPostingDate),
            sourceLineNo: line.lineNo ?? null,
            sourceItemNo: line.itemNo ?? null,
            sourceUomCode: line.uomCode ?? null,
            sourceSnapshot: line.payload,
            updatedAt: now(),
          },
        });

        await upsertExternalMapping({
          entityType: "bc_contract_line",
          internalId: lineId,
          externalId: line.externalLineId ?? lineId,
          payload: line.payload,
        });
      }
    }

    let invoiceId: string | null = null;
    if (input.invoiceSnapshot) {
      const existingInvoice = await db.query.invoices.findFirst({
        where: eq(
          schema.invoices.invoiceNumber,
          input.invoiceSnapshot.invoiceNumber,
        ),
      });
      invoiceId = existingInvoice?.id ?? createId("inv");

      await db.insert(schema.invoices).values({
        id: invoiceId,
        invoiceNumber: input.invoiceSnapshot.invoiceNumber,
        customerId: input.invoiceSnapshot.customerId,
        contractId: input.invoiceSnapshot.contractId ?? contractId ?? null,
        invoiceDate: input.invoiceSnapshot.invoiceDate,
        dueDate: input.invoiceSnapshot.dueDate,
        status: input.invoiceSnapshot.status ?? "draft",
        subtotalAmount: input.invoiceSnapshot.subtotalAmount,
        taxAmount: input.invoiceSnapshot.taxAmount ?? "0",
        totalAmount: input.invoiceSnapshot.totalAmount,
        balanceAmount: input.invoiceSnapshot.balanceAmount,
        legacyInvoiceNo:
          input.invoiceSnapshot.legacyInvoiceNo ?? input.documentNo,
        legacyOrderNo:
          input.invoiceSnapshot.legacyOrderNo ??
          input.contractSnapshot?.legacyPreviousDocumentNo ??
          null,
        invoiceSourceKind:
          input.invoiceSnapshot.invoiceSourceKind ?? "bc_posted_rental",
        importCompleteness:
          input.invoiceSnapshot.importCompleteness ?? "header_only",
        postingDate: input.invoiceSnapshot.postingDate ?? null,
        responsibilityCenter:
          input.invoiceSnapshot.responsibilityCenter ?? null,
        dimensionSetId: input.invoiceSnapshot.dimensionSetId ?? null,
        deliveryStatus: input.invoiceSnapshot.deliveryStatus ?? "draft",
        sourceProvider: "business_central",
        sourceDocumentType: input.documentType,
        sourceDocumentNo: input.documentNo,
        sourceStatus: input.status ?? null,
        sourceSnapshot: input.payload,
        createdAt: existingInvoice?.createdAt ?? now(),
        updatedAt: now(),
      }).onConflictDoUpdate({
        target: schema.invoices.id,
        set: {
          customerId: input.invoiceSnapshot.customerId,
          contractId: input.invoiceSnapshot.contractId ?? contractId ?? null,
          invoiceDate: input.invoiceSnapshot.invoiceDate,
          dueDate: input.invoiceSnapshot.dueDate,
          status: input.invoiceSnapshot.status ?? "draft",
          subtotalAmount: input.invoiceSnapshot.subtotalAmount,
          taxAmount: input.invoiceSnapshot.taxAmount ?? "0",
          totalAmount: input.invoiceSnapshot.totalAmount,
          balanceAmount: input.invoiceSnapshot.balanceAmount,
          legacyInvoiceNo:
            input.invoiceSnapshot.legacyInvoiceNo ?? input.documentNo,
          legacyOrderNo:
            input.invoiceSnapshot.legacyOrderNo ??
            input.contractSnapshot?.legacyPreviousDocumentNo ??
            null,
          invoiceSourceKind:
            input.invoiceSnapshot.invoiceSourceKind ?? "bc_posted_rental",
          importCompleteness:
            input.invoiceSnapshot.importCompleteness ?? "header_only",
          postingDate: input.invoiceSnapshot.postingDate ?? null,
          responsibilityCenter:
            input.invoiceSnapshot.responsibilityCenter ?? null,
          dimensionSetId: input.invoiceSnapshot.dimensionSetId ?? null,
          deliveryStatus: input.invoiceSnapshot.deliveryStatus ?? "draft",
          sourceProvider: "business_central",
          sourceDocumentType: input.documentType,
          sourceDocumentNo: input.documentNo,
          sourceStatus: input.status ?? null,
          sourceSnapshot: input.payload,
          updatedAt: now(),
        },
      });

      await upsertExternalMapping({
        entityType: "bc_invoice",
        internalId: invoiceId,
        externalId: input.externalDocumentId,
        payload: input.payload,
      });

      const invoiceLines = input.lines ?? [];
      for (let index = 0; index < invoiceLines.length; index += 1) {
        const line = invoiceLines[index]!;
        const lineId = `bcinvline:${input.documentType}:${input.externalDocumentId}:${line.lineNo ?? index + 1}`;
        const contractLineId = contractId
          ? `bcctrline:${input.documentType}:${input.externalDocumentId}:${line.lineNo ?? index + 1}`
          : null;
        const totalAmount =
          line.lineAmount ??
          (Number(line.quantity ?? 1) * Number(line.unitPrice ?? 0));

        await db.insert(schema.invoiceLines).values({
          id: lineId,
          invoiceId,
          description: getLineDescription(line),
          quantity: toNumericString(line.quantity ?? 1, "1"),
          unitPrice: toNumericString(line.unitPrice ?? line.lineAmount ?? 0),
          totalAmount: toNumericString(totalAmount),
          sourceFinancialEventId: null,
          contractLineId,
          assetId: line.assetId ?? null,
          lineKind: line.lineKind ?? null,
          servicePeriodStart:
            toTimestamp(line.invoiceFromDate) ??
            toTimestamp(line.shipmentDate),
          servicePeriodEnd:
            toTimestamp(line.invoiceThruDate) ??
            toTimestamp(line.returnDate),
          legacyDealCode: line.sourceDealCode ?? null,
          taxGroupCode: line.taxGroupCode ?? null,
          sourceSequenceNo: line.sourceSequenceNo ?? null,
          sourceLineNo: line.lineNo ?? null,
          sourceItemNo: line.itemNo ?? null,
          sourceUomCode: line.uomCode ?? null,
          sourceSnapshot: line.payload,
          createdAt: now(),
          updatedAt: now(),
        }).onConflictDoUpdate({
          target: schema.invoiceLines.id,
          set: {
            description: getLineDescription(line),
            quantity: toNumericString(line.quantity ?? 1, "1"),
            unitPrice: toNumericString(line.unitPrice ?? line.lineAmount ?? 0),
            totalAmount: toNumericString(totalAmount),
            contractLineId,
            assetId: line.assetId ?? null,
            lineKind: line.lineKind ?? null,
            servicePeriodStart:
              toTimestamp(line.invoiceFromDate) ??
              toTimestamp(line.shipmentDate),
            servicePeriodEnd:
              toTimestamp(line.invoiceThruDate) ??
              toTimestamp(line.returnDate),
            legacyDealCode: line.sourceDealCode ?? null,
            taxGroupCode: line.taxGroupCode ?? null,
            sourceSequenceNo: line.sourceSequenceNo ?? null,
            sourceLineNo: line.lineNo ?? null,
            sourceItemNo: line.itemNo ?? null,
            sourceUomCode: line.uomCode ?? null,
            sourceSnapshot: line.payload,
            updatedAt: now(),
          },
        });

        await upsertExternalMapping({
          entityType: "bc_invoice_line",
          internalId: lineId,
          externalId: line.externalLineId ?? lineId,
          payload: line.payload,
        });
      }
    }

    if (contractId || invoiceId) {
      const normalizedDocumentType = input.documentType.toLowerCase();
      const commercialEventStatus = invoiceId
        ? "invoiced"
        : normalizedDocumentType.includes("quote")
          ? "pending"
          : "posted";

      const eventLines = input.lines ?? [];
      for (let index = 0; index < eventLines.length; index += 1) {
        const line = eventLines[index]!;
        const eventId = `bcevt:${input.documentType}:${input.externalDocumentId}:${line.lineNo ?? index + 1}`;
        const eventContractLineId = contractId
          ? `bcctrline:${input.documentType}:${input.externalDocumentId}:${line.lineNo ?? index + 1}`
          : null;
        const totalAmount =
          line.lineAmount ??
          (Number(line.quantity ?? 1) * Number(line.unitPrice ?? 0));

        await db.insert(schema.commercialEvents).values({
          id: eventId,
          contractId,
          contractLineId: eventContractLineId,
          assetId: line.assetId ?? null,
          workOrderId: null,
          invoiceId,
          servicePeriodStart:
            toTimestamp(line.invoiceFromDate) ??
            toTimestamp(line.shipmentDate),
          servicePeriodEnd:
            toTimestamp(line.invoiceThruDate) ??
            toTimestamp(line.returnDate),
          serviceBranchId:
            line.serviceBranchId ??
            input.contractSnapshot?.serviceBranchId ??
            input.contractSnapshot?.branchId ??
            null,
          serviceLocationCode:
            line.serviceLocationCode ??
            input.contractSnapshot?.serviceLocationCode ??
            null,
          customerLocationId:
            line.customerLocationId ?? input.contractSnapshot?.locationId ?? null,
          legacyOrderNo:
            line.legacyOrderNo ??
            input.contractSnapshot?.legacyPreviousDocumentNo ??
            null,
          legacyInvoiceNo: line.legacyInvoiceNo ?? input.documentNo,
          legacyLineNo: line.lineNo ?? null,
          revenueRecognitionBasis: inferRevenueRecognitionBasis(line),
          eventType: inferCommercialEventType(line),
          description: getLineDescription(line),
          amount: toNumericString(totalAmount),
          eventDate:
            toTimestamp(input.documentDate) ??
            toTimestamp(input.dueDate) ??
            now(),
          status: commercialEventStatus,
          externalReference: line.externalLineId ?? null,
          sourceDocumentType: input.documentType,
          sourceDocumentNo: input.documentNo,
          sourceSnapshot: line.payload,
          metadata: line.payload,
          createdAt: now(),
          updatedAt: now(),
        }).onConflictDoUpdate({
          target: schema.commercialEvents.id,
          set: {
            contractId,
            contractLineId: eventContractLineId,
            assetId: line.assetId ?? null,
            invoiceId,
            servicePeriodStart:
              toTimestamp(line.invoiceFromDate) ??
              toTimestamp(line.shipmentDate),
            servicePeriodEnd:
              toTimestamp(line.invoiceThruDate) ??
              toTimestamp(line.returnDate),
            serviceBranchId:
              line.serviceBranchId ??
              input.contractSnapshot?.serviceBranchId ??
              input.contractSnapshot?.branchId ??
              null,
            serviceLocationCode:
              line.serviceLocationCode ??
              input.contractSnapshot?.serviceLocationCode ??
              null,
            customerLocationId:
              line.customerLocationId ?? input.contractSnapshot?.locationId ?? null,
            legacyOrderNo:
              line.legacyOrderNo ??
              input.contractSnapshot?.legacyPreviousDocumentNo ??
              null,
            legacyInvoiceNo: line.legacyInvoiceNo ?? input.documentNo,
            legacyLineNo: line.lineNo ?? null,
            revenueRecognitionBasis: inferRevenueRecognitionBasis(line),
            eventType: inferCommercialEventType(line),
            description: getLineDescription(line),
            amount: toNumericString(totalAmount),
            eventDate:
              toTimestamp(input.documentDate) ??
              toTimestamp(input.dueDate) ??
              now(),
            status: commercialEventStatus,
            externalReference: line.externalLineId ?? null,
            sourceDocumentType: input.documentType,
            sourceDocumentNo: input.documentNo,
            sourceSnapshot: line.payload,
            metadata: line.payload,
            updatedAt: now(),
          },
        });
      }
    }

    results.push(documentId);
  }

  return results;
}

export async function synthesizeCanonicalAgreementsFromRmi(
  inputs: BcCommercialDocumentSeedInput[],
  runId?: string,
) {
  return seedBcCommercialDocuments(inputs, runId);
}

export async function seedBcAccountingHistory(
  payload: BcAccountingHistorySeedInput,
) {
  for (const account of payload.glAccounts ?? []) {
    const id = `bcgla:${account.accountNo}`;
    await db.insert(schema.bcGlAccounts).values({
      id,
      accountNo: account.accountNo,
      name: account.name,
      accountType: account.accountType ?? null,
      incomeBalance: account.incomeBalance ?? null,
      category: account.category ?? null,
      subcategory: account.subcategory ?? null,
      blocked: account.blocked ?? false,
      payload: account.payload ?? null,
      importedAt: now(),
    }).onConflictDoUpdate({
      target: schema.bcGlAccounts.id,
      set: {
        name: account.name,
        accountType: account.accountType ?? null,
        incomeBalance: account.incomeBalance ?? null,
        category: account.category ?? null,
        subcategory: account.subcategory ?? null,
        blocked: account.blocked ?? false,
        payload: account.payload ?? null,
        importedAt: now(),
      },
    });
  }

  for (const vendor of payload.vendors ?? []) {
    const id = `bcven:${vendor.vendorNo}`;
    await db.insert(schema.bcVendors).values({
      id,
      vendorNo: vendor.vendorNo,
      name: vendor.name,
      status: vendor.status ?? null,
      locationCode: vendor.locationCode ?? null,
      payload: vendor.payload ?? null,
      importedAt: now(),
    }).onConflictDoUpdate({
      target: schema.bcVendors.id,
      set: {
        name: vendor.name,
        status: vendor.status ?? null,
        locationCode: vendor.locationCode ?? null,
        payload: vendor.payload ?? null,
        importedAt: now(),
      },
    });
  }

  for (const dimensionSet of payload.dimensionSets ?? []) {
    const dimensionSetId = `bcdset:${dimensionSet.externalDimensionSetId}`;
    await db.insert(schema.bcDimensionSets).values({
      id: dimensionSetId,
      externalDimensionSetId: dimensionSet.externalDimensionSetId,
      payload: dimensionSet.payload ?? null,
      importedAt: now(),
    }).onConflictDoUpdate({
      target: schema.bcDimensionSets.id,
      set: {
        payload: dimensionSet.payload ?? null,
        importedAt: now(),
      },
    });

    for (const entry of dimensionSet.entries ?? []) {
      const entryId = `${dimensionSetId}:${entry.dimensionCode}:${entry.dimensionValueCode}`;
      await db.insert(schema.bcDimensionSetEntries).values({
        id: entryId,
        dimensionSetId,
        dimensionCode: entry.dimensionCode,
        dimensionValueCode: entry.dimensionValueCode,
        payload: entry.payload ?? null,
        importedAt: now(),
      }).onConflictDoUpdate({
        target: schema.bcDimensionSetEntries.id,
        set: {
          payload: entry.payload ?? null,
          importedAt: now(),
        },
      });
    }
  }

  for (const entry of payload.glEntries ?? []) {
    const id = `bcgle:${entry.externalEntryNo}`;
    const dimensionSetId = entry.externalDimensionSetId
      ? `bcdset:${entry.externalDimensionSetId}`
      : null;

    await db.insert(schema.bcGlEntries).values({
      id,
      externalEntryNo: entry.externalEntryNo,
      postingDate: toTimestamp(entry.postingDate),
      documentNo: entry.documentNo ?? null,
      description: entry.description ?? null,
      accountNo: entry.accountNo ?? null,
      amount: entry.amount ? toNumericString(entry.amount) : null,
      debitAmount: entry.debitAmount ? toNumericString(entry.debitAmount) : null,
      creditAmount: entry.creditAmount ? toNumericString(entry.creditAmount) : null,
      dimensionSetId,
      payload: entry.payload,
      importedAt: now(),
    }).onConflictDoUpdate({
      target: schema.bcGlEntries.id,
      set: {
        postingDate: toTimestamp(entry.postingDate),
        documentNo: entry.documentNo ?? null,
        description: entry.description ?? null,
        accountNo: entry.accountNo ?? null,
        amount: entry.amount ? toNumericString(entry.amount) : null,
        debitAmount: entry.debitAmount ? toNumericString(entry.debitAmount) : null,
        creditAmount: entry.creditAmount ? toNumericString(entry.creditAmount) : null,
        dimensionSetId,
        payload: entry.payload,
        importedAt: now(),
      },
    });
  }

  const immutableUpserts: Array<[
    Array<{
      externalEntryNo: string;
      postingDate?: string | Date | null;
      documentNo?: string | null;
      amount?: string | number | null;
      payload: Record<string, unknown>;
      bankAccountNo?: string | null;
      vendorNo?: string | null;
      customerNo?: string | null;
      assetNo?: string | null;
    }>,
    typeof schema.bcBankLedgerEntries | typeof schema.bcVendorLedgerEntries | typeof schema.bcCustomerLedgerEntries | typeof schema.bcFaLedgerEntries,
    string,
    (entry: {
      bankAccountNo?: string | null;
      vendorNo?: string | null;
      customerNo?: string | null;
      assetNo?: string | null;
    }) => Record<string, unknown>
  ]> = [
    [
      payload.bankLedgerEntries ?? [],
      schema.bcBankLedgerEntries,
      "bcbank",
      (entry) => ({ bankAccountNo: entry.bankAccountNo ?? null }),
    ],
    [
      payload.vendorLedgerEntries ?? [],
      schema.bcVendorLedgerEntries,
      "bcvenled",
      (entry) => ({ vendorNo: entry.vendorNo ?? null }),
    ],
    [
      payload.customerLedgerEntries ?? [],
      schema.bcCustomerLedgerEntries,
      "bccustled",
      (entry) => ({ customerNo: entry.customerNo ?? null }),
    ],
    [
      payload.faLedgerEntries ?? [],
      schema.bcFaLedgerEntries,
      "bcfaled",
      (entry) => ({ assetNo: entry.assetNo ?? null }),
    ],
  ];

  for (const [entries, table, prefix, extraBuilder] of immutableUpserts) {
    for (const entry of entries) {
      const id = `${prefix}:${entry.externalEntryNo}`;
      await db.insert(table).values({
        id,
        externalEntryNo: entry.externalEntryNo,
        postingDate: toTimestamp(entry.postingDate),
        documentNo: entry.documentNo ?? null,
        amount: entry.amount ? toNumericString(entry.amount) : null,
        payload: entry.payload,
        importedAt: now(),
        ...extraBuilder(entry),
      }).onConflictDoUpdate({
        target: table.id,
        set: {
          postingDate: toTimestamp(entry.postingDate),
          documentNo: entry.documentNo ?? null,
          amount: entry.amount ? toNumericString(entry.amount) : null,
          payload: entry.payload,
          importedAt: now(),
          ...extraBuilder(entry),
        },
      });
    }
  }
}

export async function reconcileBcImportRun(runId: string) {
  const run = await db.query.bcImportRuns.findFirst({
    where: eq(schema.bcImportRuns.id, runId),
  });

  if (!run) {
    throw new Error(`Business Central import run ${runId} was not found.`);
  }

  const [assetCount, customerCount, documentCount, errorCount] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(schema.assets),
    db.select({ count: sql<number>`count(*)` }).from(schema.customers),
    db.select({ count: sql<number>`count(*)` }).from(schema.bcSourceDocuments),
    db
      .select({ count: sql<number>`count(*)` })
      .from(schema.bcImportErrors)
      .where(eq(schema.bcImportErrors.runId, runId)),
  ]);

  const summary = {
    runId,
    entityType: run.entityType,
    status: run.status,
    assets: assetCount[0]?.count ?? 0,
    customers: customerCount[0]?.count ?? 0,
    sourceDocuments: documentCount[0]?.count ?? 0,
    errors: errorCount[0]?.count ?? 0,
  };

  await db
    .update(schema.bcImportRuns)
    .set({
      metadata: {
        ...(run.metadata ?? {}),
        reconciliation: summary,
      },
      updatedAt: now(),
    })
    .where(eq(schema.bcImportRuns.id, runId));

  return summary;
}
