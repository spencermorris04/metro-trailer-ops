import { randomUUID } from "node:crypto";

import {
  canTransitionAsset,
  canTransitionContract,
} from "@/lib/domain/lifecycle";
import { titleize } from "@/lib/format";
import type {
  AssetRecord,
  AssetStatusKey,
  ContractRecord,
  ContractStatusKey,
  CustomerLocationRecord,
  CustomerRecord,
  DispatchTaskRecord,
  FinancialEventRecord,
  InvoiceRecord,
  WorkOrderRecord,
} from "@/lib/domain/models";
import type {
  AuditEventRecord,
  CollectionCaseRecord,
  FleetUtilizationRecord,
  InspectionRecord,
  IntegrationJobRecord,
  PlatformState,
  RevenueSeriesPoint,
  TelematicsRecord,
} from "@/lib/platform-types";
import { ApiError } from "@/lib/server/api";
import { getDemoStore } from "@/lib/server/demo-store";
import {
  buildCollectionsReminder,
  buildDocumentRecord,
  buildPaymentMethodRecord,
  buildQuickBooksInvoiceSync,
  buildQuickBooksPaymentSync,
  buildRecord360InspectionRequest,
  buildRevenueExport,
  buildSignatureRequest,
  buildSkyBitzSync,
  buildTelematicsRecoverySnapshot,
  createStripePaymentIntent,
  createStripePortalSession,
} from "@/lib/server/integration-clients";

type AddressInput = {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country?: string;
};

type ContactInput = {
  name: string;
  email?: string;
  phone?: string;
};

type CustomerLocationInput = {
  name: string;
  address: AddressInput;
  contactPerson: ContactInput;
};

type CreateAssetInput = {
  assetNumber: string;
  type: AssetRecord["type"];
  branchId: string;
  status?: AssetRecord["status"];
  availability?: AssetRecord["availability"];
  maintenanceStatus?: AssetRecord["maintenanceStatus"];
  gpsDeviceId?: string;
  dimensions?: string;
  ageInMonths?: number;
  features?: string[];
};

type UpdateAssetInput = Partial<CreateAssetInput>;

type CreateCustomerInput = {
  customerNumber: string;
  name: string;
  customerType: CustomerRecord["customerType"];
  contactInfo?: ContactInput;
  billingAddress: AddressInput;
  locations?: CustomerLocationInput[];
};

type UpdateCustomerInput = {
  name?: string;
  customerType?: CustomerRecord["customerType"];
  portalEnabled?: boolean;
  branchCoverage?: string[];
};

type ContractLineInput = {
  assetId?: string;
  description?: string;
  unitPrice: number;
  unit: string;
  quantity: number;
  startDate: Date;
  endDate?: Date | null;
  adjustments?: string[];
};

type CreateContractInput = {
  contractNumber: string;
  customerId: string;
  locationId: string;
  branchId: string;
  startDate: Date;
  endDate?: Date | null;
  status?: ContractRecord["status"];
  lines: ContractLineInput[];
};

type AmendContractInput = {
  amendmentType: string;
  notes?: string;
  extendedEndDate?: string;
  assetNumbersToAdd?: string[];
  assetNumbersToRemove?: string[];
};

type CreateFinancialEventInput = {
  contractId: string;
  eventType: FinancialEventRecord["eventType"];
  description: string;
  amount: number;
  eventDate: Date | string;
  status?: FinancialEventRecord["status"];
};

type CreateDispatchTaskInput = {
  type: string;
  status?: DispatchTaskRecord["status"];
  branch: string;
  assetNumber: string;
  customerSite: string;
  scheduledFor: string;
};

type DispatchConfirmationInput = {
  outcome: "delivery_confirmed" | "pickup_confirmed" | "swap_confirmed";
};

type CreateInspectionInput = {
  assetNumber: string;
  contractNumber: string;
  customerSite: string;
  inspectionType: string;
};

type InspectionCompletionInput = {
  status: "passed" | "failed" | "needs_review";
  damageSummary: string;
  photos?: string[];
};

type CreateWorkOrderInput = {
  title: string;
  assetNumber: string;
  branch: string;
  priority: string;
  source: string;
};

type AddPaymentMethodInput = {
  customerNumber: string;
  methodType: string;
  label: string;
  last4: string;
};

type UpdateCollectionCaseInput = Partial<
  Pick<CollectionCaseRecord, "status" | "promisedPaymentDate">
> & {
  note?: string;
};

type CreateDocumentInput = {
  contractNumber: string;
  customerName: string;
  documentType: string;
  filename: string;
};

type CreateSignatureRequestInput = {
  contractNumber: string;
  signers: string[];
};

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix: string) {
  return `${prefix}_${randomUUID().slice(0, 8)}`;
}

function getState() {
  return getDemoStore();
}

function resolveBranchName(state: PlatformState, branchIdOrName: string) {
  return (
    state.branches.find(
      (branch) =>
        branch.id === branchIdOrName ||
        branch.name === branchIdOrName ||
        branch.code === branchIdOrName,
    )?.name ?? branchIdOrName
  );
}

function findByIdOrNumber<T extends object, K extends keyof T>(
  records: T[],
  candidate: string,
  keys: K[],
) {
  return records.find((record) => {
    return keys.some((key) => {
      const value = record[key];
      return (
        (typeof value === "string" || typeof value === "number") &&
        String(value) === candidate
      );
    });
  });
}

function requireRecord<T>(value: T | undefined, message: string) {
  if (!value) {
    throw new ApiError(404, message);
  }

  return value;
}

function pushAudit(
  state: PlatformState,
  event: Omit<AuditEventRecord, "id" | "timestamp">,
) {
  const auditEvent: AuditEventRecord = {
    id: createId("audit"),
    timestamp: nowIso(),
    ...event,
  };

  state.auditEvents.unshift(auditEvent);
  return auditEvent;
}

function pushIntegrationJob(
  state: PlatformState,
  job: Omit<IntegrationJobRecord, "id">,
) {
  const integrationJob: IntegrationJobRecord = {
    id: createId("sync"),
    ...job,
  };

  state.integrationJobs.unshift(integrationJob);
  return integrationJob;
}

function getContractAssets(state: PlatformState, contract: ContractRecord) {
  return contract.assets
    .map((assetNumber) =>
      state.assets.find((asset) => asset.assetNumber === assetNumber),
    )
    .filter(Boolean) as AssetRecord[];
}

function setAssetAvailability(asset: AssetRecord, status: AssetStatusKey) {
  if (status === "available") {
    asset.availability = "rentable";
    if (asset.maintenanceStatus === "under_repair") {
      asset.maintenanceStatus = "clear";
    }
    return;
  }

  if (status === "reserved") {
    asset.availability = "limited";
    return;
  }

  if (status === "inspection_hold") {
    asset.availability = "limited";
    asset.maintenanceStatus = "inspection_required";
    return;
  }

  asset.availability = "unavailable";
}

function getOrCreateCollectionCase(
  state: PlatformState,
  invoice: InvoiceRecord,
  customerName: string,
) {
  const existing = state.collectionCases.find(
    (caseRecord) => caseRecord.invoiceNumber === invoice.invoiceNumber,
  );

  if (existing) {
    return existing;
  }

  const collectionCase: CollectionCaseRecord = {
    id: createId("cc"),
    customerName,
    invoiceNumber: invoice.invoiceNumber,
    status: "current",
    owner: "Morgan Lee",
    balanceAmount: invoice.balanceAmount,
    lastContactAt: null,
    promisedPaymentDate: null,
    notes: [],
  };

  state.collectionCases.unshift(collectionCase);
  return collectionCase;
}

function getCustomerByContract(state: PlatformState, contract: ContractRecord) {
  return requireRecord(
    state.customers.find((customer) => customer.name === contract.customerName),
    `Customer ${contract.customerName} not found.`,
  );
}

function getContractById(state: PlatformState, contractId: string) {
  return requireRecord(
    findByIdOrNumber(state.contracts, contractId, ["id", "contractNumber"]),
    `Contract ${contractId} not found.`,
  );
}

function getAssetById(state: PlatformState, assetId: string) {
  return requireRecord(
    findByIdOrNumber(state.assets, assetId, ["id", "assetNumber"]),
    `Asset ${assetId} not found.`,
  );
}

function getCustomerById(state: PlatformState, customerId: string) {
  return requireRecord(
    findByIdOrNumber(state.customers, customerId, ["id", "customerNumber", "name"]),
    `Customer ${customerId} not found.`,
  );
}

function getInvoiceById(state: PlatformState, invoiceId: string) {
  return requireRecord(
    findByIdOrNumber(state.invoices, invoiceId, ["id", "invoiceNumber"]),
    `Invoice ${invoiceId} not found.`,
  );
}

function getDispatchTaskById(state: PlatformState, taskId: string) {
  return requireRecord(
    findByIdOrNumber(state.dispatchTasks, taskId, ["id"]),
    `Dispatch task ${taskId} not found.`,
  );
}

function getInspectionById(state: PlatformState, inspectionId: string) {
  return requireRecord(
    findByIdOrNumber(state.inspections, inspectionId, ["id"]),
    `Inspection ${inspectionId} not found.`,
  );
}

function getWorkOrderById(state: PlatformState, workOrderId: string) {
  return requireRecord(
    findByIdOrNumber(state.workOrders, workOrderId, ["id"]),
    `Work order ${workOrderId} not found.`,
  );
}

function getDocumentById(state: PlatformState, documentId: string) {
  return requireRecord(
    findByIdOrNumber(state.documents, documentId, ["id"]),
    `Document ${documentId} not found.`,
  );
}

function getSignatureRequestById(state: PlatformState, signatureRequestId: string) {
  return requireRecord(
    findByIdOrNumber(state.signatureRequests, signatureRequestId, ["id"]),
    `Signature request ${signatureRequestId} not found.`,
  );
}

function applyContractLifecycleEffects(
  state: PlatformState,
  contract: ContractRecord,
  toStatus: ContractStatusKey,
) {
  const assets = getContractAssets(state, contract);

  if (toStatus === "reserved") {
    assets.forEach((asset) => {
      asset.status = "reserved";
      setAssetAvailability(asset, "reserved");
    });
  }

  if (toStatus === "active") {
    assets.forEach((asset) => {
      asset.status = "on_rent";
      setAssetAvailability(asset, "on_rent");
    });
  }

  if (toStatus === "completed") {
    assets.forEach((asset) => {
      asset.status = "inspection_hold";
      setAssetAvailability(asset, "inspection_hold");
    });
  }

  if (toStatus === "closed" || toStatus === "cancelled") {
    assets.forEach((asset) => {
      if (asset.maintenanceStatus === "under_repair") {
        asset.status = "in_maintenance";
        setAssetAvailability(asset, "in_maintenance");
      } else {
        asset.status = "available";
        setAssetAvailability(asset, "available");
      }
    });
  }
}

export function getDashboardSummary() {
  const state = getState();

  return {
    runtimeMode: "demo",
    assets: state.assets.length,
    customers: state.customers.length,
    contracts: state.contracts.length,
    activeContracts: state.contracts.filter((contract) => contract.status === "active")
      .length,
    overdueInvoices: state.invoices.filter((invoice) => invoice.status === "overdue")
      .length,
    openWorkOrders: state.workOrders.filter((order) => order.status !== "completed")
      .length,
    pendingInspections: state.inspections.filter(
      (inspection) => inspection.status !== "passed",
    ).length,
  };
}

export function listBranches() {
  return getState().branches;
}

export function listUsers() {
  return getState().users;
}

export function listAssets(filters?: {
  q?: string;
  branch?: string;
  status?: string;
  availability?: string;
}) {
  const state = getState();

  return state.assets.filter((asset) => {
    if (filters?.q) {
      const q = filters.q.toLowerCase();
      const matches =
        asset.assetNumber.toLowerCase().includes(q) ||
        asset.type.toLowerCase().includes(q) ||
        asset.branch.toLowerCase().includes(q);

      if (!matches) {
        return false;
      }
    }

    if (filters?.branch && asset.branch !== filters.branch) {
      return false;
    }

    if (filters?.status && asset.status !== filters.status) {
      return false;
    }

    if (filters?.availability && asset.availability !== filters.availability) {
      return false;
    }

    return true;
  });
}

export function createAsset(
  payload: CreateAssetInput,
  userName = "System",
) {
  const state = getState();
  const branch = resolveBranchName(state, String(payload.branchId));

  const asset: AssetRecord = {
    id: createId("asset"),
    assetNumber: String(payload.assetNumber),
    type: String(payload.type) as AssetRecord["type"],
    dimensions: String(payload.dimensions ?? "Unspecified dimensions"),
    branch,
    status: String(payload.status ?? "available") as AssetRecord["status"],
    availability: String(payload.availability ?? "rentable") as AssetRecord["availability"],
    maintenanceStatus: String(payload.maintenanceStatus ?? "clear") as AssetRecord["maintenanceStatus"],
    gpsDeviceId: payload.gpsDeviceId ? String(payload.gpsDeviceId) : undefined,
    age:
      payload.ageInMonths !== undefined
        ? `${Number(payload.ageInMonths)} months`
        : "Unknown",
    features: Array.isArray(payload.features)
      ? payload.features.map((feature) => String(feature))
      : [],
  };

  state.assets.unshift(asset);
  pushAudit(state, {
    entityType: "asset",
    entityId: asset.assetNumber,
    eventType: "created",
    userName,
    metadata: {
      branch,
      status: asset.status,
    },
  });

  return asset;
}

export function updateAsset(
  assetId: string,
  payload: UpdateAssetInput,
  userName = "System",
) {
  const state = getState();
  const asset = getAssetById(state, assetId);

  if (payload.branchId) {
    asset.branch = resolveBranchName(state, String(payload.branchId));
  }
  if (payload.status) {
    asset.status = String(payload.status) as AssetRecord["status"];
  }
  if (payload.availability) {
    asset.availability = String(payload.availability) as AssetRecord["availability"];
  }
  if (payload.maintenanceStatus) {
    asset.maintenanceStatus = String(payload.maintenanceStatus) as AssetRecord["maintenanceStatus"];
  }
  if (payload.dimensions) {
    asset.dimensions = String(payload.dimensions);
  }
  if (payload.gpsDeviceId !== undefined) {
    asset.gpsDeviceId = payload.gpsDeviceId ? String(payload.gpsDeviceId) : undefined;
  }
  if (payload.features && Array.isArray(payload.features)) {
    asset.features = payload.features.map((feature) => String(feature));
  }

  pushAudit(state, {
    entityType: "asset",
    entityId: asset.assetNumber,
    eventType: "updated",
    userName,
    metadata: {
      status: asset.status,
      branch: asset.branch,
    },
  });

  return asset;
}

export function deleteAsset(assetId: string, userName = "System") {
  const state = getState();
  const index = state.assets.findIndex(
    (asset) => asset.id === assetId || asset.assetNumber === assetId,
  );

  if (index === -1) {
    throw new ApiError(404, `Asset ${assetId} not found.`);
  }

  const [asset] = state.assets.splice(index, 1);
  pushAudit(state, {
    entityType: "asset",
    entityId: asset.assetNumber,
    eventType: "deleted",
    userName,
    metadata: {
      branch: asset.branch,
    },
  });

  return asset;
}

export function transitionAsset(
  assetId: string,
  toStatus: AssetStatusKey,
  userName = "System",
  reason = "Manual lifecycle transition",
) {
  const state = getState();
  const asset = getAssetById(state, assetId);

  if (!canTransitionAsset(asset.status, toStatus as AssetRecord["status"])) {
    throw new ApiError(409, "Asset transition is not allowed.", {
      fromStatus: asset.status,
      toStatus,
    });
  }

  asset.status = toStatus as AssetRecord["status"];
  setAssetAvailability(asset, toStatus);

  pushAudit(state, {
    entityType: "asset",
    entityId: asset.assetNumber,
    eventType: "status_changed",
    userName,
    metadata: {
      toStatus,
      reason,
    },
  });

  return asset;
}

export function listCustomers(filters?: {
  q?: string;
  customerType?: string;
  portalEnabled?: string;
}) {
  const state = getState();

  return state.customers.filter((customer) => {
    if (filters?.q) {
      const q = filters.q.toLowerCase();
      const matches =
        customer.name.toLowerCase().includes(q) ||
        customer.customerNumber.toLowerCase().includes(q) ||
        customer.billingCity.toLowerCase().includes(q) ||
        customer.locations.some(
          (location) =>
            location.name.toLowerCase().includes(q) ||
            location.address.toLowerCase().includes(q),
        );

      if (!matches) {
        return false;
      }
    }

    if (filters?.customerType && customer.customerType !== filters.customerType) {
      return false;
    }

    if (filters?.portalEnabled) {
      const expectedValue = filters.portalEnabled === "true";
      if (customer.portalEnabled !== expectedValue) {
        return false;
      }
    }

    return true;
  });
}

export function createCustomer(
  payload: CreateCustomerInput,
  userName = "System",
) {
  const state = getState();
  const locations = (payload.locations ?? []).map((location) => {
    return {
      id: createId("loc"),
      name: location.name,
      address: `${location.address.line1}, ${location.address.city}, ${location.address.state}`,
      contactPerson: location.contactPerson.name,
    } satisfies CustomerLocationRecord;
  });

  const customer: CustomerRecord = {
    id: createId("customer"),
    customerNumber: payload.customerNumber,
    name: payload.name,
    customerType: payload.customerType,
    billingCity: payload.billingAddress.city,
    portalEnabled: false,
    branchCoverage: [],
    locations,
  };

  state.customers.unshift(customer);
  pushAudit(state, {
    entityType: "customer",
    entityId: customer.customerNumber,
    eventType: "created",
    userName,
    metadata: {
      customerType: customer.customerType,
    },
  });

  return customer;
}

export function updateCustomer(
  customerId: string,
  payload: UpdateCustomerInput,
  userName = "System",
) {
  const state = getState();
  const customer = getCustomerById(state, customerId);

  if (payload.name) {
    customer.name = payload.name;
  }
  if (payload.customerType) {
    customer.customerType = payload.customerType;
  }
  if (payload.portalEnabled !== undefined) {
    customer.portalEnabled = payload.portalEnabled;
  }
  if (payload.branchCoverage) {
    customer.branchCoverage = payload.branchCoverage;
  }

  pushAudit(state, {
    entityType: "customer",
    entityId: customer.customerNumber,
    eventType: "updated",
    userName,
    metadata: {
      portalEnabled: customer.portalEnabled,
    },
  });

  return customer;
}

export function deleteCustomer(customerId: string, userName = "System") {
  const state = getState();
  const index = state.customers.findIndex(
    (customer) =>
      customer.id === customerId ||
      customer.customerNumber === customerId ||
      customer.name === customerId,
  );

  if (index === -1) {
    throw new ApiError(404, `Customer ${customerId} not found.`);
  }

  const [customer] = state.customers.splice(index, 1);
  pushAudit(state, {
    entityType: "customer",
    entityId: customer.customerNumber,
    eventType: "deleted",
    userName,
    metadata: {
      name: customer.name,
    },
  });

  return customer;
}

export function listContracts(filters?: {
  q?: string;
  status?: string;
  branch?: string;
}) {
  const state = getState();

  return state.contracts.filter((contract) => {
    if (filters?.q) {
      const q = filters.q.toLowerCase();
      const matches =
        contract.contractNumber.toLowerCase().includes(q) ||
        contract.customerName.toLowerCase().includes(q) ||
        contract.locationName.toLowerCase().includes(q) ||
        contract.assets.some((asset) => asset.toLowerCase().includes(q));

      if (!matches) {
        return false;
      }
    }

    if (filters?.status && contract.status !== filters.status) {
      return false;
    }

    if (filters?.branch && contract.branch !== filters.branch) {
      return false;
    }

    return true;
  });
}

export function createContract(
  payload: CreateContractInput,
  userName = "System",
) {
  const state = getState();
  const customer = getCustomerById(state, payload.customerId);
  const location = customer.locations.find(
    (entry) => entry.id === payload.locationId || entry.name === payload.locationId,
  );

  if (!location) {
    throw new ApiError(404, "Customer location not found.");
  }

  const assets = payload.lines
    .map((line) => String(line.assetId ?? ""))
    .filter(Boolean)
    .map((assetId) => getAssetById(state, assetId).assetNumber);
  const value = payload.lines.reduce((sum, line) => {
    return sum + line.quantity * line.unitPrice;
  }, 0);
  const branch = resolveBranchName(state, payload.branchId);
  const status = payload.status ?? "quoted";

  const contract: ContractRecord = {
    id: createId("contract"),
    contractNumber: payload.contractNumber,
    customerName: customer.name,
    locationName: location.name,
    branch,
    status,
    startDate: payload.startDate.toISOString(),
    endDate: payload.endDate ? payload.endDate.toISOString() : null,
    assets,
    value,
    amendmentFlags: [],
  };

  state.contracts.unshift(contract);
  applyContractLifecycleEffects(state, contract, status);

  pushAudit(state, {
    entityType: "contract",
    entityId: contract.contractNumber,
    eventType: "created",
    userName,
    metadata: {
      status,
      branch,
    },
  });

  return contract;
}

export function transitionContract(
  contractId: string,
  toStatus: ContractStatusKey,
  userName = "System",
  reason = "Manual contract lifecycle transition",
) {
  const state = getState();
  const contract = getContractById(state, contractId);

  if (!canTransitionContract(contract.status, toStatus as ContractRecord["status"])) {
    throw new ApiError(409, "Contract transition is not allowed.", {
      fromStatus: contract.status,
      toStatus,
    });
  }

  contract.status = toStatus as ContractRecord["status"];
  applyContractLifecycleEffects(state, contract, toStatus);

  if (toStatus === "reserved") {
    contract.amendmentFlags = Array.from(
      new Set([...contract.amendmentFlags, "dispatch_ready"]),
    );
  }
  if (toStatus === "active") {
    contract.amendmentFlags = Array.from(
      new Set([...contract.amendmentFlags, "inspection_synced"]),
    );
  }

  pushAudit(state, {
    entityType: "contract",
    entityId: contract.contractNumber,
    eventType: "status_changed",
    userName,
    metadata: {
      toStatus,
      reason,
    },
  });

  return contract;
}

export function amendContract(
  contractId: string,
  payload: AmendContractInput,
  userName = "System",
) {
  const state = getState();
  const contract = getContractById(state, contractId);

  if (payload.extendedEndDate) {
    contract.endDate = new Date(payload.extendedEndDate).toISOString();
  }

  if (payload.assetNumbersToAdd?.length) {
    contract.assets = Array.from(
      new Set([...contract.assets, ...payload.assetNumbersToAdd]),
    );
  }

  if (payload.assetNumbersToRemove?.length) {
    contract.assets = contract.assets.filter(
      (assetNumber) => !payload.assetNumbersToRemove?.includes(assetNumber),
    );
  }

  contract.amendmentFlags = Array.from(
    new Set([...contract.amendmentFlags, payload.amendmentType]),
  );

  pushAudit(state, {
    entityType: "contract",
    entityId: contract.contractNumber,
    eventType: "amended",
    userName,
    metadata: {
      amendmentType: payload.amendmentType,
      notes: payload.notes ?? null,
    },
  });

  return contract;
}

export function listFinancialEvents(filters?: {
  contractNumber?: string;
  status?: string;
  eventType?: string;
}) {
  const state = getState();

  return state.financialEvents.filter((event) => {
    if (filters?.contractNumber && event.contractNumber !== filters.contractNumber) {
      return false;
    }

    if (filters?.status && event.status !== filters.status) {
      return false;
    }

    if (filters?.eventType && event.eventType !== filters.eventType) {
      return false;
    }

    return true;
  });
}

export function createFinancialEvent(
  payload: CreateFinancialEventInput,
  userName = "System",
) {
  const state = getState();
  const contract = getContractById(state, payload.contractId);

  const event: FinancialEventRecord = {
    id: createId("fe"),
    contractNumber: contract.contractNumber,
    eventType: payload.eventType,
    description: payload.description,
    amount: payload.amount,
    eventDate: new Date(payload.eventDate).toISOString(),
    status: payload.status ?? "pending",
  };

  state.financialEvents.unshift(event);
  pushAudit(state, {
    entityType: "financial_event",
    entityId: event.id,
    eventType: "created",
    userName,
    metadata: {
      contractNumber: contract.contractNumber,
      amount: payload.amount,
    },
  });

  return event;
}

export function listInvoices(filters?: {
  status?: string;
  customerName?: string;
  q?: string;
}) {
  const state = getState();

  return state.invoices.filter((invoice) => {
    if (filters?.status && invoice.status !== filters.status) {
      return false;
    }

    if (filters?.customerName && invoice.customerName !== filters.customerName) {
      return false;
    }

    if (filters?.q) {
      const q = filters.q.toLowerCase();
      const matches =
        invoice.invoiceNumber.toLowerCase().includes(q) ||
        invoice.customerName.toLowerCase().includes(q) ||
        invoice.contractNumber.toLowerCase().includes(q);

      if (!matches) {
        return false;
      }
    }

    return true;
  });
}

export async function generateInvoiceForContract(
  contractId: string,
  userName = "System",
) {
  const state = getState();
  const contract = getContractById(state, contractId);
  const uninvoicedEvents = state.financialEvents.filter(
    (event) => event.contractNumber === contract.contractNumber && event.status !== "invoiced",
  );

  if (!uninvoicedEvents.length) {
    uninvoicedEvents.push(
      createFinancialEvent(
        {
          contractId: contract.contractNumber,
          eventType: "rent",
          description: "Generated recurring rent charge",
          amount: contract.value,
          eventDate: new Date(),
          status: "posted",
        },
        userName,
      ),
    );
  }

  const customer = getCustomerByContract(state, contract);
  const totalAmount = uninvoicedEvents.reduce((sum, event) => sum + event.amount, 0);
  const invoiceDate = nowIso();
  const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  const invoice: InvoiceRecord = {
    id: createId("inv"),
    invoiceNumber: `INV-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-${Math.floor(
      Math.random() * 900 + 100,
    )}`,
    customerName: customer.name,
    contractNumber: contract.contractNumber,
    status: "draft",
    invoiceDate,
    dueDate,
    totalAmount,
    balanceAmount: totalAmount,
  };

  state.invoices.unshift(invoice);
  uninvoicedEvents.forEach((event) => {
    event.status = "invoiced";
  });

  pushAudit(state, {
    entityType: "invoice",
    entityId: invoice.invoiceNumber,
    eventType: "generated",
    userName,
    metadata: {
      contractNumber: contract.contractNumber,
      totalAmount,
    },
  });

  return invoice;
}

export function listDispatchTasks(filters?: {
  status?: string;
  branch?: string;
  type?: string;
}) {
  const state = getState();
  return state.dispatchTasks.filter((task) => {
    if (filters?.status && task.status !== filters.status) {
      return false;
    }
    if (filters?.branch && task.branch !== filters.branch) {
      return false;
    }
    if (filters?.type && task.type.toLowerCase() !== filters.type.toLowerCase()) {
      return false;
    }
    return true;
  });
}

export function createDispatchTask(
  payload: CreateDispatchTaskInput,
  userName = "System",
) {
  const state = getState();
  const task: DispatchTaskRecord = {
    id: createId("dispatch"),
    type: titleize(payload.type),
    status: payload.status ?? "unassigned",
    branch: payload.branch,
    assetNumber: payload.assetNumber,
    customerSite: payload.customerSite,
    scheduledFor: payload.scheduledFor,
  };

  state.dispatchTasks.unshift(task);
  pushAudit(state, {
    entityType: "dispatch_task",
    entityId: task.id,
    eventType: "created",
    userName,
    metadata: {
      type: task.type,
      assetNumber: task.assetNumber,
    },
  });

  return task;
}

export function confirmDispatchTask(
  taskId: string,
  payload: DispatchConfirmationInput,
  userName = "System",
) {
  const state = getState();
  const task = getDispatchTaskById(state, taskId);
  const asset = getAssetById(state, task.assetNumber);
  task.status = "completed";

  const relatedContract = state.contracts.find((contract) =>
    contract.assets.includes(asset.assetNumber),
  );

  if (payload.outcome === "delivery_confirmed") {
    asset.status = "on_rent";
    setAssetAvailability(asset, "on_rent");
    if (relatedContract && relatedContract.status === "reserved") {
      transitionContract(relatedContract.id, "active", userName, "Delivery confirmed");
    }
  }

  if (payload.outcome === "pickup_confirmed") {
    asset.status = "inspection_hold";
    setAssetAvailability(asset, "inspection_hold");
    if (relatedContract && relatedContract.status === "active") {
      transitionContract(relatedContract.id, "completed", userName, "Pickup confirmed");
    }
  }

  if (payload.outcome === "swap_confirmed") {
    asset.status = "on_rent";
    setAssetAvailability(asset, "on_rent");
  }

  pushAudit(state, {
    entityType: "dispatch_task",
    entityId: task.id,
    eventType: "completed",
    userName,
    metadata: {
      outcome: payload.outcome,
      assetNumber: asset.assetNumber,
    },
  });

  return task;
}

export function listInspections(filters?: {
  status?: string;
  assetNumber?: string;
  contractNumber?: string;
}) {
  const state = getState();
  return state.inspections.filter((inspection) => {
    if (filters?.status && inspection.status !== filters.status) {
      return false;
    }
    if (filters?.assetNumber && inspection.assetNumber !== filters.assetNumber) {
      return false;
    }
    if (
      filters?.contractNumber &&
      inspection.contractNumber !== filters.contractNumber
    ) {
      return false;
    }
    return true;
  });
}

export function listWorkOrders(filters?: {
  status?: string;
  branch?: string;
  assetNumber?: string;
}) {
  const state = getState();
  return state.workOrders.filter((order) => {
    if (filters?.status && order.status !== filters.status) {
      return false;
    }
    if (filters?.branch && order.branch !== filters.branch) {
      return false;
    }
    if (filters?.assetNumber && order.assetNumber !== filters.assetNumber) {
      return false;
    }
    return true;
  });
}

export async function sendInvoice(invoiceId: string, userName = "System") {
  const state = getState();
  const invoice = getInvoiceById(state, invoiceId);
  invoice.status = invoice.balanceAmount > 0 ? "sent" : "paid";
  const sync = await buildQuickBooksInvoiceSync(invoice);

  pushIntegrationJob(state, {
    provider: sync.provider,
    entityType: "invoice",
    entityId: invoice.invoiceNumber,
    direction: "push",
    status: "success",
    startedAt: nowIso(),
    finishedAt: nowIso(),
    lastError: null,
  });

  pushAudit(state, {
    entityType: "invoice",
    entityId: invoice.invoiceNumber,
    eventType: "sent",
    userName,
    metadata: {
      provider: sync.provider,
    },
  });

  return invoice;
}

export async function recordInvoicePayment(
  invoiceId: string,
  amount: number,
  userName = "System",
) {
  const state = getState();
  const invoice = getInvoiceById(state, invoiceId);

  invoice.balanceAmount = Math.max(invoice.balanceAmount - amount, 0);
  invoice.status =
    invoice.balanceAmount === 0
      ? "paid"
      : invoice.balanceAmount < invoice.totalAmount
        ? "partially_paid"
        : invoice.status;

  const sync = await buildQuickBooksPaymentSync(invoice);
  pushIntegrationJob(state, {
    provider: sync.provider,
    entityType: "invoice",
    entityId: invoice.invoiceNumber,
    direction: "push",
    status: "success",
    startedAt: nowIso(),
    finishedAt: nowIso(),
    lastError: null,
  });

  const collectionCase = getOrCreateCollectionCase(state, invoice, invoice.customerName);
  collectionCase.balanceAmount = invoice.balanceAmount;
  collectionCase.status = invoice.balanceAmount === 0 ? "resolved" : collectionCase.status;
  collectionCase.lastContactAt = nowIso();
  collectionCase.notes.unshift(`Payment of ${amount} recorded on ${nowIso()}.`);

  pushAudit(state, {
    entityType: "invoice",
    entityId: invoice.invoiceNumber,
    eventType: "payment_recorded",
    userName,
    metadata: {
      amount,
      remainingBalance: invoice.balanceAmount,
    },
  });

  return invoice;
}

export async function createPaymentIntentForInvoice(invoiceId: string) {
  const state = getState();
  const invoice = getInvoiceById(state, invoiceId);
  return createStripePaymentIntent({
    invoice,
    customerName: invoice.customerName,
  });
}

export async function addPaymentMethod(
  payload: AddPaymentMethodInput,
  userName = "System",
) {
  const state = getState();
  const record = await buildPaymentMethodRecord(payload);
  state.paymentMethods.unshift(record.data);

  pushAudit(state, {
    entityType: "payment_method",
    entityId: record.data.id,
    eventType: "created",
    userName,
    metadata: {
      customerNumber: payload.customerNumber,
      methodType: payload.methodType,
    },
  });

  return record.data;
}

export function listPaymentMethods(customerNumber?: string) {
  const state = getState();
  return customerNumber
    ? state.paymentMethods.filter((method) => method.customerNumber === customerNumber)
    : state.paymentMethods;
}

export async function createInspection(
  payload: CreateInspectionInput,
  userName = "System",
) {
  const state = getState();
  const inspection: InspectionRecord = {
    id: createId("insp"),
    assetNumber: payload.assetNumber,
    contractNumber: payload.contractNumber,
    customerSite: payload.customerSite,
    inspectionType: payload.inspectionType,
    status: "requested",
    requestedAt: nowIso(),
    completedAt: null,
    damageSummary: "Pending inspection results.",
    photos: [],
  };

  state.inspections.unshift(inspection);

  const sync = await buildRecord360InspectionRequest(payload);
  pushIntegrationJob(state, {
    provider: sync.provider,
    entityType: "inspection",
    entityId: inspection.id,
    direction: "push",
    status: "success",
    startedAt: nowIso(),
    finishedAt: nowIso(),
    lastError: null,
  });

  pushAudit(state, {
    entityType: "inspection",
    entityId: inspection.id,
    eventType: "requested",
    userName,
    metadata: {
      provider: sync.provider,
      assetNumber: payload.assetNumber,
    },
  });

  return inspection;
}

export function completeInspection(
  inspectionId: string,
  payload: InspectionCompletionInput,
  userName = "System",
) {
  const state = getState();
  const inspection = getInspectionById(state, inspectionId);
  const asset = getAssetById(state, inspection.assetNumber);

  inspection.status = payload.status;
  inspection.damageSummary = payload.damageSummary;
  inspection.photos = payload.photos ?? inspection.photos;
  inspection.completedAt = nowIso();

  let workOrder: WorkOrderRecord | null = null;

  if (payload.status === "failed" || payload.status === "needs_review") {
    asset.status = "inspection_hold";
    setAssetAvailability(asset, "inspection_hold");

    workOrder = {
      id: createId("wo"),
      title: `Repair from ${inspection.inspectionType} inspection`,
      status: "open",
      assetNumber: asset.assetNumber,
      branch: asset.branch,
      priority: "High",
      source: "Record360 inspection result",
    };
    state.workOrders.unshift(workOrder);
  }

  if (payload.status === "passed") {
    if (asset.maintenanceStatus === "under_repair") {
      asset.status = "in_maintenance";
      setAssetAvailability(asset, "in_maintenance");
    } else {
      asset.status = "available";
      setAssetAvailability(asset, "available");
    }
  }

  pushAudit(state, {
    entityType: "inspection",
    entityId: inspection.id,
    eventType: "completed",
    userName,
    metadata: {
      status: payload.status,
      assetNumber: asset.assetNumber,
    },
  });

  return {
    inspection,
    workOrder,
  };
}

export function createWorkOrder(
  payload: CreateWorkOrderInput,
  userName = "System",
) {
  const state = getState();
  const asset = getAssetById(state, payload.assetNumber);
  const order: WorkOrderRecord = {
    id: createId("wo"),
    title: payload.title,
    status: "open",
    assetNumber: asset.assetNumber,
    branch: payload.branch,
    priority: payload.priority,
    source: payload.source,
  };

  asset.status = "in_maintenance";
  asset.maintenanceStatus = "under_repair";
  setAssetAvailability(asset, "in_maintenance");

  state.workOrders.unshift(order);
  pushAudit(state, {
    entityType: "work_order",
    entityId: order.id,
    eventType: "created",
    userName,
    metadata: {
      assetNumber: order.assetNumber,
      priority: order.priority,
    },
  });

  return order;
}

export function completeWorkOrder(
  workOrderId: string,
  userName = "System",
  notes = "Work completed",
) {
  const state = getState();
  const workOrder = getWorkOrderById(state, workOrderId);
  const asset = getAssetById(state, workOrder.assetNumber);

  workOrder.status = "completed";
  asset.status = "available";
  asset.maintenanceStatus = "clear";
  setAssetAvailability(asset, "available");

  pushAudit(state, {
    entityType: "work_order",
    entityId: workOrder.id,
    eventType: "completed",
    userName,
    metadata: {
      assetNumber: asset.assetNumber,
      notes,
    },
  });

  return workOrder;
}

export function listCollectionCases(filters?: {
  status?: string;
  owner?: string;
}) {
  const state = getState();
  return state.collectionCases.filter((caseRecord) => {
    if (filters?.status && caseRecord.status !== filters.status) {
      return false;
    }
    if (filters?.owner && caseRecord.owner !== filters.owner) {
      return false;
    }
    return true;
  });
}

export async function sendCollectionsReminder(
  collectionCaseId: string,
  userName = "System",
) {
  const state = getState();
  const caseRecord = requireRecord(
    findByIdOrNumber(state.collectionCases, collectionCaseId, ["id", "invoiceNumber"]),
    `Collection case ${collectionCaseId} not found.`,
  );

  caseRecord.status = "reminder_sent";
  caseRecord.lastContactAt = nowIso();
  caseRecord.notes.unshift("Reminder dispatched from collections workflow.");

  const reminder = await buildCollectionsReminder(caseRecord);
  pushAudit(state, {
    entityType: "collection_case",
    entityId: caseRecord.id,
    eventType: "reminder_sent",
    userName,
    metadata: {
      reminderId: reminder.data.reminderId,
    },
  });

  return {
    caseRecord,
    reminder: reminder.data,
  };
}

export function updateCollectionCase(
  collectionCaseId: string,
  payload: UpdateCollectionCaseInput,
  userName = "System",
) {
  const state = getState();
  const caseRecord = requireRecord(
    findByIdOrNumber(state.collectionCases, collectionCaseId, ["id", "invoiceNumber"]),
    `Collection case ${collectionCaseId} not found.`,
  );

  if (payload.status) {
    caseRecord.status = payload.status;
  }
  if (payload.promisedPaymentDate !== undefined) {
    caseRecord.promisedPaymentDate = payload.promisedPaymentDate;
  }
  if (payload.note) {
    caseRecord.notes.unshift(payload.note);
  }
  caseRecord.lastContactAt = nowIso();

  pushAudit(state, {
    entityType: "collection_case",
    entityId: caseRecord.id,
    eventType: "updated",
    userName,
    metadata: {
      status: caseRecord.status,
    },
  });

  return caseRecord;
}

export function listTelematics(assetNumber?: string) {
  const state = getState();
  return assetNumber
    ? state.telematics.filter((record) => record.assetNumber === assetNumber)
    : state.telematics;
}

export async function syncTelematics(assetNumber: string, userName = "System") {
  const state = getState();
  const asset = getAssetById(state, assetNumber);
  const sync = await buildSkyBitzSync(asset.assetNumber);
  const newPing: TelematicsRecord = {
    id: createId("tp"),
    assetNumber: asset.assetNumber,
    provider: "SkyBitz",
    latitude: 39 + Math.random(),
    longitude: -95 + Math.random(),
    speedMph: Number((Math.random() * 24).toFixed(1)),
    heading: Math.floor(Math.random() * 360),
    capturedAt: nowIso(),
  };
  state.telematics.unshift(newPing);

  pushIntegrationJob(state, {
    provider: sync.provider,
    entityType: "asset",
    entityId: asset.assetNumber,
    direction: "pull",
    status: "success",
    startedAt: nowIso(),
    finishedAt: nowIso(),
    lastError: null,
  });

  pushAudit(state, {
    entityType: "asset",
    entityId: asset.assetNumber,
    eventType: "telematics_synced",
    userName,
    metadata: {
      pingId: newPing.id,
    },
  });

  return newPing;
}

export function listDocuments(contractNumber?: string) {
  const state = getState();
  return contractNumber
    ? state.documents.filter((document) => document.contractNumber === contractNumber)
    : state.documents;
}

export async function createDocument(
  payload: CreateDocumentInput,
  userName = "System",
) {
  const state = getState();
  const documentResult = await buildDocumentRecord(payload);
  state.documents.unshift(documentResult.data);

  pushAudit(state, {
    entityType: "document",
    entityId: documentResult.data.id,
    eventType: "created",
    userName,
    metadata: {
      contractNumber: payload.contractNumber,
      documentType: payload.documentType,
    },
  });

  return documentResult.data;
}

export function markDocumentArchived(documentId: string, userName = "System") {
  const state = getState();
  const document = getDocumentById(state, documentId);
  document.status = "archived";

  pushAudit(state, {
    entityType: "document",
    entityId: document.id,
    eventType: "archived",
    userName,
    metadata: {
      filename: document.filename,
    },
  });

  return document;
}

export function listSignatureRequests(contractNumber?: string) {
  const state = getState();
  return contractNumber
    ? state.signatureRequests.filter(
        (request) => request.contractNumber === contractNumber,
      )
    : state.signatureRequests;
}

export async function createSignatureRequestForContract(
  payload: CreateSignatureRequestInput,
  userName = "System",
) {
  const state = getState();
  const contract = getContractById(state, payload.contractNumber);
  const signature = await buildSignatureRequest({
    contractNumber: contract.contractNumber,
    customerName: contract.customerName,
    signers: payload.signers,
  });

  state.signatureRequests.unshift(signature.data);

  pushIntegrationJob(state, {
    provider: signature.provider,
    entityType: "contract",
    entityId: contract.contractNumber,
    direction: "push",
    status: "success",
    startedAt: nowIso(),
    finishedAt: nowIso(),
    lastError: null,
  });

  pushAudit(state, {
    entityType: "contract",
    entityId: contract.contractNumber,
    eventType: "signature_requested",
    userName,
    metadata: {
      provider: signature.provider,
      signerCount: payload.signers.length,
    },
  });

  return signature.data;
}

export function completeSignatureRequest(
  signatureRequestId: string,
  userName = "System",
) {
  const state = getState();
  const signatureRequest = getSignatureRequestById(state, signatureRequestId);
  signatureRequest.status = "signed";
  signatureRequest.completedAt = nowIso();

  pushAudit(state, {
    entityType: "signature_request",
    entityId: signatureRequest.id,
    eventType: "completed",
    userName,
    metadata: {
      contractNumber: signatureRequest.contractNumber,
    },
  });

  return signatureRequest;
}

export function listIntegrationJobs(filters?: {
  provider?: string;
  status?: string;
}) {
  const state = getState();
  return state.integrationJobs.filter((job) => {
    if (filters?.provider && job.provider !== filters.provider) {
      return false;
    }
    if (filters?.status && job.status !== filters.status) {
      return false;
    }
    return true;
  });
}

export async function getPortalOverview(customerNumber: string) {
  const state = getState();
  const customer = getCustomerById(state, customerNumber);
  const contracts = state.contracts.filter(
    (contract) => contract.customerName === customer.name,
  );
  const customerInvoices = state.invoices.filter(
    (invoice) => invoice.customerName === customer.name,
  );
  const paymentMethods = state.paymentMethods.filter(
    (method) => method.customerNumber === customer.customerNumber,
  );
  const inspections = state.inspections.filter((inspection) =>
    contracts.some((contract) => contract.contractNumber === inspection.contractNumber),
  );
  const portalSession = await createStripePortalSession({
    customerName: customer.name,
    returnUrl: process.env.APP_URL ?? "http://localhost:3000/portal",
  });

  return {
    customer,
    contracts,
    invoices: customerInvoices,
    paymentMethods,
    inspections,
    portalSession: portalSession.data,
  };
}

export function getReports() {
  const state = getState();
  const utilization: FleetUtilizationRecord[] = state.branches.map((branch) => {
    const branchAssets = state.assets.filter((asset) => asset.branch === branch.name);
    const onRentCount = branchAssets.filter((asset) => asset.status === "on_rent").length;
    const fleetCount = branchAssets.length;

    return {
      branch: branch.name,
      fleetCount,
      onRentCount,
      utilizationRate:
        fleetCount === 0 ? 0 : Number(((onRentCount / fleetCount) * 100).toFixed(1)),
    };
  });

  const revenueByType = state.financialEvents.reduce<Record<string, number>>(
    (acc, event) => {
      acc[event.eventType] = (acc[event.eventType] ?? 0) + event.amount;
      return acc;
    },
    {},
  );

  const overdueInvoices = state.invoices.filter((invoice) =>
    ["overdue", "sent", "partially_paid"].includes(invoice.status),
  );

  const revenueSeries: RevenueSeriesPoint[] = Object.entries(revenueByType).map(
    ([label, revenue]) => ({
      label,
      revenue,
    }),
  );

  return {
    utilization,
    revenueSeries,
    overdueInvoices,
    auditTrail: state.auditEvents.slice(0, 12),
  };
}

export async function exportRevenueReport() {
  const state = getState();
  return buildRevenueExport(state.financialEvents);
}

export async function getCollectionsRecoverySnapshot(assetNumber: string) {
  const state = getState();
  const lastKnown = state.telematics.find((record) => record.assetNumber === assetNumber);
  return buildTelematicsRecoverySnapshot({
    assetNumber,
    lastKnown,
  });
}
