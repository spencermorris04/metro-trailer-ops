import { db } from "@/lib/db";
import { ApiError } from "@/lib/server/api";
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

  return filterPortalOverviewByLocations(merged, locationIds);
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
  return getPortalOverviewForCustomer(context.customerId, context.locationIds);
}
