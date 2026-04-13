import {
  assetAvailabilities,
  assetStatuses,
  assetTypes,
  billingUnits,
  contractStatuses,
  customerTypes,
  dispatchTaskStatuses,
  financialEventStatuses,
  financialEventTypes,
  invoiceStatuses,
  maintenanceStatuses,
  workOrderStatuses,
} from "../lib/domain/models";
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const auditEntityTypes = [
  "asset",
  "customer",
  "customer_location",
  "contract",
  "contract_line",
  "financial_event",
  "invoice",
  "user",
  "dispatch_task",
  "inspection",
  "work_order",
  "payment_method",
  "collection_case",
] as const;

const userRoles = [
  "admin",
  "sales",
  "dispatcher",
  "accounting",
  "technician",
  "collections",
  "portal",
] as const;

const rateScopes = [
  "standard",
  "customer",
  "branch",
  "promotional",
] as const;

const dispatchTaskTypes = [
  "delivery",
  "pickup",
  "swap",
  "return",
  "checkout",
  "checkin",
] as const;

const inspectionTypes = [
  "delivery",
  "return",
  "damage_assessment",
  "maintenance_release",
  "spot_check",
] as const;

const inspectionStatuses = [
  "requested",
  "in_progress",
  "passed",
  "failed",
  "needs_review",
] as const;

const paymentMethodTypes = ["card", "ach", "wire", "check"] as const;

const collectionStatuses = [
  "current",
  "reminder_sent",
  "promise_to_pay",
  "disputed",
  "escalated",
  "resolved",
] as const;

const integrationProviders = [
  "stripe",
  "quickbooks",
  "record360",
  "skybitz",
  "dropbox_sign",
  "internal",
] as const;

const integrationDirections = [
  "push",
  "pull",
  "bidirectional",
  "webhook",
] as const;

const integrationSyncStatuses = [
  "pending",
  "success",
  "failed",
  "skipped",
] as const;

export const assetTypeEnum = pgEnum("asset_type", assetTypes);
export const assetStatusEnum = pgEnum("asset_status", assetStatuses);
export const assetAvailabilityEnum = pgEnum(
  "asset_availability",
  assetAvailabilities,
);
export const maintenanceStatusEnum = pgEnum(
  "maintenance_status",
  maintenanceStatuses,
);
export const customerTypeEnum = pgEnum("customer_type", customerTypes);
export const contractStatusEnum = pgEnum("contract_status", contractStatuses);
export const billingUnitEnum = pgEnum("billing_unit", billingUnits);
export const financialEventTypeEnum = pgEnum(
  "financial_event_type",
  financialEventTypes,
);
export const financialEventStatusEnum = pgEnum(
  "financial_event_status",
  financialEventStatuses,
);
export const invoiceStatusEnum = pgEnum("invoice_status", invoiceStatuses);
export const auditEntityTypeEnum = pgEnum(
  "audit_entity_type",
  auditEntityTypes,
);
export const userRoleEnum = pgEnum("user_role", userRoles);
export const rateScopeEnum = pgEnum("rate_scope", rateScopes);
export const dispatchTaskTypeEnum = pgEnum(
  "dispatch_task_type",
  dispatchTaskTypes,
);
export const dispatchTaskStatusEnum = pgEnum(
  "dispatch_task_status",
  dispatchTaskStatuses,
);
export const inspectionTypeEnum = pgEnum("inspection_type", inspectionTypes);
export const inspectionStatusEnum = pgEnum(
  "inspection_status",
  inspectionStatuses,
);
export const workOrderStatusEnum = pgEnum(
  "work_order_status",
  workOrderStatuses,
);
export const paymentMethodTypeEnum = pgEnum(
  "payment_method_type",
  paymentMethodTypes,
);
export const collectionStatusEnum = pgEnum(
  "collection_status",
  collectionStatuses,
);
export const integrationProviderEnum = pgEnum(
  "integration_provider",
  integrationProviders,
);
export const integrationDirectionEnum = pgEnum(
  "integration_direction",
  integrationDirections,
);
export const integrationSyncStatusEnum = pgEnum(
  "integration_sync_status",
  integrationSyncStatuses,
);

export const branches = pgTable(
  "branches",
  {
    id: text().primaryKey(),
    code: text().notNull(),
    name: text().notNull(),
    timezone: text().default("America/New_York").notNull(),
    phone: text(),
    email: text(),
    address: jsonb().$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    codeUnique: uniqueIndex("branches_code_unique").on(table.code),
  }),
);

export const customers = pgTable(
  "customers",
  {
    id: text().primaryKey(),
    customerNumber: text().notNull(),
    name: text().notNull(),
    customerType: customerTypeEnum().notNull(),
    contactInfo: jsonb().$type<Record<string, unknown>>().notNull(),
    billingAddress: jsonb().$type<Record<string, unknown>>().notNull(),
    taxExempt: boolean().default(false).notNull(),
    creditLimit: numeric({ precision: 12, scale: 2 }),
    notes: text(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    customerNumberUnique: uniqueIndex("customers_customer_number_unique").on(
      table.customerNumber,
    ),
    nameIdx: index("customers_name_idx").on(table.name),
    customerTypeIdx: index("customers_customer_type_idx").on(table.customerType),
  }),
);

export const customerLocations = pgTable(
  "customer_locations",
  {
    id: text().primaryKey(),
    customerId: text()
      .notNull()
      .references(() => customers.id),
    name: text().notNull(),
    address: jsonb().$type<Record<string, unknown>>().notNull(),
    contactPerson: jsonb().$type<Record<string, unknown>>(),
    deliveryNotes: text(),
    isPrimary: boolean().default(false).notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    customerIdx: index("customer_locations_customer_id_idx").on(table.customerId),
  }),
);

export const users = pgTable(
  "users",
  {
    id: text().primaryKey(),
    email: text().notNull(),
    name: text().notNull(),
    role: userRoleEnum().notNull(),
    active: boolean().default(true).notNull(),
    branchId: text().references(() => branches.id),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    emailUnique: uniqueIndex("users_email_unique").on(table.email),
    branchRoleIdx: index("users_branch_role_idx").on(table.branchId, table.role),
  }),
);

export const assets = pgTable(
  "assets",
  {
    id: text().primaryKey(),
    assetNumber: text().notNull(),
    type: assetTypeEnum().notNull(),
    subtype: text(),
    dimensions: jsonb().$type<Record<string, unknown>>(),
    branchId: text()
      .notNull()
      .references(() => branches.id),
    status: assetStatusEnum().default("available").notNull(),
    availability: assetAvailabilityEnum().default("rentable").notNull(),
    gpsDeviceId: text(),
    maintenanceStatus: maintenanceStatusEnum().default("clear").notNull(),
    ageInMonths: integer(),
    features: jsonb().$type<string[]>(),
    serialNumber: text(),
    manufacturedAt: timestamp({ withTimezone: true }),
    purchaseDate: timestamp({ withTimezone: true }),
    record360UnitId: text(),
    skybitzAssetId: text(),
    telematicsProvider: integrationProviderEnum(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    assetNumberUnique: uniqueIndex("assets_asset_number_unique").on(
      table.assetNumber,
    ),
    gpsDeviceIdUnique: uniqueIndex("assets_gps_device_id_unique").on(
      table.gpsDeviceId,
    ),
    branchStatusIdx: index("assets_branch_status_idx").on(
      table.branchId,
      table.status,
    ),
    availabilityMaintenanceIdx: index("assets_availability_maintenance_idx").on(
      table.availability,
      table.maintenanceStatus,
    ),
  }),
);

export const rateCards = pgTable(
  "rate_cards",
  {
    id: text().primaryKey(),
    name: text().notNull(),
    scope: rateScopeEnum().notNull(),
    customerId: text().references(() => customers.id),
    assetType: assetTypeEnum(),
    dailyRate: numeric({ precision: 12, scale: 2 }),
    weeklyRate: numeric({ precision: 12, scale: 2 }),
    monthlyRate: numeric({ precision: 12, scale: 2 }),
    mileageRate: numeric({ precision: 12, scale: 2 }),
    deliveryFee: numeric({ precision: 12, scale: 2 }),
    pickupFee: numeric({ precision: 12, scale: 2 }),
    effectiveFrom: timestamp({ withTimezone: true }).notNull(),
    effectiveTo: timestamp({ withTimezone: true }),
    active: boolean().default(true).notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    customerActiveIdx: index("rate_cards_customer_active_idx").on(
      table.customerId,
      table.active,
    ),
    assetTypeActiveIdx: index("rate_cards_asset_type_active_idx").on(
      table.assetType,
      table.active,
    ),
  }),
);

export const contracts = pgTable(
  "contracts",
  {
    id: text().primaryKey(),
    contractNumber: text().notNull(),
    customerId: text()
      .notNull()
      .references(() => customers.id),
    locationId: text()
      .notNull()
      .references(() => customerLocations.id),
    branchId: text()
      .notNull()
      .references(() => branches.id),
    salesRepId: text().references(() => users.id),
    startDate: timestamp({ withTimezone: true }).notNull(),
    endDate: timestamp({ withTimezone: true }),
    status: contractStatusEnum().default("quoted").notNull(),
    quotedAt: timestamp({ withTimezone: true }),
    reservedAt: timestamp({ withTimezone: true }),
    activatedAt: timestamp({ withTimezone: true }),
    completedAt: timestamp({ withTimezone: true }),
    closedAt: timestamp({ withTimezone: true }),
    cancelledAt: timestamp({ withTimezone: true }),
    notes: text(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    contractNumberUnique: uniqueIndex("contracts_contract_number_unique").on(
      table.contractNumber,
    ),
    customerStatusIdx: index("contracts_customer_status_idx").on(
      table.customerId,
      table.status,
    ),
    branchStatusIdx: index("contracts_branch_status_idx").on(
      table.branchId,
      table.status,
    ),
    locationIdx: index("contracts_location_id_idx").on(table.locationId),
  }),
);

export const contractLines = pgTable(
  "contract_lines",
  {
    id: text().primaryKey(),
    contractId: text()
      .notNull()
      .references(() => contracts.id),
    assetId: text().references(() => assets.id),
    description: text(),
    unitPrice: numeric({ precision: 12, scale: 2 }).notNull(),
    unit: billingUnitEnum().notNull(),
    quantity: numeric({ precision: 10, scale: 2 }).default("1").notNull(),
    startDate: timestamp({ withTimezone: true }).notNull(),
    endDate: timestamp({ withTimezone: true }),
    adjustments: jsonb().$type<Record<string, unknown>>(),
    deliveryFee: numeric({ precision: 12, scale: 2 }),
    pickupFee: numeric({ precision: 12, scale: 2 }),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    contractIdx: index("contract_lines_contract_id_idx").on(table.contractId),
    assetIdx: index("contract_lines_asset_id_idx").on(table.assetId),
  }),
);

export const invoices = pgTable(
  "invoices",
  {
    id: text().primaryKey(),
    invoiceNumber: text().notNull(),
    customerId: text()
      .notNull()
      .references(() => customers.id),
    contractId: text().references(() => contracts.id),
    invoiceDate: timestamp({ withTimezone: true }).notNull(),
    dueDate: timestamp({ withTimezone: true }).notNull(),
    status: invoiceStatusEnum().default("draft").notNull(),
    subtotalAmount: numeric({ precision: 12, scale: 2 }).notNull(),
    taxAmount: numeric({ precision: 12, scale: 2 }).default("0").notNull(),
    totalAmount: numeric({ precision: 12, scale: 2 }).notNull(),
    balanceAmount: numeric({ precision: 12, scale: 2 }).notNull(),
    quickBooksInvoiceId: text(),
    stripePaymentIntentId: text(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    invoiceNumberUnique: uniqueIndex("invoices_invoice_number_unique").on(
      table.invoiceNumber,
    ),
    customerStatusIdx: index("invoices_customer_status_idx").on(
      table.customerId,
      table.status,
    ),
    contractIdx: index("invoices_contract_id_idx").on(table.contractId),
    dueDateIdx: index("invoices_due_date_idx").on(table.dueDate),
  }),
);

export const financialEvents = pgTable(
  "financial_events",
  {
    id: text().primaryKey(),
    contractId: text().references(() => contracts.id),
    contractLineId: text().references(() => contractLines.id),
    assetId: text().references(() => assets.id),
    invoiceId: text().references(() => invoices.id),
    eventType: financialEventTypeEnum().notNull(),
    description: text().notNull(),
    amount: numeric({ precision: 12, scale: 2 }).notNull(),
    eventDate: timestamp({ withTimezone: true }).notNull(),
    status: financialEventStatusEnum().default("pending").notNull(),
    externalReference: text(),
    metadata: jsonb().$type<Record<string, unknown>>(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    contractStatusIdx: index("financial_events_contract_status_idx").on(
      table.contractId,
      table.status,
    ),
    assetIdx: index("financial_events_asset_id_idx").on(table.assetId),
    invoiceIdx: index("financial_events_invoice_id_idx").on(table.invoiceId),
    eventDateIdx: index("financial_events_event_date_idx").on(table.eventDate),
  }),
);

export const invoiceLines = pgTable(
  "invoice_lines",
  {
    id: text().primaryKey(),
    invoiceId: text()
      .notNull()
      .references(() => invoices.id),
    description: text().notNull(),
    quantity: numeric({ precision: 10, scale: 2 }).notNull(),
    unitPrice: numeric({ precision: 12, scale: 2 }).notNull(),
    totalAmount: numeric({ precision: 12, scale: 2 }).notNull(),
    sourceFinancialEventId: text(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    invoiceIdx: index("invoice_lines_invoice_id_idx").on(table.invoiceId),
  }),
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: text().primaryKey(),
    entityType: auditEntityTypeEnum().notNull(),
    entityId: text().notNull(),
    eventType: text().notNull(),
    userId: text().references(() => users.id),
    metadata: jsonb().$type<Record<string, unknown>>(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    entityIdx: index("audit_events_entity_idx").on(
      table.entityType,
      table.entityId,
    ),
    userIdx: index("audit_events_user_id_idx").on(table.userId),
    createdAtIdx: index("audit_events_created_at_idx").on(table.createdAt),
  }),
);

export const dispatchTasks = pgTable(
  "dispatch_tasks",
  {
    id: text().primaryKey(),
    branchId: text()
      .notNull()
      .references(() => branches.id),
    contractId: text().references(() => contracts.id),
    assetId: text().references(() => assets.id),
    customerLocationId: text().references(() => customerLocations.id),
    taskType: dispatchTaskTypeEnum().notNull(),
    status: dispatchTaskStatusEnum().default("unassigned").notNull(),
    scheduledStart: timestamp({ withTimezone: true }).notNull(),
    scheduledEnd: timestamp({ withTimezone: true }),
    driverName: text(),
    notes: text(),
    completedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    branchStatusIdx: index("dispatch_tasks_branch_status_idx").on(
      table.branchId,
      table.status,
    ),
    assetIdx: index("dispatch_tasks_asset_id_idx").on(table.assetId),
    contractIdx: index("dispatch_tasks_contract_id_idx").on(table.contractId),
  }),
);

export const inspections = pgTable(
  "inspections",
  {
    id: text().primaryKey(),
    assetId: text()
      .notNull()
      .references(() => assets.id),
    contractId: text().references(() => contracts.id),
    customerLocationId: text().references(() => customerLocations.id),
    inspectionType: inspectionTypeEnum().notNull(),
    status: inspectionStatusEnum().default("requested").notNull(),
    externalInspectionId: text(),
    resultSummary: text(),
    damageScore: integer(),
    photos: jsonb().$type<string[]>(),
    record360Payload: jsonb().$type<Record<string, unknown>>(),
    completedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    assetStatusIdx: index("inspections_asset_status_idx").on(
      table.assetId,
      table.status,
    ),
    contractIdx: index("inspections_contract_id_idx").on(table.contractId),
  }),
);

export const workOrders = pgTable(
  "work_orders",
  {
    id: text().primaryKey(),
    assetId: text()
      .notNull()
      .references(() => assets.id),
    inspectionId: text().references(() => inspections.id),
    branchId: text()
      .notNull()
      .references(() => branches.id),
    assignedToUserId: text().references(() => users.id),
    status: workOrderStatusEnum().default("open").notNull(),
    priority: text(),
    title: text().notNull(),
    description: text(),
    vendorName: text(),
    estimatedCost: numeric({ precision: 12, scale: 2 }),
    actualCost: numeric({ precision: 12, scale: 2 }),
    laborHours: numeric({ precision: 8, scale: 2 }),
    parts: jsonb().$type<Record<string, unknown>>(),
    openedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    assignedAt: timestamp({ withTimezone: true }),
    completedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    assetStatusIdx: index("work_orders_asset_status_idx").on(
      table.assetId,
      table.status,
    ),
    branchStatusIdx: index("work_orders_branch_status_idx").on(
      table.branchId,
      table.status,
    ),
    inspectionIdx: index("work_orders_inspection_id_idx").on(table.inspectionId),
  }),
);

export const paymentMethods = pgTable(
  "payment_methods",
  {
    id: text().primaryKey(),
    customerId: text()
      .notNull()
      .references(() => customers.id),
    provider: integrationProviderEnum().default("stripe").notNull(),
    methodType: paymentMethodTypeEnum().notNull(),
    stripePaymentMethodId: text(),
    last4: text(),
    brand: text(),
    achBankName: text(),
    isDefault: boolean().default(false).notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    customerDefaultIdx: index("payment_methods_customer_default_idx").on(
      table.customerId,
      table.isDefault,
    ),
  }),
);

export const collectionCases = pgTable(
  "collection_cases",
  {
    id: text().primaryKey(),
    customerId: text()
      .notNull()
      .references(() => customers.id),
    invoiceId: text().references(() => invoices.id),
    ownerUserId: text().references(() => users.id),
    status: collectionStatusEnum().default("current").notNull(),
    promisedPaymentDate: timestamp({ withTimezone: true }),
    lastContactAt: timestamp({ withTimezone: true }),
    notes: jsonb().$type<string[]>(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    customerStatusIdx: index("collection_cases_customer_status_idx").on(
      table.customerId,
      table.status,
    ),
    invoiceIdx: index("collection_cases_invoice_id_idx").on(table.invoiceId),
  }),
);

export const telematicsPings = pgTable(
  "telematics_pings",
  {
    id: text().primaryKey(),
    assetId: text()
      .notNull()
      .references(() => assets.id),
    provider: integrationProviderEnum().default("skybitz").notNull(),
    latitude: numeric({ precision: 9, scale: 6 }).notNull(),
    longitude: numeric({ precision: 9, scale: 6 }).notNull(),
    heading: integer(),
    speedMph: numeric({ precision: 6, scale: 2 }),
    capturedAt: timestamp({ withTimezone: true }).notNull(),
    rawPayload: jsonb().$type<Record<string, unknown>>(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    assetCapturedAtIdx: index("telematics_pings_asset_captured_at_idx").on(
      table.assetId,
      table.capturedAt,
    ),
  }),
);

export const integrationSyncJobs = pgTable(
  "integration_sync_jobs",
  {
    id: text().primaryKey(),
    provider: integrationProviderEnum().notNull(),
    entityType: text().notNull(),
    entityId: text().notNull(),
    direction: integrationDirectionEnum().notNull(),
    status: integrationSyncStatusEnum().default("pending").notNull(),
    payload: jsonb().$type<Record<string, unknown>>(),
    lastError: text(),
    startedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    finishedAt: timestamp({ withTimezone: true }),
  },
  (table) => ({
    providerStatusIdx: index("integration_sync_jobs_provider_status_idx").on(
      table.provider,
      table.status,
    ),
    entityIdx: index("integration_sync_jobs_entity_idx").on(
      table.entityType,
      table.entityId,
    ),
  }),
);
