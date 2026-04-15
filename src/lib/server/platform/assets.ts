export {
  createAsset,
  deleteAsset,
  listAssetsPage,
  listAssets,
  transferAsset,
  transitionAsset,
  updateAsset,
  type AssetTransferInput,
  type AssetTransitionOptions,
  type CreateAssetInput,
  type UpdateAssetInput,
} from "@/lib/server/platform-service.production";

import { listAssets } from "@/lib/server/platform-service.production";
import {
  listDispatchTasks,
  listInspections,
  listWorkOrders,
} from "@/lib/server/platform-operations.production";

type InventoryAsset = Awaited<ReturnType<typeof listAssets>>[number];

const branchBlockedStatuses = new Set([
  "reserved",
  "dispatched",
  "inspection_hold",
  "in_maintenance",
]);

const dispatchQueueStatuses = new Set(["unassigned", "assigned", "in_progress"]);
const inspectionQueueStatuses = new Set(["requested", "in_progress", "needs_review"]);
const maintenanceQueueStatuses = new Set([
  "open",
  "assigned",
  "in_progress",
  "awaiting_parts",
  "awaiting_vendor",
  "repair_completed",
]);

function isTelematicsBlind(asset: InventoryAsset) {
  return asset.telematicsFreshnessMinutes === null || asset.telematicsStale === true;
}

function isBranchBlocked(asset: InventoryAsset) {
  return branchBlockedStatuses.has(asset.status);
}

function isTurningSoon(asset: InventoryAsset) {
  if (!asset.nextReservationStart) {
    return false;
  }

  const nextStart = new Date(asset.nextReservationStart).getTime();
  const now = Date.now();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;

  return nextStart >= now && nextStart - now <= sevenDays;
}

function sortByUpcomingReservation(a: InventoryAsset, b: InventoryAsset) {
  const left = a.nextReservationStart ? new Date(a.nextReservationStart).getTime() : Number.MAX_SAFE_INTEGER;
  const right = b.nextReservationStart ? new Date(b.nextReservationStart).getTime() : Number.MAX_SAFE_INTEGER;
  return left - right;
}

function sortTelematicsBlindAssets(a: InventoryAsset, b: InventoryAsset) {
  if (a.telematicsFreshnessMinutes === null && b.telematicsFreshnessMinutes !== null) {
    return -1;
  }
  if (a.telematicsFreshnessMinutes !== null && b.telematicsFreshnessMinutes === null) {
    return 1;
  }

  return (b.telematicsFreshnessMinutes ?? 0) - (a.telematicsFreshnessMinutes ?? 0);
}

function sortBlockedAssets(a: InventoryAsset, b: InventoryAsset) {
  const priority = {
    dispatched: 0,
    inspection_hold: 1,
    in_maintenance: 2,
    reserved: 3,
    on_rent: 4,
    available: 5,
    retired: 6,
  } as const;

  return priority[a.status] - priority[b.status];
}

export async function getInventoryOverview() {
  const [assets, dispatchTasks, inspections, workOrders] = await Promise.all([
    listAssets(),
    listDispatchTasks(),
    listInspections(),
    listWorkOrders(),
  ]);

  const countsByStatus = assets.reduce<Record<string, number>>((acc, asset) => {
    acc[asset.status] = (acc[asset.status] ?? 0) + 1;
    return acc;
  }, {});

  const totalAssets = assets.length;
  const retiredCount = countsByStatus.retired ?? 0;
  const activeAssetsCount = totalAssets - retiredCount;
  const rentReadyCount = countsByStatus.available ?? 0;
  const branchBlockedCount = assets.filter(isBranchBlocked).length;
  const onRentCount = countsByStatus.on_rent ?? 0;
  const telematicsBlindCount = assets.filter(isTelematicsBlind).length;
  const turningSoonCount = assets.filter(isTurningSoon).length;

  const branchSnapshots = Array.from(
    assets.reduce<
      Map<
        string,
        {
          branch: string;
          total: number;
          active: number;
          available: number;
          reserved: number;
          dispatched: number;
          onRent: number;
          maintenance: number;
          inspection: number;
          retired: number;
          blocked: number;
          telematicsBlind: number;
          turningSoon: number;
          readyRate: number;
          blockedRate: number;
        }
      >
    >((acc, asset) => {
      const current = acc.get(asset.branch) ?? {
        branch: asset.branch,
        total: 0,
        active: 0,
        available: 0,
        reserved: 0,
        dispatched: 0,
        onRent: 0,
        maintenance: 0,
        inspection: 0,
        retired: 0,
        blocked: 0,
        telematicsBlind: 0,
        turningSoon: 0,
        readyRate: 0,
        blockedRate: 0,
      };

      current.total += 1;
      if (asset.status !== "retired") {
        current.active += 1;
      }
      if (asset.status === "available") {
        current.available += 1;
      } else if (asset.status === "reserved") {
        current.reserved += 1;
      } else if (asset.status === "dispatched") {
        current.dispatched += 1;
      } else if (asset.status === "on_rent") {
        current.onRent += 1;
      } else if (asset.status === "inspection_hold") {
        current.inspection += 1;
      } else if (asset.status === "in_maintenance") {
        current.maintenance += 1;
      } else if (asset.status === "retired") {
        current.retired += 1;
      }

      if (isBranchBlocked(asset)) {
        current.blocked += 1;
      }
      if (isTelematicsBlind(asset)) {
        current.telematicsBlind += 1;
      }
      if (isTurningSoon(asset)) {
        current.turningSoon += 1;
      }

      current.readyRate = current.active > 0 ? current.available / current.active : 0;
      current.blockedRate = current.active > 0 ? current.blocked / current.active : 0;

      acc.set(asset.branch, current);
      return acc;
    }, new Map()).values(),
  );

  const branchPressure = [...branchSnapshots].sort((a, b) => {
    if (b.blocked !== a.blocked) {
      return b.blocked - a.blocked;
    }
    if (b.telematicsBlind !== a.telematicsBlind) {
      return b.telematicsBlind - a.telematicsBlind;
    }
    return a.readyRate - b.readyRate;
  });

  const fleetMix = Array.from(
    assets.reduce<Map<string, number>>((acc, asset) => {
      acc.set(asset.type, (acc.get(asset.type) ?? 0) + 1);
      return acc;
    }, new Map()).entries(),
  )
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);

  const ownership = {
    contractOwned: assets.filter((asset) => Boolean(asset.activeContractNumber)).length,
    dispatchOwned: assets.filter((asset) => Boolean(asset.activeDispatchTaskId)).length,
    maintenanceOwned: assets.filter((asset) => Boolean(asset.activeWorkOrderId)).length,
    inspectionOwned: assets.filter((asset) => asset.status === "inspection_hold").length,
  };

  const actionLanes = [
    {
      key: "dispatch",
      title: "Dispatch friction",
      href: "/dispatch",
      count: assets.filter((asset) => asset.status === "dispatched" || asset.status === "reserved").length,
      assets: assets
        .filter((asset) => asset.status === "dispatched" || asset.status === "reserved")
        .sort(sortBlockedAssets)
        .slice(0, 8),
    },
    {
      key: "inspection",
      title: "Inspection release",
      href: "/inspections",
      count: assets.filter((asset) => asset.status === "inspection_hold").length,
      assets: assets
        .filter((asset) => asset.status === "inspection_hold")
        .sort(sortBlockedAssets)
        .slice(0, 8),
    },
    {
      key: "maintenance",
      title: "Maintenance blockers",
      href: "/maintenance",
      count: assets.filter((asset) => asset.status === "in_maintenance").length,
      assets: assets
        .filter((asset) => asset.status === "in_maintenance")
        .sort(sortBlockedAssets)
        .slice(0, 8),
    },
    {
      key: "telematics",
      title: "Telematics blind spots",
      href: "/telematics",
      count: telematicsBlindCount,
      assets: assets.filter(isTelematicsBlind).sort(sortTelematicsBlindAssets).slice(0, 8),
    },
    {
      key: "turns",
      title: "Upcoming turns",
      href: "/contracts",
      count: turningSoonCount,
      assets: assets.filter(isTurningSoon).sort(sortByUpcomingReservation).slice(0, 8),
    },
  ];

  return {
    countsByStatus,
    summary: {
      totalAssets,
      activeAssetsCount,
      rentReadyCount,
      branchBlockedCount,
      onRentCount,
      retiredCount,
      telematicsBlindCount,
      turningSoonCount,
      readyRate: activeAssetsCount > 0 ? rentReadyCount / activeAssetsCount : 0,
    },
    branchSnapshots: branchSnapshots.sort((a, b) => a.branch.localeCompare(b.branch)),
    branchPressure,
    fleetMix,
    ownership,
    activityCounts: {
      dispatchOpen: dispatchTasks.filter((task) => dispatchQueueStatuses.has(task.status)).length,
      inspectionOpen: inspections.filter((inspection) => inspectionQueueStatuses.has(inspection.status)).length,
      maintenanceOpen: workOrders.filter((order) => maintenanceQueueStatuses.has(order.status)).length,
      telematicsBlind: telematicsBlindCount,
    },
    blockedAssetsCount: assets.filter((asset) => asset.status !== "available").length,
    dispatchQueueCount: dispatchTasks.filter((task) => task.status !== "completed").length,
    inspectionQueueCount: inspections.filter((inspection) =>
      inspectionQueueStatuses.has(inspection.status),
    ).length,
    maintenanceQueueCount: workOrders.filter((order) =>
      maintenanceQueueStatuses.has(order.status),
    ).length,
    actionLanes,
  };
}
