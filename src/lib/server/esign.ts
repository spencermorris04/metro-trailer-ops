import * as demo from "@/lib/server/esign-service";
import * as production from "@/lib/server/esign-service.production";
import { isProductionRuntime } from "@/lib/server/runtime";

async function callService<T>(value: T | Promise<T>) {
  return Promise.resolve(value);
}

export async function listDocuments(contractNumber?: string, workOrderId?: string) {
  return isProductionRuntime()
    ? production.listDocuments(contractNumber, workOrderId)
    : callService(demo.listDocuments(contractNumber));
}

export async function createDocument(
  payload: {
    contractNumber?: string;
    workOrderId?: string;
    customerName?: string;
    documentType: string;
    filename: string;
    contentType?: string;
    contentBase64?: string;
    metadata?: Record<string, unknown>;
  },
  userId?: string,
) {
  return isProductionRuntime()
    ? production.createDocument(payload, userId)
    : callService(
        demo.createDocument(
          {
            contractNumber: payload.contractNumber ?? payload.workOrderId ?? "DEMO",
            customerName: payload.customerName ?? "Demo customer",
            documentType: payload.documentType,
            filename: payload.filename,
          },
          userId,
        ),
      );
}

export async function markDocumentArchived(...args: Parameters<typeof demo.markDocumentArchived>) {
  return isProductionRuntime()
    ? production.markDocumentArchived(args[0], args[1])
    : callService(demo.markDocumentArchived(...args));
}

export async function listSignatureRequests(contractNumber?: string) {
  return isProductionRuntime()
    ? production.listSignatureRequests(contractNumber)
    : callService(demo.listSignatureRequests(contractNumber));
}

export async function getSignatureRequest(...args: Parameters<typeof demo.getSignatureRequest>) {
  return isProductionRuntime()
    ? production.getSignatureRequest(args[0])
    : callService(demo.getSignatureRequest(...args));
}

export async function getDocumentDownload(...args: Parameters<typeof demo.getDocumentDownload>) {
  return isProductionRuntime()
    ? production.getDocumentDownload(args[0])
    : callService(demo.getDocumentDownload(...args));
}

export async function createSignatureRequestForContract(
  ...args: Parameters<typeof demo.createSignatureRequestForContract>
) {
  return isProductionRuntime()
    ? production.createSignatureRequestForContract(args[0], args[1])
    : callService(demo.createSignatureRequestForContract(...args));
}

export async function sendSignatureReminder(...args: Parameters<typeof demo.sendSignatureReminder>) {
  return isProductionRuntime()
    ? production.sendSignatureReminder(args[0], args[1], args[2])
    : callService(demo.sendSignatureReminder(...args));
}

export async function cancelSignatureRequest(...args: Parameters<typeof demo.cancelSignatureRequest>) {
  return isProductionRuntime()
    ? production.cancelSignatureRequest(args[0], args[1], args[2])
    : callService(demo.cancelSignatureRequest(...args));
}

export async function getSigningSession(...args: Parameters<typeof demo.getSigningSession>) {
  return isProductionRuntime()
    ? production.getSigningSession(args[0], args[1], args[2])
    : callService(demo.getSigningSession(...args));
}

export async function signSignatureRequest(...args: Parameters<typeof demo.signSignatureRequest>) {
  return isProductionRuntime()
    ? production.signSignatureRequest(
        args[0],
        args[1] as Parameters<typeof production.signSignatureRequest>[1],
        args[2],
      )
    : callService(demo.signSignatureRequest(...args));
}

export async function requestSignatureOtp(...args: Parameters<typeof demo.requestSignatureOtp>) {
  return isProductionRuntime()
    ? production.requestSignatureOtp(args[0], args[1], args[2])
    : callService(demo.requestSignatureOtp(...args));
}

export async function adminCompleteSignatureRequest(
  ...args: Parameters<typeof demo.adminCompleteSignatureRequest>
) {
  return isProductionRuntime()
    ? production.adminCompleteSignatureRequest(args[0], args[1])
    : callService(demo.adminCompleteSignatureRequest(...args));
}

export const getRequestMetadata = demo.getRequestMetadata;
