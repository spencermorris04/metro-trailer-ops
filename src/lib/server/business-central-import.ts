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

function toTimestamp(value?: string | Date | null) {
  return value ? (toDate(value) ?? null) : null;
}

async function upsertExternalMapping(options: {
  entityType: BusinessCentralEntityType;
  internalId: string;
  externalId: string;
  payload?: Record<string, unknown>;
}) {
  const existing = await db.query.externalEntityMappings.findFirst({
    where: eq(schema.externalEntityMappings.externalId, options.externalId),
  });

  if (existing && existing.provider === "business_central") {
    await db
      .update(schema.externalEntityMappings)
      .set({
        entityType: options.entityType,
        internalId: options.internalId,
        payload: options.payload ?? existing.payload ?? null,
        updatedAt: now(),
      })
      .where(eq(schema.externalEntityMappings.id, existing.id));
    return existing.id;
  }

  const id = existing?.id ?? createId("xmap");

  await db
    .insert(schema.externalEntityMappings)
    .values({
      id,
      provider: "business_central",
      entityType: options.entityType,
      internalId: options.internalId,
      externalId: options.externalId,
      payload: options.payload ?? null,
      createdAt: existing?.createdAt ?? now(),
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

    if (input.contractSnapshot) {
      const existingContract = await db.query.contracts.findFirst({
        where: eq(
          schema.contracts.contractNumber,
          input.contractSnapshot.contractNumber,
        ),
      });
      const contractId = existingContract?.id ?? createId("ctr");

      await db.insert(schema.contracts).values({
        id: contractId,
        contractNumber: input.contractSnapshot.contractNumber,
        customerId: input.contractSnapshot.customerId,
        locationId: input.contractSnapshot.locationId,
        branchId: input.contractSnapshot.branchId,
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
    }

    if (input.invoiceSnapshot) {
      const existingInvoice = await db.query.invoices.findFirst({
        where: eq(
          schema.invoices.invoiceNumber,
          input.invoiceSnapshot.invoiceNumber,
        ),
      });
      const invoiceId = existingInvoice?.id ?? createId("inv");

      await db.insert(schema.invoices).values({
        id: invoiceId,
        invoiceNumber: input.invoiceSnapshot.invoiceNumber,
        customerId: input.invoiceSnapshot.customerId,
        contractId: input.invoiceSnapshot.contractId ?? null,
        invoiceDate: input.invoiceSnapshot.invoiceDate,
        dueDate: input.invoiceSnapshot.dueDate,
        status: input.invoiceSnapshot.status ?? "draft",
        subtotalAmount: input.invoiceSnapshot.subtotalAmount,
        taxAmount: input.invoiceSnapshot.taxAmount ?? "0",
        totalAmount: input.invoiceSnapshot.totalAmount,
        balanceAmount: input.invoiceSnapshot.balanceAmount,
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
          contractId: input.invoiceSnapshot.contractId ?? null,
          invoiceDate: input.invoiceSnapshot.invoiceDate,
          dueDate: input.invoiceSnapshot.dueDate,
          status: input.invoiceSnapshot.status ?? "draft",
          subtotalAmount: input.invoiceSnapshot.subtotalAmount,
          taxAmount: input.invoiceSnapshot.taxAmount ?? "0",
          totalAmount: input.invoiceSnapshot.totalAmount,
          balanceAmount: input.invoiceSnapshot.balanceAmount,
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
    }

    results.push(documentId);
  }

  return results;
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
