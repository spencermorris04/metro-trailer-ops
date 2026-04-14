import * as production from "@/lib/server/esign-service.production";
import { ensureWorkflowEnabled } from "@/lib/server/feature-flags";

export async function listDocuments(contractNumber?: string, workOrderId?: string) {
  ensureWorkflowEnabled("documents");
  return production.listDocuments(contractNumber, workOrderId);
}

export async function createDocument(
  payload: Parameters<typeof production.createDocument>[0],
  userId?: string,
) {
  ensureWorkflowEnabled("documents");
  return production.createDocument(payload, userId);
}

export async function markDocumentArchived(documentId: string, userId?: string) {
  ensureWorkflowEnabled("documents");
  return production.markDocumentArchived(documentId, userId);
}

export const getDocumentDownload = production.getDocumentDownload;
