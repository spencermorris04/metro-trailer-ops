import { eq } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import { ApiError } from "@/lib/server/api";
import { appendAuditEvent } from "@/lib/server/audit";
import {
  getActorFromHeaders,
  type ResolvedActor,
} from "@/lib/server/authorization";
import { listDocuments, listSignatureRequests } from "@/lib/server/esign";
import {
  getPortalOverview,
  listCustomers,
  listInspections,
} from "@/lib/server/platform";
import { isDemoRuntime } from "@/lib/server/runtime";

function requireRecord<T>(value: T | undefined | null, message: string) {
  if (!value) {
    throw new ApiError(404, message);
  }

  return value;
}

async function logPortalActivity(
  customerId: string,
  eventType: string,
  metadata: Record<string, unknown> = {},
) {
  await appendAuditEvent({
    entityType: "customer",
    entityId: customerId,
    eventType,
    metadata: {
      portalActivity: true,
      ...metadata,
    },
  });

  await db
    .update(schema.collectionCases)
    .set({
      latestPortalActivityAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(schema.collectionCases.customerId, customerId));
}

type PortalAccountContext = {
  actor: ResolvedActor;
  customerId: string;
  customerNumber: string;
  customerName: string;
  locationIds: string[];
};

async function buildPortalAccountContext(
  actor: ResolvedActor,
): Promise<PortalAccountContext> {
  if (actor.kind !== "portal" || !actor.customerId || !actor.portalAccountId) {
    throw new ApiError(403, "A customer portal account is required.");
  }

  const portalAccount = requireRecord(
    await db.query.portalAccounts.findFirst({
      where: (table, operators) => operators.eq(table.id, actor.portalAccountId as string),
    }),
    "Portal account not found.",
  );

  if (!portalAccount.active) {
    throw new ApiError(403, "This portal account is inactive.");
  }

  const customer = requireRecord(
    (await listCustomers()).find((entry) => entry.id === portalAccount.customerId),
    `Customer ${portalAccount.customerId} not found.`,
  );

  return {
    actor,
    customerId: customer.id,
    customerNumber: customer.customerNumber,
    customerName: customer.name,
    locationIds: portalAccount.locationIds ?? [],
  };
}

function filterPortalOverviewByLocations<T extends {
  customer: {
    locations: Array<{
      id: string;
      name: string;
    }>;
  };
  contracts: Array<{
    contractNumber: string;
    locationName: string;
  }>;
  invoices: Array<{
    contractNumber: string;
    invoiceNumber: string;
  }>;
  paymentHistory: Array<{
    invoiceNumber: string | null;
  }>;
  inspections: Array<{
    contractNumber: string;
    customerSite: string;
  }>;
  documents: Array<{
    contractNumber: string;
  }>;
  signatureRequests: Array<{
    contractNumber: string;
  }>;
}>(overview: T, locationIds: string[]) {
  if (locationIds.length === 0) {
    return overview;
  }

  const locationNames = new Set(
    overview.customer.locations
      .filter((location) => locationIds.includes(location.id))
      .map((location) => location.name),
  );

  if (locationNames.size === 0) {
    return {
      ...overview,
      contracts: [],
      invoices: [],
      paymentHistory: [],
      inspections: [],
      documents: [],
      signatureRequests: [],
    };
  }

  const contracts = overview.contracts.filter((contract) =>
    locationNames.has(contract.locationName),
  );
  const contractNumbers = new Set(contracts.map((contract) => contract.contractNumber));
  const invoices = overview.invoices.filter((invoice) =>
    contractNumbers.has(invoice.contractNumber),
  );
  const invoiceNumbers = new Set(invoices.map((invoice) => invoice.invoiceNumber));

  return {
    ...overview,
    contracts,
    invoices,
    paymentHistory: overview.paymentHistory.filter(
      (payment) =>
        payment.invoiceNumber === null || invoiceNumbers.has(payment.invoiceNumber),
    ),
    inspections: overview.inspections.filter(
      (inspection) =>
        contractNumbers.has(inspection.contractNumber) ||
        locationNames.has(inspection.customerSite),
    ),
    documents: overview.documents.filter((document) =>
      contractNumbers.has(document.contractNumber),
    ),
    signatureRequests: overview.signatureRequests.filter((request) =>
      contractNumbers.has(request.contractNumber),
    ),
  };
}

export async function getPortalOverviewForCustomer(
  customerIdentifier: string,
  locationIds: string[] = [],
) {
  const overview = await getPortalOverview(customerIdentifier);
  const contractNumbers = new Set(overview.contracts.map((contract) => contract.contractNumber));
  const [documents, signatureRequests, inspections] = await Promise.all([
    listDocuments(),
    listSignatureRequests(),
    listInspections(),
  ]);

  const merged = {
    ...overview,
    documents: documents.filter((document) =>
      contractNumbers.has(document.contractNumber),
    ),
    signatureRequests: signatureRequests.filter((request) =>
      contractNumbers.has(request.contractNumber),
    ),
    inspections: inspections.filter((inspection) =>
      contractNumbers.has(inspection.contractNumber),
    ),
  };
  const filtered = filterPortalOverviewByLocations(merged, locationIds);

  return {
    ...filtered,
    downloadableDocuments: filtered.documents.map((document) => ({
      id: document.id,
      filename: document.filename,
      documentType: document.documentType,
      status: document.status,
    })),
    payableInvoices: filtered.invoices.filter(
      (invoice) =>
        !["draft", "voided", "paid"].includes(invoice.status) &&
        invoice.balanceAmount > 0,
    ),
    latestPaymentFailures: filtered.paymentHistory
      .filter((payment) => payment.status === "failed")
      .slice(0, 5),
  };
}

export async function getPortalContextFromHeaders(inputHeaders: Headers) {
  const actor = await getActorFromHeaders(inputHeaders);
  if (!actor) {
    return null;
  }

  if (actor.kind === "portal") {
    return buildPortalAccountContext(actor);
  }

  if (isDemoRuntime() && actor.kind === "system") {
    const customer = (await listCustomers()).find((entry) => entry.portalEnabled);
    if (!customer) {
      return null;
    }

    return {
      actor,
      customerId: customer.id,
      customerNumber: customer.customerNumber,
      customerName: customer.name,
      locationIds: [],
    } satisfies PortalAccountContext;
  }

  return null;
}

export async function requirePortalContextFromHeaders(inputHeaders: Headers) {
  const context = await getPortalContextFromHeaders(inputHeaders);
  if (!context) {
    throw new ApiError(401, "Portal authentication is required.");
  }

  return context;
}

export async function getPortalCustomerNumberFromHeaders(inputHeaders: Headers) {
  const context = await requirePortalContextFromHeaders(inputHeaders);
  return context.customerNumber;
}

export async function getCurrentPortalOverview(inputHeaders: Headers) {
  const context = await requirePortalContextFromHeaders(inputHeaders);
  await logPortalActivity(context.customerId, "portal_viewed", {
    locationIds: context.locationIds,
  });
  const overview = await getPortalOverviewForCustomer(context.customerId, context.locationIds);

  return {
    ...overview,
    portalPermissions: ["portal.view", "portal.pay", "documents.view"],
  };
}

export async function logPortalDocumentDownload(customerId: string, documentId: string) {
  await logPortalActivity(customerId, "portal_document_downloaded", {
    documentId,
  });
}

export async function logPortalSignatureViewed(customerId: string, signatureRequestId: string) {
  await logPortalActivity(customerId, "portal_signature_viewed", {
    signatureRequestId,
  });
}

export async function logPortalPaymentAttempt(
  customerId: string,
  invoiceId: string,
  outcome: "attempted" | "succeeded" | "failed",
  metadata: Record<string, unknown> = {},
) {
  await logPortalActivity(customerId, `portal_payment_${outcome}`, {
    invoiceId,
    ...metadata,
  });
}

export async function listPortalAccessLogs(customerIdentifier: string) {
  const customer = requireRecord(
    (await listCustomers()).find(
      (entry) => entry.id === customerIdentifier || entry.customerNumber === customerIdentifier,
    ),
    `Customer ${customerIdentifier} not found.`,
  );

  const rows = await db.query.auditEvents.findMany({
    where: (table, operators) =>
      operators.and(
        operators.eq(table.entityType, "customer"),
        operators.eq(table.entityId, customer.id),
      ),
    orderBy: (table, operators) => [operators.desc(table.createdAt)],
    limit: 100,
  });

  return rows
    .filter((row) => Boolean((row.metadata as Record<string, unknown> | null)?.portalActivity))
    .map((row) => ({
      id: row.id,
      eventType: row.eventType,
      metadata: row.metadata ?? {},
      createdAt: row.createdAt.toISOString(),
    }));
}
