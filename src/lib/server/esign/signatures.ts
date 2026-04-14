import * as production from "@/lib/server/esign-service.production";
import { ensureWorkflowEnabled } from "@/lib/server/feature-flags";

export async function listSignatureRequests(contractNumber?: string) {
  ensureWorkflowEnabled("signatures");
  return production.listSignatureRequests(contractNumber);
}

export const getSignatureRequest = production.getSignatureRequest;

export async function createSignatureRequestForContract(
  payload: Parameters<typeof production.createSignatureRequestForContract>[0],
  userId?: string,
) {
  ensureWorkflowEnabled("signatures");
  return production.createSignatureRequestForContract(payload, userId);
}

export async function sendSignatureReminder(
  signatureRequestId: string,
  signerId?: string,
  userId?: string,
) {
  ensureWorkflowEnabled("signatures");
  return production.sendSignatureReminder(signatureRequestId, signerId, userId);
}

export async function cancelSignatureRequest(
  signatureRequestId: string,
  reason: string,
  userId?: string,
) {
  ensureWorkflowEnabled("signatures");
  return production.cancelSignatureRequest(signatureRequestId, reason, userId);
}

export async function getSigningSession(
  signatureRequestId: string,
  signerId: string,
  token: string,
) {
  ensureWorkflowEnabled("signatures");
  return production.getSigningSession(signatureRequestId, signerId, token);
}

export async function signSignatureRequest(
  signatureRequestId: string,
  payload: Parameters<typeof production.signSignatureRequest>[1],
  metadata: Parameters<typeof production.signSignatureRequest>[2],
) {
  ensureWorkflowEnabled("signatures");
  return production.signSignatureRequest(signatureRequestId, payload, metadata);
}

export async function requestSignatureOtp(
  signatureRequestId: string,
  signerId: string,
  token: string,
) {
  ensureWorkflowEnabled("signatures");
  return production.requestSignatureOtp(signatureRequestId, signerId, token);
}

export async function adminCompleteSignatureRequest(
  signatureRequestId: string,
  userId?: string,
) {
  ensureWorkflowEnabled("signatures");
  return production.adminCompleteSignatureRequest(signatureRequestId, userId);
}

export const getRequestMetadata = production.getRequestMetadata;
