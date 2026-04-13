import type {
  AssetRecord,
  ContractRecord,
  CustomerRecord,
  DispatchTaskRecord,
  FinancialEventRecord,
  InvoiceRecord,
  RatePolicy,
  WorkOrderRecord,
} from "@/lib/domain/models";

export interface BranchRecord {
  id: string;
  code: string;
  name: string;
  timezone: string;
  address: string;
  phone: string;
}

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: string;
  branch: string;
}

export interface InspectionRecord {
  id: string;
  assetNumber: string;
  contractNumber: string;
  customerSite: string;
  inspectionType: string;
  status: string;
  requestedAt: string;
  completedAt: string | null;
  damageSummary: string;
  photos: string[];
}

export interface PaymentMethodRecord {
  id: string;
  customerNumber: string;
  provider: string;
  methodType: string;
  label: string;
  last4: string;
  isDefault: boolean;
}

export interface CollectionCaseRecord {
  id: string;
  customerName: string;
  invoiceNumber: string;
  status: string;
  owner: string;
  balanceAmount: number;
  lastContactAt: string | null;
  promisedPaymentDate: string | null;
  notes: string[];
}

export interface TelematicsRecord {
  id: string;
  assetNumber: string;
  provider: string;
  latitude: number;
  longitude: number;
  speedMph: number;
  heading: number;
  capturedAt: string;
}

export interface DocumentRecord {
  id: string;
  contractNumber: string;
  customerName: string;
  documentType: string;
  status: string;
  filename: string;
  objectLocked: boolean;
  hash: string;
  createdAt: string;
}

export interface SignatureRequestRecord {
  id: string;
  contractNumber: string;
  customerName: string;
  provider: string;
  status: string;
  signers: string[];
  requestedAt: string;
  completedAt: string | null;
}

export interface IntegrationJobRecord {
  id: string;
  provider: string;
  entityType: string;
  entityId: string;
  direction: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  lastError: string | null;
}

export interface AuditEventRecord {
  id: string;
  entityType: string;
  entityId: string;
  eventType: string;
  userName: string;
  timestamp: string;
  metadata: Record<string, string | number | boolean | null>;
}

export interface RevenueSeriesPoint {
  label: string;
  revenue: number;
}

export interface FleetUtilizationRecord {
  branch: string;
  fleetCount: number;
  onRentCount: number;
  utilizationRate: number;
}

export interface PlatformState {
  branches: BranchRecord[];
  users: UserRecord[];
  assets: AssetRecord[];
  customers: CustomerRecord[];
  contracts: ContractRecord[];
  financialEvents: FinancialEventRecord[];
  invoices: InvoiceRecord[];
  dispatchTasks: DispatchTaskRecord[];
  inspections: InspectionRecord[];
  workOrders: WorkOrderRecord[];
  paymentMethods: PaymentMethodRecord[];
  collectionCases: CollectionCaseRecord[];
  telematics: TelematicsRecord[];
  documents: DocumentRecord[];
  signatureRequests: SignatureRequestRecord[];
  integrationJobs: IntegrationJobRecord[];
  auditEvents: AuditEventRecord[];
  ratePolicies: RatePolicy[];
}
