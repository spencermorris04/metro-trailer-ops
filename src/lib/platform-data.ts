import type {
  AssetRecord,
  ContractRecord,
  CustomerRecord,
  DispatchTaskRecord,
  DomainCard,
  FinancialEventRecord,
  FleetSnapshot,
  IntegrationDefinition,
  InvoiceRecord,
  MetricDefinition,
  PhaseDefinition,
  RatePolicy,
  WorkOrderRecord,
} from "@/lib/domain/models";

export const portfolioMetrics: MetricDefinition[] = [
  {
    label: "Fleet under management",
    value: "50,000 assets",
    detail:
      "Commercial box trailers, office trailers, and storage containers across multi-branch operations.",
  },
  {
    label: "Connected branches",
    value: "18 branches",
    detail:
      "Shared dispatch, maintenance, and contract visibility instead of siloed legacy workflows.",
  },
  {
    label: "Active rental agreements",
    value: "7,284 contracts",
    detail:
      "Quotes, reservations, amendments, returns, and closures all tracked in one lifecycle model.",
  },
  {
    label: "External service boundaries",
    value: "4 core integrations",
    detail:
      "Stripe, QuickBooks Online, Record360, and SkyBitz stay specialized without fragmenting operations.",
  },
];

export const domainCards: DomainCard[] = [
  {
    name: "Assets",
    summary:
      "The fleet record that drives availability, dispatch, inspections, maintenance, and telemetry.",
    fields: [
      "id",
      "type",
      "dimensions",
      "branch_id",
      "status",
      "availability",
      "gps_device_id",
      "maintenance_status",
    ],
  },
  {
    name: "Customers",
    summary:
      "Billing and relationship context for commercial, government, and municipal renters.",
    fields: [
      "id",
      "name",
      "contact_info",
      "billing_address",
      "customer_type",
    ],
  },
  {
    name: "Customer Locations",
    summary:
      "Delivery yards, jobsites, and storage sites connected to each customer account.",
    fields: ["id", "customer_id", "address", "contact_person"],
  },
  {
    name: "Rental Contracts",
    summary:
      "The operational agreement that moves from quote to reservation to active rent and closeout.",
    fields: [
      "id",
      "customer_id",
      "location_id",
      "start_date",
      "end_date",
      "status",
    ],
  },
  {
    name: "Contract Lines",
    summary:
      "Asset-specific pricing, units, date ranges, and adjustments under a contract.",
    fields: [
      "id",
      "contract_id",
      "asset_id",
      "price",
      "unit",
      "start_date",
      "end_date",
      "adjustments",
    ],
  },
  {
    name: "Financial Events",
    summary:
      "The ledger-ready activity stream that produces invoice lines and reconciliation hooks.",
    fields: [
      "id",
      "contract_id",
      "event_type",
      "description",
      "amount",
      "date",
      "status",
    ],
  },
  {
    name: "Invoices",
    summary:
      "Customer-facing billing documents generated from financial events and payment activity.",
    fields: [
      "id",
      "customer_id",
      "contract_id",
      "invoice_date",
      "due_date",
      "status",
      "total_amount",
    ],
  },
  {
    name: "Audit Events",
    summary:
      "Append-only operational history with user attribution and metadata for every key change.",
    fields: [
      "id",
      "entity_type",
      "entity_id",
      "event_type",
      "user_id",
      "timestamp",
      "metadata",
    ],
  },
  {
    name: "Users and Roles",
    summary:
      "Role-based access for dispatchers, sales, accounting, admins, technicians, and collections.",
    fields: ["id", "name", "email", "role", "branch_id", "active"],
  },
];

export const roadmapPhases: PhaseDefinition[] = [
  {
    phase: "0",
    title: "Domain modeling and design",
    summary:
      "Lock the business vocabulary and state rules before scale or integrations magnify mistakes.",
    deliverables: [
      "Drizzle schema and entity boundaries",
      "Contract and asset lifecycle transitions",
      "Audit-first operational design",
    ],
  },
  {
    phase: "1",
    title: "Core asset and rental backend",
    summary:
      "Make asset availability, customer records, and contract execution explicit and trustworthy.",
    deliverables: [
      "Asset CRUD and status transitions",
      "Customer and site management",
      "Quote to close contract workflow",
    ],
  },
  {
    phase: "2",
    title: "Financial engine and invoices",
    summary:
      "Turn operational events into accurate billing and reconciliation paths.",
    deliverables: [
      "Rate cards and overrides",
      "Invoice generation from financial events",
      "QuickBooks synchronization",
    ],
  },
  {
    phase: "3",
    title: "Dispatch execution",
    summary:
      "Give dispatchers a daily board that mirrors real deliveries, pickups, swaps, and returns.",
    deliverables: [
      "Dispatch board",
      "Assignment workflows",
      "Asset status updates on execution",
    ],
  },
  {
    phase: "4",
    title: "Record360 inspections",
    summary:
      "Treat inspection capture as a first-class operational trigger without owning media tooling yourself.",
    deliverables: [
      "Record360 unit sync",
      "Inspection retrieval and damage updates",
      "Contract and asset inspection history",
    ],
  },
  {
    phase: "5",
    title: "Maintenance and work orders",
    summary:
      "Translate inspection outcomes and technician work into fleet readiness decisions.",
    deliverables: [
      "Work order lifecycle",
      "Parts and labor tracking",
      "Automatic availability recovery",
    ],
  },
  {
    phase: "6",
    title: "Payments and portal",
    summary:
      "Let customers self-serve invoices, contracts, and online payment without leaving the platform.",
    deliverables: [
      "Stripe payment methods and charges",
      "Invoice and contract portal",
      "Inspection and damage visibility",
    ],
  },
  {
    phase: "7",
    title: "Telematics, collections, reporting",
    summary:
      "Expose overdue risk, asset location, and operational reporting from a single data model.",
    deliverables: [
      "SkyBitz visibility",
      "Collections workflow",
      "Fleet and revenue reporting",
    ],
  },
  {
    phase: "8",
    title: "Internal e-signature",
    summary:
      "Run signing directly inside Metro Trailer so consent capture, routing, audit evidence, and immutable signed artifacts stay under first-party control.",
    deliverables: [
      "Internal signing sessions and signer routing",
      "Immutable signed agreement and certificate generation",
      "Consent, hashing, and evidence controls",
    ],
  },
];

export const branchSnapshots: FleetSnapshot[] = [
  { branch: "Newark", available: 3140, reserved: 412, onRent: 2578, maintenance: 118 },
  { branch: "Savannah", available: 2288, reserved: 301, onRent: 1812, maintenance: 104 },
  { branch: "Kansas City", available: 1982, reserved: 244, onRent: 1607, maintenance: 89 },
  { branch: "Phoenix", available: 2641, reserved: 327, onRent: 2139, maintenance: 96 },
];

export const sampleAssets: AssetRecord[] = [
  {
    id: "asset_001",
    assetNumber: "BX-10428",
    type: "commercial_box_trailer",
    dimensions: "53' x 102\" dry van",
    branch: "Newark",
    status: "reserved",
    availability: "limited",
    maintenanceStatus: "clear",
    gpsDeviceId: "SKY-992031",
    age: "4.2 years",
    features: ["roll-up door", "e-track", "swing jack"],
  },
  {
    id: "asset_002",
    assetNumber: "OF-20913",
    type: "office_trailer",
    dimensions: "10' x 40' office",
    branch: "Phoenix",
    status: "on_rent",
    availability: "unavailable",
    maintenanceStatus: "clear",
    gpsDeviceId: "SKY-908811",
    age: "2.8 years",
    features: ["HVAC", "ADA stairs", "split office"],
  },
  {
    id: "asset_003",
    assetNumber: "ST-53108",
    type: "storage_container",
    dimensions: "40' storage container",
    branch: "Kansas City",
    status: "inspection_hold",
    availability: "limited",
    maintenanceStatus: "inspection_required",
    gpsDeviceId: "SKY-101774",
    age: "6.1 years",
    features: ["lock box", "fork pockets"],
  },
  {
    id: "asset_004",
    assetNumber: "BX-11791",
    type: "commercial_box_trailer",
    dimensions: "48' x 102\" dry van",
    branch: "Savannah",
    status: "in_maintenance",
    availability: "unavailable",
    maintenanceStatus: "under_repair",
    gpsDeviceId: "SKY-915403",
    age: "7.4 years",
    features: ["swing doors", "rear threshold plate"],
  },
  {
    id: "asset_005",
    assetNumber: "CH-01488",
    type: "chassis",
    dimensions: "40' container chassis",
    branch: "Newark",
    status: "available",
    availability: "rentable",
    maintenanceStatus: "clear",
    gpsDeviceId: "SKY-773198",
    age: "1.9 years",
    features: ["radial tires", "LED lighting"],
  },
];

export const sampleCustomers: CustomerRecord[] = [
  {
    id: "customer_001",
    customerNumber: "C-2041",
    name: "Atlantic Infrastructure Group",
    customerType: "commercial",
    billingCity: "Jersey City, NJ",
    portalEnabled: true,
    branchCoverage: ["Newark", "Savannah"],
    locations: [
      {
        id: "loc_001",
        name: "Port Newark Staging Yard",
        address: "125 Corbin St, Newark, NJ",
        contactPerson: "Maria Ortiz",
      },
      {
        id: "loc_002",
        name: "Savannah Bridge Expansion Site",
        address: "22 Harbor Causeway, Savannah, GA",
        contactPerson: "Lewis Hart",
      },
    ],
  },
  {
    id: "customer_002",
    customerNumber: "G-8802",
    name: "City of Mesa Facilities",
    customerType: "government",
    billingCity: "Mesa, AZ",
    portalEnabled: false,
    branchCoverage: ["Phoenix"],
    locations: [
      {
        id: "loc_003",
        name: "Mesa Utilities Overflow Yard",
        address: "901 S Country Club Dr, Mesa, AZ",
        contactPerson: "Angela Reed",
      },
    ],
  },
  {
    id: "customer_003",
    customerNumber: "C-4104",
    name: "Midwest Retail Rollout",
    customerType: "commercial",
    billingCity: "Overland Park, KS",
    portalEnabled: true,
    branchCoverage: ["Kansas City"],
    locations: [
      {
        id: "loc_004",
        name: "Lenexa Remodel Cluster",
        address: "8301 Renner Blvd, Lenexa, KS",
        contactPerson: "Tessa Nguyen",
      },
    ],
  },
];

export const sampleContracts: ContractRecord[] = [
  {
    id: "contract_001",
    contractNumber: "R-250114",
    customerName: "Atlantic Infrastructure Group",
    locationName: "Port Newark Staging Yard",
    branch: "Newark",
    status: "reserved",
    startDate: "2026-04-18",
    endDate: "2026-09-18",
    assets: ["BX-10428", "CH-01488"],
    value: 21840,
    amendmentFlags: ["asset_swap_ready"],
  },
  {
    id: "contract_002",
    contractNumber: "R-250093",
    customerName: "City of Mesa Facilities",
    locationName: "Mesa Utilities Overflow Yard",
    branch: "Phoenix",
    status: "active",
    startDate: "2026-02-03",
    endDate: null,
    assets: ["OF-20913"],
    value: 14400,
    amendmentFlags: ["extension_due", "inspection_synced"],
  },
  {
    id: "contract_003",
    contractNumber: "R-250041",
    customerName: "Midwest Retail Rollout",
    locationName: "Lenexa Remodel Cluster",
    branch: "Kansas City",
    status: "completed",
    startDate: "2026-01-10",
    endDate: "2026-04-08",
    assets: ["ST-53108"],
    value: 6120,
    amendmentFlags: ["damage_review"],
  },
];

export const financialEvents: FinancialEventRecord[] = [
  {
    id: "fe_001",
    contractNumber: "R-250093",
    eventType: "rent",
    description: "Monthly office trailer rent",
    amount: 4800,
    eventDate: "2026-04-01",
    status: "posted",
  },
  {
    id: "fe_002",
    contractNumber: "R-250114",
    eventType: "delivery",
    description: "Scheduled delivery fee to Port Newark Staging Yard",
    amount: 650,
    eventDate: "2026-04-18",
    status: "pending",
  },
  {
    id: "fe_003",
    contractNumber: "R-250041",
    eventType: "damage",
    description: "Door track impact found on return inspection",
    amount: 910,
    eventDate: "2026-04-08",
    status: "posted",
  },
  {
    id: "fe_004",
    contractNumber: "R-250041",
    eventType: "credit",
    description: "Partial credit for early pickup coordination",
    amount: -180,
    eventDate: "2026-04-09",
    status: "posted",
  },
];

export const invoices: InvoiceRecord[] = [
  {
    id: "inv_001",
    invoiceNumber: "INV-260401-117",
    customerName: "City of Mesa Facilities",
    contractNumber: "R-250093",
    status: "sent",
    invoiceDate: "2026-04-01",
    dueDate: "2026-04-15",
    totalAmount: 4800,
    balanceAmount: 4800,
  },
  {
    id: "inv_002",
    invoiceNumber: "INV-260409-044",
    customerName: "Midwest Retail Rollout",
    contractNumber: "R-250041",
    status: "partially_paid",
    invoiceDate: "2026-04-09",
    dueDate: "2026-04-23",
    totalAmount: 730,
    balanceAmount: 320,
  },
];

export const dispatchBoard: DispatchTaskRecord[] = [
  {
    id: "dispatch_001",
    type: "Delivery",
    status: "assigned",
    branch: "Newark",
    assetNumber: "BX-10428",
    customerSite: "Port Newark Staging Yard",
    scheduledFor: "Apr 18, 7:00 AM",
  },
  {
    id: "dispatch_002",
    type: "Pickup",
    status: "unassigned",
    branch: "Kansas City",
    assetNumber: "ST-53108",
    customerSite: "Lenexa Remodel Cluster",
    scheduledFor: "Apr 15, 2:30 PM",
  },
  {
    id: "dispatch_003",
    type: "Swap",
    status: "in_progress",
    branch: "Phoenix",
    assetNumber: "OF-20913",
    customerSite: "Mesa Utilities Overflow Yard",
    scheduledFor: "Apr 13, 10:00 AM",
  },
];

export const workOrders: WorkOrderRecord[] = [
  {
    id: "wo_001",
    title: "Replace damaged door track",
    status: "assigned",
    assetNumber: "ST-53108",
    branch: "Kansas City",
    priority: "High",
    source: "Record360 return inspection",
  },
  {
    id: "wo_002",
    title: "Brake chamber replacement",
    status: "in_progress",
    assetNumber: "BX-11791",
    branch: "Savannah",
    priority: "Critical",
    source: "Technician manual entry",
  },
  {
    id: "wo_003",
    title: "Preventive HVAC service",
    status: "open",
    assetNumber: "OF-20913",
    branch: "Phoenix",
    priority: "Medium",
    source: "Scheduled maintenance plan",
  },
];

export const integrationBlueprint: IntegrationDefinition[] = [
  {
    provider: "Stripe",
    purpose:
      "Store payment methods, charge invoices, and power self-service portal payments.",
    syncMode: "API + webhook",
    systemOfRecord:
      "Stripe for payment execution, Metro Trailer for invoice intent and customer UX.",
    boundary:
      "Payments stay external while invoice state and collections context remain internal.",
  },
  {
    provider: "QuickBooks Online",
    purpose: "Push posted invoices and reconcile payment status back into operations.",
    syncMode: "Outbound invoice sync + inbound payment updates",
    systemOfRecord:
      "QuickBooks for accounting and GL, Metro Trailer for contract-level operational billing logic.",
    boundary:
      "Financial posting follows internal event generation rather than driving it.",
  },
  {
    provider: "Record360",
    purpose:
      "Capture delivery and return inspections with media, damage evidence, and unit condition.",
    syncMode: "Lifecycle-triggered outbound sync + inspection pullback",
    systemOfRecord:
      "Record360 for capture workflow, Metro Trailer for readiness and billing decisions.",
    boundary:
      "Inspection results enrich contracts and assets without moving core asset ownership outside the app.",
  },
  {
    provider: "SkyBitz",
    purpose:
      "Expose location and status signals for operations and collections.",
    syncMode: "Scheduled polling",
    systemOfRecord:
      "SkyBitz for raw telemetry, Metro Trailer for asset context and recovery workflows.",
    boundary:
      "Telemetry informs decisions but does not own contract or asset lifecycle state.",
  },
];

export const ratePolicies: RatePolicy[] = [
  {
    name: "53' commercial box trailer",
    daily: 32,
    weekly: 144,
    monthly: 435,
    notes:
      "Regional base rate with customer override support for strategic accounts.",
  },
  {
    name: "40' storage container",
    daily: 24,
    weekly: 108,
    monthly: 330,
    notes:
      "Common storage use case with pickup and delivery fees added as separate events.",
  },
  {
    name: "10' x 40' office trailer",
    daily: 68,
    weekly: 306,
    monthly: 920,
    notes:
      "Higher-touch rental line that frequently pairs with maintenance and inspection milestones.",
  },
];
