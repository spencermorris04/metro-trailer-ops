import type { AnyColumn, SQL } from "drizzle-orm";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import {
  buildRouteSearchResults,
  groupSearchResults,
  rankGlobalSearchResult,
  type GlobalSearchGroup,
  type GlobalSearchResult,
} from "@/lib/search-core";

type SearchOptions = {
  query: string;
  store?: string | null;
};

function likePattern(value: string) {
  return `%${value.trim().replace(/[%_]/g, "\\$&")}%`;
}

function payloadText(value: AnyColumn | SQL) {
  return sql<string>`coalesce(${value}::text, '')`;
}

function branchScope(store: string | null | undefined) {
  if (!store || store === "all") {
    return undefined;
  }

  const pattern = likePattern(store);
  return or(
    eq(schema.branches.id, store),
    ilike(schema.branches.code, pattern),
    ilike(schema.branches.name, pattern),
  );
}

function customerBranchScope(store: string | null | undefined) {
  if (!store || store === "all") {
    return undefined;
  }

  return ilike(payloadText(schema.customers.branchCoverage), likePattern(store));
}

function sourceDocumentStoreScope(store: string | null | undefined) {
  if (!store || store === "all") {
    return undefined;
  }

  return ilike(payloadText(schema.bcSourceDocuments.payload), likePattern(store));
}

function compactSubtitle(parts: Array<string | null | undefined>) {
  return parts.filter(Boolean).join(" / ");
}

function withScore(
  query: string,
  result: Omit<GlobalSearchResult, "score">,
  values: Array<string | null | undefined>,
) {
  return {
    ...result,
    score: rankGlobalSearchResult(query, [result.title, result.subtitle, ...values]),
  };
}

async function searchAssets(query: string, store?: string | null) {
  const pattern = likePattern(query);
  const clauses: SQL[] = [
    or(
      ilike(schema.assets.assetNumber, pattern),
      ilike(sql`coalesce(${schema.assets.serialNumber}, '')`, pattern),
      ilike(sql`coalesce(${schema.assets.registrationNumber}, '')`, pattern),
      ilike(sql`coalesce(${schema.assets.bcProductNo}, '')`, pattern),
      ilike(sql`coalesce(${schema.assets.bcServiceItemNo}, '')`, pattern),
      ilike(sql`coalesce(${schema.assets.gpsDeviceId}, '')`, pattern),
      ilike(payloadText(schema.assets.sourcePayload), pattern),
    )!,
  ];
  const scoped = branchScope(store);
  if (scoped) {
    clauses.push(scoped);
  }

  const rows = await db
    .select({
      id: schema.assets.id,
      assetNumber: schema.assets.assetNumber,
      type: schema.assets.type,
      status: schema.assets.status,
      serialNumber: schema.assets.serialNumber,
      registrationNumber: schema.assets.registrationNumber,
      branchCode: schema.branches.code,
      branchName: schema.branches.name,
    })
    .from(schema.assets)
    .innerJoin(schema.branches, eq(schema.assets.branchId, schema.branches.id))
    .where(and(...clauses))
    .limit(8);

  return rows.map((row) =>
    withScore(
      query,
      {
        id: `asset:${row.id}`,
        type: "Asset",
        title: row.assetNumber,
        subtitle: compactSubtitle([
          row.branchCode,
          row.type,
          row.serialNumber ? `SN ${row.serialNumber}` : null,
          row.registrationNumber ? `Reg ${row.registrationNumber}` : null,
        ]),
        href: `/assets/${row.id}`,
        badge: row.status,
        source: "assets",
      },
      [row.serialNumber, row.registrationNumber, row.branchName],
    ),
  );
}

async function searchCustomers(query: string, store?: string | null) {
  const pattern = likePattern(query);
  const clauses: SQL[] = [
    or(
      ilike(schema.customers.customerNumber, pattern),
      ilike(schema.customers.name, pattern),
      ilike(payloadText(schema.customers.contactInfo), pattern),
      ilike(payloadText(schema.customers.billingAddress), pattern),
      ilike(payloadText(schema.customers.sourcePayload), pattern),
    )!,
  ];
  const scoped = customerBranchScope(store);
  if (scoped) {
    clauses.push(scoped);
  }

  const rows = await db
    .select({
      id: schema.customers.id,
      customerNumber: schema.customers.customerNumber,
      name: schema.customers.name,
      customerType: schema.customers.customerType,
      branchCoverage: schema.customers.branchCoverage,
    })
    .from(schema.customers)
    .where(and(...clauses))
    .limit(8);

  return rows.map((row) =>
    withScore(
      query,
      {
        id: `customer:${row.id}`,
        type: "Customer",
        title: row.name,
        subtitle: compactSubtitle([row.customerNumber, row.branchCoverage.join(", ")]),
        href: `/customers/${row.id}`,
        badge: row.customerType,
        source: "customers",
      },
      [row.customerNumber, ...row.branchCoverage],
    ),
  );
}

async function searchContracts(query: string, store?: string | null) {
  const pattern = likePattern(query);
  const clauses: SQL[] = [
    or(
      ilike(schema.contracts.contractNumber, pattern),
      ilike(schema.customers.name, pattern),
      ilike(schema.customers.customerNumber, pattern),
      ilike(sql`coalesce(${schema.contracts.sourceDocumentNo}, '')`, pattern),
      ilike(payloadText(schema.contracts.sourceSnapshot), pattern),
    )!,
  ];
  const scoped = branchScope(store);
  if (scoped) {
    clauses.push(scoped);
  }

  const rows = await db
    .select({
      id: schema.contracts.id,
      contractNumber: schema.contracts.contractNumber,
      status: schema.contracts.status,
      sourceDocumentNo: schema.contracts.sourceDocumentNo,
      customerName: schema.customers.name,
      branchCode: schema.branches.code,
    })
    .from(schema.contracts)
    .innerJoin(schema.customers, eq(schema.contracts.customerId, schema.customers.id))
    .innerJoin(schema.branches, eq(schema.contracts.branchId, schema.branches.id))
    .where(and(...clauses))
    .limit(8);

  return rows.map((row) =>
    withScore(
      query,
      {
        id: `contract:${row.id}`,
        type: "Contract",
        title: row.contractNumber,
        subtitle: compactSubtitle([row.customerName, row.branchCode, row.sourceDocumentNo]),
        href: `/contracts/${row.id}`,
        badge: row.status,
        source: "contracts",
      },
      [row.customerName, row.sourceDocumentNo],
    ),
  );
}

async function searchInvoices(query: string, store?: string | null) {
  const pattern = likePattern(query);
  const clauses: SQL[] = [
    or(
      ilike(schema.invoices.invoiceNumber, pattern),
      ilike(schema.customers.name, pattern),
      ilike(schema.customers.customerNumber, pattern),
      ilike(sql`coalesce(${schema.invoices.sourceDocumentNo}, '')`, pattern),
      ilike(payloadText(schema.invoices.sourceSnapshot), pattern),
    )!,
  ];
  const scoped = branchScope(store);
  if (scoped) {
    clauses.push(scoped);
  }

  const rows = await db
    .select({
      id: schema.invoices.id,
      invoiceNumber: schema.invoices.invoiceNumber,
      status: schema.invoices.status,
      customerName: schema.customers.name,
      contractNumber: schema.contracts.contractNumber,
      branchCode: schema.branches.code,
    })
    .from(schema.invoices)
    .innerJoin(schema.customers, eq(schema.invoices.customerId, schema.customers.id))
    .leftJoin(schema.contracts, eq(schema.invoices.contractId, schema.contracts.id))
    .leftJoin(schema.branches, eq(schema.contracts.branchId, schema.branches.id))
    .where(and(...clauses))
    .limit(8);

  return rows.map((row) =>
    withScore(
      query,
      {
        id: `invoice:${row.id}`,
        type: "Invoice",
        title: row.invoiceNumber,
        subtitle: compactSubtitle([row.customerName, row.contractNumber, row.branchCode]),
        href: `/ar/invoices?q=${encodeURIComponent(row.invoiceNumber)}`,
        badge: row.status,
        source: "invoices",
      },
      [row.customerName, row.contractNumber],
    ),
  );
}

async function searchWorkOrders(query: string, store?: string | null) {
  const pattern = likePattern(query);
  const clauses: SQL[] = [
    or(
      ilike(schema.workOrders.id, pattern),
      ilike(schema.workOrders.title, pattern),
      ilike(sql`coalesce(${schema.workOrders.description}, '')`, pattern),
      ilike(sql`coalesce(${schema.workOrders.symptomSummary}, '')`, pattern),
      ilike(schema.assets.assetNumber, pattern),
      ilike(sql`coalesce(${schema.assets.serialNumber}, '')`, pattern),
    )!,
  ];
  const scoped = branchScope(store);
  if (scoped) {
    clauses.push(scoped);
  }

  const rows = await db
    .select({
      id: schema.workOrders.id,
      title: schema.workOrders.title,
      status: schema.workOrders.status,
      assetNumber: schema.assets.assetNumber,
      branchCode: schema.branches.code,
    })
    .from(schema.workOrders)
    .innerJoin(schema.assets, eq(schema.workOrders.assetId, schema.assets.id))
    .innerJoin(schema.branches, eq(schema.workOrders.branchId, schema.branches.id))
    .where(and(...clauses))
    .limit(8);

  return rows.map((row) =>
    withScore(
      query,
      {
        id: `work-order:${row.id}`,
        type: "Work Order",
        title: row.title,
        subtitle: compactSubtitle([row.assetNumber, row.branchCode, row.id]),
        href: "/maintenance",
        badge: row.status,
        source: "work_orders",
      },
      [row.assetNumber, row.id],
    ),
  );
}

async function searchInspections(query: string, store?: string | null) {
  const pattern = likePattern(query);
  const clauses: SQL[] = [
    or(
      ilike(schema.inspections.id, pattern),
      ilike(sql`coalesce(${schema.inspections.externalInspectionId}, '')`, pattern),
      ilike(sql`coalesce(${schema.inspections.externalUnitId}, '')`, pattern),
      ilike(sql`coalesce(${schema.inspections.resultSummary}, '')`, pattern),
      ilike(payloadText(schema.inspections.record360Payload), pattern),
      ilike(schema.assets.assetNumber, pattern),
      ilike(sql`coalesce(${schema.assets.serialNumber}, '')`, pattern),
    )!,
  ];
  const scoped = branchScope(store);
  if (scoped) {
    clauses.push(scoped);
  }

  const rows = await db
    .select({
      id: schema.inspections.id,
      inspectionType: schema.inspections.inspectionType,
      status: schema.inspections.status,
      externalInspectionId: schema.inspections.externalInspectionId,
      assetNumber: schema.assets.assetNumber,
      branchCode: schema.branches.code,
    })
    .from(schema.inspections)
    .innerJoin(schema.assets, eq(schema.inspections.assetId, schema.assets.id))
    .innerJoin(schema.branches, eq(schema.assets.branchId, schema.branches.id))
    .where(and(...clauses))
    .limit(8);

  return rows.map((row) =>
    withScore(
      query,
      {
        id: `inspection:${row.id}`,
        type: "Inspection",
        title: `${row.assetNumber} ${row.inspectionType}`,
        subtitle: compactSubtitle([row.externalInspectionId, row.branchCode, row.id]),
        href: "/inspections",
        badge: row.status,
        source: "inspections",
      },
      [row.externalInspectionId, row.id],
    ),
  );
}

async function searchSourceDocuments(query: string, store?: string | null) {
  const pattern = likePattern(query);
  const clauses: SQL[] = [
    or(
      ilike(schema.bcSourceDocuments.documentNo, pattern),
      ilike(schema.bcSourceDocuments.externalDocumentId, pattern),
      ilike(sql`coalesce(${schema.bcSourceDocuments.customerExternalId}, '')`, pattern),
      ilike(payloadText(schema.bcSourceDocuments.payload), pattern),
    )!,
  ];
  const scoped = sourceDocumentStoreScope(store);
  if (scoped) {
    clauses.push(scoped);
  }

  const rows = await db
    .select({
      id: schema.bcSourceDocuments.id,
      documentType: schema.bcSourceDocuments.documentType,
      documentNo: schema.bcSourceDocuments.documentNo,
      status: schema.bcSourceDocuments.status,
      customerExternalId: schema.bcSourceDocuments.customerExternalId,
    })
    .from(schema.bcSourceDocuments)
    .where(and(...clauses))
    .orderBy(desc(schema.bcSourceDocuments.importedAt))
    .limit(8);

  return rows.map((row) =>
    withScore(
      query,
      {
        id: `bc-source:${row.id}`,
        type: "BC Source",
        title: row.documentNo,
        subtitle: compactSubtitle([row.documentType, row.customerExternalId]),
        href: "/source-documents",
        badge: row.status ?? "Imported",
        source: "business_central",
      },
      [row.customerExternalId, row.documentType],
    ),
  );
}

async function searchLedgerKeys(query: string) {
  const pattern = likePattern(query);
  const [gl, customer, vendor, bank, fa] = await Promise.all([
    db
      .select({
        id: schema.bcGlEntries.id,
        externalEntryNo: schema.bcGlEntries.externalEntryNo,
        documentNo: schema.bcGlEntries.documentNo,
        accountNo: schema.bcGlEntries.accountNo,
        description: schema.bcGlEntries.description,
      })
      .from(schema.bcGlEntries)
      .where(
        or(
          ilike(schema.bcGlEntries.externalEntryNo, pattern),
          ilike(sql`coalesce(${schema.bcGlEntries.documentNo}, '')`, pattern),
          ilike(sql`coalesce(${schema.bcGlEntries.accountNo}, '')`, pattern),
          ilike(sql`coalesce(${schema.bcGlEntries.description}, '')`, pattern),
        ),
      )
      .limit(4),
    db
      .select({
        id: schema.bcCustomerLedgerEntries.id,
        externalEntryNo: schema.bcCustomerLedgerEntries.externalEntryNo,
        documentNo: schema.bcCustomerLedgerEntries.documentNo,
        customerNo: schema.bcCustomerLedgerEntries.customerNo,
      })
      .from(schema.bcCustomerLedgerEntries)
      .where(
        or(
          ilike(schema.bcCustomerLedgerEntries.externalEntryNo, pattern),
          ilike(sql`coalesce(${schema.bcCustomerLedgerEntries.documentNo}, '')`, pattern),
          ilike(sql`coalesce(${schema.bcCustomerLedgerEntries.customerNo}, '')`, pattern),
        ),
      )
      .limit(4),
    db
      .select({
        id: schema.bcVendorLedgerEntries.id,
        externalEntryNo: schema.bcVendorLedgerEntries.externalEntryNo,
        documentNo: schema.bcVendorLedgerEntries.documentNo,
        vendorNo: schema.bcVendorLedgerEntries.vendorNo,
      })
      .from(schema.bcVendorLedgerEntries)
      .where(
        or(
          ilike(schema.bcVendorLedgerEntries.externalEntryNo, pattern),
          ilike(sql`coalesce(${schema.bcVendorLedgerEntries.documentNo}, '')`, pattern),
          ilike(sql`coalesce(${schema.bcVendorLedgerEntries.vendorNo}, '')`, pattern),
        ),
      )
      .limit(4),
    db
      .select({
        id: schema.bcBankLedgerEntries.id,
        externalEntryNo: schema.bcBankLedgerEntries.externalEntryNo,
        documentNo: schema.bcBankLedgerEntries.documentNo,
        bankAccountNo: schema.bcBankLedgerEntries.bankAccountNo,
      })
      .from(schema.bcBankLedgerEntries)
      .where(
        or(
          ilike(schema.bcBankLedgerEntries.externalEntryNo, pattern),
          ilike(sql`coalesce(${schema.bcBankLedgerEntries.documentNo}, '')`, pattern),
          ilike(sql`coalesce(${schema.bcBankLedgerEntries.bankAccountNo}, '')`, pattern),
        ),
      )
      .limit(4),
    db
      .select({
        id: schema.bcFaLedgerEntries.id,
        externalEntryNo: schema.bcFaLedgerEntries.externalEntryNo,
        documentNo: schema.bcFaLedgerEntries.documentNo,
        assetNo: schema.bcFaLedgerEntries.assetNo,
      })
      .from(schema.bcFaLedgerEntries)
      .where(
        or(
          ilike(schema.bcFaLedgerEntries.externalEntryNo, pattern),
          ilike(sql`coalesce(${schema.bcFaLedgerEntries.documentNo}, '')`, pattern),
          ilike(sql`coalesce(${schema.bcFaLedgerEntries.assetNo}, '')`, pattern),
        ),
      )
      .limit(4),
  ]);

  return [
    ...gl.map((row) =>
      withScore(
        query,
        {
          id: `bc-gl:${row.id}`,
          type: "BC GL",
          title: row.documentNo ?? row.externalEntryNo,
          subtitle: compactSubtitle([row.accountNo, row.description, row.externalEntryNo]),
          href: "/gl/journal",
          badge: "GL",
          source: "business_central",
        },
        [row.accountNo, row.description, row.externalEntryNo],
      ),
    ),
    ...customer.map((row) =>
      withScore(
        query,
        {
          id: `bc-cust-ledger:${row.id}`,
          type: "BC Customer Ledger",
          title: row.documentNo ?? row.externalEntryNo,
          subtitle: compactSubtitle([row.customerNo, row.externalEntryNo]),
          href: "/source-documents",
          badge: "Customer ledger",
          source: "business_central",
        },
        [row.customerNo, row.externalEntryNo],
      ),
    ),
    ...vendor.map((row) =>
      withScore(
        query,
        {
          id: `bc-vendor-ledger:${row.id}`,
          type: "BC Vendor Ledger",
          title: row.documentNo ?? row.externalEntryNo,
          subtitle: compactSubtitle([row.vendorNo, row.externalEntryNo]),
          href: "/ap/bills",
          badge: "Vendor ledger",
          source: "business_central",
        },
        [row.vendorNo, row.externalEntryNo],
      ),
    ),
    ...bank.map((row) =>
      withScore(
        query,
        {
          id: `bc-bank-ledger:${row.id}`,
          type: "BC Bank Ledger",
          title: row.documentNo ?? row.externalEntryNo,
          subtitle: compactSubtitle([row.bankAccountNo, row.externalEntryNo]),
          href: "/cash",
          badge: "Bank ledger",
          source: "business_central",
        },
        [row.bankAccountNo, row.externalEntryNo],
      ),
    ),
    ...fa.map((row) =>
      withScore(
        query,
        {
          id: `bc-fa-ledger:${row.id}`,
          type: "BC FA Ledger",
          title: row.documentNo ?? row.externalEntryNo,
          subtitle: compactSubtitle([row.assetNo, row.externalEntryNo]),
          href: "/assets",
          badge: "FA ledger",
          source: "business_central",
        },
        [row.assetNo, row.externalEntryNo],
      ),
    ),
  ].slice(0, 10);
}

export async function searchWorkspace({ query, store }: SearchOptions) {
  const trimmed = query.trim();
  const pageResults = buildRouteSearchResults(trimmed);

  if (!trimmed) {
    return {
      query: trimmed,
      store: store ?? "all",
      groups: groupSearchResults([
        {
          id: "pages",
          label: "Pages",
          results: pageResults,
        },
      ]),
    };
  }

  const [
    assets,
    customers,
    contracts,
    invoices,
    workOrders,
    inspections,
    sourceDocuments,
    ledgerKeys,
  ] = await Promise.all([
    searchAssets(trimmed, store),
    searchCustomers(trimmed, store),
    searchContracts(trimmed, store),
    searchInvoices(trimmed, store),
    searchWorkOrders(trimmed, store),
    searchInspections(trimmed, store),
    searchSourceDocuments(trimmed, store),
    searchLedgerKeys(trimmed),
  ]);

  const groups: GlobalSearchGroup[] = groupSearchResults([
    { id: "pages", label: "Pages", results: pageResults },
    { id: "assets", label: "Fleet", results: assets },
    { id: "customers", label: "Customers", results: customers },
    { id: "commercial", label: "Contracts and Invoices", results: [...contracts, ...invoices] },
    { id: "service", label: "Service Work", results: [...workOrders, ...inspections] },
    { id: "business-central", label: "Business Central", results: sourceDocuments },
    { id: "ledger-keys", label: "Ledger Keys", results: ledgerKeys },
  ]);

  return {
    query: trimmed,
    store: store ?? "all",
    groups,
    resultCount: groups.reduce((sum, group) => sum + group.results.length, 0),
  };
}
