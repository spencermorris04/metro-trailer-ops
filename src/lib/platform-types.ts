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
  damageScore?: number | null;
  externalInspectionId?: string | null;
  externalUnitId?: string | null;
  linkedWorkOrderId?: string | null;
  media?: Array<Record<string, unknown>>;
  record360SyncState?: string;
  lastSyncAttemptAt?: string | null;
  lastSyncError?: string | null;
  webhookMatchedBy?: string | null;
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

export interface PaymentTransactionRecord {
  id: string;
  invoiceNumber: string | null;
  customerNumber: string | null;
  provider: string;
  transactionType: string;
  status: string;
  amount: number;
  currency: string;
  paymentMethodLabel: string | null;
  externalId: string | null;
  errorMessage: string | null;
  createdAt: string;
  settledAt: string | null;
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
  overdueDays?: number;
  reminderCount?: number;
  nextAction?: string;
  lastActivityType?: string | null;
  latestActivityAt?: string | null;
  promisedPaymentAmount?: number | null;
  slaBucket?: string | null;
  disputeState?: string | null;
  promisedPaymentRisk?: string | null;
  latestPortalActivityAt?: string | null;
  latestTelematicsAt?: string | null;
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
  stale?: boolean;
  freshnessMinutes?: number;
  gpsDeviceId?: string | null;
  externalAssetId?: string | null;
  rawSource?: string | null;
  source?: string | null;
  trustLevel?: string | null;
  lastProviderSyncAt?: string | null;
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
  workOrderId?: string | null;
  retentionState?: string | null;
  objectLockVerified?: boolean;
  downloadAuditCount?: number;
}

export interface WorkOrderLaborEntryRecord {
  id: string;
  technicianUserId: string | null;
  technicianName: string | null;
  hours: number;
  hourlyRate: number | null;
  notes: string | null;
  createdAt: string;
}

export interface WorkOrderPartEntryRecord {
  id: string;
  partNumber: string | null;
  description: string;
  quantity: number;
  unitCost: number | null;
  createdAt: string;
}

export interface WorkOrderEventRecord {
  id: string;
  type: string;
  actorUserId: string | null;
  actorName: string | null;
  fromStatus: string | null;
  toStatus: string | null;
  notes: string | null;
  metadata: Record<string, string | number | boolean | null>;
  createdAt: string;
}

export interface WorkOrderVerificationRecord {
  id: string;
  verifierUserId: string | null;
  verifierName: string | null;
  result: "passed" | "failed";
  notes: string | null;
  inspectionId: string | null;
  createdAt: string;
}

export interface WorkOrderDetailRecord extends WorkOrderRecord {
  laborEntries: WorkOrderLaborEntryRecord[];
  partEntries: WorkOrderPartEntryRecord[];
  events: WorkOrderEventRecord[];
  verifications: WorkOrderVerificationRecord[];
  attachments: DocumentRecord[];
}

export interface TechnicianWorkloadRecord {
  technicianUserId: string | null;
  technicianName: string;
  assignedCount: number;
  inProgressCount: number;
  awaitingCount: number;
  repairCompletedCount: number;
  estimatedHours: number;
}

export interface VendorQueueRecord {
  vendorId: string | null;
  vendorName: string;
  assignedCount: number;
  awaitingVendorCount: number;
  repairCompletedCount: number;
  estimatedCost: number;
  actualCost: number;
}

export interface VerificationQueueRecord {
  workOrderId: string;
  assetNumber: string;
  title: string;
  branch: string;
  repairCompletedAt: string | null;
  technicianName: string | null;
  vendorName: string | null;
  billableDisposition: string;
}

export type SignatureAppearanceMode =
  | "handwriting_font"
  | "drawn"
  | "uploaded_image";

export type SignatureFieldKind = "signature" | "title" | "date";

export interface SignatureFieldRecord {
  id: string;
  signerId: string;
  kind: SignatureFieldKind;
  label: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  required: boolean;
  navigationOrder: number;
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
  signatureMode: SignatureAppearanceMode | null;
  signatureAppearanceDataUrl: string | null;
  signatureAppearanceHash: string | null;
  intentAcceptedAt: string | null;
  consentAcceptedAt: string | null;
  certificationAcceptedAt: string | null;
  otpVerifiedAt: string | null;
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
  signingFields: SignatureFieldRecord[];
  signers: SignatureSignerRecord[];
  events: SignatureEventRecord[];
  evidenceHash: string | null;
  requestedAt: string;
  completedAt: string | null;
  completionState?: string;
  evidenceState?: string;
  finalizationAttempts?: number;
  lastFinalizationError?: string | null;
  retentionVerified?: boolean;
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
  providerEventId?: string | null;
  providerAttemptCount?: number;
  lastProcessedAt?: string | null;
  replayEligible?: boolean;
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
