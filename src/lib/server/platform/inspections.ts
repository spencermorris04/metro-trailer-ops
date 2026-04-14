import * as operations from "@/lib/server/platform-operations.production";
import { ensureWorkflowEnabled } from "@/lib/server/feature-flags";

export async function listInspections(
  filters?: Parameters<typeof operations.listInspections>[0],
) {
  ensureWorkflowEnabled("inspections");
  return operations.listInspections(filters);
}

export async function createInspection(
  payload: Parameters<typeof operations.createInspection>[0],
  userId?: string,
) {
  ensureWorkflowEnabled("inspections");
  return operations.createInspection(payload, userId);
}

export async function completeInspection(
  inspectionId: string,
  payload: Parameters<typeof operations.completeInspection>[1],
  userId?: string,
) {
  ensureWorkflowEnabled("inspections");
  return operations.completeInspection(inspectionId, payload, userId);
}
