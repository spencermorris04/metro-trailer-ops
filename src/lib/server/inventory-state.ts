import type {
  AssetAvailabilityKey,
  AssetStatusKey,
  MaintenanceStatusKey,
  WorkOrderStatusKey,
} from "@/lib/domain/models";

export type InventoryAllocationType =
  | "reservation"
  | "dispatch_hold"
  | "on_rent"
  | "maintenance_hold"
  | "inspection_hold"
  | "swap_out"
  | "swap_in";

export function inferManualAllocationTypeForAssetStatus(
  status: AssetStatusKey,
): InventoryAllocationType | null {
  switch (status) {
    case "reserved":
      return "reservation";
    case "dispatched":
      return "dispatch_hold";
    case "on_rent":
      return "on_rent";
    case "inspection_hold":
      return "inspection_hold";
    case "in_maintenance":
      return "maintenance_hold";
    default:
      return null;
  }
}

export function deriveInventoryAssetState(options: {
  isRetired: boolean;
  maintenanceStatus: MaintenanceStatusKey;
  allocationTypes: InventoryAllocationType[];
  blockingWorkOrderStatuses?: WorkOrderStatusKey[];
}) {
  const {
    isRetired,
    maintenanceStatus,
    allocationTypes,
    blockingWorkOrderStatuses = [],
  } = options;

  if (isRetired) {
    return {
      status: "retired" as AssetStatusKey,
      availability: "unavailable" as AssetAvailabilityKey,
      maintenanceStatus,
    };
  }

  if (
    allocationTypes.includes("maintenance_hold") ||
    blockingWorkOrderStatuses.length > 0
  ) {
    let nextMaintenanceStatus: MaintenanceStatusKey = "under_repair";
    if (blockingWorkOrderStatuses.includes("awaiting_parts")) {
      nextMaintenanceStatus = "waiting_on_parts";
    } else if (blockingWorkOrderStatuses.includes("repair_completed")) {
      nextMaintenanceStatus = "inspection_required";
    } else if (maintenanceStatus !== "clear") {
      nextMaintenanceStatus = maintenanceStatus;
    }

    return {
      status: "in_maintenance" as AssetStatusKey,
      availability: "unavailable" as AssetAvailabilityKey,
      maintenanceStatus: nextMaintenanceStatus,
    };
  }

  if (allocationTypes.includes("inspection_hold")) {
    return {
      status: "inspection_hold" as AssetStatusKey,
      availability: "limited" as AssetAvailabilityKey,
      maintenanceStatus: "inspection_required" as MaintenanceStatusKey,
    };
  }

  if (allocationTypes.includes("dispatch_hold")) {
    return {
      status: "dispatched" as AssetStatusKey,
      availability: "unavailable" as AssetAvailabilityKey,
      maintenanceStatus:
        maintenanceStatus === "under_repair" ? "clear" : maintenanceStatus,
    };
  }

  if (allocationTypes.includes("on_rent") || allocationTypes.includes("swap_in")) {
    return {
      status: "on_rent" as AssetStatusKey,
      availability: "unavailable" as AssetAvailabilityKey,
      maintenanceStatus: "clear" as MaintenanceStatusKey,
    };
  }

  if (allocationTypes.includes("reservation") || allocationTypes.includes("swap_out")) {
    return {
      status: "reserved" as AssetStatusKey,
      availability: "limited" as AssetAvailabilityKey,
      maintenanceStatus: "clear" as MaintenanceStatusKey,
    };
  }

  return {
    status: "available" as AssetStatusKey,
    availability: "rentable" as AssetAvailabilityKey,
    maintenanceStatus: "clear" as MaintenanceStatusKey,
  };
}
