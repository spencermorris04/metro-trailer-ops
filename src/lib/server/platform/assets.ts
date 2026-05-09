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

import { inArray, sql } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import { listAssetsPage } from "@/lib/server/platform-service.production";

const branchBlockedStatuses = ["reserved", "dispatched", "inspection_hold", "in_maintenance"];
const dispatchQueueStatuses = ["unassigned", "assigned", "in_progress"] as const;
const inspectionQueueStatuses = ["requested", "in_progress", "needs_review"] as const;
const maintenanceQueueStatuses = [
  "open",
  "assigned",
  "in_progress",
  "awaiting_parts",
  "awaiting_vendor",
  "repair_completed",
] as const;

export async function getInventoryOverview() {
  const [
    statusRows,
    branchRows,
    fleetMixRows,
    ownershipRows,
    turningSoonRows,
    dispatchOpenRows,
    dispatchQueueRows,
    inspectionOpenRows,
    maintenanceOpenRows,
    dispatchLane,
    inspectionLane,
    maintenanceLane,
  ] = await Promise.all([
    db
      .select({
        status: schema.assets.status,
        count: sql<number>`count(*)`,
      })
      .from(schema.assets)
      .groupBy(schema.assets.status),
    db
      .select({
        branch: schema.branches.name,
        total: sql<number>`count(*)`,
        active: sql<number>`count(*) filter (where ${schema.assets.status} <> 'retired')`,
        available: sql<number>`count(*) filter (where ${schema.assets.status} = 'available')`,
        reserved: sql<number>`count(*) filter (where ${schema.assets.status} = 'reserved')`,
        dispatched: sql<number>`count(*) filter (where ${schema.assets.status} = 'dispatched')`,
        onRent: sql<number>`count(*) filter (where ${schema.assets.status} = 'on_rent')`,
        maintenance: sql<number>`count(*) filter (where ${schema.assets.status} = 'in_maintenance')`,
        inspection: sql<number>`count(*) filter (where ${schema.assets.status} = 'inspection_hold')`,
        retired: sql<number>`count(*) filter (where ${schema.assets.status} = 'retired')`,
        blocked: sql<number>`count(*) filter (where ${schema.assets.status} in ('reserved', 'dispatched', 'inspection_hold', 'in_maintenance'))`,
        telematicsBlind: sql<number>`count(*) filter (where ${schema.assets.gpsDeviceId} is null and ${schema.assets.skybitzAssetId} is null)`,
        turningSoon: sql<number>`count(*) filter (
          where exists (
            select 1
            from asset_allocations aa
            where aa.asset_id = ${schema.assets.id}
              and aa.active = true
              and aa.allocation_type = 'reservation'
              and aa.starts_at >= now()
              and aa.starts_at < now() + interval '7 days'
          )
        )`,
      })
      .from(schema.assets)
      .innerJoin(schema.branches, sql`${schema.branches.id} = ${schema.assets.branchId}`)
      .groupBy(schema.branches.name),
    db
      .select({
        type: schema.assets.type,
        count: sql<number>`count(*)`,
      })
      .from(schema.assets)
      .groupBy(schema.assets.type),
    db
      .select({
        contractOwned: sql<number>`count(distinct ${schema.assetAllocations.assetId}) filter (where ${schema.assetAllocations.contractId} is not null)`,
        dispatchOwned: sql<number>`count(distinct ${schema.assetAllocations.assetId}) filter (where ${schema.assetAllocations.dispatchTaskId} is not null)`,
        maintenanceOwned: sql<number>`count(distinct ${schema.assetAllocations.assetId}) filter (where ${schema.assetAllocations.workOrderId} is not null)`,
      })
      .from(schema.assetAllocations)
      .where(sql`${schema.assetAllocations.active} = true`),
    db
      .select({
        total: sql<number>`count(distinct ${schema.assetAllocations.assetId})`,
      })
      .from(schema.assetAllocations)
      .where(sql`
        ${schema.assetAllocations.active} = true
        and ${schema.assetAllocations.allocationType} = 'reservation'
        and ${schema.assetAllocations.startsAt} >= now()
        and ${schema.assetAllocations.startsAt} < now() + interval '7 days'
      `),
    db
      .select({ total: sql<number>`count(*)` })
      .from(schema.dispatchTasks)
      .where(inArray(schema.dispatchTasks.status, dispatchQueueStatuses)),
    db
      .select({ total: sql<number>`count(*)` })
      .from(schema.dispatchTasks)
      .where(sql`${schema.dispatchTasks.status} <> 'completed'`),
    db
      .select({ total: sql<number>`count(*)` })
      .from(schema.inspections)
      .where(inArray(schema.inspections.status, inspectionQueueStatuses)),
    db
      .select({ total: sql<number>`count(*)` })
      .from(schema.workOrders)
      .where(inArray(schema.workOrders.status, maintenanceQueueStatuses)),
    listAssetsPage({ status: "reserved", page: 1, pageSize: 8 }),
    listAssetsPage({ status: "inspection_hold", page: 1, pageSize: 8 }),
    listAssetsPage({ status: "in_maintenance", page: 1, pageSize: 8 }),
  ]);

  const countsByStatus = statusRows.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = Number(row.count);
    return acc;
  }, {});

  const totalAssets = Object.values(countsByStatus).reduce((sum, value) => sum + value, 0);
  const retiredCount = countsByStatus.retired ?? 0;
  const activeAssetsCount = totalAssets - retiredCount;
  const rentReadyCount = countsByStatus.available ?? 0;
  const branchBlockedCount = branchBlockedStatuses.reduce(
    (sum, status) => sum + (countsByStatus[status] ?? 0),
    0,
  );
  const onRentCount = countsByStatus.on_rent ?? 0;
  const telematicsBlindCount = branchRows.reduce(
    (sum, branch) => sum + Number(branch.telematicsBlind),
    0,
  );
  const turningSoonCount = Number(turningSoonRows[0]?.total ?? 0);

  const branchSnapshots = branchRows.map((branch) => {
    const active = Number(branch.active);
    const available = Number(branch.available);
    const blocked = Number(branch.blocked);
    return {
      branch: branch.branch,
      total: Number(branch.total),
      active,
      available,
      reserved: Number(branch.reserved),
      dispatched: Number(branch.dispatched),
      onRent: Number(branch.onRent),
      maintenance: Number(branch.maintenance),
      inspection: Number(branch.inspection),
      retired: Number(branch.retired),
      blocked,
      telematicsBlind: Number(branch.telematicsBlind),
      turningSoon: Number(branch.turningSoon),
      readyRate: active > 0 ? available / active : 0,
      blockedRate: active > 0 ? blocked / active : 0,
    };
  });

  const branchPressure = [...branchSnapshots].sort((a, b) => {
    if (b.blocked !== a.blocked) {
      return b.blocked - a.blocked;
    }
    if (b.telematicsBlind !== a.telematicsBlind) {
      return b.telematicsBlind - a.telematicsBlind;
    }
    return a.readyRate - b.readyRate;
  });

  const fleetMix = fleetMixRows
    .map((row) => ({ type: row.type, count: Number(row.count) }))
    .sort((a, b) => b.count - a.count);

  const ownershipCounts = ownershipRows[0] ?? {
    contractOwned: 0,
    dispatchOwned: 0,
    maintenanceOwned: 0,
  };
  const ownership = {
    contractOwned: Number(ownershipCounts.contractOwned ?? 0),
    dispatchOwned: Number(ownershipCounts.dispatchOwned ?? 0),
    maintenanceOwned: Number(ownershipCounts.maintenanceOwned ?? 0),
    inspectionOwned: countsByStatus.inspection_hold ?? 0,
  };

  const actionLanes = [
    {
      key: "dispatch",
      title: "Dispatch friction",
      href: "/dispatch",
      count: (countsByStatus.dispatched ?? 0) + (countsByStatus.reserved ?? 0),
      assets: dispatchLane.data,
    },
    {
      key: "inspection",
      title: "Inspection release",
      href: "/inspections",
      count: countsByStatus.inspection_hold ?? 0,
      assets: inspectionLane.data,
    },
    {
      key: "maintenance",
      title: "Maintenance blockers",
      href: "/maintenance",
      count: countsByStatus.in_maintenance ?? 0,
      assets: maintenanceLane.data,
    },
    {
      key: "telematics",
      title: "Telematics blind spots",
      href: "/telematics",
      count: telematicsBlindCount,
      assets: [],
    },
    {
      key: "turns",
      title: "Upcoming turns",
      href: "/leases",
      count: turningSoonCount,
      assets: [],
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
      dispatchOpen: Number(dispatchOpenRows[0]?.total ?? 0),
      inspectionOpen: Number(inspectionOpenRows[0]?.total ?? 0),
      maintenanceOpen: Number(maintenanceOpenRows[0]?.total ?? 0),
      telematicsBlind: telematicsBlindCount,
    },
    blockedAssetsCount: totalAssets - rentReadyCount,
    dispatchQueueCount: Number(dispatchQueueRows[0]?.total ?? 0),
    inspectionQueueCount: Number(inspectionOpenRows[0]?.total ?? 0),
    maintenanceQueueCount: Number(maintenanceOpenRows[0]?.total ?? 0),
    actionLanes,
  };
}
