import { desc, eq } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import type { AuditEventRecord, FleetUtilizationRecord, RevenueSeriesPoint } from "@/lib/platform-types";
import { getObservabilityConfig } from "@/lib/server/observability";
import { numericToNumber, toIso } from "@/lib/server/production-utils";
import { getWorkflowFlags } from "@/lib/server/feature-flags";

type AgingBucket = {
  label: string;
  invoiceCount: number;
  balanceAmount: number;
};

type MaintenanceSummary = {
  openWorkOrders: number;
  assignedWorkOrders: number;
  vendorAssigned: number;
  verificationQueue: number;
  estimatedCost: number;
  actualCost: number;
  averageBacklogAgeDays: number;
  averageRepairDurationHours: number;
  billableRecoveryTotal: number;
  repeatFailureAssets: number;
  byStatus: Array<{
    status: string;
    count: number;
  }>;
};

type InspectionDamageSummary = {
  requested: number;
  inProgress: number;
  passed: number;
  failed: number;
  needsReview: number;
  damagedAssets: number;
  averageDamageScore: number;
  photoCount: number;
};

type AuditHealthSummary = {
  totalEventsLast7Days: number;
  actorCoverageRate: number;
  pendingOutboxJobs: number;
  deadLetterJobs: number;
  failedWebhookReceipts: number;
  integrationFailures: number;
};

type DailyRevenueRollup = {
  date: string;
  amount: number;
};

function buildAgingBucketLabel(days: number) {
  if (days <= 0) {
    return "Current";
  }
  if (days <= 30) {
    return "1-30 days";
  }
  if (days <= 60) {
    return "31-60 days";
  }
  if (days <= 90) {
    return "61-90 days";
  }
  return "90+ days";
}

function startOfDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function differenceInDays(from: Date, to: Date) {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((startOfDay(to).getTime() - startOfDay(from).getTime()) / msPerDay);
}

function toDayKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

export async function buildOperationalReports() {
  const [
    branchRows,
    assetRows,
    invoiceRows,
    eventRows,
    workOrderRows,
    inspectionRows,
    auditRows,
    outboxRows,
    webhookRows,
    syncRows,
  ] = await Promise.all([
    db.select().from(schema.branches),
    db.select().from(schema.assets),
    db.select().from(schema.invoices),
    db.select().from(schema.financialEvents).orderBy(desc(schema.financialEvents.eventDate)),
    db.select().from(schema.workOrders),
    db.select().from(schema.inspections),
    db.select().from(schema.auditEvents).orderBy(desc(schema.auditEvents.createdAt)).limit(20),
    db.select().from(schema.outboxJobs),
    db.select().from(schema.webhookReceipts),
    db.select().from(schema.integrationSyncJobs),
  ]);

  const utilization: FleetUtilizationRecord[] = branchRows.map((branch) => {
    const branchAssets = assetRows.filter((asset) => asset.branchId === branch.id);
    const onRentCount = branchAssets.filter((asset) => asset.status === "on_rent").length;
    const fleetCount = branchAssets.length;
    return {
      branch: branch.name,
      fleetCount,
      onRentCount,
      utilizationRate:
        fleetCount === 0 ? 0 : Number(((onRentCount / fleetCount) * 100).toFixed(1)),
    };
  });

  const revenueTotals = eventRows.reduce<Record<string, number>>((acc, event) => {
    if (event.status === "voided") {
      return acc;
    }
    acc[event.eventType] = (acc[event.eventType] ?? 0) + numericToNumber(event.amount);
    return acc;
  }, {});
  const revenueSeries: RevenueSeriesPoint[] = Object.entries(revenueTotals)
    .map(([label, revenue]) => ({ label, revenue }))
    .sort((left, right) => right.revenue - left.revenue);

  const overdueAgingMap = new Map<string, AgingBucket>();
  const now = new Date();
  const overdueInvoices = invoiceRows.filter(
    (invoice) => numericToNumber(invoice.balanceAmount) > 0,
  );

  for (const invoice of overdueInvoices) {
    const daysPastDue = differenceInDays(invoice.dueDate, now);
    const label = buildAgingBucketLabel(daysPastDue);
    const current = overdueAgingMap.get(label) ?? {
      label,
      invoiceCount: 0,
      balanceAmount: 0,
    };
    current.invoiceCount += 1;
    current.balanceAmount += numericToNumber(invoice.balanceAmount);
    overdueAgingMap.set(label, current);
  }

  const overdueAging = ["Current", "1-30 days", "31-60 days", "61-90 days", "90+ days"]
    .map((label) => overdueAgingMap.get(label) ?? {
      label,
      invoiceCount: 0,
      balanceAmount: 0,
    });

  const maintenanceStatusCounts = new Map<string, number>();
  let estimatedCost = 0;
  let actualCost = 0;
  let assignedWorkOrders = 0;
  let vendorAssigned = 0;
  let openWorkOrders = 0;
  let verificationQueue = 0;
  let backlogAgeDaysTotal = 0;
  let completedRepairHoursTotal = 0;
  let completedRepairCount = 0;
  const workOrdersByAsset = new Map<string, number>();

  for (const workOrder of workOrderRows) {
    maintenanceStatusCounts.set(
      workOrder.status,
      (maintenanceStatusCounts.get(workOrder.status) ?? 0) + 1,
    );
    estimatedCost += numericToNumber(workOrder.estimatedCost);
    actualCost += numericToNumber(workOrder.actualCost);
    if (workOrder.assignedToUserId) {
      assignedWorkOrders += 1;
    }
    if (workOrder.vendorName) {
      vendorAssigned += 1;
    }
    workOrdersByAsset.set(
      workOrder.assetId,
      (workOrdersByAsset.get(workOrder.assetId) ?? 0) + 1,
    );
    if (!["verified", "closed", "cancelled"].includes(workOrder.status)) {
      openWorkOrders += 1;
      backlogAgeDaysTotal += Math.max(0, differenceInDays(workOrder.openedAt, now));
    }
    if (workOrder.status === "repair_completed") {
      verificationQueue += 1;
    }
    if (workOrder.verifiedAt) {
      completedRepairHoursTotal += Math.max(
        0,
        (workOrder.verifiedAt.getTime() - workOrder.openedAt.getTime()) / 3_600_000,
      );
      completedRepairCount += 1;
    }
  }

  const billableRecoveryTotal = eventRows
    .filter(
      (event) =>
        event.eventType === "damage" &&
        event.workOrderId &&
        event.status !== "voided",
    )
    .reduce((sum, event) => sum + numericToNumber(event.amount), 0);

  const repeatFailureAssets = [...workOrdersByAsset.values()].filter((count) => count > 1).length;

  const maintenanceSummary: MaintenanceSummary = {
    openWorkOrders,
    assignedWorkOrders,
    vendorAssigned,
    verificationQueue,
    estimatedCost,
    actualCost,
    averageBacklogAgeDays:
      openWorkOrders === 0 ? 0 : Number((backlogAgeDaysTotal / openWorkOrders).toFixed(1)),
    averageRepairDurationHours:
      completedRepairCount === 0
        ? 0
        : Number((completedRepairHoursTotal / completedRepairCount).toFixed(1)),
    billableRecoveryTotal: Number(billableRecoveryTotal.toFixed(2)),
    repeatFailureAssets,
    byStatus: [...maintenanceStatusCounts.entries()].map(([status, count]) => ({
      status,
      count,
    })),
  };

  const inspectionDamageSummary: InspectionDamageSummary = {
    requested: inspectionRows.filter((row) => row.status === "requested").length,
    inProgress: inspectionRows.filter((row) => row.status === "in_progress").length,
    passed: inspectionRows.filter((row) => row.status === "passed").length,
    failed: inspectionRows.filter((row) => row.status === "failed").length,
    needsReview: inspectionRows.filter((row) => row.status === "needs_review").length,
    damagedAssets: inspectionRows.filter((row) => (row.damageScore ?? 0) > 0).length,
    averageDamageScore: 0,
    photoCount: inspectionRows.reduce(
      (count, row) => count + ((row.photos as string[] | null)?.length ?? 0),
      0,
    ),
  };

  const scoredInspections = inspectionRows.filter(
    (row): row is typeof row & { damageScore: number } => typeof row.damageScore === "number",
  );
  inspectionDamageSummary.averageDamageScore =
    scoredInspections.length === 0
      ? 0
      : Number(
          (
            scoredInspections.reduce((sum, row) => sum + row.damageScore, 0) /
            scoredInspections.length
          ).toFixed(2),
        );

  const auditTrail: AuditEventRecord[] = auditRows.map((row) => ({
    id: row.id,
    entityType: row.entityType,
    entityId: row.entityId,
    eventType: row.eventType,
    userName: row.userId ?? "system",
    timestamp: toIso(row.createdAt) ?? new Date(0).toISOString(),
    metadata: (row.metadata ?? {}) as Record<string, string | number | boolean | null>,
  }));

  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const auditEventsLast7Days = auditRows.filter((row) => row.createdAt >= sevenDaysAgo);
  const actorCoverageRate =
    auditEventsLast7Days.length === 0
      ? 100
      : Number(
          (
            (auditEventsLast7Days.filter((row) => Boolean(row.userId)).length /
              auditEventsLast7Days.length) *
            100
          ).toFixed(1),
        );

  const auditHealth: AuditHealthSummary = {
    totalEventsLast7Days: auditEventsLast7Days.length,
    actorCoverageRate,
    pendingOutboxJobs: outboxRows.filter((row) => row.status === "pending").length,
    deadLetterJobs: outboxRows.filter((row) => row.status === "dead_letter").length,
    failedWebhookReceipts: webhookRows.filter((row) => row.status === "failed").length,
    integrationFailures: syncRows.filter((row) => row.status === "failed").length,
  };

  const rollupMap = new Map<string, number>();
  for (const event of eventRows) {
    if (event.status === "voided") {
      continue;
    }
    const key = toDayKey(event.eventDate);
    rollupMap.set(key, (rollupMap.get(key) ?? 0) + numericToNumber(event.amount));
  }
  const revenueRollups: DailyRevenueRollup[] = [...rollupMap.entries()]
    .map(([date, amount]) => ({ date, amount }))
    .sort((left, right) => left.date.localeCompare(right.date))
    .slice(-14);

  return {
    generatedAt: now.toISOString(),
    utilization,
    revenueSeries,
    overdueAging,
    overdueInvoices: overdueInvoices.map((invoice) => ({
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      dueDate: toIso(invoice.dueDate) ?? new Date(0).toISOString(),
      balanceAmount: numericToNumber(invoice.balanceAmount),
      totalAmount: numericToNumber(invoice.totalAmount),
    })),
    maintenanceSummary,
    inspectionDamageSummary,
    revenueRollups,
    auditTrail,
    auditHealth,
    featureFlags: getWorkflowFlags(),
    observability: getObservabilityConfig(),
  };
}

export async function buildReadinessSnapshot() {
  const [branchRow, pendingJobs, failedWebhooks] = await Promise.all([
    db.select({ id: schema.branches.id }).from(schema.branches).limit(1),
    db
      .select({ id: schema.outboxJobs.id })
      .from(schema.outboxJobs)
      .where(eq(schema.outboxJobs.status, "pending")),
    db
      .select({ id: schema.webhookReceipts.id })
      .from(schema.webhookReceipts)
      .where(eq(schema.webhookReceipts.status, "failed")),
  ]);

  return {
    status: branchRow.length > 0 ? "ready" : "degraded",
    checks: {
      database: branchRow.length > 0 ? "ok" : "missing_seed_or_schema",
      pendingOutboxJobs: pendingJobs.length,
      failedWebhookReceipts: failedWebhooks.length,
    },
    featureFlags: getWorkflowFlags(),
    observability: getObservabilityConfig(),
    checkedAt: new Date().toISOString(),
  };
}
