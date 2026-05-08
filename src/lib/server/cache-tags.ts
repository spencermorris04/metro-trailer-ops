export const cacheTags = {
  branches: "branches",
  dashboard: "dashboard",
  search: "search",
  assets: "assets",
  asset: (id: string) => `asset:${id}`,
  customers: "customers",
  customer: (id: string) => `customer:${id}`,
  contracts: "contracts",
  contract: (id: string) => `contract:${id}`,
  invoices: "invoices",
  workOrders: "work-orders",
  inspections: "inspections",
} as const;

export function assetInvalidationTags(assetId?: string | null) {
  return [
    cacheTags.assets,
    cacheTags.dashboard,
    cacheTags.search,
    ...(assetId ? [cacheTags.asset(assetId)] : []),
  ];
}

export function customerInvalidationTags(customerId?: string | null) {
  return [
    cacheTags.customers,
    cacheTags.dashboard,
    cacheTags.search,
    ...(customerId ? [cacheTags.customer(customerId)] : []),
  ];
}

export function contractInvalidationTags(contractId?: string | null) {
  return [
    cacheTags.contracts,
    cacheTags.dashboard,
    cacheTags.search,
    ...(contractId ? [cacheTags.contract(contractId)] : []),
  ];
}
