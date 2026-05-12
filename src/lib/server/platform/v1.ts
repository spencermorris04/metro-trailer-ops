import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";

import { db, pool, schema } from "@/lib/db";
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

function payloadText(
  payload: Record<string, unknown> | null | undefined,
  keys: string[],
) {
  if (!payload) {
    return null;
  }

  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }
  return null;
}

function payloadAmount(
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
      const parsed = Number.parseFloat(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return null;
}

function timestampForSort(value: string | null | undefined) {
  if (!value) {
    return 0;
  }
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
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
    faClassCode: filters?.faClassCode,
    faSubclassCode: filters?.faSubclassCode,
    blocked: filters?.blocked,
    inactive: filters?.inactive,
    disposed: filters?.disposed,
    onRent: filters?.onRent,
    inService: filters?.inService,
    underMaintenance: filters?.underMaintenance,
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
      sourcePayloadAvailable: Boolean(
        (customer as { sourcePayload?: unknown }).sourcePayload,
      ),
    }))
    .filter((customer) => {
      if (filters?.sourceProvider && customer.sourceProvider !== filters.sourceProvider) {
        return false;
      }
      return true;
    });

  const start = (page - 1) * pageSize;
  const pageData = filtered.slice(start, start + pageSize);
  const customerNumbers = pageData.map((customer) => customer.customerNumber);
  const bcStatsResult =
    customerNumbers.length === 0
      ? { rows: [] as Array<{
          customer_number: string;
          bc_invoice_count: string;
          bc_lease_count: string;
          bc_equipment_count: string;
          bc_revenue: string | null;
          bc_ar_balance: string | null;
          latest_invoice_date: Date | null;
          latest_activity_date: Date | null;
        }> }
      : await pool.query<{
          customer_number: string;
          bc_invoice_count: string;
          bc_lease_count: string;
          bc_equipment_count: string;
          bc_revenue: string | null;
          bc_ar_balance: string | null;
          latest_invoice_date: Date | null;
          latest_activity_date: Date | null;
        }>(
          `
            with scoped_headers as (
              select
                coalesce(h.bill_to_customer_no, h.sell_to_customer_no) as customer_number,
                h.document_type,
                h.document_no,
                h.previous_no,
                h.posting_date
              from bc_rmi_posted_rental_invoice_headers h
              where coalesce(h.bill_to_customer_no, h.sell_to_customer_no) = any($1::text[])
            ),
            line_stats as (
              select
                sh.customer_number,
                count(distinct sh.document_no)::bigint as bc_invoice_count,
                count(distinct sh.previous_no) filter (where sh.previous_no is not null)::bigint as bc_lease_count,
                count(distinct l.item_no) filter (where l.type = 'Fixed Asset' and l.item_no is not null)::bigint as bc_equipment_count,
                coalesce(sum(l.gross_amount), 0)::numeric(18,2) as bc_revenue,
                max(coalesce(l.invoice_thru_date, l.invoice_from_date, l.posting_date, sh.posting_date)) as latest_activity_date,
                max(sh.posting_date) as latest_invoice_date
              from scoped_headers sh
              left join bc_rmi_posted_rental_lines l
                on l.document_type = sh.document_type
               and l.document_no = sh.document_no
              group by sh.customer_number
            ),
            ar_stats as (
              select
                customer_no as customer_number,
                coalesce(sum(amount), 0)::numeric(18,2) as bc_ar_balance
              from bc_customer_ledger_entries
              where customer_no = any($1::text[])
              group by customer_no
            )
            select
              coalesce(ls.customer_number, ar.customer_number) as customer_number,
              coalesce(ls.bc_invoice_count, 0)::bigint as bc_invoice_count,
              coalesce(ls.bc_lease_count, 0)::bigint as bc_lease_count,
              coalesce(ls.bc_equipment_count, 0)::bigint as bc_equipment_count,
              coalesce(ls.bc_revenue, 0)::numeric(18,2) as bc_revenue,
              coalesce(ar.bc_ar_balance, 0)::numeric(18,2) as bc_ar_balance,
              ls.latest_invoice_date,
              ls.latest_activity_date
            from line_stats ls
            full join ar_stats ar on ar.customer_number = ls.customer_number
          `,
          [customerNumbers],
        );
  const bcStatsByCustomer = new Map(
    bcStatsResult.rows.map((row) => [row.customer_number, row]),
  );

  return {
    data: pageData.map((customer) => {
      const stats = bcStatsByCustomer.get(customer.customerNumber);
      return {
        ...customer,
        arBalance:
          stats?.bc_ar_balance !== undefined
            ? numericToNumber(stats.bc_ar_balance)
            : customer.arBalance,
        bcInvoiceCount: Number(stats?.bc_invoice_count ?? 0),
        bcLeaseCount: Number(stats?.bc_lease_count ?? 0),
        bcEquipmentCount: Number(stats?.bc_equipment_count ?? 0),
        bcRevenue: numericToNumber(stats?.bc_revenue),
        latestInvoiceDate: toIso(stats?.latest_invoice_date ?? null),
        latestActivityDate: toIso(stats?.latest_activity_date ?? null),
      };
    }),
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

  const canonicalEvents = baseEvents.map((event) => {
    const row = rowById.get(event.id);
    return {
      ...event,
      sourceDocumentType: row?.sourceDocumentType ?? null,
      sourceDocumentNo: row?.sourceDocumentNo ?? null,
      invoiceStatus: row?.invoiceStatus ?? null,
      invoiceNumber: row?.invoiceNumber ?? null,
    };
  });

  const rawLedgerRows = await db
    .select({
      id: schema.bcRmiRentalLedgerEntries.id,
      externalEntryNo: schema.bcRmiRentalLedgerEntries.externalEntryNo,
      documentType: schema.bcRmiRentalLedgerEntries.documentType,
      documentNo: schema.bcRmiRentalLedgerEntries.documentNo,
      orderNo: schema.bcRmiRentalLedgerEntries.orderNo,
      postingDate: schema.bcRmiRentalLedgerEntries.postingDate,
      billToCustomerNo: schema.bcRmiRentalLedgerEntries.billToCustomerNo,
      typeOrdered: schema.bcRmiRentalLedgerEntries.typeOrdered,
      noOrdered: schema.bcRmiRentalLedgerEntries.noOrdered,
      typeShipped: schema.bcRmiRentalLedgerEntries.typeShipped,
      noShipped: schema.bcRmiRentalLedgerEntries.noShipped,
      serialNoShipped: schema.bcRmiRentalLedgerEntries.serialNoShipped,
      quantity: schema.bcRmiRentalLedgerEntries.quantity,
      fromDate: schema.bcRmiRentalLedgerEntries.fromDate,
      thruDate: schema.bcRmiRentalLedgerEntries.thruDate,
      grossAmount: schema.bcRmiRentalLedgerEntries.grossAmount,
      grossAmountLcy: schema.bcRmiRentalLedgerEntries.grossAmountLcy,
      dealCode: schema.bcRmiRentalLedgerEntries.dealCode,
    })
    .from(schema.bcRmiRentalLedgerEntries)
    .orderBy(desc(schema.bcRmiRentalLedgerEntries.postingDate))
    .limit(500);

  const rawEvents = rawLedgerRows
    .filter((row) => {
      if (filters?.contractNumber && row.orderNo !== filters.contractNumber) {
        return false;
      }
      if (filters?.eventType && filters.eventType !== "legacy_rental") {
        return false;
      }
      if (filters?.status && filters.status !== "posted") {
        return false;
      }
      return true;
    })
    .map((row) => {
      const itemNo = row.noShipped ?? row.noOrdered ?? row.serialNoShipped ?? "";
      const period = [toIso(row.fromDate)?.slice(0, 10), toIso(row.thruDate)?.slice(0, 10)]
        .filter(Boolean)
        .join(" to ");
      return {
        id: row.id,
        contractId: null,
        contractNumber: row.orderNo ?? row.documentNo ?? "Legacy BC",
        contractLineId: null,
        assetId: null,
        eventType: "legacy_rental",
        description: [
          row.typeShipped ?? row.typeOrdered ?? "Rental ledger entry",
          itemNo,
          row.dealCode ? `deal ${row.dealCode}` : "",
          period,
        ]
          .filter(Boolean)
          .join(" / "),
        amount: numericToNumber(row.grossAmount ?? row.grossAmountLcy),
        eventDate: toIso(row.postingDate) ?? toIso(row.fromDate) ?? new Date(0).toISOString(),
        status: "posted",
        sourceDocumentType: row.documentType ?? "Rental Ledger Entry",
        sourceDocumentNo: row.documentNo ?? row.externalEntryNo,
        invoiceStatus: "posted",
        invoiceNumber: row.documentNo,
        externalReference: row.externalEntryNo,
        metadata: {
          sourceProvider: "business_central",
          billToCustomerNo: row.billToCustomerNo,
          quantity: numericToNumber(row.quantity),
        },
      };
    });

  return [...canonicalEvents, ...rawEvents]
    .sort((left, right) => timestampForSort(right.eventDate) - timestampForSort(left.eventDate))
    .slice(0, 700);
}

export async function getArInvoicesView() {
  const invoices = await listInvoices();
  const canonicalInvoices = invoices.map((invoice) => {
    const sourceInvoice = invoice as typeof invoice & {
      sourceProvider?: string | null;
      sourceDocumentType?: string | null;
      sourceDocumentNo?: string | null;
      sourceStatus?: string | null;
    };
    return {
      ...invoice,
      sourceProvider: sourceInvoice.sourceProvider ?? "internal",
      sourceDocumentType: sourceInvoice.sourceDocumentType ?? null,
      sourceDocumentNo: sourceInvoice.sourceDocumentNo ?? null,
      sourceStatus: sourceInvoice.sourceStatus ?? null,
    };
  });
  const canonicalSourceKeys = new Set(
    canonicalInvoices
      .map((invoice) =>
        invoice.sourceDocumentType && invoice.sourceDocumentNo
          ? `${invoice.sourceDocumentType}:${invoice.sourceDocumentNo}`
          : null,
      )
      .filter((key): key is string => Boolean(key)),
  );

  const rawHeaders = await db
    .select({
      id: schema.bcRmiPostedRentalInvoiceHeaders.id,
      documentType: schema.bcRmiPostedRentalInvoiceHeaders.documentType,
      documentNo: schema.bcRmiPostedRentalInvoiceHeaders.documentNo,
      previousDocType: schema.bcRmiPostedRentalInvoiceHeaders.previousDocType,
      previousNo: schema.bcRmiPostedRentalInvoiceHeaders.previousNo,
      sellToCustomerNo: schema.bcRmiPostedRentalInvoiceHeaders.sellToCustomerNo,
      billToCustomerNo: schema.bcRmiPostedRentalInvoiceHeaders.billToCustomerNo,
      postingDate: schema.bcRmiPostedRentalInvoiceHeaders.postingDate,
      documentDate: schema.bcRmiPostedRentalInvoiceHeaders.documentDate,
      dueDate: schema.bcRmiPostedRentalInvoiceHeaders.dueDate,
      sourcePayload: schema.bcRmiPostedRentalInvoiceHeaders.sourcePayload,
    })
    .from(schema.bcRmiPostedRentalInvoiceHeaders)
    .orderBy(desc(schema.bcRmiPostedRentalInvoiceHeaders.postingDate))
    .limit(500);

  const rawInvoices = rawHeaders
    .filter((row) => !canonicalSourceKeys.has(`${row.documentType}:${row.documentNo}`))
    .map((row) => {
      const payload = row.sourcePayload as Record<string, unknown>;
      return {
        id: row.id,
        invoiceNumber: row.documentNo,
        customerName:
          payloadText(payload, ["BilltoName", "SelltoCustomerName", "Name"]) ??
          row.billToCustomerNo ??
          row.sellToCustomerNo ??
          "Unknown customer",
        contractNumber: row.previousNo ?? "Legacy BC posted invoice",
        status: "posted",
        invoiceDate:
          toIso(row.documentDate) ?? toIso(row.postingDate) ?? new Date(0).toISOString(),
        dueDate: toIso(row.dueDate) ?? toIso(row.documentDate) ?? new Date(0).toISOString(),
        totalAmount: payloadAmount(payload, ["AmountIncludingVAT", "Amount", "TotalAmount"]) ?? 0,
        balanceAmount: 0,
        deliveryStatus: "imported",
        sentAt: null,
        deliveryChannel: "business_central",
        quickBooksSyncStatus: "skipped",
        quickBooksLastSyncedAt: null,
        quickBooksLastError: null,
        reconciliationState: "synced",
        sourceProvider: "business_central",
        sourceDocumentType: row.documentType,
        sourceDocumentNo: row.documentNo,
        sourceStatus: "posted",
        previousDocumentType: row.previousDocType,
        previousDocumentNo: row.previousNo,
      };
    });

  return [...canonicalInvoices, ...rawInvoices]
    .sort((left, right) => timestampForSort(right.invoiceDate) - timestampForSort(left.invoiceDate))
    .slice(0, 700);
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

export async function getVendorApHistoryView() {
  const [summaryResult, vendorResult, ledgerResult, canonicalCountsResult] =
    await Promise.all([
      pool.query<{
        vendor_count: string;
        ledger_count: string;
        ledger_amount: string | null;
      }>(
        `
          select
            (select count(*)::bigint from bc_vendors) as vendor_count,
            (select count(*)::bigint from bc_vendor_ledger_entries) as ledger_count,
            (select coalesce(sum(amount), 0)::numeric(18,2) from bc_vendor_ledger_entries) as ledger_amount
        `,
      ),
      pool.query<{
        id: string;
        vendor_no: string;
        name: string;
        status: string | null;
        location_code: string | null;
        ledger_count: string;
        balance: string | null;
        latest_posting_date: Date | null;
      }>(
        `
          select
            v.id,
            v.vendor_no,
            v.name,
            v.status,
            v.location_code,
            count(e.id)::bigint as ledger_count,
            coalesce(sum(e.amount), 0)::numeric(18,2) as balance,
            max(e.posting_date) as latest_posting_date
          from bc_vendors v
          left join bc_vendor_ledger_entries e on e.vendor_no = v.vendor_no
          group by v.id, v.vendor_no, v.name, v.status, v.location_code
          order by max(e.posting_date) desc nulls last, v.vendor_no
          limit 200
        `,
      ),
      pool.query<{
        id: string;
        external_entry_no: string;
        vendor_no: string | null;
        vendor_name: string | null;
        posting_date: Date | null;
        document_no: string | null;
        amount: string | null;
        payload: Record<string, unknown>;
      }>(
        `
          select
            e.id,
            e.external_entry_no,
            e.vendor_no,
            v.name as vendor_name,
            e.posting_date,
            e.document_no,
            e.amount,
            e.payload
          from bc_vendor_ledger_entries e
          left join bc_vendors v on v.vendor_no = e.vendor_no
          order by e.posting_date desc nulls last, e.external_entry_no desc
          limit 200
        `,
      ),
      pool.query<{
        ap_bill_count: string;
        ap_payment_count: string;
      }>(
        `
          select
            (select count(*)::bigint from ap_bills) as ap_bill_count,
            (select count(*)::bigint from ap_payments) as ap_payment_count
        `,
      ),
    ]);

  const summary = summaryResult.rows[0];
  const canonicalCounts = canonicalCountsResult.rows[0];
  return {
    summary: {
      vendorCount: Number(summary.vendor_count),
      vendorLedgerCount: Number(summary.ledger_count),
      vendorLedgerAmount: numericToNumber(summary.ledger_amount),
      appBillCount: Number(canonicalCounts.ap_bill_count),
      appPaymentCount: Number(canonicalCounts.ap_payment_count),
    },
    vendors: vendorResult.rows.map((row) => ({
      id: row.id,
      vendorNo: row.vendor_no,
      name: row.name,
      status: row.status,
      locationCode: row.location_code,
      ledgerCount: Number(row.ledger_count),
      balance: numericToNumber(row.balance),
      latestPostingDate: toIso(row.latest_posting_date),
    })),
    ledgerEntries: ledgerResult.rows.map((row) => ({
      id: row.id,
      entryNo: row.external_entry_no,
      vendorNo: row.vendor_no,
      vendorName: row.vendor_name,
      postingDate: toIso(row.posting_date),
      documentNo: row.document_no,
      amount: numericToNumber(row.amount),
      documentType:
        typeof row.payload.Document_Type === "string"
          ? row.payload.Document_Type
          : null,
      description:
        typeof row.payload.Description === "string" ? row.payload.Description : null,
    })),
    purchaseOrdersImported: false,
  };
}

export async function getGlAccountsView() {
  const rows = await db
    .select()
    .from(schema.glAccounts)
    .orderBy(schema.glAccounts.accountNumber);

  const appRows = rows.map((row) => ({
    ...row,
    sourceProvider: row.sourceProvider ?? "internal",
    sourceKind: "app" as const,
  }));

  const appAccountNumbers = new Set(appRows.map((row) => row.accountNumber));
  const bcRows = await db
    .select()
    .from(schema.bcGlAccounts)
    .orderBy(schema.bcGlAccounts.accountNo);

  const bcAccounts = bcRows
    .filter((row) => !appAccountNumbers.has(row.accountNo))
    .map((row) => ({
      id: row.id,
      accountNumber: row.accountNo,
      name: row.name,
      category: row.category ?? row.accountType ?? "uncategorized",
      subcategory: row.subcategory,
      normalSide: row.incomeBalance ?? row.accountType ?? "account",
      active: !row.blocked,
      sourceProvider: "business_central",
      sourceExternalId: row.accountNo,
      sourcePayload: row.payload,
      createdAt: row.importedAt,
      updatedAt: row.importedAt,
      sourceKind: "business_central" as const,
    }));

  return [...appRows, ...bcAccounts].sort((left, right) =>
    left.accountNumber.localeCompare(right.accountNumber),
  );
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
      db.select({ count: sql<number>`count(*)` }).from(schema.bcGlAccounts),
      db.select({ count: sql<number>`count(*)` }).from(schema.bcDimensionSets),
      db.select({ count: sql<number>`count(*)` }).from(schema.bcDimensionSetEntries),
      db.select({ count: sql<number>`count(*)` }).from(schema.bcRmiPostedRentalInvoiceHeaders),
      db.select({ count: sql<number>`count(*)` }).from(schema.bcRmiPostedRentalHeaders),
      db.select({ count: sql<number>`count(*)` }).from(schema.bcRmiPostedRentalLines),
      db.select({ count: sql<number>`count(*)` }).from(schema.bcRmiRentalLedgerEntries),
      db.select({ count: sql<number>`count(*)` }).from(schema.bcRmiWsRentalLedgerEntries),
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
      bcGlAccounts: counts[9][0]?.count ?? 0,
      bcDimensionSets: counts[10][0]?.count ?? 0,
      bcDimensionSetEntries: counts[11][0]?.count ?? 0,
      bcRmiPostedRentalInvoiceHeaders: counts[12][0]?.count ?? 0,
      bcRmiPostedRentalHeaders: counts[13][0]?.count ?? 0,
      bcRmiPostedRentalLines: counts[14][0]?.count ?? 0,
      bcRmiRentalLedgerEntries: counts[15][0]?.count ?? 0,
      bcRmiWsRentalLedgerEntries: counts[16][0]?.count ?? 0,
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
  const rmiInvoiceHeaders = await db
    .select({
      id: schema.bcRmiPostedRentalInvoiceHeaders.id,
      documentType: schema.bcRmiPostedRentalInvoiceHeaders.documentType,
      documentNo: schema.bcRmiPostedRentalInvoiceHeaders.documentNo,
      previousDocType: schema.bcRmiPostedRentalInvoiceHeaders.previousDocType,
      previousNo: schema.bcRmiPostedRentalInvoiceHeaders.previousNo,
      sellToCustomerNo: schema.bcRmiPostedRentalInvoiceHeaders.sellToCustomerNo,
      billToCustomerNo: schema.bcRmiPostedRentalInvoiceHeaders.billToCustomerNo,
      postingDate: schema.bcRmiPostedRentalInvoiceHeaders.postingDate,
      documentDate: schema.bcRmiPostedRentalInvoiceHeaders.documentDate,
      dueDate: schema.bcRmiPostedRentalInvoiceHeaders.dueDate,
      sourcePayload: schema.bcRmiPostedRentalInvoiceHeaders.sourcePayload,
      importedAt: schema.bcRmiPostedRentalInvoiceHeaders.importedAt,
    })
    .from(schema.bcRmiPostedRentalInvoiceHeaders)
    .orderBy(desc(schema.bcRmiPostedRentalInvoiceHeaders.postingDate))
    .limit(500);

  const docIds = docs.map((doc) => doc.id);
  const rmiDocumentNos = rmiInvoiceHeaders.map((doc) => doc.documentNo);
  const [lines, linkedContracts, linkedInvoices, rmiLineRows] = await Promise.all([
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
    rmiDocumentNos.length === 0
      ? Promise.resolve([] as Array<{ documentNo: string | null; count: number }>)
      : db
          .select({
            documentNo: schema.bcRmiPostedRentalLines.documentNo,
            count: sql<number>`count(*)`,
          })
          .from(schema.bcRmiPostedRentalLines)
          .where(inArray(schema.bcRmiPostedRentalLines.documentNo, rmiDocumentNos))
          .groupBy(schema.bcRmiPostedRentalLines.documentNo),
  ]);

  const lineCountByDocument = new Map(lines.map((row) => [row.sourceDocumentId, Number(row.count)]));
  const rmiLineCountByDocumentNo = new Map<string, number>();
  for (const row of rmiLineRows) {
    if (row.documentNo) {
      rmiLineCountByDocumentNo.set(row.documentNo, Number(row.count));
    }
  }

  const indexedDocs = docs.map((doc) => ({
    ...doc,
    documentDate: toIso(doc.documentDate),
    dueDate: toIso(doc.dueDate),
    importedAt: toIso(doc.importedAt),
    lineCount: lineCountByDocument.get(doc.id) ?? 0,
    customerName:
      (doc.payload &&
      typeof doc.payload === "object" &&
      (typeof doc.payload.customerName === "string"
        ? doc.payload.customerName
        : typeof doc.payload.sellToCustomerName === "string"
          ? doc.payload.sellToCustomerName
          : typeof doc.payload.name === "string"
            ? doc.payload.name
            : null)) ??
      null,
    totalAmount:
      (doc.payload &&
      typeof doc.payload === "object" &&
      (typeof doc.payload.totalAmount === "number"
        ? doc.payload.totalAmount
        : typeof doc.payload.amountIncludingVat === "number"
          ? doc.payload.amountIncludingVat
          : typeof doc.payload.amount === "number"
            ? doc.payload.amount
            : null)) ??
      null,
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

  const rawRmiDocs = rmiInvoiceHeaders.map((doc) => {
    const payload = doc.sourcePayload as Record<string, unknown>;
    return {
      id: doc.id,
      runId: null,
      externalDocumentId: doc.documentNo,
      documentType: doc.documentType,
      documentNo: doc.documentNo,
      customerExternalId: doc.billToCustomerNo ?? doc.sellToCustomerNo,
      status: "posted",
      documentDate: toIso(doc.documentDate) ?? toIso(doc.postingDate),
      dueDate: toIso(doc.dueDate),
      payload,
      importedAt: toIso(doc.importedAt),
      lineCount: rmiLineCountByDocumentNo.get(doc.documentNo) ?? 0,
      customerName:
        payloadText(payload, ["BilltoName", "SelltoCustomerName", "Name"]) ??
        doc.billToCustomerNo ??
        doc.sellToCustomerNo ??
        "Unknown",
      totalAmount: payloadAmount(payload, ["AmountIncludingVAT", "Amount", "TotalAmount"]),
      linkedContracts: linkedContracts.filter(
        (contract) =>
          contract.sourceDocumentNo === doc.documentNo ||
          contract.sourceDocumentNo === doc.previousNo,
      ),
      linkedInvoices: linkedInvoices.filter(
        (invoice) =>
          invoice.sourceDocumentNo === doc.documentNo ||
          invoice.sourceDocumentNo === doc.previousNo,
      ),
      previousDocumentType: doc.previousDocType,
      previousDocumentNo: doc.previousNo,
      sourceKind: "rmi_posted_rental_invoice",
    };
  });

  const seen = new Set<string>();
  return [...rawRmiDocs, ...indexedDocs]
    .filter((doc) => {
      const key = `${doc.documentType}:${doc.documentNo}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .sort(
      (left, right) =>
        timestampForSort(right.documentDate ?? right.importedAt) -
        timestampForSort(left.documentDate ?? left.importedAt),
    )
    .slice(0, 700);
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
