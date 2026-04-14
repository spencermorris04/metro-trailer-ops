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
  workOrderBillingApprovalStatuses,
  workOrderBillableDispositions,
  workOrderSourceTypes,
  workOrderStatuses,
  workOrderVerificationResults,
} from "../lib/domain/models";
import type { SignatureFieldRecord } from "../lib/platform-types";
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

const billingCadences = [
  "immediate",
  "weekly_arrears",
  "monthly_arrears",
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
  "internal_esign",
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

const roleScopeTypes = ["global", "branch", "customer"] as const;

const assetAllocationTypes = [
  "reservation",
  "dispatch_hold",
  "on_rent",
  "maintenance_hold",
  "inspection_hold",
  "swap_out",
  "swap_in",
] as const;

const contractAmendmentTypes = [
  "extension",
  "asset_swap",
  "partial_return",
  "rate_adjustment",
  "cancellation",
  "note",
] as const;

const documentStatuses = [
  "draft",
  "ready_for_signature",
  "signature_in_progress",
  "signed",
  "evidence_locked",
  "archived",
] as const;

const documentSources = [
  "internal_esign",
  "record360_sync",
  "invoice_generation",
  "portal_upload",
  "internal",
] as const;

const storageProviders = ["inline", "s3"] as const;

const retentionModes = ["governance", "compliance"] as const;

const signatureRequestStatuses = [
  "sent",
  "in_progress",
  "partially_signed",
  "completed",
  "cancelled",
  "expired",
] as const;

const signatureSignerStatuses = [
  "pending",
  "viewed",
  "signed",
  "declined",
  "cancelled",
  "expired",
] as const;

const collectionActivityTypes = [
  "email",
  "call",
  "note",
  "promise_to_pay",
  "dispute",
  "escalation",
  "telematics_recovery",
] as const;

const paymentTransactionTypes = [
  "payment_intent",
  "charge",
  "refund",
  "credit_memo",
  "payment_application",
] as const;

const paymentTransactionStatuses = [
  "pending",
  "succeeded",
  "failed",
  "cancelled",
  "refunded",
] as const;

const workOrderEventTypes = [
  "created",
  "updated",
  "assigned",
  "status_changed",
  "started",
  "awaiting_parts",
  "awaiting_vendor",
  "repair_completed",
  "verified_passed",
  "verified_failed",
  "cancelled",
  "closed",
  "note_added",
  "labor_added",
  "part_added",
  "billing_reviewed",
  "attachment_added",
] as const;

const webhookProcessingStatuses = [
  "received",
  "processed",
  "failed",
  "ignored",
] as const;

const outboxJobStatuses = [
  "pending",
  "processing",
  "succeeded",
  "failed",
  "dead_letter",
] as const;

const notificationChannels = ["email", "sms", "internal"] as const;

const notificationStatuses = ["queued", "sent", "failed", "skipped"] as const;

const signatureAccessTokenPurposes = ["sign", "otp"] as const;
const signatureAppearanceModes = [
  "handwriting_font",
  "drawn",
  "uploaded_image",
] as const;

const quickbooksConnectionStatuses = [
  "pending",
  "active",
  "refresh_required",
  "disconnected",
  "error",
] as const;

const quickbooksEnvironments = ["sandbox", "production"] as const;

const accountingSyncIssueStatuses = ["open", "resolved", "ignored"] as const;

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
export const billingCadenceEnum = pgEnum("billing_cadence", billingCadences);
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
export const workOrderSourceTypeEnum = pgEnum(
  "work_order_source_type",
  workOrderSourceTypes,
);
export const workOrderBillableDispositionEnum = pgEnum(
  "work_order_billable_disposition",
  workOrderBillableDispositions,
);
export const workOrderBillingApprovalStatusEnum = pgEnum(
  "work_order_billing_approval_status",
  workOrderBillingApprovalStatuses,
);
export const workOrderVerificationResultEnum = pgEnum(
  "work_order_verification_result",
  workOrderVerificationResults,
);
export const workOrderEventTypeEnum = pgEnum(
  "work_order_event_type",
  workOrderEventTypes,
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
export const roleScopeTypeEnum = pgEnum("role_scope_type", roleScopeTypes);
export const assetAllocationTypeEnum = pgEnum(
  "asset_allocation_type",
  assetAllocationTypes,
);
export const contractAmendmentTypeEnum = pgEnum(
  "contract_amendment_type",
  contractAmendmentTypes,
);
export const documentStatusEnum = pgEnum("document_status", documentStatuses);
export const documentSourceEnum = pgEnum("document_source", documentSources);
export const storageProviderEnum = pgEnum("storage_provider", storageProviders);
export const retentionModeEnum = pgEnum("retention_mode", retentionModes);
export const signatureRequestStatusEnum = pgEnum(
  "signature_request_status",
  signatureRequestStatuses,
);
export const signatureSignerStatusEnum = pgEnum(
  "signature_signer_status",
  signatureSignerStatuses,
);
export const collectionActivityTypeEnum = pgEnum(
  "collection_activity_type",
  collectionActivityTypes,
);
export const paymentTransactionTypeEnum = pgEnum(
  "payment_transaction_type",
  paymentTransactionTypes,
);
export const paymentTransactionStatusEnum = pgEnum(
  "payment_transaction_status",
  paymentTransactionStatuses,
);
export const webhookProcessingStatusEnum = pgEnum(
  "webhook_processing_status",
  webhookProcessingStatuses,
);
export const outboxJobStatusEnum = pgEnum(
  "outbox_job_status",
  outboxJobStatuses,
);
export const notificationChannelEnum = pgEnum(
  "notification_channel",
  notificationChannels,
);
export const notificationStatusEnum = pgEnum(
  "notification_status",
  notificationStatuses,
);
export const signatureAccessTokenPurposeEnum = pgEnum(
  "signature_access_token_purpose",
  signatureAccessTokenPurposes,
);
export const signatureAppearanceModeEnum = pgEnum(
  "signature_appearance_mode",
  signatureAppearanceModes,
);
export const quickbooksConnectionStatusEnum = pgEnum(
  "quickbooks_connection_status",
  quickbooksConnectionStatuses,
);
export const quickbooksEnvironmentEnum = pgEnum(
  "quickbooks_environment",
  quickbooksEnvironments,
);
export const accountingSyncIssueStatusEnum = pgEnum(
  "accounting_sync_issue_status",
  accountingSyncIssueStatuses,
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
    portalEnabled: boolean().default(false).notNull(),
    branchCoverage: jsonb().$type<string[]>().default([]).notNull(),
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
    authUserId: text(),
    email: text().notNull(),
    name: text().notNull(),
    role: userRoleEnum().notNull(),
    active: boolean().default(true).notNull(),
    branchId: text().references(() => branches.id),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    authUserIdUnique: uniqueIndex("users_auth_user_id_unique").on(table.authUserId),
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
    yardZone: text(),
    yardRow: text(),
    yardSlot: text(),
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
    branchId: text().references(() => branches.id),
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
    branchActiveIdx: index("rate_cards_branch_active_idx").on(
      table.branchId,
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
    billingCadence: billingCadenceEnum()
      .default("monthly_arrears")
      .notNull(),
    paymentTermsDays: integer().default(14).notNull(),
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
    deliveryStatus: text().default("draft").notNull(),
    sentAt: timestamp({ withTimezone: true }),
    deliveryChannel: text(),
    quickBooksSyncStatus: text().default("pending").notNull(),
    quickBooksLastSyncedAt: timestamp({ withTimezone: true }),
    quickBooksLastError: text(),
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

export const invoiceHistory = pgTable(
  "invoice_history",
  {
    id: text().primaryKey(),
    invoiceId: text()
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    eventType: text().notNull(),
    actorUserId: text().references(() => users.id),
    metadata: jsonb().$type<Record<string, unknown>>(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    invoiceIdx: index("invoice_history_invoice_id_idx").on(
      table.invoiceId,
      table.createdAt,
    ),
  }),
);

export const financialEvents = pgTable(
  "financial_events",
  {
    id: text().primaryKey(),
    contractId: text().references(() => contracts.id),
    contractLineId: text().references(() => contractLines.id),
    assetId: text().references(() => assets.id),
    workOrderId: text().references(() => workOrders.id),
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
    workOrderIdx: index("financial_events_work_order_id_idx").on(table.workOrderId),
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
    externalUnitId: text(),
    record360SyncState: text().default("pending_sync").notNull(),
    lastSyncAttemptAt: timestamp({ withTimezone: true }),
    lastSyncError: text(),
    webhookMatchedBy: text(),
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
    contractId: text().references(() => contracts.id),
    inspectionId: text().references(() => inspections.id),
    branchId: text()
      .notNull()
      .references(() => branches.id),
    assignedToUserId: text().references(() => users.id),
    vendorId: text().references(() => maintenanceVendors.id),
    sourceType: workOrderSourceTypeEnum().default("manual").notNull(),
    status: workOrderStatusEnum().default("open").notNull(),
    priority: text(),
    title: text().notNull(),
    description: text(),
    symptomSummary: text(),
    diagnosis: text(),
    repairSummary: text(),
    vendorName: text(),
    dueAt: timestamp({ withTimezone: true }),
    startedAt: timestamp({ withTimezone: true }),
    repairCompletedAt: timestamp({ withTimezone: true }),
    verifiedAt: timestamp({ withTimezone: true }),
    closedAt: timestamp({ withTimezone: true }),
    cancelledAt: timestamp({ withTimezone: true }),
    verifiedByUserId: text().references(() => users.id),
    billableDisposition: workOrderBillableDispositionEnum()
      .default("internal")
      .notNull(),
    billingApprovalStatus: workOrderBillingApprovalStatusEnum()
      .default("not_required")
      .notNull(),
    billableApprovedByUserId: text().references(() => users.id),
    billableApprovedAt: timestamp({ withTimezone: true }),
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
    contractIdx: index("work_orders_contract_id_idx").on(table.contractId),
    vendorIdx: index("work_orders_vendor_id_idx").on(table.vendorId),
  }),
);

export const maintenanceVendors = pgTable(
  "maintenance_vendors",
  {
    id: text().primaryKey(),
    name: text().notNull(),
    code: text(),
    email: text(),
    phone: text(),
    active: boolean().default(true).notNull(),
    notes: text(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    nameUnique: uniqueIndex("maintenance_vendors_name_unique").on(table.name),
    activeIdx: index("maintenance_vendors_active_idx").on(table.active),
  }),
);

export const workOrderEvents = pgTable(
  "work_order_events",
  {
    id: text().primaryKey(),
    workOrderId: text()
      .notNull()
      .references(() => workOrders.id, { onDelete: "cascade" }),
    eventType: workOrderEventTypeEnum().notNull(),
    actorUserId: text().references(() => users.id),
    fromStatus: workOrderStatusEnum(),
    toStatus: workOrderStatusEnum(),
    notes: text(),
    metadata: jsonb().$type<Record<string, unknown>>(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    workOrderIdx: index("work_order_events_work_order_id_idx").on(table.workOrderId),
    createdAtIdx: index("work_order_events_created_at_idx").on(table.createdAt),
  }),
);

export const workOrderVerifications = pgTable(
  "work_order_verifications",
  {
    id: text().primaryKey(),
    workOrderId: text()
      .notNull()
      .references(() => workOrders.id, { onDelete: "cascade" }),
    verifierUserId: text().references(() => users.id),
    result: workOrderVerificationResultEnum().notNull(),
    notes: text(),
    inspectionId: text().references(() => inspections.id),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    workOrderIdx: index("work_order_verifications_work_order_id_idx").on(table.workOrderId),
    inspectionIdx: index("work_order_verifications_inspection_id_idx").on(table.inspectionId),
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
    nextStep: text(),
    slaBucket: text(),
    disputeState: text(),
    reminderScheduledAt: timestamp({ withTimezone: true }),
    recoveryEscalation: text(),
    latestPortalActivityAt: timestamp({ withTimezone: true }),
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
    source: text().default("provider").notNull(),
    trustLevel: text().default("authoritative").notNull(),
    lastProviderSyncAt: timestamp({ withTimezone: true }),
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
    providerEventId: text(),
    providerAttemptCount: integer().default(0).notNull(),
    lastProcessedAt: timestamp({ withTimezone: true }),
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

export const quickbooksConnections = pgTable(
  "quickbooks_connections",
  {
    id: text().primaryKey(),
    realmId: text().notNull(),
    companyName: text(),
    environment: quickbooksEnvironmentEnum().default("sandbox").notNull(),
    status: quickbooksConnectionStatusEnum().default("pending").notNull(),
    scopes: jsonb().$type<string[]>().default([]).notNull(),
    tokenType: text(),
    accessTokenEncrypted: text(),
    refreshTokenEncrypted: text(),
    accessTokenExpiresAt: timestamp({ withTimezone: true }),
    refreshTokenExpiresAt: timestamp({ withTimezone: true }),
    connectedByUserId: text().references(() => users.id),
    connectedAt: timestamp({ withTimezone: true }),
    lastRefreshedAt: timestamp({ withTimezone: true }),
    disconnectedAt: timestamp({ withTimezone: true }),
    metadata: jsonb().$type<Record<string, unknown>>(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    realmUnique: uniqueIndex("quickbooks_connections_realm_id_unique").on(
      table.realmId,
    ),
    statusIdx: index("quickbooks_connections_status_idx").on(table.status),
  }),
);

export const quickbooksAuthStates = pgTable(
  "quickbooks_auth_states",
  {
    id: text().primaryKey(),
    state: text().notNull(),
    requestedByUserId: text().references(() => users.id),
    redirectPath: text(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    consumedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    stateUnique: uniqueIndex("quickbooks_auth_states_state_unique").on(table.state),
    expiresIdx: index("quickbooks_auth_states_expires_at_idx").on(table.expiresAt),
  }),
);

export const authUsers = pgTable(
  "auth_users",
  {
    id: text().primaryKey(),
    name: text().notNull(),
    email: text().notNull(),
    emailVerified: boolean().default(false).notNull(),
    image: text(),
    twoFactorEnabled: boolean().default(false).notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    emailUnique: uniqueIndex("auth_users_email_unique").on(table.email),
  }),
);

export const authSessions = pgTable(
  "auth_sessions",
  {
    id: text().primaryKey(),
    token: text().notNull(),
    userId: text()
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    ipAddress: text(),
    userAgent: text(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tokenUnique: uniqueIndex("auth_sessions_token_unique").on(table.token),
    userIdx: index("auth_sessions_user_id_idx").on(table.userId),
  }),
);

export const authAccounts = pgTable(
  "auth_accounts",
  {
    id: text().primaryKey(),
    accountId: text().notNull(),
    providerId: text().notNull(),
    userId: text()
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    accessToken: text(),
    refreshToken: text(),
    idToken: text(),
    accessTokenExpiresAt: timestamp({ withTimezone: true }),
    refreshTokenExpiresAt: timestamp({ withTimezone: true }),
    scope: text(),
    password: text(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    providerAccountUnique: uniqueIndex("auth_accounts_provider_account_unique").on(
      table.providerId,
      table.accountId,
    ),
    userIdx: index("auth_accounts_user_id_idx").on(table.userId),
  }),
);

export const authVerifications = pgTable(
  "auth_verifications",
  {
    id: text().primaryKey(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    identifierIdx: index("auth_verifications_identifier_idx").on(table.identifier),
  }),
);

export const authTwoFactors = pgTable(
  "auth_two_factors",
  {
    id: text().primaryKey(),
    userId: text()
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    secret: text().notNull(),
    backupCodes: jsonb().$type<string[]>().default([]).notNull(),
    verified: boolean().default(false).notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userUnique: uniqueIndex("auth_two_factors_user_id_unique").on(table.userId),
  }),
);

export const permissions = pgTable(
  "permissions",
  {
    id: text().primaryKey(),
    key: text().notNull(),
    resource: text().notNull(),
    action: text().notNull(),
    description: text(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    keyUnique: uniqueIndex("permissions_key_unique").on(table.key),
    resourceActionUnique: uniqueIndex("permissions_resource_action_unique").on(
      table.resource,
      table.action,
    ),
  }),
);

export const roles = pgTable(
  "roles",
  {
    id: text().primaryKey(),
    key: text().notNull(),
    name: text().notNull(),
    description: text(),
    isSystem: boolean().default(false).notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    keyUnique: uniqueIndex("roles_key_unique").on(table.key),
  }),
);

export const rolePermissions = pgTable(
  "role_permissions",
  {
    id: text().primaryKey(),
    roleId: text()
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permissionId: text()
      .notNull()
      .references(() => permissions.id, { onDelete: "cascade" }),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    rolePermissionUnique: uniqueIndex("role_permissions_role_permission_unique").on(
      table.roleId,
      table.permissionId,
    ),
  }),
);

export const userBranchMemberships = pgTable(
  "user_branch_memberships",
  {
    id: text().primaryKey(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    branchId: text()
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    isPrimary: boolean().default(false).notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userBranchUnique: uniqueIndex("user_branch_memberships_user_branch_unique").on(
      table.userId,
      table.branchId,
    ),
  }),
);

export const userRoleAssignments = pgTable(
  "user_role_assignments",
  {
    id: text().primaryKey(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: text()
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    scopeType: roleScopeTypeEnum().default("global").notNull(),
    branchId: text().references(() => branches.id),
    customerId: text().references(() => customers.id),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userScopeIdx: index("user_role_assignments_user_scope_idx").on(
      table.userId,
      table.scopeType,
      table.branchId,
      table.customerId,
    ),
  }),
);

export const portalAccounts = pgTable(
  "portal_accounts",
  {
    id: text().primaryKey(),
    authUserId: text()
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    customerId: text()
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    locationIds: jsonb().$type<string[]>().default([]).notNull(),
    active: boolean().default(true).notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    authUserUnique: uniqueIndex("portal_accounts_auth_user_id_unique").on(
      table.authUserId,
    ),
    customerIdx: index("portal_accounts_customer_id_idx").on(table.customerId),
  }),
);

export const assetAllocations = pgTable(
  "asset_allocations",
  {
    id: text().primaryKey(),
    assetId: text()
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    contractId: text().references(() => contracts.id, { onDelete: "cascade" }),
    contractLineId: text().references(() => contractLines.id, {
      onDelete: "cascade",
    }),
    dispatchTaskId: text().references(() => dispatchTasks.id),
    workOrderId: text().references(() => workOrders.id, { onDelete: "cascade" }),
    allocationType: assetAllocationTypeEnum().notNull(),
    startsAt: timestamp({ withTimezone: true }).notNull(),
    endsAt: timestamp({ withTimezone: true }),
    sourceEvent: text().notNull(),
    active: boolean().default(true).notNull(),
    metadata: jsonb().$type<Record<string, unknown>>(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    assetWindowIdx: index("asset_allocations_asset_window_idx").on(
      table.assetId,
      table.startsAt,
      table.endsAt,
    ),
    contractIdx: index("asset_allocations_contract_id_idx").on(table.contractId),
    workOrderIdx: index("asset_allocations_work_order_id_idx").on(table.workOrderId),
  }),
);

export const contractAmendments = pgTable(
  "contract_amendments",
  {
    id: text().primaryKey(),
    contractId: text()
      .notNull()
      .references(() => contracts.id, { onDelete: "cascade" }),
    amendmentType: contractAmendmentTypeEnum().notNull(),
    requestedByUserId: text().references(() => users.id),
    approvedByUserId: text().references(() => users.id),
    effectiveAt: timestamp({ withTimezone: true }),
    notes: text(),
    deltaPayload: jsonb().$type<Record<string, unknown>>(),
    approvedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    contractIdx: index("contract_amendments_contract_id_idx").on(table.contractId),
  }),
);

export const documents = pgTable(
  "documents",
  {
    id: text().primaryKey(),
    contractId: text().references(() => contracts.id),
    customerId: text().references(() => customers.id),
    workOrderId: text().references(() => workOrders.id),
    documentType: text().notNull(),
    status: documentStatusEnum().notNull(),
    filename: text().notNull(),
    source: documentSourceEnum().notNull(),
    hash: text().notNull(),
    contentType: text().notNull(),
    sizeBytes: integer().notNull(),
    storageProvider: storageProviderEnum().notNull(),
    storageBucket: text(),
    storageKey: text(),
    storageVersionId: text(),
    storageETag: text(),
    objectLocked: boolean().default(false).notNull(),
    retentionMode: retentionModeEnum(),
    retentionUntil: timestamp({ withTimezone: true }),
    lockedAt: timestamp({ withTimezone: true }),
    legalHold: boolean().default(false).notNull(),
    relatedSignatureRequestId: text(),
    supersedesDocumentId: text(),
    metadata: jsonb().$type<Record<string, unknown>>(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    contractIdx: index("documents_contract_id_idx").on(table.contractId),
    customerIdx: index("documents_customer_id_idx").on(table.customerId),
    workOrderIdx: index("documents_work_order_id_idx").on(table.workOrderId),
    signatureIdx: index("documents_related_signature_request_id_idx").on(
      table.relatedSignatureRequestId,
    ),
  }),
);

export const signatureRequests = pgTable(
  "signature_requests",
  {
    id: text().primaryKey(),
    contractId: text()
      .notNull()
      .references(() => contracts.id, { onDelete: "cascade" }),
    customerId: text()
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    provider: text().default("Metro Trailer").notNull(),
    status: signatureRequestStatusEnum().notNull(),
    title: text().notNull(),
    subject: text().notNull(),
    message: text().notNull(),
    consentTextVersion: text().notNull(),
    certificationText: text().notNull(),
    documentId: text().references(() => documents.id),
    finalDocumentId: text().references(() => documents.id),
    certificateDocumentId: text().references(() => documents.id),
    signingFields: jsonb().$type<SignatureFieldRecord[]>().default([]).notNull(),
    expiresAt: timestamp({ withTimezone: true }),
    cancelledAt: timestamp({ withTimezone: true }),
    evidenceHash: text(),
    requestedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp({ withTimezone: true }),
    createdByUserId: text().references(() => users.id),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    contractIdx: index("signature_requests_contract_id_idx").on(table.contractId),
    customerIdx: index("signature_requests_customer_id_idx").on(table.customerId),
    statusIdx: index("signature_requests_status_idx").on(table.status),
  }),
);

export const signatureSigners = pgTable(
  "signature_signers",
  {
    id: text().primaryKey(),
    signatureRequestId: text()
      .notNull()
      .references(() => signatureRequests.id, { onDelete: "cascade" }),
    name: text().notNull(),
    email: text().notNull(),
    title: text(),
    routingOrder: integer().notNull(),
    status: signatureSignerStatusEnum().default("pending").notNull(),
    requestedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    viewedAt: timestamp({ withTimezone: true }),
    signedAt: timestamp({ withTimezone: true }),
    declinedAt: timestamp({ withTimezone: true }),
    reminderCount: integer().default(0).notNull(),
    lastReminderAt: timestamp({ withTimezone: true }),
    signatureText: text(),
    signatureMode: signatureAppearanceModeEnum(),
    signatureAppearanceDataUrl: text(),
    signatureAppearanceHash: text(),
    intentAcceptedAt: timestamp({ withTimezone: true }),
    consentAcceptedAt: timestamp({ withTimezone: true }),
    certificationAcceptedAt: timestamp({ withTimezone: true }),
    otpVerifiedAt: timestamp({ withTimezone: true }),
    ipAddress: text(),
    userAgent: text(),
    evidenceHash: text(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    requestOrderUnique: uniqueIndex("signature_signers_request_order_unique").on(
      table.signatureRequestId,
      table.routingOrder,
    ),
    requestIdx: index("signature_signers_signature_request_id_idx").on(
      table.signatureRequestId,
    ),
  }),
);

export const signatureEvents = pgTable(
  "signature_events",
  {
    id: text().primaryKey(),
    signatureRequestId: text()
      .notNull()
      .references(() => signatureRequests.id, { onDelete: "cascade" }),
    signerId: text().references(() => signatureSigners.id, { onDelete: "cascade" }),
    type: text().notNull(),
    actor: text().notNull(),
    metadata: jsonb().$type<Record<string, unknown>>(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    requestIdx: index("signature_events_signature_request_id_idx").on(
      table.signatureRequestId,
    ),
  }),
);

export const signatureAccessTokens = pgTable(
  "signature_access_tokens",
  {
    id: text().primaryKey(),
    signatureRequestId: text()
      .notNull()
      .references(() => signatureRequests.id, { onDelete: "cascade" }),
    signerId: text()
      .notNull()
      .references(() => signatureSigners.id, { onDelete: "cascade" }),
    purpose: signatureAccessTokenPurposeEnum().notNull(),
    tokenHash: text().notNull(),
    otpCodeHash: text(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    consumedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    signerPurposeIdx: index("signature_access_tokens_signer_purpose_idx").on(
      table.signerId,
      table.purpose,
    ),
  }),
);

export const collectionActivities = pgTable(
  "collection_activities",
  {
    id: text().primaryKey(),
    collectionCaseId: text()
      .notNull()
      .references(() => collectionCases.id, { onDelete: "cascade" }),
    activityType: collectionActivityTypeEnum().notNull(),
    performedByUserId: text().references(() => users.id),
    note: text(),
    payload: jsonb().$type<Record<string, unknown>>(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    caseIdx: index("collection_activities_collection_case_id_idx").on(
      table.collectionCaseId,
    ),
  }),
);

export const promisedPayments = pgTable(
  "promised_payments",
  {
    id: text().primaryKey(),
    collectionCaseId: text()
      .notNull()
      .references(() => collectionCases.id, { onDelete: "cascade" }),
    amount: numeric({ precision: 12, scale: 2 }).notNull(),
    promisedFor: timestamp({ withTimezone: true }).notNull(),
    status: text().default("open").notNull(),
    notes: text(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    resolvedAt: timestamp({ withTimezone: true }),
  },
  (table) => ({
    caseIdx: index("promised_payments_collection_case_id_idx").on(
      table.collectionCaseId,
    ),
  }),
);

export const paymentTransactions = pgTable(
  "payment_transactions",
  {
    id: text().primaryKey(),
    invoiceId: text().references(() => invoices.id),
    customerId: text().references(() => customers.id),
    paymentMethodId: text().references(() => paymentMethods.id),
    provider: integrationProviderEnum().default("stripe").notNull(),
    transactionType: paymentTransactionTypeEnum().notNull(),
    status: paymentTransactionStatusEnum().notNull(),
    externalId: text(),
    amount: numeric({ precision: 12, scale: 2 }).notNull(),
    currency: text().default("usd").notNull(),
    payload: jsonb().$type<Record<string, unknown>>(),
    errorMessage: text(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    settledAt: timestamp({ withTimezone: true }),
  },
  (table) => ({
    invoiceIdx: index("payment_transactions_invoice_id_idx").on(table.invoiceId),
    externalIdUnique: uniqueIndex("payment_transactions_external_id_unique").on(
      table.provider,
      table.externalId,
    ),
  }),
);

export const externalEntityMappings = pgTable(
  "external_entity_mappings",
  {
    id: text().primaryKey(),
    provider: integrationProviderEnum().notNull(),
    entityType: text().notNull(),
    internalId: text().notNull(),
    externalId: text().notNull(),
    payload: jsonb().$type<Record<string, unknown>>(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    providerEntityUnique: uniqueIndex("external_entity_mappings_provider_entity_unique").on(
      table.provider,
      table.entityType,
      table.internalId,
    ),
    externalLookupUnique: uniqueIndex("external_entity_mappings_external_lookup_unique").on(
      table.provider,
      table.entityType,
      table.externalId,
    ),
  }),
);

export const accountingSyncIssues = pgTable(
  "accounting_sync_issues",
  {
    id: text().primaryKey(),
    provider: integrationProviderEnum().default("quickbooks").notNull(),
    connectionId: text().references(() => quickbooksConnections.id),
    syncJobId: text().references(() => integrationSyncJobs.id),
    entityType: text().notNull(),
    internalEntityId: text(),
    externalEntityId: text(),
    status: accountingSyncIssueStatusEnum().default("open").notNull(),
    reasonCode: text().notNull(),
    summary: text().notNull(),
    details: jsonb().$type<Record<string, unknown>>(),
    resolvedByUserId: text().references(() => users.id),
    resolvedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    statusIdx: index("accounting_sync_issues_status_idx").on(
      table.provider,
      table.status,
    ),
    entityIdx: index("accounting_sync_issues_entity_idx").on(
      table.entityType,
      table.internalEntityId,
    ),
  }),
);

export const webhookReceipts = pgTable(
  "webhook_receipts",
  {
    id: text().primaryKey(),
    provider: integrationProviderEnum().notNull(),
    signature: text(),
    externalEventId: text(),
    headers: jsonb().$type<Record<string, unknown>>().notNull(),
    payload: jsonb().$type<Record<string, unknown>>().notNull(),
    verified: boolean().default(false).notNull(),
    verificationError: text(),
    status: webhookProcessingStatusEnum().default("received").notNull(),
    attempts: integer().default(0).notNull(),
    processingError: text(),
    receivedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    lastAttemptAt: timestamp({ withTimezone: true }),
    processedAt: timestamp({ withTimezone: true }),
  },
  (table) => ({
    providerEventUnique: uniqueIndex("webhook_receipts_provider_event_unique").on(
      table.provider,
      table.externalEventId,
    ),
  }),
);

export const outboxJobs = pgTable(
  "outbox_jobs",
  {
    id: text().primaryKey(),
    jobType: text().notNull(),
    status: outboxJobStatusEnum().default("pending").notNull(),
    aggregateType: text().notNull(),
    aggregateId: text().notNull(),
    provider: integrationProviderEnum(),
    idempotencyKey: text(),
    correlationId: text(),
    payload: jsonb().$type<Record<string, unknown>>().notNull(),
    attempts: integer().default(0).notNull(),
    maxAttempts: integer().default(10).notNull(),
    availableAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    lockedBy: text(),
    startedAt: timestamp({ withTimezone: true }),
    lastAttemptAt: timestamp({ withTimezone: true }),
    finishedAt: timestamp({ withTimezone: true }),
    lastError: text(),
    deadLetteredAt: timestamp({ withTimezone: true }),
    deadLetterReason: text(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    statusAvailableIdx: index("outbox_jobs_status_available_at_idx").on(
      table.status,
      table.availableAt,
    ),
    aggregateIdx: index("outbox_jobs_aggregate_idx").on(
      table.aggregateType,
      table.aggregateId,
    ),
  }),
);

export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    id: text().primaryKey(),
    key: text().notNull(),
    requestPath: text().notNull(),
    requestMethod: text().notNull(),
    requestHash: text().notNull(),
    responseStatus: integer(),
    responseBody: jsonb().$type<Record<string, unknown>>(),
    lockedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    keyUnique: uniqueIndex("idempotency_keys_key_unique").on(
      table.key,
      table.requestMethod,
      table.requestPath,
    ),
  }),
);

export const workOrderLaborEntries = pgTable(
  "work_order_labor_entries",
  {
    id: text().primaryKey(),
    workOrderId: text()
      .notNull()
      .references(() => workOrders.id, { onDelete: "cascade" }),
    technicianUserId: text().references(() => users.id),
    hours: numeric({ precision: 8, scale: 2 }).notNull(),
    hourlyRate: numeric({ precision: 12, scale: 2 }),
    notes: text(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    workOrderIdx: index("work_order_labor_entries_work_order_id_idx").on(
      table.workOrderId,
    ),
  }),
);

export const workOrderPartEntries = pgTable(
  "work_order_part_entries",
  {
    id: text().primaryKey(),
    workOrderId: text()
      .notNull()
      .references(() => workOrders.id, { onDelete: "cascade" }),
    partNumber: text(),
    description: text().notNull(),
    quantity: numeric({ precision: 8, scale: 2 }).notNull(),
    unitCost: numeric({ precision: 12, scale: 2 }),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    workOrderIdx: index("work_order_part_entries_work_order_id_idx").on(
      table.workOrderId,
    ),
  }),
);

export const notifications = pgTable(
  "notifications",
  {
    id: text().primaryKey(),
    channel: notificationChannelEnum().notNull(),
    status: notificationStatusEnum().default("queued").notNull(),
    toAddress: text().notNull(),
    subject: text(),
    body: text().notNull(),
    relatedEntityType: text(),
    relatedEntityId: text(),
    providerMessageId: text(),
    payload: jsonb().$type<Record<string, unknown>>(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    sentAt: timestamp({ withTimezone: true }),
    failedAt: timestamp({ withTimezone: true }),
    errorMessage: text(),
  },
  (table) => ({
    statusIdx: index("notifications_status_idx").on(table.status),
    entityIdx: index("notifications_entity_idx").on(
      table.relatedEntityType,
      table.relatedEntityId,
    ),
  }),
);
