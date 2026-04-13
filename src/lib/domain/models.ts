export const assetTypes = [
  "commercial_box_trailer",
  "office_trailer",
  "storage_container",
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

export const financialEventTypes = [
  "rent",
  "damage",
  "delivery",
  "pickup",
  "surcharge",
  "credit",
  "adjustment",
  "tax",
] as const;

export const financialEventStatuses = [
  "pending",
  "posted",
  "invoiced",
  "voided",
] as const;

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
  "completed",
  "cancelled",
] as const;

export type AssetTypeKey = (typeof assetTypes)[number];
export type AssetStatusKey = (typeof assetStatuses)[number];
export type AssetAvailabilityKey = (typeof assetAvailabilities)[number];
export type MaintenanceStatusKey = (typeof maintenanceStatuses)[number];
export type CustomerTypeKey = (typeof customerTypes)[number];
export type ContractStatusKey = (typeof contractStatuses)[number];
export type BillingUnitKey = (typeof billingUnits)[number];
export type FinancialEventTypeKey = (typeof financialEventTypes)[number];
export type FinancialEventStatusKey = (typeof financialEventStatuses)[number];
export type InvoiceStatusKey = (typeof invoiceStatuses)[number];
export type DispatchTaskStatusKey = (typeof dispatchTaskStatuses)[number];
export type WorkOrderStatusKey = (typeof workOrderStatuses)[number];

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
}

export interface FinancialEventRecord {
  id: string;
  contractNumber: string;
  eventType: FinancialEventTypeKey;
  description: string;
  amount: number;
  eventDate: string;
  status: FinancialEventStatusKey;
}

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
  technicianName?: string | null;
  vendorName?: string | null;
  inspectionId?: string | null;
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
