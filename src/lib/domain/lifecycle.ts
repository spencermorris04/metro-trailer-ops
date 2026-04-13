import type { AssetStatusKey, ContractStatusKey } from "@/lib/domain/models";

export const assetTransitionMap: Record<AssetStatusKey, AssetStatusKey[]> = {
  available: ["reserved", "dispatched", "in_maintenance", "retired"],
  reserved: ["available", "dispatched", "in_maintenance"],
  dispatched: ["on_rent", "available", "inspection_hold"],
  on_rent: ["inspection_hold", "in_maintenance", "retired"],
  inspection_hold: ["available", "in_maintenance", "retired"],
  in_maintenance: ["available", "inspection_hold", "retired"],
  retired: [],
};

export const contractTransitionMap: Record<ContractStatusKey, ContractStatusKey[]> = {
  quoted: ["reserved", "cancelled"],
  reserved: ["active", "cancelled", "quoted"],
  active: ["completed", "cancelled"],
  completed: ["closed", "active"],
  closed: [],
  cancelled: [],
};

export const assetGuardrails: Record<AssetStatusKey, string[]> = {
  available: [
    "Asset can be quoted, reserved, or assigned to a dispatch task.",
    "No open work order should exist if the asset is marked rentable and available.",
  ],
  reserved: [
    "Reservation must be tied to a contract or dispatch intent.",
    "Reserved units remain visible to dispatch but should be excluded from rentable search.",
  ],
  dispatched: [
    "Dispatch confirmation should capture driver, site, and planned time window.",
    "A dispatched asset should not be double-assigned to another delivery or pickup task.",
  ],
  on_rent: [
    "Location, contract, and billing cadence must remain visible to operations and accounting.",
    "Extensions, swaps, and partial returns should amend the same active agreement.",
  ],
  inspection_hold: [
    "Inspection hold blocks new reservations until results are reviewed.",
    "Damage outcomes should route into maintenance or billing without duplicate entry.",
  ],
  in_maintenance: [
    "Maintenance work orders own the readiness decision while this state is active.",
    "Asset should return to available only when repair and inspection conditions are satisfied.",
  ],
  retired: [
    "Retired assets stay queryable for audit and financial history.",
    "Retired units should never re-enter availability calculations.",
  ],
};

export const contractGuardrails: Record<ContractStatusKey, string[]> = {
  quoted: [
    "Quote can price assets, delivery, pickup, mileage, and surcharges before final assignment.",
    "No financial posting or dispatch execution should occur while the contract is only a quote.",
  ],
  reserved: [
    "Reserved contracts block asset availability and prepare dispatch execution.",
    "Reserved units can still be swapped before activation if branch inventory changes.",
  ],
  active: [
    "An active contract becomes the source for on-rent assets, billing cadence, and inspections.",
    "Extensions, swaps, and partial returns should be modeled as amendments on the same agreement.",
  ],
  completed: [
    "All assets are returned or swapped off rent, but final billing and inspection review may still be open.",
    "Completed contracts can reopen to active only through an explicit amendment path.",
  ],
  closed: [
    "Closed means operational work is done and financial state is reconciled.",
    "Closed contracts are immutable except through auditable administrative correction flows.",
  ],
  cancelled: [
    "Cancelled contracts preserve quote and reservation history for reporting and audit.",
    "Asset reservations and dispatch intents must be released immediately on cancellation.",
  ],
};

export const amendmentActions = [
  "extension",
  "asset_swap",
  "partial_return",
  "rate_adjustment",
] as const;

export function canTransitionAsset(
  fromStatus: AssetStatusKey,
  toStatus: AssetStatusKey,
) {
  return assetTransitionMap[fromStatus].includes(toStatus);
}

export function canTransitionContract(
  fromStatus: ContractStatusKey,
  toStatus: ContractStatusKey,
) {
  return contractTransitionMap[fromStatus].includes(toStatus);
}
