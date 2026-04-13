import { createHash } from "node:crypto";

import {
  dispatchBoard,
  financialEvents,
  invoices,
  ratePolicies,
  sampleAssets,
  sampleContracts,
  sampleCustomers,
  workOrders,
} from "@/lib/platform-data";
import type { PlatformState } from "@/lib/platform-types";

function hashValue(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function buildInitialState(): PlatformState {
  return {
    branches: [
      {
        id: "branch_newark",
        code: "NWK",
        name: "Newark",
        timezone: "America/New_York",
        address: "200 Corbin St, Newark, NJ 07105",
        phone: "(973) 555-0101",
      },
      {
        id: "branch_savannah",
        code: "SAV",
        name: "Savannah",
        timezone: "America/New_York",
        address: "14 Harbor Loop, Savannah, GA 31408",
        phone: "(912) 555-0118",
      },
      {
        id: "branch_kc",
        code: "MKC",
        name: "Kansas City",
        timezone: "America/Chicago",
        address: "7020 Front St, Kansas City, MO 64120",
        phone: "(816) 555-0142",
      },
      {
        id: "branch_phx",
        code: "PHX",
        name: "Phoenix",
        timezone: "America/Phoenix",
        address: "811 South 51st Ave, Phoenix, AZ 85043",
        phone: "(602) 555-0165",
      },
    ],
    users: [
      {
        id: "user_001",
        name: "Avery Cole",
        email: "avery.cole@metrotrailer.local",
        role: "admin",
        branch: "Newark",
      },
      {
        id: "user_002",
        name: "Jordan Banks",
        email: "jordan.banks@metrotrailer.local",
        role: "dispatcher",
        branch: "Phoenix",
      },
      {
        id: "user_003",
        name: "Dana Russo",
        email: "dana.russo@metrotrailer.local",
        role: "accounting",
        branch: "Newark",
      },
      {
        id: "user_004",
        name: "Chris Madden",
        email: "chris.madden@metrotrailer.local",
        role: "technician",
        branch: "Savannah",
      },
      {
        id: "user_005",
        name: "Morgan Lee",
        email: "morgan.lee@metrotrailer.local",
        role: "collections",
        branch: "Kansas City",
      },
    ],
    assets: sampleAssets,
    customers: sampleCustomers,
    contracts: sampleContracts,
    financialEvents,
    invoices,
    dispatchTasks: dispatchBoard,
    inspections: [
      {
        id: "insp_001",
        assetNumber: "ST-53108",
        contractNumber: "R-250041",
        customerSite: "Lenexa Remodel Cluster",
        inspectionType: "return",
        status: "needs_review",
        requestedAt: "2026-04-08T14:30:00.000Z",
        completedAt: "2026-04-08T15:05:00.000Z",
        damageSummary: "Door track impact with visible frame misalignment.",
        photos: [
          "https://example.com/record360/st53108/photo1.jpg",
          "https://example.com/record360/st53108/photo2.jpg",
        ],
      },
      {
        id: "insp_002",
        assetNumber: "OF-20913",
        contractNumber: "R-250093",
        customerSite: "Mesa Utilities Overflow Yard",
        inspectionType: "spot_check",
        status: "passed",
        requestedAt: "2026-04-11T09:00:00.000Z",
        completedAt: "2026-04-11T09:22:00.000Z",
        damageSummary: "No new damage, HVAC operating normally.",
        photos: ["https://example.com/record360/of20913/photo1.jpg"],
      },
    ],
    workOrders,
    paymentMethods: [
      {
        id: "pm_001",
        customerNumber: "C-2041",
        provider: "Stripe",
        methodType: "card",
        label: "Visa corporate card",
        last4: "4242",
        isDefault: true,
      },
      {
        id: "pm_002",
        customerNumber: "C-4104",
        provider: "Stripe",
        methodType: "ach",
        label: "Operating account ACH",
        last4: "1188",
        isDefault: true,
      },
    ],
    collectionCases: [
      {
        id: "cc_001",
        customerName: "City of Mesa Facilities",
        invoiceNumber: "INV-260401-117",
        status: "reminder_sent",
        owner: "Morgan Lee",
        balanceAmount: 4800,
        lastContactAt: "2026-04-12T16:10:00.000Z",
        promisedPaymentDate: null,
        notes: [
          "Reminder email sent after due date passed.",
          "Customer requested copy of signed delivery packet.",
        ],
      },
      {
        id: "cc_002",
        customerName: "Midwest Retail Rollout",
        invoiceNumber: "INV-260409-044",
        status: "promise_to_pay",
        owner: "Morgan Lee",
        balanceAmount: 320,
        lastContactAt: "2026-04-12T11:40:00.000Z",
        promisedPaymentDate: "2026-04-16T00:00:00.000Z",
        notes: ["AP contact promised payment by April 16, 2026."],
      },
    ],
    telematics: [
      {
        id: "tp_001",
        assetNumber: "OF-20913",
        provider: "SkyBitz",
        latitude: 33.3942,
        longitude: -111.8226,
        speedMph: 0,
        heading: 92,
        capturedAt: "2026-04-13T11:10:00.000Z",
      },
      {
        id: "tp_002",
        assetNumber: "BX-10428",
        provider: "SkyBitz",
        latitude: 40.6764,
        longitude: -74.1461,
        speedMph: 12,
        heading: 44,
        capturedAt: "2026-04-13T12:02:00.000Z",
      },
    ],
    documents: [
      {
        id: "doc_001",
        contractNumber: "R-250093",
        customerName: "City of Mesa Facilities",
        documentType: "contract",
        status: "sent",
        filename: "R-250093-master-rental.pdf",
        objectLocked: true,
        hash: hashValue("R-250093-master-rental.pdf"),
        createdAt: "2026-02-03T08:12:00.000Z",
      },
      {
        id: "doc_002",
        contractNumber: "R-250041",
        customerName: "Midwest Retail Rollout",
        documentType: "inspection",
        status: "archived",
        filename: "R-250041-return-inspection.pdf",
        objectLocked: true,
        hash: hashValue("R-250041-return-inspection.pdf"),
        createdAt: "2026-04-08T16:10:00.000Z",
      },
    ],
    signatureRequests: [
      {
        id: "sig_001",
        contractNumber: "R-250114",
        customerName: "Atlantic Infrastructure Group",
        provider: "Dropbox Sign",
        status: "sent",
        signers: ["maria.ortiz@atlantic.example"],
        requestedAt: "2026-04-13T10:00:00.000Z",
        completedAt: null,
      },
    ],
    integrationJobs: [
      {
        id: "sync_001",
        provider: "QuickBooks",
        entityType: "invoice",
        entityId: "INV-260409-044",
        direction: "push",
        status: "success",
        startedAt: "2026-04-09T09:15:00.000Z",
        finishedAt: "2026-04-09T09:15:05.000Z",
        lastError: null,
      },
      {
        id: "sync_002",
        provider: "Record360",
        entityType: "inspection",
        entityId: "insp_001",
        direction: "pull",
        status: "success",
        startedAt: "2026-04-08T15:06:00.000Z",
        finishedAt: "2026-04-08T15:06:04.000Z",
        lastError: null,
      },
    ],
    auditEvents: [
      {
        id: "audit_001",
        entityType: "contract",
        entityId: "R-250114",
        eventType: "status_changed",
        userName: "Avery Cole",
        timestamp: "2026-04-12T09:00:00.000Z",
        metadata: {
          from: "quoted",
          to: "reserved",
        },
      },
      {
        id: "audit_002",
        entityType: "inspection",
        entityId: "insp_001",
        eventType: "damage_flagged",
        userName: "Chris Madden",
        timestamp: "2026-04-08T15:08:00.000Z",
        metadata: {
          asset: "ST-53108",
          severity: "high",
        },
      },
    ],
    ratePolicies,
  };
}

declare global {
  var __metroTrailerDemoStore: PlatformState | undefined;
}

export function getDemoStore() {
  if (!globalThis.__metroTrailerDemoStore) {
    globalThis.__metroTrailerDemoStore = structuredClone(buildInitialState());
  }

  return globalThis.__metroTrailerDemoStore;
}

export function resetDemoStore() {
  globalThis.__metroTrailerDemoStore = structuredClone(buildInitialState());
  return globalThis.__metroTrailerDemoStore;
}
