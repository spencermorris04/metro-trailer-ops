import {
  agreementKinds,
  assetAvailabilities,
  assetStatuses,
  assetTypes,
  billingUnits,
  contractLineKinds,
  contractStatuses,
  customerTypes,
  dispatchTaskStatuses,
  financialEventStatuses,
  financialEventTypes,
  importCompletenesses,
  invoiceSourceKinds,
  invoiceStatuses,
  maintenanceStatuses,
  revenueRecognitionBases,
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
  "commercial_event",
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
  "business_central",
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

const bcImportRunStatuses = [
  "pending",
  "running",
  "succeeded",
  "partial_failure",
  "failed",
] as const;

const subledgerDocumentStatuses = [
  "draft",
  "open",
  "posted",
  "partially_applied",
  "closed",
  "voided",
] as const;

const journalLineSides = ["debit", "credit"] as const;

const journalEntryStatuses = ["draft", "posted", "reversed"] as const;

const postingRuleScopes = [
  "contract",
  "invoice",
  "receipt",
  "bill",
  "payment",
  "fixed_asset",
  "manual",
] as const;

const cashTransactionTypes = [
  "receipt",
  "disbursement",
  "transfer",
  "adjustment",
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
export const agreementKindEnum = pgEnum("agreement_kind", agreementKinds);
export const importCompletenessEnum = pgEnum(
  "import_completeness",
  importCompletenesses,
);
export const contractLineKindEnum = pgEnum(
  "contract_line_kind",
  contractLineKinds,
);
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
export const invoiceSourceKindEnum = pgEnum(
  "invoice_source_kind",
  invoiceSourceKinds,
);
export const revenueRecognitionBasisEnum = pgEnum(
  "revenue_recognition_basis",
  revenueRecognitionBases,
);
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
export const bcImportRunStatusEnum = pgEnum(
  "bc_import_run_status",
  bcImportRunStatuses,
);
export const subledgerDocumentStatusEnum = pgEnum(
  "subledger_document_status",
  subledgerDocumentStatuses,
);
export const journalLineSideEnum = pgEnum(
  "journal_line_side",
  journalLineSides,
);
export const journalEntryStatusEnum = pgEnum(
  "journal_entry_status",
  journalEntryStatuses,
);
export const postingRuleScopeEnum = pgEnum(
  "posting_rule_scope",
  postingRuleScopes,
);
export const cashTransactionTypeEnum = pgEnum(
  "cash_transaction_type",
  cashTransactionTypes,
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
    responsibilityCenter: text(),
    defaultSalesTeam: text(),
    defaultDealCode: text(),
    damageWaiverDeclined: boolean(),
    insuranceCertRequired: boolean(),
    insuranceExpirationDate: timestamp({ withTimezone: true }),
    insurancePolicyNo: text(),
    registrationNumber: text(),
    sourcePayload: jsonb().$type<Record<string, unknown>>(),
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
    sourcePayload: jsonb().$type<Record<string, unknown>>(),
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

export const workspaceLayouts = pgTable(
  "workspace_layouts",
  {
    id: text().primaryKey(),
    ownerKey: text().notNull(),
    pageKey: text().notNull(),
    layout: jsonb().$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    ownerPageUnique: uniqueIndex("workspace_layouts_owner_page_unique").on(
      table.ownerKey,
      table.pageKey,
    ),
  }),
);

export const globalSearchDocuments = pgTable(
  "global_search_documents",
  {
    id: text().primaryKey(),
    entityType: text().notNull(),
    entityId: text().notNull(),
    title: text().notNull(),
    subtitle: text(),
    href: text().notNull(),
    branchId: text().references(() => branches.id),
    searchText: text().notNull(),
    keywords: jsonb().$type<string[]>().default([]).notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    entityUnique: uniqueIndex("global_search_documents_entity_unique").on(
      table.entityType,
      table.entityId,
    ),
    entityBranchIdx: index("global_search_documents_entity_branch_idx").on(
      table.entityType,
      table.branchId,
    ),
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
    manufacturer: text(),
    modelYear: integer(),
    registrationNumber: text(),
    faClassCode: text(),
    faSubclassCode: text(),
    bcLocationCode: text(),
    bcDimension1Code: text(),
    bcProductNo: text(),
    bcServiceItemNo: text(),
    isBlocked: boolean().default(false).notNull(),
    isInactive: boolean().default(false).notNull(),
    isDisposed: boolean().default(false).notNull(),
    isOnRent: boolean().default(false).notNull(),
    isInService: boolean().default(true).notNull(),
    underMaintenance: boolean().default(false).notNull(),
    bookValue: numeric({ precision: 12, scale: 2 }),
    sourcePayload: jsonb().$type<Record<string, unknown>>(),
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
    agreementKind: agreementKindEnum().default("rental_order").notNull(),
    legacySourceSystem: text(),
    legacyDocumentNo: text(),
    legacyPreviousDocumentNo: text(),
    legacyPreviousDocumentType: text(),
    serviceBranchId: text().references(() => branches.id),
    serviceLocationCode: text(),
    agreementState: text(),
    importCompleteness: importCompletenessEnum(),
    legacyOpenedAt: timestamp({ withTimezone: true }),
    legacyClosedAt: timestamp({ withTimezone: true }),
    postedAt: timestamp({ withTimezone: true }),
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
    sourceProvider: integrationProviderEnum(),
    sourceDocumentType: text(),
    sourceDocumentNo: text(),
    sourceStatus: text(),
    sourceSnapshot: jsonb().$type<Record<string, unknown>>(),
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
    lineKind: contractLineKindEnum(),
    sourceLineType: text(),
    sourceSequenceNo: integer(),
    sourceDealCode: text(),
    sourceDealLength: numeric({ precision: 10, scale: 2 }),
    billingFor: text(),
    invoiceFromDate: timestamp({ withTimezone: true }),
    invoiceThruDate: timestamp({ withTimezone: true }),
    shipmentDate: timestamp({ withTimezone: true }),
    returnDate: timestamp({ withTimezone: true }),
    taxGroupCode: text(),
    damageWaiverPercent: numeric({ precision: 8, scale: 4 }),
    parentItemLineNo: integer(),
    legacyPostingDate: timestamp({ withTimezone: true }),
    sourceLineNo: integer(),
    sourceItemNo: text(),
    sourceUomCode: text(),
    sourceSnapshot: jsonb().$type<Record<string, unknown>>(),
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
    legacyInvoiceNo: text(),
    legacyOrderNo: text(),
    invoiceSourceKind: invoiceSourceKindEnum().default("app_native").notNull(),
    importCompleteness: importCompletenessEnum(),
    postingDate: timestamp({ withTimezone: true }),
    responsibilityCenter: text(),
    dimensionSetId: integer(),
    deliveryStatus: text().default("draft").notNull(),
    sentAt: timestamp({ withTimezone: true }),
    deliveryChannel: text(),
    quickBooksSyncStatus: text().default("pending").notNull(),
    quickBooksLastSyncedAt: timestamp({ withTimezone: true }),
    quickBooksLastError: text(),
    quickBooksInvoiceId: text(),
    stripePaymentIntentId: text(),
    sourceProvider: integrationProviderEnum(),
    sourceDocumentType: text(),
    sourceDocumentNo: text(),
    sourceStatus: text(),
    sourceSnapshot: jsonb().$type<Record<string, unknown>>(),
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

export const commercialEvents = pgTable(
  "commercial_events",
  {
    id: text().primaryKey(),
    contractId: text().references(() => contracts.id),
    contractLineId: text().references(() => contractLines.id),
    assetId: text().references(() => assets.id),
    workOrderId: text().references(() => workOrders.id),
    invoiceId: text().references(() => invoices.id),
    servicePeriodStart: timestamp({ withTimezone: true }),
    servicePeriodEnd: timestamp({ withTimezone: true }),
    serviceBranchId: text().references(() => branches.id),
    serviceLocationCode: text(),
    customerLocationId: text().references(() => customerLocations.id),
    legacyOrderNo: text(),
    legacyInvoiceNo: text(),
    legacyLineNo: integer(),
    revenueRecognitionBasis: revenueRecognitionBasisEnum(),
    eventType: financialEventTypeEnum().notNull(),
    description: text().notNull(),
    amount: numeric({ precision: 12, scale: 2 }).notNull(),
    eventDate: timestamp({ withTimezone: true }).notNull(),
    status: financialEventStatusEnum().default("pending").notNull(),
    externalReference: text(),
    sourceDocumentType: text(),
    sourceDocumentNo: text(),
    sourceSnapshot: jsonb().$type<Record<string, unknown>>(),
    metadata: jsonb().$type<Record<string, unknown>>(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    contractStatusIdx: index("commercial_events_contract_status_idx").on(
      table.contractId,
      table.status,
    ),
    assetIdx: index("commercial_events_asset_id_idx").on(table.assetId),
    workOrderIdx: index("commercial_events_work_order_id_idx").on(table.workOrderId),
    invoiceIdx: index("commercial_events_invoice_id_idx").on(table.invoiceId),
    eventDateIdx: index("commercial_events_event_date_idx").on(table.eventDate),
  }),
);

export const financialEvents = commercialEvents;

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
    contractLineId: text().references(() => contractLines.id),
    assetId: text().references(() => assets.id),
    lineKind: contractLineKindEnum(),
    servicePeriodStart: timestamp({ withTimezone: true }),
    servicePeriodEnd: timestamp({ withTimezone: true }),
    legacyDealCode: text(),
    taxGroupCode: text(),
    sourceSequenceNo: integer(),
    sourceLineNo: integer(),
    sourceItemNo: text(),
    sourceUomCode: text(),
    sourceSnapshot: jsonb().$type<Record<string, unknown>>(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    invoiceIdx: index("invoice_lines_invoice_id_idx").on(table.invoiceId),
  }),
);

export const arInvoices = invoices;
export const arInvoiceLines = invoiceLines;

export const bcImportRuns = pgTable(
  "bc_import_runs",
  {
    id: text().primaryKey(),
    provider: integrationProviderEnum().default("business_central").notNull(),
    entityType: text().notNull(),
    status: bcImportRunStatusEnum().default("pending").notNull(),
    sourceWindowStart: timestamp({ withTimezone: true }),
    sourceWindowEnd: timestamp({ withTimezone: true }),
    startedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    finishedAt: timestamp({ withTimezone: true }),
    recordsSeen: integer().default(0).notNull(),
    recordsInserted: integer().default(0).notNull(),
    recordsUpdated: integer().default(0).notNull(),
    recordsSkipped: integer().default(0).notNull(),
    recordsFailed: integer().default(0).notNull(),
    errorSummary: text(),
    jobVersion: text(),
    metadata: jsonb().$type<Record<string, unknown>>(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    statusIdx: index("bc_import_runs_status_idx").on(table.entityType, table.status),
    startedAtIdx: index("bc_import_runs_started_at_idx").on(table.startedAt),
  }),
);

export const bcImportErrors = pgTable(
  "bc_import_errors",
  {
    id: text().primaryKey(),
    runId: text()
      .notNull()
      .references(() => bcImportRuns.id, { onDelete: "cascade" }),
    entityType: text().notNull(),
    externalId: text(),
    internalId: text(),
    pageCursor: text(),
    errorCode: text(),
    message: text().notNull(),
    payload: jsonb().$type<Record<string, unknown>>(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    resolvedAt: timestamp({ withTimezone: true }),
  },
  (table) => ({
    runIdx: index("bc_import_errors_run_id_idx").on(table.runId),
    entityIdx: index("bc_import_errors_entity_idx").on(
      table.entityType,
      table.externalId,
    ),
  }),
);

export const bcImportCheckpoints = pgTable(
  "bc_import_checkpoints",
  {
    id: text().primaryKey(),
    entityType: text().notNull(),
    runId: text().references(() => bcImportRuns.id, { onDelete: "set null" }),
    cursor: text(),
    pageNumber: integer().default(0).notNull(),
    lastExternalId: text(),
    windowStart: timestamp({ withTimezone: true }),
    windowEnd: timestamp({ withTimezone: true }),
    checkpointData: jsonb().$type<Record<string, unknown>>(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    entityUnique: uniqueIndex("bc_import_checkpoints_entity_unique").on(
      table.entityType,
    ),
  }),
);

export const bcSourceDocuments = pgTable(
  "bc_source_documents",
  {
    id: text().primaryKey(),
    runId: text().references(() => bcImportRuns.id, { onDelete: "set null" }),
    externalDocumentId: text().notNull(),
    documentType: text().notNull(),
    documentNo: text().notNull(),
    customerExternalId: text(),
    status: text(),
    documentDate: timestamp({ withTimezone: true }),
    dueDate: timestamp({ withTimezone: true }),
    payload: jsonb().$type<Record<string, unknown>>().notNull(),
    importedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    externalUnique: uniqueIndex("bc_source_documents_external_unique").on(
      table.documentType,
      table.externalDocumentId,
    ),
    documentNoIdx: index("bc_source_documents_document_no_idx").on(
      table.documentType,
      table.documentNo,
    ),
  }),
);

export const bcSourceDocumentLines = pgTable(
  "bc_source_document_lines",
  {
    id: text().primaryKey(),
    sourceDocumentId: text()
      .notNull()
      .references(() => bcSourceDocuments.id, { onDelete: "cascade" }),
    externalLineId: text(),
    lineNo: integer(),
    itemNo: text(),
    uomCode: text(),
    quantity: numeric({ precision: 12, scale: 2 }),
    unitPrice: numeric({ precision: 12, scale: 2 }),
    lineAmount: numeric({ precision: 12, scale: 2 }),
    payload: jsonb().$type<Record<string, unknown>>().notNull(),
    importedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    documentIdx: index("bc_source_document_lines_document_id_idx").on(
      table.sourceDocumentId,
    ),
  }),
);

export const bcCustomerCards = pgTable(
  "bc_customer_cards",
  {
    id: text().primaryKey(),
    runId: text().references(() => bcImportRuns.id, { onDelete: "set null" }),
    customerNo: text().notNull(),
    name: text().notNull(),
    customerType: text(),
    parentNo: text(),
    parentName: text(),
    blocked: text(),
    responsibilityCenter: text(),
    salespersonCode: text(),
    defaultSalesTeam: text(),
    defaultDealCode: text(),
    damageWaiverDeclined: boolean(),
    insuranceCertRequired: boolean(),
    insuranceExpirationDate: timestamp({ withTimezone: true }),
    insurancePolicyNo: text(),
    registrationNumber: text(),
    balanceLcy: numeric({ precision: 14, scale: 2 }),
    balanceDueLcy: numeric({ precision: 14, scale: 2 }),
    creditLimitLcy: numeric({ precision: 14, scale: 2 }),
    sourcePayload: jsonb().$type<Record<string, unknown>>().notNull(),
    importedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    customerNoUnique: uniqueIndex("bc_customer_cards_no_unique").on(
      table.customerNo,
    ),
    parentIdx: index("bc_customer_cards_parent_idx").on(table.parentNo),
  }),
);

export const bcRmiPostedRentalHeaders = pgTable(
  "bc_rmi_posted_rental_headers",
  {
    id: text().primaryKey(),
    runId: text().references(() => bcImportRuns.id, { onDelete: "set null" }),
    externalId: text(),
    documentType: text().notNull(),
    documentNo: text().notNull(),
    previousDocType: text(),
    previousNo: text(),
    sellToCustomerNo: text(),
    billToCustomerNo: text(),
    shipToCode: text(),
    postingDate: timestamp({ withTimezone: true }),
    orderDate: timestamp({ withTimezone: true }),
    selectThruDate: timestamp({ withTimezone: true }),
    documentDate: timestamp({ withTimezone: true }),
    dueDate: timestamp({ withTimezone: true }),
    shipmentDate: timestamp({ withTimezone: true }),
    returnDate: timestamp({ withTimezone: true }),
    locationCode: text(),
    responsibilityCenter: text(),
    shortcutDimension1Code: text(),
    shortcutDimension2Code: text(),
    status: text(),
    sourceCode: text(),
    externalDocumentNo: text(),
    dimensionSetId: integer(),
    sourcePayload: jsonb().$type<Record<string, unknown>>().notNull(),
    importedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    documentUnique: uniqueIndex("bc_rmi_prh_doc_unique").on(
      table.documentType,
      table.documentNo,
    ),
    previousIdx: index("bc_rmi_prh_previous_idx").on(
      table.previousDocType,
      table.previousNo,
    ),
    customerIdx: index("bc_rmi_prh_customer_idx").on(table.billToCustomerNo),
  }),
);

export const bcRmiPostedRentalLines = pgTable(
  "bc_rmi_posted_rental_lines",
  {
    id: text().primaryKey(),
    runId: text().references(() => bcImportRuns.id, { onDelete: "set null" }),
    externalId: text(),
    documentType: text().notNull(),
    documentNo: text().notNull(),
    lineNo: integer().notNull(),
    sequenceNo: integer(),
    lineType: text(),
    type: text(),
    itemNo: text(),
    description: text(),
    quantity: numeric({ precision: 14, scale: 4 }),
    unitOfMeasureCode: text(),
    unitPrice: numeric({ precision: 14, scale: 2 }),
    grossAmount: numeric({ precision: 14, scale: 2 }),
    grossAmountLcy: numeric({ precision: 14, scale: 2 }),
    lineDiscountAmount: numeric({ precision: 14, scale: 2 }),
    invoiceDiscountAmount: numeric({ precision: 14, scale: 2 }),
    taxAmount: numeric({ precision: 14, scale: 2 }),
    damageWaiverAmount: numeric({ precision: 14, scale: 2 }),
    fromDate: timestamp({ withTimezone: true }),
    thruDate: timestamp({ withTimezone: true }),
    invoiceFromDate: timestamp({ withTimezone: true }),
    invoiceThruDate: timestamp({ withTimezone: true }),
    shipmentDate: timestamp({ withTimezone: true }),
    returnDate: timestamp({ withTimezone: true }),
    postingDate: timestamp({ withTimezone: true }),
    previousDocType: text(),
    previousNo: text(),
    dealCode: text(),
    dealLength: numeric({ precision: 10, scale: 2 }),
    billingFor: text(),
    locationCode: text(),
    shortcutDimension1Code: text(),
    shortcutDimension2Code: text(),
    taxGroupCode: text(),
    dimensionSetId: integer(),
    sourcePayload: jsonb().$type<Record<string, unknown>>().notNull(),
    importedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    lineUnique: uniqueIndex("bc_rmi_prl_line_unique").on(
      table.documentType,
      table.documentNo,
      table.lineNo,
    ),
    previousIdx: index("bc_rmi_prl_previous_idx").on(
      table.previousDocType,
      table.previousNo,
    ),
    assetIdx: index("bc_rmi_prl_asset_idx").on(table.type, table.itemNo),
  }),
);

export const bcRmiRentalLedgerEntries = pgTable(
  "bc_rmi_rental_ledger_entries",
  {
    id: text().primaryKey(),
    runId: text().references(() => bcImportRuns.id, { onDelete: "set null" }),
    externalEntryNo: text().notNull(),
    documentType: text(),
    documentNo: text(),
    orderNo: text(),
    postingDate: timestamp({ withTimezone: true }),
    billToCustomerNo: text(),
    typeOrdered: text(),
    noOrdered: text(),
    typeShipped: text(),
    noShipped: text(),
    serialNoShipped: text(),
    quantity: numeric({ precision: 14, scale: 4 }),
    fromDate: timestamp({ withTimezone: true }),
    thruDate: timestamp({ withTimezone: true }),
    rentalDays: numeric({ precision: 14, scale: 4 }),
    unitPrice: numeric({ precision: 14, scale: 2 }),
    grossAmount: numeric({ precision: 14, scale: 2 }),
    grossAmountLcy: numeric({ precision: 14, scale: 2 }),
    lineDiscountAmount: numeric({ precision: 14, scale: 2 }),
    invoiceDiscountAmount: numeric({ precision: 14, scale: 2 }),
    dealCode: text(),
    shortcutDimension1Code: text(),
    shortcutDimension2Code: text(),
    sourcePayload: jsonb().$type<Record<string, unknown>>().notNull(),
    importedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    entryNoUnique: uniqueIndex("bc_rmi_rle_entry_unique").on(
      table.externalEntryNo,
    ),
    documentIdx: index("bc_rmi_rle_document_idx").on(
      table.documentType,
      table.documentNo,
    ),
    orderIdx: index("bc_rmi_rle_order_idx").on(table.orderNo),
  }),
);

export const bcRmiWsRentalLedgerEntries = pgTable(
  "bc_rmi_ws_rental_ledger_entries",
  {
    id: text().primaryKey(),
    runId: text().references(() => bcImportRuns.id, { onDelete: "set null" }),
    externalEntryNo: text().notNull(),
    documentType: text(),
    documentNo: text(),
    orderNo: text(),
    postingDate: timestamp({ withTimezone: true }),
    billToCustomerNo: text(),
    typeOrdered: text(),
    noOrdered: text(),
    typeShipped: text(),
    noShipped: text(),
    serialNoShipped: text(),
    quantity: numeric({ precision: 14, scale: 4 }),
    fromDate: timestamp({ withTimezone: true }),
    thruDate: timestamp({ withTimezone: true }),
    rentalDays: numeric({ precision: 14, scale: 4 }),
    unitPrice: numeric({ precision: 14, scale: 2 }),
    grossAmount: numeric({ precision: 14, scale: 2 }),
    grossAmountLcy: numeric({ precision: 14, scale: 2 }),
    lineDiscountAmount: numeric({ precision: 14, scale: 2 }),
    invoiceDiscountAmount: numeric({ precision: 14, scale: 2 }),
    dealCode: text(),
    shortcutDimension1Code: text(),
    shortcutDimension2Code: text(),
    sourcePayload: jsonb().$type<Record<string, unknown>>().notNull(),
    importedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    entryNoUnique: uniqueIndex("bc_rmi_ws_rle_entry_unique").on(
      table.externalEntryNo,
    ),
    documentIdx: index("bc_rmi_ws_rle_document_idx").on(
      table.documentType,
      table.documentNo,
    ),
    orderIdx: index("bc_rmi_ws_rle_order_idx").on(table.orderNo),
  }),
);

export const bcRmiPostedRentalInvoiceHeaders = pgTable(
  "bc_rmi_posted_rental_invoice_headers",
  {
    id: text().primaryKey(),
    runId: text().references(() => bcImportRuns.id, { onDelete: "set null" }),
    documentType: text().notNull(),
    documentNo: text().notNull(),
    previousDocType: text(),
    previousNo: text(),
    sellToCustomerNo: text(),
    billToCustomerNo: text(),
    postingDate: timestamp({ withTimezone: true }),
    documentDate: timestamp({ withTimezone: true }),
    dueDate: timestamp({ withTimezone: true }),
    locationCode: text(),
    responsibilityCenter: text(),
    shortcutDimension1Code: text(),
    shortcutDimension2Code: text(),
    externalDocumentNo: text(),
    sourcePayload: jsonb().$type<Record<string, unknown>>().notNull(),
    importedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    documentUnique: uniqueIndex("bc_rmi_inv_hdr_doc_unique").on(
      table.documentType,
      table.documentNo,
    ),
    previousIdx: index("bc_rmi_inv_hdr_previous_idx").on(
      table.previousDocType,
      table.previousNo,
    ),
  }),
);

export const bcSalesDocuments = pgTable(
  "bc_sales_documents",
  {
    id: text().primaryKey(),
    runId: text().references(() => bcImportRuns.id, { onDelete: "set null" }),
    externalId: text(),
    documentType: text().notNull(),
    documentNo: text().notNull(),
    sellToCustomerNo: text(),
    billToCustomerNo: text(),
    status: text(),
    orderDate: timestamp({ withTimezone: true }),
    postingDate: timestamp({ withTimezone: true }),
    documentDate: timestamp({ withTimezone: true }),
    dueDate: timestamp({ withTimezone: true }),
    shipmentDate: timestamp({ withTimezone: true }),
    locationCode: text(),
    shortcutDimension1Code: text(),
    shortcutDimension2Code: text(),
    amount: numeric({ precision: 14, scale: 2 }),
    amountIncludingVat: numeric({ precision: 14, scale: 2 }),
    dimensionSetId: integer(),
    sourcePayload: jsonb().$type<Record<string, unknown>>().notNull(),
    importedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    documentUnique: uniqueIndex("bc_sales_documents_doc_unique").on(
      table.documentType,
      table.documentNo,
    ),
    customerIdx: index("bc_sales_documents_customer_idx").on(
      table.sellToCustomerNo,
    ),
  }),
);

export const bcSalesDocumentLines = pgTable(
  "bc_sales_document_lines",
  {
    id: text().primaryKey(),
    runId: text().references(() => bcImportRuns.id, { onDelete: "set null" }),
    documentType: text().notNull(),
    documentNo: text().notNull(),
    lineNo: integer().notNull(),
    sellToCustomerNo: text(),
    type: text(),
    itemNo: text(),
    description: text(),
    quantity: numeric({ precision: 14, scale: 4 }),
    outstandingQuantity: numeric({ precision: 14, scale: 4 }),
    qtyToInvoice: numeric({ precision: 14, scale: 4 }),
    unitPrice: numeric({ precision: 14, scale: 2 }),
    amount: numeric({ precision: 14, scale: 2 }),
    lineAmount: numeric({ precision: 14, scale: 2 }),
    amountIncludingVat: numeric({ precision: 14, scale: 2 }),
    locationCode: text(),
    shipmentDate: timestamp({ withTimezone: true }),
    requestedDeliveryDate: timestamp({ withTimezone: true }),
    plannedDeliveryDate: timestamp({ withTimezone: true }),
    shortcutDimension1Code: text(),
    shortcutDimension2Code: text(),
    dimensionSetId: integer(),
    sourcePayload: jsonb().$type<Record<string, unknown>>().notNull(),
    importedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    lineUnique: uniqueIndex("bc_sales_doc_lines_unique").on(
      table.documentType,
      table.documentNo,
      table.lineNo,
    ),
    documentIdx: index("bc_sales_doc_lines_document_idx").on(
      table.documentType,
      table.documentNo,
    ),
  }),
);

export const bcRmiPostedRentalInvoiceRentalLines = pgTable(
  "bc_rmi_posted_rental_invoice_rental_lines",
  {
    id: text().primaryKey(),
    runId: text().references(() => bcImportRuns.id, { onDelete: "set null" }),
    documentType: text().notNull(),
    documentNo: text().notNull(),
    lineNo: integer().notNull(),
    itemNo: text(),
    description: text(),
    quantity: numeric({ precision: 14, scale: 4 }),
    unitPrice: numeric({ precision: 14, scale: 2 }),
    lineAmount: numeric({ precision: 14, scale: 2 }),
    sourcePayload: jsonb().$type<Record<string, unknown>>().notNull(),
    importedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    lineUnique: uniqueIndex("bc_rmi_inv_rent_lines_unique").on(
      table.documentType,
      table.documentNo,
      table.lineNo,
    ),
  }),
);

export const bcRmiPostedRentalInvoiceSalesLines = pgTable(
  "bc_rmi_posted_rental_invoice_sales_lines",
  {
    id: text().primaryKey(),
    runId: text().references(() => bcImportRuns.id, { onDelete: "set null" }),
    documentType: text().notNull(),
    documentNo: text().notNull(),
    lineNo: integer().notNull(),
    itemNo: text(),
    description: text(),
    quantity: numeric({ precision: 14, scale: 4 }),
    unitPrice: numeric({ precision: 14, scale: 2 }),
    lineAmount: numeric({ precision: 14, scale: 2 }),
    sourcePayload: jsonb().$type<Record<string, unknown>>().notNull(),
    importedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    lineUnique: uniqueIndex("bc_rmi_inv_sale_lines_unique").on(
      table.documentType,
      table.documentNo,
      table.lineNo,
    ),
  }),
);

export const bcGlAccounts = pgTable(
  "bc_gl_accounts",
  {
    id: text().primaryKey(),
    accountNo: text().notNull(),
    name: text().notNull(),
    accountType: text(),
    incomeBalance: text(),
    category: text(),
    subcategory: text(),
    blocked: boolean().default(false).notNull(),
    payload: jsonb().$type<Record<string, unknown>>(),
    importedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    accountNoUnique: uniqueIndex("bc_gl_accounts_account_no_unique").on(
      table.accountNo,
    ),
  }),
);

export const bcVendors = pgTable(
  "bc_vendors",
  {
    id: text().primaryKey(),
    vendorNo: text().notNull(),
    name: text().notNull(),
    status: text(),
    locationCode: text(),
    payload: jsonb().$type<Record<string, unknown>>(),
    importedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    vendorNoUnique: uniqueIndex("bc_vendors_vendor_no_unique").on(table.vendorNo),
  }),
);

export const bcDimensionSets = pgTable("bc_dimension_sets", {
  id: text().primaryKey(),
  externalDimensionSetId: text().notNull(),
  payload: jsonb().$type<Record<string, unknown>>(),
  importedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
});

export const bcDimensionSetEntries = pgTable(
  "bc_dimension_set_entries",
  {
    id: text().primaryKey(),
    dimensionSetId: text()
      .notNull()
      .references(() => bcDimensionSets.id, { onDelete: "cascade" }),
    dimensionCode: text().notNull(),
    dimensionValueCode: text().notNull(),
    payload: jsonb().$type<Record<string, unknown>>(),
    importedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    dimensionUnique: uniqueIndex("bc_dimension_set_entries_dimension_unique").on(
      table.dimensionSetId,
      table.dimensionCode,
      table.dimensionValueCode,
    ),
  }),
);

export const bcGlEntries = pgTable(
  "bc_gl_entries",
  {
    id: text().primaryKey(),
    externalEntryNo: text().notNull(),
    postingDate: timestamp({ withTimezone: true }),
    documentNo: text(),
    description: text(),
    accountNo: text(),
    amount: numeric({ precision: 14, scale: 2 }),
    debitAmount: numeric({ precision: 14, scale: 2 }),
    creditAmount: numeric({ precision: 14, scale: 2 }),
    dimensionSetId: text().references(() => bcDimensionSets.id),
    payload: jsonb().$type<Record<string, unknown>>().notNull(),
    importedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    entryNoUnique: uniqueIndex("bc_gl_entries_external_entry_no_unique").on(
      table.externalEntryNo,
    ),
    postingDateIdx: index("bc_gl_entries_posting_date_idx").on(table.postingDate),
  }),
);

export const bcBankLedgerEntries = pgTable(
  "bc_bank_ledger_entries",
  {
    id: text().primaryKey(),
    externalEntryNo: text().notNull(),
    bankAccountNo: text(),
    postingDate: timestamp({ withTimezone: true }),
    documentNo: text(),
    amount: numeric({ precision: 14, scale: 2 }),
    payload: jsonb().$type<Record<string, unknown>>().notNull(),
    importedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    entryNoUnique: uniqueIndex("bc_bank_ledger_entries_external_entry_no_unique").on(
      table.externalEntryNo,
    ),
  }),
);

export const bcVendorLedgerEntries = pgTable(
  "bc_vendor_ledger_entries",
  {
    id: text().primaryKey(),
    externalEntryNo: text().notNull(),
    vendorNo: text(),
    postingDate: timestamp({ withTimezone: true }),
    documentNo: text(),
    amount: numeric({ precision: 14, scale: 2 }),
    payload: jsonb().$type<Record<string, unknown>>().notNull(),
    importedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    entryNoUnique: uniqueIndex(
      "bc_vendor_ledger_entries_external_entry_no_unique",
    ).on(table.externalEntryNo),
  }),
);

export const bcCustomerLedgerEntries = pgTable(
  "bc_customer_ledger_entries",
  {
    id: text().primaryKey(),
    externalEntryNo: text().notNull(),
    customerNo: text(),
    postingDate: timestamp({ withTimezone: true }),
    documentNo: text(),
    amount: numeric({ precision: 14, scale: 2 }),
    payload: jsonb().$type<Record<string, unknown>>().notNull(),
    importedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    entryNoUnique: uniqueIndex(
      "bc_customer_ledger_entries_external_entry_no_unique",
    ).on(table.externalEntryNo),
  }),
);

export const bcFaLedgerEntries = pgTable(
  "bc_fa_ledger_entries",
  {
    id: text().primaryKey(),
    externalEntryNo: text().notNull(),
    assetNo: text(),
    postingDate: timestamp({ withTimezone: true }),
    documentNo: text(),
    amount: numeric({ precision: 14, scale: 2 }),
    payload: jsonb().$type<Record<string, unknown>>().notNull(),
    importedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    entryNoUnique: uniqueIndex("bc_fa_ledger_entries_external_entry_no_unique").on(
      table.externalEntryNo,
    ),
  }),
);

export const glAccounts = pgTable(
  "gl_accounts",
  {
    id: text().primaryKey(),
    accountNumber: text().notNull(),
    name: text().notNull(),
    category: text().notNull(),
    subcategory: text(),
    normalSide: journalLineSideEnum().notNull(),
    active: boolean().default(true).notNull(),
    sourceProvider: integrationProviderEnum(),
    sourceExternalId: text(),
    sourcePayload: jsonb().$type<Record<string, unknown>>(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    accountNumberUnique: uniqueIndex("gl_accounts_account_number_unique").on(
      table.accountNumber,
    ),
  }),
);

export const glPostingPeriods = pgTable(
  "gl_posting_periods",
  {
    id: text().primaryKey(),
    name: text().notNull(),
    startsAt: timestamp({ withTimezone: true }).notNull(),
    endsAt: timestamp({ withTimezone: true }).notNull(),
    status: text().default("open").notNull(),
    closedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    periodRangeUnique: uniqueIndex("gl_posting_periods_range_unique").on(
      table.startsAt,
      table.endsAt,
    ),
  }),
);

export const glDimensions = pgTable(
  "gl_dimensions",
  {
    id: text().primaryKey(),
    code: text().notNull(),
    name: text().notNull(),
    active: boolean().default(true).notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    codeUnique: uniqueIndex("gl_dimensions_code_unique").on(table.code),
  }),
);

export const glDimensionValues = pgTable(
  "gl_dimension_values",
  {
    id: text().primaryKey(),
    dimensionId: text()
      .notNull()
      .references(() => glDimensions.id, { onDelete: "cascade" }),
    code: text().notNull(),
    name: text().notNull(),
    active: boolean().default(true).notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    dimensionCodeUnique: uniqueIndex("gl_dimension_values_dimension_code_unique").on(
      table.dimensionId,
      table.code,
    ),
  }),
);

export const glJournalBatches = pgTable(
  "gl_journal_batches",
  {
    id: text().primaryKey(),
    name: text().notNull(),
    description: text(),
    status: journalEntryStatusEnum().default("draft").notNull(),
    source: text(),
    createdByUserId: text().references(() => users.id),
    postedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    nameUnique: uniqueIndex("gl_journal_batches_name_unique").on(table.name),
  }),
);

export const glJournalEntries = pgTable(
  "gl_journal_entries",
  {
    id: text().primaryKey(),
    batchId: text().references(() => glJournalBatches.id),
    postingPeriodId: text().references(() => glPostingPeriods.id),
    entryNumber: text().notNull(),
    entryDate: timestamp({ withTimezone: true }).notNull(),
    sourceType: text(),
    sourceId: text(),
    description: text().notNull(),
    status: journalEntryStatusEnum().default("draft").notNull(),
    currencyCode: text().default("USD").notNull(),
    postedAt: timestamp({ withTimezone: true }),
    reversalOfEntryId: text(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    entryNumberUnique: uniqueIndex("gl_journal_entries_entry_number_unique").on(
      table.entryNumber,
    ),
    statusIdx: index("gl_journal_entries_status_idx").on(table.status, table.entryDate),
  }),
);

export const glJournalLines = pgTable(
  "gl_journal_lines",
  {
    id: text().primaryKey(),
    journalEntryId: text()
      .notNull()
      .references(() => glJournalEntries.id, { onDelete: "cascade" }),
    lineNo: integer().notNull(),
    accountId: text()
      .notNull()
      .references(() => glAccounts.id),
    side: journalLineSideEnum().notNull(),
    amount: numeric({ precision: 14, scale: 2 }).notNull(),
    description: text(),
    customerId: text().references(() => customers.id),
    vendorId: text().references(() => bcVendors.id),
    assetId: text().references(() => assets.id),
    contractId: text().references(() => contracts.id),
    branchId: text().references(() => branches.id),
    sourceDocumentType: text(),
    sourceDocumentNo: text(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    journalLineUnique: uniqueIndex("gl_journal_lines_journal_line_unique").on(
      table.journalEntryId,
      table.lineNo,
    ),
    accountIdx: index("gl_journal_lines_account_idx").on(table.accountId, table.side),
  }),
);

export const glEntryDimensions = pgTable(
  "gl_entry_dimensions",
  {
    id: text().primaryKey(),
    journalLineId: text()
      .notNull()
      .references(() => glJournalLines.id, { onDelete: "cascade" }),
    dimensionId: text()
      .notNull()
      .references(() => glDimensions.id),
    dimensionValueId: text()
      .notNull()
      .references(() => glDimensionValues.id),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    lineDimensionUnique: uniqueIndex("gl_entry_dimensions_line_dimension_unique").on(
      table.journalLineId,
      table.dimensionId,
    ),
  }),
);

export const postingRules = pgTable(
  "posting_rules",
  {
    id: text().primaryKey(),
    code: text().notNull(),
    name: text().notNull(),
    scope: postingRuleScopeEnum().notNull(),
    eventType: text(),
    active: boolean().default(true).notNull(),
    metadata: jsonb().$type<Record<string, unknown>>(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    codeUnique: uniqueIndex("posting_rules_code_unique").on(table.code),
  }),
);

export const postingRuleLines = pgTable(
  "posting_rule_lines",
  {
    id: text().primaryKey(),
    postingRuleId: text()
      .notNull()
      .references(() => postingRules.id, { onDelete: "cascade" }),
    lineRole: text().notNull(),
    accountId: text()
      .notNull()
      .references(() => glAccounts.id),
    amountMode: text().default("event_amount").notNull(),
    memoTemplate: text(),
    sortOrder: integer().default(0).notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    ruleSortUnique: uniqueIndex("posting_rule_lines_rule_sort_unique").on(
      table.postingRuleId,
      table.sortOrder,
    ),
  }),
);

export const arCreditMemos = pgTable(
  "ar_credit_memos",
  {
    id: text().primaryKey(),
    creditMemoNumber: text().notNull(),
    customerId: text()
      .notNull()
      .references(() => customers.id),
    contractId: text().references(() => contracts.id),
    status: subledgerDocumentStatusEnum().default("draft").notNull(),
    creditMemoDate: timestamp({ withTimezone: true }).notNull(),
    totalAmount: numeric({ precision: 12, scale: 2 }).notNull(),
    balanceAmount: numeric({ precision: 12, scale: 2 }).notNull(),
    sourceProvider: integrationProviderEnum(),
    sourceDocumentNo: text(),
    sourceSnapshot: jsonb().$type<Record<string, unknown>>(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    creditMemoNumberUnique: uniqueIndex("ar_credit_memos_number_unique").on(
      table.creditMemoNumber,
    ),
  }),
);

export const arReceipts = pgTable(
  "ar_receipts",
  {
    id: text().primaryKey(),
    receiptNumber: text().notNull(),
    customerId: text()
      .notNull()
      .references(() => customers.id),
    cashAccountId: text(),
    status: subledgerDocumentStatusEnum().default("draft").notNull(),
    receiptDate: timestamp({ withTimezone: true }).notNull(),
    amount: numeric({ precision: 12, scale: 2 }).notNull(),
    unappliedAmount: numeric({ precision: 12, scale: 2 }).notNull(),
    sourceProvider: integrationProviderEnum(),
    sourceDocumentNo: text(),
    sourceSnapshot: jsonb().$type<Record<string, unknown>>(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    receiptNumberUnique: uniqueIndex("ar_receipts_number_unique").on(
      table.receiptNumber,
    ),
  }),
);

export const arApplications = pgTable(
  "ar_applications",
  {
    id: text().primaryKey(),
    receiptId: text()
      .notNull()
      .references(() => arReceipts.id, { onDelete: "cascade" }),
    invoiceId: text().references(() => invoices.id),
    creditMemoId: text().references(() => arCreditMemos.id),
    appliedAmount: numeric({ precision: 12, scale: 2 }).notNull(),
    appliedAt: timestamp({ withTimezone: true }).notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    receiptIdx: index("ar_applications_receipt_id_idx").on(table.receiptId),
  }),
);

export const cashAccounts = pgTable(
  "cash_accounts",
  {
    id: text().primaryKey(),
    accountNumber: text().notNull(),
    name: text().notNull(),
    glAccountId: text().references(() => glAccounts.id),
    active: boolean().default(true).notNull(),
    sourceProvider: integrationProviderEnum(),
    sourceExternalId: text(),
    sourcePayload: jsonb().$type<Record<string, unknown>>(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    accountNumberUnique: uniqueIndex("cash_accounts_account_number_unique").on(
      table.accountNumber,
    ),
  }),
);

export const cashTransactions = pgTable(
  "cash_transactions",
  {
    id: text().primaryKey(),
    cashAccountId: text()
      .notNull()
      .references(() => cashAccounts.id),
    arReceiptId: text().references(() => arReceipts.id),
    apPaymentId: text(),
    transactionType: cashTransactionTypeEnum().notNull(),
    transactionDate: timestamp({ withTimezone: true }).notNull(),
    amount: numeric({ precision: 12, scale: 2 }).notNull(),
    description: text(),
    sourcePayload: jsonb().$type<Record<string, unknown>>(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    cashDateIdx: index("cash_transactions_cash_date_idx").on(
      table.cashAccountId,
      table.transactionDate,
    ),
  }),
);

export const apBills = pgTable(
  "ap_bills",
  {
    id: text().primaryKey(),
    billNumber: text().notNull(),
    vendorId: text()
      .notNull()
      .references(() => bcVendors.id),
    status: subledgerDocumentStatusEnum().default("draft").notNull(),
    billDate: timestamp({ withTimezone: true }).notNull(),
    dueDate: timestamp({ withTimezone: true }),
    totalAmount: numeric({ precision: 12, scale: 2 }).notNull(),
    balanceAmount: numeric({ precision: 12, scale: 2 }).notNull(),
    sourceProvider: integrationProviderEnum(),
    sourceDocumentNo: text(),
    sourceSnapshot: jsonb().$type<Record<string, unknown>>(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    billNumberUnique: uniqueIndex("ap_bills_number_unique").on(table.billNumber),
  }),
);

export const apBillLines = pgTable(
  "ap_bill_lines",
  {
    id: text().primaryKey(),
    billId: text()
      .notNull()
      .references(() => apBills.id, { onDelete: "cascade" }),
    description: text().notNull(),
    amount: numeric({ precision: 12, scale: 2 }).notNull(),
    glAccountId: text().references(() => glAccounts.id),
    assetId: text().references(() => assets.id),
    sourceLineNo: integer(),
    sourceSnapshot: jsonb().$type<Record<string, unknown>>(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    billIdx: index("ap_bill_lines_bill_id_idx").on(table.billId),
  }),
);

export const apPayments = pgTable(
  "ap_payments",
  {
    id: text().primaryKey(),
    paymentNumber: text().notNull(),
    vendorId: text()
      .notNull()
      .references(() => bcVendors.id),
    cashAccountId: text().references(() => cashAccounts.id),
    status: subledgerDocumentStatusEnum().default("draft").notNull(),
    paymentDate: timestamp({ withTimezone: true }).notNull(),
    amount: numeric({ precision: 12, scale: 2 }).notNull(),
    unappliedAmount: numeric({ precision: 12, scale: 2 }).notNull(),
    sourceProvider: integrationProviderEnum(),
    sourceDocumentNo: text(),
    sourceSnapshot: jsonb().$type<Record<string, unknown>>(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    paymentNumberUnique: uniqueIndex("ap_payments_number_unique").on(
      table.paymentNumber,
    ),
  }),
);

export const apApplications = pgTable(
  "ap_applications",
  {
    id: text().primaryKey(),
    paymentId: text()
      .notNull()
      .references(() => apPayments.id, { onDelete: "cascade" }),
    billId: text()
      .notNull()
      .references(() => apBills.id, { onDelete: "cascade" }),
    appliedAmount: numeric({ precision: 12, scale: 2 }).notNull(),
    appliedAt: timestamp({ withTimezone: true }).notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    paymentIdx: index("ap_applications_payment_id_idx").on(table.paymentId),
  }),
);

export const faBooks = pgTable(
  "fa_books",
  {
    id: text().primaryKey(),
    assetId: text()
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    bookCode: text().notNull(),
    acquisitionCost: numeric({ precision: 14, scale: 2 }).default("0").notNull(),
    accumulatedDepreciation: numeric({ precision: 14, scale: 2 })
      .default("0")
      .notNull(),
    netBookValue: numeric({ precision: 14, scale: 2 }).default("0").notNull(),
    inServiceDate: timestamp({ withTimezone: true }),
    retiredAt: timestamp({ withTimezone: true }),
    sourceProvider: integrationProviderEnum(),
    sourceExternalId: text(),
    sourcePayload: jsonb().$type<Record<string, unknown>>(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    assetBookUnique: uniqueIndex("fa_books_asset_book_unique").on(
      table.assetId,
      table.bookCode,
    ),
  }),
);

export const faPostings = pgTable(
  "fa_postings",
  {
    id: text().primaryKey(),
    faBookId: text()
      .notNull()
      .references(() => faBooks.id, { onDelete: "cascade" }),
    journalEntryId: text().references(() => glJournalEntries.id),
    postingType: text().notNull(),
    postingDate: timestamp({ withTimezone: true }).notNull(),
    amount: numeric({ precision: 14, scale: 2 }).notNull(),
    description: text(),
    sourcePayload: jsonb().$type<Record<string, unknown>>(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    bookDateIdx: index("fa_postings_book_date_idx").on(
      table.faBookId,
      table.postingDate,
    ),
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
