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

import {
  listAssets,
} from "@/lib/server/platform-service.production";
import {
  listDispatchTasks,
  listInspections,
  listWorkOrders,
} from "@/lib/server/platform-operations.production";

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

  const branchSnapshots = Array.from(
    assets.reduce<
      Map<
        string,
        {
          branch: string;
          available: number;
          reserved: number;
          dispatched: number;
          onRent: number;
          maintenance: number;
          inspection: number;
        }
      >
    >((acc, asset) => {
      const current = acc.get(asset.branch) ?? {
        branch: asset.branch,
        available: 0,
        reserved: 0,
        dispatched: 0,
        onRent: 0,
        maintenance: 0,
        inspection: 0,
      };

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
      }

      acc.set(asset.branch, current);
      return acc;
    }, new Map()).values(),
  ).sort((a, b) => a.branch.localeCompare(b.branch));

  return {
    countsByStatus,
    branchSnapshots,
    staleTelematicsCount: assets.filter((asset) => asset.telematicsStale).length,
    blockedAssetsCount: assets.filter((asset) => asset.status !== "available").length,
    dispatchQueueCount: dispatchTasks.filter((task) => task.status !== "completed").length,
    inspectionQueueCount: inspections.filter((inspection) =>
      ["requested", "in_progress", "needs_review"].includes(inspection.status),
    ).length,
    maintenanceQueueCount: workOrders.filter(
      (order) => !["verified", "closed", "cancelled"].includes(order.status),
    ).length,
    exceptionAssets: {
      dispatched: assets.filter((asset) => asset.status === "dispatched").slice(0, 6),
      inspection: assets.filter((asset) => asset.status === "inspection_hold").slice(0, 6),
      maintenance: assets.filter((asset) => asset.status === "in_maintenance").slice(0, 6),
      staleTelematics: assets.filter((asset) => asset.telematicsStale).slice(0, 6),
    },
  };
}
