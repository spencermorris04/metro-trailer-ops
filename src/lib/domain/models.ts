export const assetTypes = [
  "commercial_box_trailer",
  "road_trailer",
  "cartage_trailer",
  "storage_trailer",
  "office_trailer",
  "storage_container",
  "flatbed_trailer",
  "reefer_trailer",
  "yard_truck",
  "specialty_trailer",
  "chassis",
] as const;

export const assetStatuses = [
  "available",
  "reserved",
  "dispatched",
  "on_rent",
  "inspection_hold",
  "in_maintenance",
  "retired",
] as const;

export const assetAvailabilities = [
  "rentable",
  "limited",
  "unavailable",
] as const;

export const maintenanceStatuses = [
  "clear",
  "scheduled",
  "under_repair",
  "waiting_on_parts",
  "inspection_required",
] as const;

export const customerTypes = [
  "commercial",
  "government",
  "municipal",
  "non_profit",
  "internal",
] as const;

export const contractStatuses = [
  "quoted",
  "reserved",
  "active",
  "completed",
  "closed",
  "cancelled",
] as const;

export const billingUnits = [
  "day",
  "week",
  "month",
  "flat",
  "mileage",
  "event",
] as const;

export const commercialEventTypes = [
  "rent",
  "damage",
  "delivery",
  "pickup",
  "deposit_request",
  "surcharge",
  "credit",
  "adjustment",
  "tax",
] as const;

export const commercialEventStatuses = [
  "pending",
  "posted",
  "invoiced",
  "voided",
] as const;

export const financialEventTypes = commercialEventTypes;
export const financialEventStatuses = commercialEventStatuses;

export const invoiceStatuses = [
  "draft",
  "sent",
  "partially_paid",
  "paid",
  "overdue",
  "voided",
] as const;

export const dispatchTaskStatuses = [
  "unassigned",
  "assigned",
  "in_progress",
  "completed",
  "cancelled",
] as const;

export const workOrderStatuses = [
  "open",
  "assigned",
  "in_progress",
  "awaiting_parts",
  "awaiting_vendor",
  "repair_completed",
  "verified",
  "closed",
  "cancelled",
] as const;

export const workOrderSourceTypes = [
  "manual",
  "inspection_failure",
  "dispatch_return",
  "telematics_alert",
  "customer_report",
  "scheduled_maintenance",
] as const;

export const workOrderBillableDispositions = [
  "internal",
  "customer_damage",
  "warranty",
  "vendor_recovery",
] as const;

export const workOrderBillingApprovalStatuses = [
  "not_required",
  "pending_review",
  "approved",
  "rejected",
] as const;

export const workOrderVerificationResults = ["passed", "failed"] as const;

export type AssetTypeKey = (typeof assetTypes)[number];
export type AssetStatusKey = (typeof assetStatuses)[number];
export type AssetAvailabilityKey = (typeof assetAvailabilities)[number];
export type MaintenanceStatusKey = (typeof maintenanceStatuses)[number];
export type CustomerTypeKey = (typeof customerTypes)[number];
export type ContractStatusKey = (typeof contractStatuses)[number];
export type BillingUnitKey = (typeof billingUnits)[number];
export type CommercialEventTypeKey = (typeof commercialEventTypes)[number];
export type CommercialEventStatusKey = (typeof commercialEventStatuses)[number];
export type FinancialEventTypeKey = CommercialEventTypeKey;
export type FinancialEventStatusKey = CommercialEventStatusKey;
export type InvoiceStatusKey = (typeof invoiceStatuses)[number];
export type DispatchTaskStatusKey = (typeof dispatchTaskStatuses)[number];
export type WorkOrderStatusKey = (typeof workOrderStatuses)[number];
export type WorkOrderSourceTypeKey = (typeof workOrderSourceTypes)[number];
export type WorkOrderBillableDispositionKey =
  (typeof workOrderBillableDispositions)[number];
export type WorkOrderBillingApprovalStatusKey =
  (typeof workOrderBillingApprovalStatuses)[number];
export type WorkOrderVerificationResultKey =
  (typeof workOrderVerificationResults)[number];

export interface MetricDefinition {
  label: string;
  value: string;
  detail: string;
}

export interface DomainCard {
  name: string;
  summary: string;
  fields: string[];
}

export interface PhaseDefinition {
  phase: string;
  title: string;
  summary: string;
  deliverables: string[];
}

export interface FleetSnapshot {
  branch: string;
  available: number;
  reserved: number;
  onRent: number;
  maintenance: number;
}

export interface AssetRecord {
  id: string;
  assetNumber: string;
  type: AssetTypeKey;
  dimensions: string;
  branch: string;
  status: AssetStatusKey;
  availability: AssetAvailabilityKey;
  maintenanceStatus: MaintenanceStatusKey;
  gpsDeviceId?: string;
  age: string;
  features: string[];
  subtype?: string | null;
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
  bookValue?: number | null;
  yardZone?: string | null;
  yardRow?: string | null;
  yardSlot?: string | null;
  custodyLocation?: string | null;
  locationSource?: string | null;
  blockingReason?: string | null;
  allocationTypes?: string[];
  activeContractNumber?: string | null;
  activeCustomerName?: string | null;
  nextContractNumber?: string | null;
  nextReservationStart?: string | null;
  activeDispatchTaskId?: string | null;
  activeDispatchTaskStatus?: string | null;
  activeWorkOrderId?: string | null;
  activeWorkOrderStatus?: string | null;
  record360UnitId?: string | null;
  skybitzAssetId?: string | null;
  sourceProvider?: string | null;
  sourcePayload?: Record<string, unknown> | null;
  telematicsFreshnessMinutes?: number | null;
  telematicsStale?: boolean;
}

export interface CustomerLocationRecord {
  id: string;
  name: string;
  address: string;
  contactPerson: string;
}

export interface CustomerRecord {
  id: string;
  customerNumber: string;
  name: string;
  customerType: CustomerTypeKey;
  billingCity: string;
  portalEnabled: boolean;
  branchCoverage: string[];
  locations: CustomerLocationRecord[];
  sourcePayload?: Record<string, unknown> | null;
}

export interface ContractRecord {
  id: string;
  contractNumber: string;
  customerName: string;
  locationName: string;
  branch: string;
  status: ContractStatusKey;
  startDate: string;
  endDate: string | null;
  assets: string[];
  value: number;
  amendmentFlags: string[];
  signatureStatus?: string;
  latestSignatureRequestId?: string | null;
  signedDocumentId?: string | null;
  invoiceCount?: number;
  openInvoiceCount?: number;
  overdueInvoiceCount?: number;
  outstandingBalance?: number;
  uninvoicedEventCount?: number;
  uninvoicedEventAmount?: number;
  commercialStage?: string;
  billingState?: string;
  nextAction?: string | null;
  financialExceptions?: string[];
  lastInvoiceSentAt?: string | null;
  reconciliationState?: string;
  sourceProvider?: string | null;
  sourceDocumentType?: string | null;
  sourceDocumentNo?: string | null;
  sourceStatus?: string | null;
}

export interface CommercialEventRecord {
  id: string;
  contractNumber: string;
  eventType: CommercialEventTypeKey;
  description: string;
  amount: number;
  eventDate: string;
  status: CommercialEventStatusKey;
  sourceDocumentType?: string | null;
  sourceDocumentNo?: string | null;
}

export type FinancialEventRecord = CommercialEventRecord;

export interface InvoiceRecord {
  id: string;
  invoiceNumber: string;
  customerName: string;
  contractNumber: string;
  status: InvoiceStatusKey;
  invoiceDate: string;
  dueDate: string;
  totalAmount: number;
  balanceAmount: number;
  deliveryStatus?: string;
  sentAt?: string | null;
  deliveryChannel?: string | null;
  quickBooksSyncStatus?: string;
  quickBooksLastSyncedAt?: string | null;
  quickBooksLastError?: string | null;
  reconciliationState?: string;
  sourceProvider?: string | null;
  sourceDocumentType?: string | null;
  sourceDocumentNo?: string | null;
  sourceStatus?: string | null;
}

export interface DispatchTaskRecord {
  id: string;
  type: string;
  status: DispatchTaskStatusKey;
  branch: string;
  assetNumber: string;
  customerSite: string;
  scheduledFor: string;
  contractNumber?: string | null;
  driverName?: string | null;
  notes?: string | null;
  scheduledEnd?: string | null;
  completedAt?: string | null;
}

export interface WorkOrderRecord {
  id: string;
  title: string;
  status: WorkOrderStatusKey;
  assetNumber: string;
  branch: string;
  priority: string;
  source: string;
  sourceType?: WorkOrderSourceTypeKey;
  symptomSummary?: string | null;
  diagnosis?: string | null;
  repairSummary?: string | null;
  contractNumber?: string | null;
  customerName?: string | null;
  technicianName?: string | null;
  technicianUserId?: string | null;
  vendorId?: string | null;
  vendorName?: string | null;
  inspectionId?: string | null;
  dueAt?: string | null;
  openedAt?: string | null;
  assignedAt?: string | null;
  startedAt?: string | null;
  repairCompletedAt?: string | null;
  verifiedAt?: string | null;
  closedAt?: string | null;
  cancelledAt?: string | null;
  verificationOutcome?: WorkOrderVerificationResultKey | null;
  billableDisposition?: WorkOrderBillableDispositionKey;
  billingApprovalStatus?: WorkOrderBillingApprovalStatusKey;
  billableApprovedAt?: string | null;
  attachmentCount?: number;
  estimatedCost?: number | null;
  actualCost?: number | null;
  laborHours?: number | null;
  partCount?: number;
}

export interface IntegrationDefinition {
  provider: string;
  purpose: string;
  syncMode: string;
  systemOfRecord: string;
  boundary: string;
}

export interface RatePolicy {
  name: string;
  daily: number;
  weekly: number;
  monthly: number;
  notes: string;
}
