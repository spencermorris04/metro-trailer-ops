import * as operations from "@/lib/server/platform-operations.production";
import { ensureWorkflowEnabled } from "@/lib/server/feature-flags";

export async function listCollectionCases(
  filters?: Parameters<typeof operations.listCollectionCases>[0],
) {
  ensureWorkflowEnabled("collections");
  return operations.listCollectionCases(filters);
}

export async function sendCollectionsReminder(
  collectionCaseId: string,
  userId?: string,
) {
  ensureWorkflowEnabled("collections");
  return operations.sendCollectionsReminder(collectionCaseId, userId);
}

export async function updateCollectionCase(
  collectionCaseId: string,
  payload: Parameters<typeof operations.updateCollectionCase>[1],
  userId?: string,
) {
  ensureWorkflowEnabled("collections");
  return operations.updateCollectionCase(collectionCaseId, payload, userId);
}

export async function evaluateCollectionsWorklist(
  collectionCaseId?: string,
  userId?: string,
) {
  ensureWorkflowEnabled("collections");
  return operations.evaluateCollectionsWorklist(collectionCaseId, userId);
}
