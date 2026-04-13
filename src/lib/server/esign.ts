import * as service from "@/lib/server/esign-service";

async function callService<T>(value: T | Promise<T>) {
  return Promise.resolve(value);
}

export async function listDocuments(contractNumber?: string) {
  return callService(service.listDocuments(contractNumber));
}

export async function createDocument(...args: Parameters<typeof service.createDocument>) {
  return callService(service.createDocument(...args));
}

export async function markDocumentArchived(...args: Parameters<typeof service.markDocumentArchived>) {
  return callService(service.markDocumentArchived(...args));
}

export async function listSignatureRequests(contractNumber?: string) {
  return callService(service.listSignatureRequests(contractNumber));
}

export async function getSignatureRequest(...args: Parameters<typeof service.getSignatureRequest>) {
  return callService(service.getSignatureRequest(...args));
}

export async function getDocumentDownload(...args: Parameters<typeof service.getDocumentDownload>) {
  return callService(service.getDocumentDownload(...args));
}

export async function createSignatureRequestForContract(...args: Parameters<typeof service.createSignatureRequestForContract>) {
  return callService(service.createSignatureRequestForContract(...args));
}

export async function sendSignatureReminder(...args: Parameters<typeof service.sendSignatureReminder>) {
  return callService(service.sendSignatureReminder(...args));
}

export async function cancelSignatureRequest(...args: Parameters<typeof service.cancelSignatureRequest>) {
  return callService(service.cancelSignatureRequest(...args));
}

export async function getSigningSession(...args: Parameters<typeof service.getSigningSession>) {
  return callService(service.getSigningSession(...args));
}

export async function signSignatureRequest(...args: Parameters<typeof service.signSignatureRequest>) {
  return callService(service.signSignatureRequest(...args));
}

export async function adminCompleteSignatureRequest(...args: Parameters<typeof service.adminCompleteSignatureRequest>) {
  return callService(service.adminCompleteSignatureRequest(...args));
}

export const getRequestMetadata = service.getRequestMetadata;
