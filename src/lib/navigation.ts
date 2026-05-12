import type { IconName } from "@/components/icons";

export type NavItem = {
  href: string;
  label: string;
  description: string;
  icon: IconName;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const navigationGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [
      {
        href: "/",
        label: "Dashboard",
        description: "Configurable Metro operating dashboard and saved workspace presets",
        icon: "home",
      },
    ],
  },
  {
    label: "Operations",
    items: [
      {
        href: "/equipment",
        label: "Equipment",
        description: "Fleet master, trailer revenue, BC lineage, placement, and readiness state",
        icon: "truck",
      },
      {
        href: "/customers",
        label: "Customers",
        description: "Accounts, sites, contract history, and receivables context",
        icon: "users",
      },      
      {
        href: "/operations",
        label: "Operations",
        description: "Execution overview across dispatch, inspections, and maintenance",
        icon: "layers",
      },
      {
        href: "/dispatch",
        label: "Dispatch",
        description: "Daily board, assignments, deliveries, pickups, and swaps",
        icon: "map-pin",
      },
      {
        href: "/inspections",
        label: "Inspections",
        description: "Record360 flows, damage review, and readiness outcomes",
        icon: "clipboard",
      },
      {
        href: "/maintenance",
        label: "Maintenance",
        description: "Work orders, technicians, vendors, and asset release",
        icon: "wrench",
      },
    ],
  },
  {
    label: "Commercial",
    items: [
      {
        href: "/leases",
        label: "Leases",
        description: "Rental agreements, BC order history, invoice exposure, and asset allocations",
        icon: "file-text",
      },
      {
        href: "/documents",
        label: "Documents",
        description: "Internal docs, e-sign packets, and linked source lineage",
        icon: "folder",
      },
    ],
  },
  {
    label: "Accounting",
    items: [
      {
        href: "/financial",
        label: "Finance",
        description: "Commercial, subledger, GL, and BC reconciliation overview",
        icon: "dollar",
      },
      {
        href: "/ar/invoices",
        label: "AR Invoices",
        description: "App-native receivables invoices with source awareness",
        icon: "file-text",
      },
      {
        href: "/ar/receipts",
        label: "AR Receipts",
        description: "Customer receipts, applications, and unapplied cash",
        icon: "phone",
      },
      {
        href: "/ap/bills",
        label: "AP / Vendors",
        description: "Vendor master, AP ledger history, and purchase-order readiness",
        icon: "clipboard",
      },
      {
        href: "/gl/accounts",
        label: "GL Accounts",
        description: "Account master and BC-origin account references",
        icon: "layers",
      },
      {
        href: "/gl/journal",
        label: "GL Journal",
        description: "Journal entries, lines, and posting posture",
        icon: "bar-chart",
      },
      {
        href: "/gl/periods",
        label: "GL Periods",
        description: "Posting periods and close status",
        icon: "bell",
      },
      {
        href: "/cash",
        label: "Cash",
        description: "Cash accounts, transactions, and receipt/payment links",
        icon: "globe",
      },
      {
        href: "/collections",
        label: "Collections",
        description: "Reminder workflows, promise-to-pay tracking, and recovery context",
        icon: "phone",
      },
      {
        href: "/portal",
        label: "Portal",
        description: "Customer invoices, payments, contracts, and damage history",
        icon: "globe",
      },
    ],
  },
  {
    label: "Admin",
    items: [
      {
        href: "/integrations",
        label: "Integrations",
        description: "Provider boundaries, sync posture, and BC migration status",
        icon: "link",
      },
      {
        href: "/integrations/business-central",
        label: "Business Central",
        description: "Import runs, reconciliation, checkpoints, and source coverage",
        icon: "link",
      },
      {
        href: "/source-documents",
        label: "Source Documents",
        description: "Imported BC commercial documents and app-native linkage",
        icon: "search",
      },
      {
        href: "/reports",
        label: "Reports",
        description: "Operations, commercial, accounting, and BC reconciliation views",
        icon: "bar-chart",
      },
    ],
  },
];

/** Flat list for backward compatibility. */
export const navigationItems = navigationGroups.flatMap((g) => g.items);
