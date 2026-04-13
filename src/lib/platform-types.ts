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
  lockedAt: string | null;
  source: string;
  hash: string;
  createdAt: string;
  contentType: string;
  sizeBytes: number;
  contentBase64: string | null;
  storageProvider: "inline" | "s3";
  storageBucket: string | null;
  storageKey: string | null;
  storageVersionId: string | null;
  storageETag: string | null;
  retentionUntil: string | null;
  relatedSignatureRequestId: string | null;
  supersedesDocumentId: string | null;
  retentionMode: "governance" | "compliance";
  metadata: Record<string, string | number | boolean | null>;
}

export interface SignatureSignerRecord {
  id: string;
  name: string;
  email: string;
  title: string | null;
  routingOrder: number;
  status: string;
  requestedAt: string;
  viewedAt: string | null;
  signedAt: string | null;
  declinedAt: string | null;
  reminderCount: number;
  lastReminderAt: string | null;
  accessNonce: string;
  signatureText: string | null;
  intentAcceptedAt: string | null;
  consentAcceptedAt: string | null;
  certificationAcceptedAt: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  evidenceHash: string | null;
}

export interface SignatureEventRecord {
  id: string;
  type: string;
  actor: string;
  timestamp: string;
  metadata: Record<string, string | number | boolean | null>;
}

export interface SignatureRequestRecord {
  id: string;
  contractNumber: string;
  customerName: string;
  provider: string;
  status: string;
  title: string;
  subject: string;
  message: string;
  consentTextVersion: string;
  certificationText: string;
  documentId: string;
  finalDocumentId: string | null;
  certificateDocumentId: string | null;
  expiresAt: string | null;
  cancelledAt: string | null;
  signers: SignatureSignerRecord[];
  events: SignatureEventRecord[];
  evidenceHash: string | null;
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
