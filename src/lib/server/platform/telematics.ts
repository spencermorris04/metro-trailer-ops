import * as operations from "@/lib/server/platform-operations.production";
import { ensureWorkflowEnabled } from "@/lib/server/feature-flags";

export async function listTelematics(assetNumber?: string) {
  ensureWorkflowEnabled("telematics");
  return operations.listTelematics(assetNumber);
}

export async function syncTelematics(assetNumber: string, userId?: string) {
  ensureWorkflowEnabled("telematics");
  return operations.syncTelematics(assetNumber, userId);
}

export async function scheduleSkybitzPulls(options?: {
  branchId?: string;
  userId?: string;
}) {
  ensureWorkflowEnabled("telematics");
  return operations.scheduleSkybitzPulls(options);
}

export async function getCollectionsRecoverySnapshot(assetNumber: string) {
  ensureWorkflowEnabled("collections");
  ensureWorkflowEnabled("telematics");
  return operations.getCollectionsRecoverySnapshot(assetNumber);
}
