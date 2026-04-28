import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import {
  listAssets,
  listAssetsPage,
  listContracts,
  listCustomers,
  listFinancialEvents,
  listInvoices,
} from "@/lib/server/platform-service.production";
import {
  listDispatchTasks,
  listInspections,
  listWorkOrders,
} from "@/lib/server/platform-operations.production";
import { numericToNumber, toIso } from "@/lib/server/production-utils";

type AssetListFilters = {
  q?: string;
  branch?: string;
  status?: string;
  availability?: string;
  maintenanceStatus?: string;
  type?: string;
  faClassCode?: string;
  faSubclassCode?: string;
  blocked?: string;
  inactive?: string;
  disposed?: string;
  onRent?: string;
  inService?: string;
  underMaintenance?: string;
  page?: number;
  pageSize?: number;
};

type CustomerListFilters = {
  q?: string;
  customerType?: string;
  portalEnabled?: string;
  sourceProvider?: string;
  page?: number;
  pageSize?: number;
};

type ContractListFilters = {
  q?: string;
  status?: string;
  branch?: string;
  sourceProvider?: string;
  sourceDocumentType?: string;
};

type CommercialEventFilters = {
  contractNumber?: string;
  eventType?: string;
  status?: string;
};

function matchesBooleanFilter(filter: string | undefined, value: boolean) {
  if (!filter) {
    return true;
  }
  return filter === "true" ? value : !value;
}

function textContains(value: string | null | undefined, q: string) {
  return (value ?? "").toLowerCase().includes(q.toLowerCase());
}

function formatAddress(value: Record<string, unknown> | null | undefined) {
  if (!value) {
    return "";
  }

  return [
    typeof value.line1 === "string" ? value.line1 : "",
    typeof value.city === "string" ? value.city : "",
    typeof value.state === "string" ? value.state : "",
  ]
    .filter(Boolean)
    .join(", ");
}

function formatContact(value: Record<string, unknown> | null | undefined) {
  if (!value) {
    return "";
  }

  return typeof value.name === "string" ? value.name : "";
}

async function getBusinessCentralMappings(entityType: string) {
  const rows = await db
    .select()
    .from(schema.externalEntityMappings)
    .where(
      and(
        eq(schema.externalEntityMappings.provider, "business_central"),
        eq(schema.externalEntityMappings.entityType, entityType),
      ),
    );

  return new Map(rows.map((row) => [row.internalId, row]));
}

export async function getAssetListView(filters?: AssetListFilters) {
  const page = Math.max(1, filters?.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters?.pageSize ?? 25));
  const base = await listAssetsPage({
    q: filters?.q,
    branch: filters?.branch,
    status: filters?.status,
    availability: filters?.availability,
    maintenanceStatus: filters?.maintenanceStatus,
    type: filters?.type,
    page,
    pageSize,
  });

  const assetIds = base.data.map((asset) => asset.id);
  const [assetRows, bcMappings] = await Promise.all([
    assetIds.length === 0
      ? Promise.resolve([] as Array<typeof schema.assets.$inferSelect & { branchCode: string; branchName: string }>)
      : db
          .select({
            id: schema.assets.id,
            assetNumber: schema.assets.assetNumber,
            type: schema.assets.type,
            subtype: schema.assets.subtype,
            branchId: schema.assets.branchId,
            branchCode: schema.branches.code,
            branchName: schema.branches.name,
            status: schema.assets.status,
            availability: schema.assets.availability,
            maintenanceStatus: schema.assets.maintenanceStatus,
            serialNumber: schema.assets.serialNumber,
            manufacturer: schema.assets.manufacturer,
            modelYear: schema.assets.modelYear,
            registrationNumber: schema.assets.registrationNumber,
            faClassCode: schema.assets.faClassCode,
            faSubclassCode: schema.assets.faSubclassCode,
            bcLocationCode: schema.assets.bcLocationCode,
            bcDimension1Code: schema.assets.bcDimension1Code,
            bcProductNo: schema.assets.bcProductNo,
            bcServiceItemNo: schema.assets.bcServiceItemNo,
            isBlocked: schema.assets.isBlocked,
            isInactive: schema.assets.isInactive,
            isDisposed: schema.assets.isDisposed,
            isOnRent: schema.assets.isOnRent,
            isInService: schema.assets.isInService,
            underMaintenance: schema.assets.underMaintenance,
            bookValue: schema.assets.bookValue,
            sourcePayload: schema.assets.sourcePayload,
            updatedAt: schema.assets.updatedAt,
          })
          .from(schema.assets)
          .innerJoin(schema.branches, eq(schema.assets.branchId, schema.branches.id))
          .where(inArray(schema.assets.id, assetIds)),
    getBusinessCentralMappings("bc_asset"),
  ]);

  const rawById = new Map(assetRows.map((row) => [row.id, row]));

  const data = base.data
    .map((asset) => {
      const raw = rawById.get(asset.id);
      if (!raw) {
        return null;
      }

      return {
        ...asset,
        branchCode: raw.branchCode,
        manufacturer: raw.manufacturer,
        modelYear: raw.modelYear,
        registrationNumber: raw.registrationNumber,
        faClassCode: raw.faClassCode,
        faSubclassCode: raw.faSubclassCode,
        bcLocationCode: raw.bcLocationCode,
        bcDimension1Code: raw.bcDimension1Code,
        bcProductNo: raw.bcProductNo,
        bcServiceItemNo: raw.bcServiceItemNo,
        isBlocked: raw.isBlocked,
        isInactive: raw.isInactive,
        isDisposed: raw.isDisposed,
        isOnRent: raw.isOnRent,
        isInService: raw.isInService,
        underMaintenance: raw.underMaintenance,
        bookValue: numericToNumber(raw.bookValue, 0),
        sourceProvider: bcMappings.has(asset.id) ? "business_central" : "internal",
        sourcePayloadAvailable: Boolean(raw.sourcePayload),
        lastUpdatedAt: toIso(raw.updatedAt),
      };
    })
    .filter((asset): asset is NonNullable<typeof asset> => Boolean(asset))
    .filter((asset) => {
      if (filters?.faClassCode && asset.faClassCode !== filters.faClassCode) {
        return false;
      }
      if (filters?.faSubclassCode && asset.faSubclassCode !== filters.faSubclassCode) {
        return false;
      }
      if (!matchesBooleanFilter(filters?.blocked, asset.isBlocked)) {
        return false;
      }
      if (!matchesBooleanFilter(filters?.inactive, asset.isInactive)) {
        return false;
      }
      if (!matchesBooleanFilter(filters?.disposed, asset.isDisposed)) {
        return false;
      }
      if (!matchesBooleanFilter(filters?.onRent, asset.isOnRent)) {
        return false;
      }
      if (!matchesBooleanFilter(filters?.inService, asset.isInService)) {
        return false;
      }
      if (!matchesBooleanFilter(filters?.underMaintenance, asset.underMaintenance)) {
        return false;
      }
      return true;
    });

  return {
    ...base,
    data,
    total: data.length < base.total && page === 1 ? data.length : base.total,
  };
}

export async function getAssetDetailView(assetId: string) {
  const [assets, assetRows, contractLinks, inspections, workOrders, bcMapping] =
    await Promise.all([
      listAssets(),
      db
        .select({
          id: schema.assets.id,
          assetNumber: schema.assets.assetNumber,
          type: schema.assets.type,
          subtype: schema.assets.subtype,
          branchCode: schema.branches.code,
          branchName: schema.branches.name,
          status: schema.assets.status,
          availability: schema.assets.availability,
          maintenanceStatus: schema.assets.maintenanceStatus,
          serialNumber: schema.assets.serialNumber,
          manufacturer: schema.assets.manufacturer,
          modelYear: schema.assets.modelYear,
          registrationNumber: schema.assets.registrationNumber,
          faClassCode: schema.assets.faClassCode,
          faSubclassCode: schema.assets.faSubclassCode,
          bcLocationCode: schema.assets.bcLocationCode,
          bcDimension1Code: schema.assets.bcDimension1Code,
          bcProductNo: schema.assets.bcProductNo,
          bcServiceItemNo: schema.assets.bcServiceItemNo,
          isBlocked: schema.assets.isBlocked,
          isInactive: schema.assets.isInactive,
          isDisposed: schema.assets.isDisposed,
          isOnRent: schema.assets.isOnRent,
          isInService: schema.assets.isInService,
          underMaintenance: schema.assets.underMaintenance,
          bookValue: schema.assets.bookValue,
          dimensions: schema.assets.dimensions,
          sourcePayload: schema.assets.sourcePayload,
          updatedAt: schema.assets.updatedAt,
        })
        .from(schema.assets)
        .innerJoin(schema.branches, eq(schema.assets.branchId, schema.branches.id))
        .where(or(eq(schema.assets.id, assetId), eq(schema.assets.assetNumber, assetId))),
      db
        .select({
          contractId: schema.contracts.id,
          contractNumber: schema.contracts.contractNumber,
          status: schema.contracts.status,
          startDate: schema.contracts.startDate,
          endDate: schema.contracts.endDate,
          customerName: schema.customers.name,
        })
        .from(schema.contractLines)
        .innerJoin(schema.contracts, eq(schema.contractLines.contractId, schema.contracts.id))
        .innerJoin(schema.customers, eq(schema.contracts.customerId, schema.customers.id))
        .innerJoin(schema.assets, eq(schema.contractLines.assetId, schema.assets.id))
        .where(or(eq(schema.assets.id, assetId), eq(schema.assets.assetNumber, assetId)))
        .orderBy(desc(schema.contracts.startDate)),
      db
        .select({
          id: schema.inspections.id,
          inspectionType: schema.inspections.inspectionType,
          status: schema.inspections.status,
          resultSummary: schema.inspections.resultSummary,
          damageScore: schema.inspections.damageScore,
          completedAt: schema.inspections.completedAt,
        })
        .from(schema.inspections)
        .innerJoin(schema.assets, eq(schema.inspections.assetId, schema.assets.id))
        .where(or(eq(schema.assets.id, assetId), eq(schema.assets.assetNumber, assetId)))
        .orderBy(desc(schema.inspections.completedAt)),
      db
        .select({
          id: schema.workOrders.id,
          title: schema.workOrders.title,
          status: schema.workOrders.status,
          priority: schema.workOrders.priority,
          dueAt: schema.workOrders.dueAt,
          billableDisposition: schema.workOrders.billableDisposition,
        })
        .from(schema.workOrders)
        .innerJoin(schema.assets, eq(schema.workOrders.assetId, schema.assets.id))
        .where(or(eq(schema.assets.id, assetId), eq(schema.assets.assetNumber, assetId)))
        .orderBy(desc(schema.workOrders.updatedAt)),
      db.query.externalEntityMappings.findFirst({
        where: (table, { and: localAnd, eq: localEq, or: localOr }) =>
          localAnd(
            localEq(table.provider, "business_central"),
            localEq(table.entityType, "bc_asset"),
            localOr(localEq(table.internalId, assetId), localEq(table.externalId, assetId)),
          ),
      }),
    ]);

  const operational = assets.find(
    (asset) => asset.id === assetId || asset.assetNumber === assetId,
  );
  const raw = assetRows[0];

  if (!operational || !raw) {
    return null;
  }

  return {
    summary: {
      ...operational,
      branchCode: raw.branchCode,
      manufacturer: raw.manufacturer,
      modelYear: raw.modelYear,
      registrationNumber: raw.registrationNumber,
      faClassCode: raw.faClassCode,
      faSubclassCode: raw.faSubclassCode,
      bcLocationCode: raw.bcLocationCode,
      bcDimension1Code: raw.bcDimension1Code,
      bcProductNo: raw.bcProductNo,
      bcServiceItemNo: raw.bcServiceItemNo,
      isBlocked: raw.isBlocked,
      isInactive: raw.isInactive,
      isDisposed: raw.isDisposed,
      isOnRent: raw.isOnRent,
      isInService: raw.isInService,
      underMaintenance: raw.underMaintenance,
      bookValue: numericToNumber(raw.bookValue, 0),
      rawDimensions: raw.dimensions,
      sourceProvider: bcMapping ? "business_central" : "internal",
      sourcePayload: raw.sourcePayload,
      externalId: bcMapping?.externalId ?? null,
      sourceUpdatedAt: toIso(raw.updatedAt),
    },
    contractHistory: contractLinks.map((row) => ({
      ...row,
      startDate: toIso(row.startDate),
      endDate: toIso(row.endDate),
    })),
    inspections: inspections.map((row) => ({
      ...row,
      completedAt: toIso(row.completedAt),
    })),
    workOrders: workOrders.map((row) => ({
      ...row,
      dueAt: toIso(row.dueAt),
    })),
  };
}

export async function getCustomerListView(filters?: CustomerListFilters) {
  const page = Math.max(1, filters?.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters?.pageSize ?? 30));
  const customers = await listCustomers({
    q: filters?.q,
    customerType: filters?.customerType,
    portalEnabled: filters?.portalEnabled,
  });

  const customerIds = customers.map((customer) => customer.id);
  const [bcMappings, contractCounts, arBalances] = await Promise.all([
    getBusinessCentralMappings("bc_customer"),
    customerIds.length === 0
      ? Promise.resolve([] as Array<{ customerId: string; count: number }>)
      : db
          .select({
            customerId: schema.contracts.customerId,
            count: sql<number>`count(*)`,
          })
          .from(schema.contracts)
          .where(inArray(schema.contracts.customerId, customerIds))
          .groupBy(schema.contracts.customerId),
    customerIds.length === 0
      ? Promise.resolve([] as Array<{ customerId: string; balance: string | number | null }>)
      : db
          .select({
            customerId: schema.invoices.customerId,
            balance: sql<string>`coalesce(sum(${schema.invoices.balanceAmount}), 0)`,
          })
          .from(schema.invoices)
          .where(inArray(schema.invoices.customerId, customerIds))
          .groupBy(schema.invoices.customerId),
  ]);

  const contractCountByCustomer = new Map(
    contractCounts.map((row) => [row.customerId, Number(row.count)]),
  );
  const arBalanceByCustomer = new Map(
    arBalances.map((row) => [row.customerId, numericToNumber(row.balance, 0)]),
  );

  const filtered = customers
    .map((customer) => ({
      ...customer,
      contractCount: contractCountByCustomer.get(customer.id) ?? 0,
      arBalance: arBalanceByCustomer.get(customer.id) ?? 0,
      sourceProvider: bcMappings.has(customer.id) ? "business_central" : "internal",
      sourcePayloadAvailable: Boolean(customer.sourcePayload),
    }))
    .filter((customer) => {
      if (filters?.sourceProvider && customer.sourceProvider !== filters.sourceProvider) {
        return false;
      }
      return true;
    });

  const start = (page - 1) * pageSize;
  return {
    data: filtered.slice(start, start + pageSize),
    total: filtered.length,
    page,
    pageSize,
  };
}

export async function getCustomerDetailView(customerId: string) {
  const customers = await listCustomers();
  const customer = customers.find(
    (entry) => entry.id === customerId || entry.customerNumber === customerId,
  );

  if (!customer) {
    return null;
  }

  const [contracts, invoices, receipts, bcMapping, sourceRow] = await Promise.all([
    listContracts(),
    listInvoices({ customerNumber: customer.customerNumber }),
    db
      .select({
        id: schema.arReceipts.id,
        receiptNumber: schema.arReceipts.receiptNumber,
        receiptDate: schema.arReceipts.receiptDate,
        amount: schema.arReceipts.amount,
        unappliedAmount: schema.arReceipts.unappliedAmount,
        status: schema.arReceipts.status,
      })
      .from(schema.arReceipts)
      .where(eq(schema.arReceipts.customerId, customer.id))
      .orderBy(desc(schema.arReceipts.receiptDate)),
    db.query.externalEntityMappings.findFirst({
      where: (table, { and: localAnd, eq: localEq, or: localOr }) =>
        localAnd(
          localEq(table.provider, "business_central"),
          localEq(table.entityType, "bc_customer"),
          localOr(localEq(table.internalId, customer.id), localEq(table.externalId, customerId)),
        ),
    }),
    db.query.customers.findFirst({
      where: (table, { eq: localEq }) => localEq(table.id, customer.id),
    }),
  ]);

  const customerContracts = contracts.filter(
    (contract) => contract.customerName === customer.name,
  );

  return {
    summary: {
      ...customer,
      contractCount: customerContracts.length,
      arBalance: invoices.reduce((sum, invoice) => sum + invoice.balanceAmount, 0),
      sourceProvider: bcMapping ? "business_central" : "internal",
      externalId: bcMapping?.externalId ?? null,
      sourcePayload: sourceRow?.sourcePayload ?? null,
    },
    contracts: customerContracts,
    invoices,
    receipts: receipts.map((row) => ({
      ...row,
      receiptDate: toIso(row.receiptDate),
      amount: numericToNumber(row.amount),
      unappliedAmount: numericToNumber(row.unappliedAmount),
    })),
  };
}

export async function getContractListView(filters?: ContractListFilters) {
  const [contracts, bcMappings] = await Promise.all([
    listContracts({
      q: filters?.q,
      status: filters?.status,
      branch: filters?.branch,
    }),
    getBusinessCentralMappings("bc_contract"),
  ]);

  return contracts.filter((contract) => {
    const sourceProvider = contract.sourceProvider ?? (bcMappings.has(contract.id) ? "business_central" : "internal");
    if (filters?.sourceProvider && sourceProvider !== filters.sourceProvider) {
      return false;
    }
    if (
      filters?.sourceDocumentType &&
      (contract.sourceDocumentType ?? "") !== filters.sourceDocumentType
    ) {
      return false;
    }
    return true;
  });
}

export async function getContractDetailView(contractId: string) {
  const contracts = await listContracts();
  const contract = contracts.find(
    (entry) => entry.id === contractId || entry.contractNumber === contractId,
  );

  if (!contract) {
    return null;
  }

  const [contractRow, contractLines, events, invoices, sourceDocument, auditRows] =
    await Promise.all([
      db.query.contracts.findFirst({
        where: (table, { eq: localEq }) => localEq(table.id, contract.id),
      }),
      db
        .select({
          id: schema.contractLines.id,
          description: schema.contractLines.description,
          unitPrice: schema.contractLines.unitPrice,
          unit: schema.contractLines.unit,
          quantity: schema.contractLines.quantity,
          deliveryFee: schema.contractLines.deliveryFee,
          pickupFee: schema.contractLines.pickupFee,
          startDate: schema.contractLines.startDate,
          endDate: schema.contractLines.endDate,
          sourceLineNo: schema.contractLines.sourceLineNo,
          sourceItemNo: schema.contractLines.sourceItemNo,
          sourceUomCode: schema.contractLines.sourceUomCode,
          assetNumber: schema.assets.assetNumber,
        })
        .from(schema.contractLines)
        .leftJoin(schema.assets, eq(schema.contractLines.assetId, schema.assets.id))
        .where(eq(schema.contractLines.contractId, contract.id))
        .orderBy(schema.contractLines.startDate),
      listFinancialEvents({ contractNumber: contract.contractNumber }),
      listInvoices({ contractNumber: contract.contractNumber }),
      db.query.bcSourceDocuments.findFirst({
        where: (table, { and: localAnd, eq: localEq }) => {
          const conditions = [
            localEq(table.documentNo, contract.sourceDocumentNo ?? contract.contractNumber),
          ];
          if (contract.sourceDocumentType) {
            conditions.push(localEq(table.documentType, contract.sourceDocumentType));
          }
          return localAnd(...conditions);
        },
      }),
      db
        .select({
          id: schema.auditEvents.id,
          eventType: schema.auditEvents.eventType,
          createdAt: schema.auditEvents.createdAt,
          userId: schema.auditEvents.userId,
        })
        .from(schema.auditEvents)
        .where(
          and(
            eq(schema.auditEvents.entityType, "contract"),
            eq(schema.auditEvents.entityId, contract.id),
          ),
        )
        .orderBy(desc(schema.auditEvents.createdAt))
        .limit(12),
    ]);

  const sourceDocumentLines = sourceDocument
    ? await db
        .select()
        .from(schema.bcSourceDocumentLines)
        .where(eq(schema.bcSourceDocumentLines.sourceDocumentId, sourceDocument.id))
        .orderBy(schema.bcSourceDocumentLines.lineNo)
    : [];

  return {
    summary: {
      ...contract,
      sourceProvider: contractRow?.sourceProvider ?? contract.sourceProvider ?? "internal",
      sourceDocumentType: contractRow?.sourceDocumentType ?? contract.sourceDocumentType ?? null,
      sourceDocumentNo: contractRow?.sourceDocumentNo ?? contract.sourceDocumentNo ?? null,
      sourceStatus: contractRow?.sourceStatus ?? contract.sourceStatus ?? null,
      sourceSnapshot: contractRow?.sourceSnapshot ?? null,
    },
    lines: contractLines.map((line) => ({
      ...line,
      unitPrice: numericToNumber(line.unitPrice),
      quantity: numericToNumber(line.quantity),
      deliveryFee: numericToNumber(line.deliveryFee),
      pickupFee: numericToNumber(line.pickupFee),
      startDate: toIso(line.startDate),
      endDate: toIso(line.endDate),
    })),
    commercialEvents: events,
    invoices,
    sourceDocument: sourceDocument
      ? {
          ...sourceDocument,
          documentDate: toIso(sourceDocument.documentDate),
          dueDate: toIso(sourceDocument.dueDate),
        }
      : null,
    sourceDocumentLines: sourceDocumentLines.map((line) => ({
      ...line,
      quantity: numericToNumber(line.quantity),
      unitPrice: numericToNumber(line.unitPrice),
      lineAmount: numericToNumber(line.lineAmount),
    })),
    auditTrail: auditRows.map((row) => ({
      ...row,
      createdAt: toIso(row.createdAt),
    })),
  };
}

export async function getCommercialEventsView(filters?: CommercialEventFilters) {
  const baseEvents = await listFinancialEvents(filters);
  const eventIds = baseEvents.map((event) => event.id);

  const rows =
    eventIds.length === 0
      ? []
      : await db
          .select({
            id: schema.commercialEvents.id,
            sourceDocumentType: schema.commercialEvents.sourceDocumentType,
            sourceDocumentNo: schema.commercialEvents.sourceDocumentNo,
            invoiceStatus: schema.invoices.status,
            invoiceNumber: schema.invoices.invoiceNumber,
          })
          .from(schema.commercialEvents)
          .leftJoin(schema.invoices, eq(schema.commercialEvents.invoiceId, schema.invoices.id))
          .where(inArray(schema.commercialEvents.id, eventIds));

  const rowById = new Map(rows.map((row) => [row.id, row]));

  return baseEvents.map((event) => {
    const row = rowById.get(event.id);
    return {
      ...event,
      sourceDocumentType: row?.sourceDocumentType ?? event.sourceDocumentType ?? null,
      sourceDocumentNo: row?.sourceDocumentNo ?? event.sourceDocumentNo ?? null,
      invoiceStatus: row?.invoiceStatus ?? null,
      invoiceNumber: row?.invoiceNumber ?? null,
    };
  });
}

export async function getArInvoicesView() {
  const invoices = await listInvoices();
  return invoices.map((invoice) => ({
    ...invoice,
    sourceProvider: invoice.sourceProvider ?? "internal",
    sourceDocumentType: invoice.sourceDocumentType ?? null,
    sourceDocumentNo: invoice.sourceDocumentNo ?? null,
    sourceStatus: invoice.sourceStatus ?? null,
  }));
}

export async function getArReceiptsView() {
  const rows = await db
    .select({
      id: schema.arReceipts.id,
      receiptNumber: schema.arReceipts.receiptNumber,
      customerName: schema.customers.name,
      cashAccountName: schema.cashAccounts.name,
      receiptDate: schema.arReceipts.receiptDate,
      amount: schema.arReceipts.amount,
      unappliedAmount: schema.arReceipts.unappliedAmount,
      status: schema.arReceipts.status,
      sourceProvider: schema.arReceipts.sourceProvider,
      sourceDocumentNo: schema.arReceipts.sourceDocumentNo,
    })
    .from(schema.arReceipts)
    .innerJoin(schema.customers, eq(schema.arReceipts.customerId, schema.customers.id))
    .leftJoin(schema.cashAccounts, eq(schema.arReceipts.cashAccountId, schema.cashAccounts.id))
    .orderBy(desc(schema.arReceipts.receiptDate));

  return rows.map((row) => ({
    ...row,
    receiptDate: toIso(row.receiptDate),
    amount: numericToNumber(row.amount),
    unappliedAmount: numericToNumber(row.unappliedAmount),
  }));
}

export async function getApBillsView() {
  const rows = await db
    .select({
      id: schema.apBills.id,
      billNumber: schema.apBills.billNumber,
      vendorName: schema.bcVendors.name,
      billDate: schema.apBills.billDate,
      dueDate: schema.apBills.dueDate,
      totalAmount: schema.apBills.totalAmount,
      balanceAmount: schema.apBills.balanceAmount,
      status: schema.apBills.status,
      sourceProvider: schema.apBills.sourceProvider,
      sourceDocumentNo: schema.apBills.sourceDocumentNo,
    })
    .from(schema.apBills)
    .innerJoin(schema.bcVendors, eq(schema.apBills.vendorId, schema.bcVendors.id))
    .orderBy(desc(schema.apBills.billDate));

  return rows.map((row) => ({
    ...row,
    billDate: toIso(row.billDate),
    dueDate: toIso(row.dueDate),
    totalAmount: numericToNumber(row.totalAmount),
    balanceAmount: numericToNumber(row.balanceAmount),
  }));
}

export async function getGlAccountsView() {
  const rows = await db
    .select()
    .from(schema.glAccounts)
    .orderBy(schema.glAccounts.accountNumber);

  return rows.map((row) => ({
    ...row,
    sourceProvider: row.sourceProvider ?? "internal",
  }));
}

export async function getGlJournalView() {
  const entries = await db
    .select({
      id: schema.glJournalEntries.id,
      entryNumber: schema.glJournalEntries.entryNumber,
      entryDate: schema.glJournalEntries.entryDate,
      description: schema.glJournalEntries.description,
      status: schema.glJournalEntries.status,
      sourceType: schema.glJournalEntries.sourceType,
      sourceId: schema.glJournalEntries.sourceId,
      postedAt: schema.glJournalEntries.postedAt,
    })
    .from(schema.glJournalEntries)
    .orderBy(desc(schema.glJournalEntries.entryDate))
    .limit(100);

  const entryIds = entries.map((entry) => entry.id);
  const lines =
    entryIds.length === 0
      ? []
      : await db
          .select({
            journalEntryId: schema.glJournalLines.journalEntryId,
            side: schema.glJournalLines.side,
            amount: schema.glJournalLines.amount,
          })
          .from(schema.glJournalLines)
          .where(inArray(schema.glJournalLines.journalEntryId, entryIds));

  const totalsByEntry = new Map<
    string,
    {
      debitTotal: number;
      creditTotal: number;
    }
  >();
  for (const line of lines) {
    const current = totalsByEntry.get(line.journalEntryId) ?? {
      debitTotal: 0,
      creditTotal: 0,
    };
    if (line.side === "debit") {
      current.debitTotal += numericToNumber(line.amount);
    } else {
      current.creditTotal += numericToNumber(line.amount);
    }
    totalsByEntry.set(line.journalEntryId, current);
  }

  return entries.map((entry) => {
    const totals = totalsByEntry.get(entry.id) ?? {
      debitTotal: 0,
      creditTotal: 0,
    };
    return {
      ...entry,
      entryDate: toIso(entry.entryDate),
      postedAt: toIso(entry.postedAt),
      ...totals,
    };
  });
}

export async function getGlPeriodsView() {
  const rows = await db
    .select()
    .from(schema.glPostingPeriods)
    .orderBy(desc(schema.glPostingPeriods.startsAt));

  return rows.map((row) => ({
    ...row,
    startsAt: toIso(row.startsAt),
    endsAt: toIso(row.endsAt),
    closedAt: toIso(row.closedAt),
  }));
}

export async function getCashView() {
  const [accounts, transactions] = await Promise.all([
    db.select().from(schema.cashAccounts).orderBy(schema.cashAccounts.accountNumber),
    db
      .select({
        id: schema.cashTransactions.id,
        cashAccountId: schema.cashTransactions.cashAccountId,
        transactionType: schema.cashTransactions.transactionType,
        transactionDate: schema.cashTransactions.transactionDate,
        amount: schema.cashTransactions.amount,
        description: schema.cashTransactions.description,
        accountName: schema.cashAccounts.name,
      })
      .from(schema.cashTransactions)
      .innerJoin(schema.cashAccounts, eq(schema.cashTransactions.cashAccountId, schema.cashAccounts.id))
      .orderBy(desc(schema.cashTransactions.transactionDate))
      .limit(200),
  ]);

  return {
    accounts,
    transactions: transactions.map((row) => ({
      ...row,
      transactionDate: toIso(row.transactionDate),
      amount: numericToNumber(row.amount),
    })),
  };
}

export async function getBusinessCentralOverviewView() {
  const [runs, errors, checkpoints, sourceDocuments, sourceLines, counts] = await Promise.all([
    db.select().from(schema.bcImportRuns).orderBy(desc(schema.bcImportRuns.startedAt)).limit(12),
    db.select().from(schema.bcImportErrors).orderBy(desc(schema.bcImportErrors.createdAt)).limit(12),
    db.select().from(schema.bcImportCheckpoints).orderBy(desc(schema.bcImportCheckpoints.updatedAt)),
    db.select({ count: sql<number>`count(*)` }).from(schema.bcSourceDocuments),
    db.select({ count: sql<number>`count(*)` }).from(schema.bcSourceDocumentLines),
    Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(schema.assets),
      db.select({ count: sql<number>`count(*)` }).from(schema.customers),
      db.select({ count: sql<number>`count(*)` }).from(schema.contracts),
      db.select({ count: sql<number>`count(*)` }).from(schema.invoices),
      db.select({ count: sql<number>`count(*)` }).from(schema.bcGlEntries),
      db.select({ count: sql<number>`count(*)` }).from(schema.bcBankLedgerEntries),
      db.select({ count: sql<number>`count(*)` }).from(schema.bcVendorLedgerEntries),
      db.select({ count: sql<number>`count(*)` }).from(schema.bcCustomerLedgerEntries),
      db.select({ count: sql<number>`count(*)` }).from(schema.bcFaLedgerEntries),
    ]),
  ]);

  return {
    latestRun: runs[0]
      ? {
          ...runs[0],
          startedAt: toIso(runs[0].startedAt),
          finishedAt: toIso(runs[0].finishedAt),
        }
      : null,
    recentRuns: runs.map((row) => ({
      ...row,
      startedAt: toIso(row.startedAt),
      finishedAt: toIso(row.finishedAt),
    })),
    recentErrors: errors.map((row) => ({
      ...row,
      createdAt: toIso(row.createdAt),
      resolvedAt: toIso(row.resolvedAt),
    })),
    checkpoints: checkpoints.map((row) => ({
      ...row,
      windowStart: toIso(row.windowStart),
      windowEnd: toIso(row.windowEnd),
      updatedAt: toIso(row.updatedAt),
    })),
    metrics: {
      assets: counts[0][0]?.count ?? 0,
      customers: counts[1][0]?.count ?? 0,
      contracts: counts[2][0]?.count ?? 0,
      invoices: counts[3][0]?.count ?? 0,
      bcGlEntries: counts[4][0]?.count ?? 0,
      bcBankLedgerEntries: counts[5][0]?.count ?? 0,
      bcVendorLedgerEntries: counts[6][0]?.count ?? 0,
      bcCustomerLedgerEntries: counts[7][0]?.count ?? 0,
      bcFaLedgerEntries: counts[8][0]?.count ?? 0,
      sourceDocuments: sourceDocuments[0]?.count ?? 0,
      sourceDocumentLines: sourceLines[0]?.count ?? 0,
    },
  };
}

export async function getBusinessCentralImportRunsView() {
  const rows = await db
    .select()
    .from(schema.bcImportRuns)
    .orderBy(desc(schema.bcImportRuns.startedAt));

  return rows.map((row) => ({
    ...row,
    startedAt: toIso(row.startedAt),
    finishedAt: toIso(row.finishedAt),
    sourceWindowStart: toIso(row.sourceWindowStart),
    sourceWindowEnd: toIso(row.sourceWindowEnd),
  }));
}

export async function getBusinessCentralImportErrorsView() {
  const rows = await db
    .select({
      id: schema.bcImportErrors.id,
      runId: schema.bcImportErrors.runId,
      entityType: schema.bcImportErrors.entityType,
      externalId: schema.bcImportErrors.externalId,
      internalId: schema.bcImportErrors.internalId,
      errorCode: schema.bcImportErrors.errorCode,
      message: schema.bcImportErrors.message,
      createdAt: schema.bcImportErrors.createdAt,
      runStatus: schema.bcImportRuns.status,
    })
    .from(schema.bcImportErrors)
    .leftJoin(schema.bcImportRuns, eq(schema.bcImportErrors.runId, schema.bcImportRuns.id))
    .orderBy(desc(schema.bcImportErrors.createdAt));

  return rows.map((row) => ({
    ...row,
    createdAt: toIso(row.createdAt),
  }));
}

export async function getSourceDocumentsView() {
  const docs = await db
    .select()
    .from(schema.bcSourceDocuments)
    .orderBy(desc(schema.bcSourceDocuments.importedAt))
    .limit(200);

  const docIds = docs.map((doc) => doc.id);
  const [lines, linkedContracts, linkedInvoices] = await Promise.all([
    docIds.length === 0
      ? Promise.resolve([] as Array<{ sourceDocumentId: string; count: number }>)
      : db
          .select({
            sourceDocumentId: schema.bcSourceDocumentLines.sourceDocumentId,
            count: sql<number>`count(*)`,
          })
          .from(schema.bcSourceDocumentLines)
          .where(inArray(schema.bcSourceDocumentLines.sourceDocumentId, docIds))
          .groupBy(schema.bcSourceDocumentLines.sourceDocumentId),
    db
      .select({
        id: schema.contracts.id,
        contractNumber: schema.contracts.contractNumber,
        sourceDocumentType: schema.contracts.sourceDocumentType,
        sourceDocumentNo: schema.contracts.sourceDocumentNo,
      })
      .from(schema.contracts),
    db
      .select({
        id: schema.invoices.id,
        invoiceNumber: schema.invoices.invoiceNumber,
        sourceDocumentType: schema.invoices.sourceDocumentType,
        sourceDocumentNo: schema.invoices.sourceDocumentNo,
      })
      .from(schema.invoices),
  ]);

  const lineCountByDocument = new Map(lines.map((row) => [row.sourceDocumentId, Number(row.count)]));

  return docs.map((doc) => ({
    ...doc,
    documentDate: toIso(doc.documentDate),
    dueDate: toIso(doc.dueDate),
    importedAt: toIso(doc.importedAt),
    lineCount: lineCountByDocument.get(doc.id) ?? 0,
    linkedContracts: linkedContracts.filter(
      (contract) =>
        contract.sourceDocumentNo === doc.documentNo &&
        contract.sourceDocumentType === doc.documentType,
    ),
    linkedInvoices: linkedInvoices.filter(
      (invoice) =>
        invoice.sourceDocumentNo === doc.documentNo &&
        invoice.sourceDocumentType === doc.documentType,
    ),
  }));
}

export async function getFinancialDashboardView() {
  const [commercialEvents, invoices, receipts, bills, journals, bcOverview] =
    await Promise.all([
      getCommercialEventsView(),
      getArInvoicesView(),
      getArReceiptsView(),
      getApBillsView(),
      getGlJournalView(),
      getBusinessCentralOverviewView(),
    ]);

  const uninvoicedCommercialEvents = commercialEvents.filter(
    (event) => event.invoiceStatus === null,
  );
  const openReceivables = invoices.filter(
    (invoice) => invoice.balanceAmount > 0 && invoice.status !== "voided",
  );
  const unappliedReceipts = receipts.filter((receipt) => receipt.unappliedAmount > 0);
  const openAp = bills.filter((bill) => bill.balanceAmount > 0);
  const postedJournals = journals.filter((entry) => entry.status === "posted");

  return {
    metrics: {
      uninvoicedCommercialEvents: uninvoicedCommercialEvents.length,
      uninvoicedCommercialAmount: uninvoicedCommercialEvents.reduce(
        (sum, event) => sum + event.amount,
        0,
      ),
      openArInvoices: openReceivables.length,
      openArBalance: openReceivables.reduce((sum, invoice) => sum + invoice.balanceAmount, 0),
      unappliedReceipts: unappliedReceipts.length,
      unappliedReceiptAmount: unappliedReceipts.reduce(
        (sum, receipt) => sum + receipt.unappliedAmount,
        0,
      ),
      openApBills: openAp.length,
      openApBalance: openAp.reduce((sum, bill) => sum + bill.balanceAmount, 0),
      postedJournals: postedJournals.length,
      currentTrialBalanceDelta: postedJournals.reduce(
        (sum, entry) => sum + (entry.debitTotal - entry.creditTotal),
        0,
      ),
      bcImportErrors: bcOverview.recentErrors.length,
    },
    commercialEvents: commercialEvents.slice(0, 12),
    arInvoices: invoices.slice(0, 12),
    arReceipts: receipts.slice(0, 12),
    apBills: bills.slice(0, 12),
    journals: journals.slice(0, 12),
    bcOverview,
  };
}

export async function getReconciliationReportsView() {
  const [sourceDocuments, bcOverview, operationalReports] = await Promise.all([
    getSourceDocumentsView(),
    getBusinessCentralOverviewView(),
    Promise.all([listAssetsPage({ page: 1, pageSize: 1000 }), listContracts(), listInvoices()]),
  ]);

  const [assetPage, contracts, invoices] = operationalReports;
  const linkedContracts = sourceDocuments.reduce(
    (sum, doc) => sum + doc.linkedContracts.length,
    0,
  );
  const linkedInvoices = sourceDocuments.reduce(
    (sum, doc) => sum + doc.linkedInvoices.length,
    0,
  );

  return {
    metrics: {
      seededAssetsVisible: assetPage.total,
      seededContractsVisible: contracts.length,
      seededInvoicesVisible: invoices.length,
      sourceDocuments: bcOverview.metrics.sourceDocuments,
      linkedContracts,
      linkedInvoices,
      importErrors: bcOverview.recentErrors.length,
    },
    recentErrors: bcOverview.recentErrors,
    recentRuns: bcOverview.recentRuns,
    sourceDocuments: sourceDocuments.slice(0, 20),
  };
}

export async function getOperationsContextView() {
  const [dispatchTasks, inspections, workOrders] = await Promise.all([
    listDispatchTasks(),
    listInspections(),
    listWorkOrders(),
  ]);

  return {
    dispatchTasks,
    inspections,
    workOrders,
  };
}
