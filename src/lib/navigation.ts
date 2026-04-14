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
    label: "Core",
    items: [
      {
        href: "/",
        label: "Overview",
        description: "Platform blueprint and phase map",
        icon: "home",
      },
      {
        href: "/assets",
        label: "Assets",
        description: "Fleet inventory, status, and availability rules",
        icon: "truck",
      },
      {
        href: "/customers",
        label: "Customers",
        description: "Accounts, billing profiles, and yard locations",
        icon: "users",
      },
      {
        href: "/contracts",
        label: "Contracts",
        description: "Quote, reservation, active rental, and return lifecycle",
        icon: "file-text",
      },
    ],
  },
  {
    label: "Operations",
    items: [
      {
        href: "/operations",
        label: "Operations",
        description: "Execution overview across dispatch, inspections, and fleet health",
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
    label: "Finance",
    items: [
      {
        href: "/financial",
        label: "Financials",
        description: "Rates, events, invoices, payments, and reconciliation",
        icon: "dollar",
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
    label: "System",
    items: [
      {
        href: "/reports",
        label: "Reports",
        description: "Utilization, revenue, overdue exposure, and audit visibility",
        icon: "bar-chart",
      },
      {
        href: "/documents",
        label: "Documents",
        description: "Invoices, contracts, signatures, and immutable storage posture",
        icon: "folder",
      },
      {
        href: "/integrations",
        label: "Integrations",
        description: "Stripe, QuickBooks, Record360, and SkyBitz boundaries",
        icon: "link",
      },
    ],
  },
];

/** Flat list for backward compatibility. */
export const navigationItems = navigationGroups.flatMap((g) => g.items);
