export * from "@/lib/server/platform/assets";
export * from "@/lib/server/platform/collections";
export * from "@/lib/server/platform/contracts";
export * from "@/lib/server/platform/customers";
export * from "@/lib/server/platform/dashboard";
export * from "@/lib/server/platform/dispatch";
export * from "@/lib/server/platform/financials";
export * from "@/lib/server/platform/inspections";
export * from "@/lib/server/platform/integrations";
export * from "@/lib/server/platform/payments";
export * from "@/lib/server/platform/portal";
export * from "@/lib/server/platform/reports";
export * from "@/lib/server/platform/telematics";
export * from "@/lib/server/platform/work-orders";

export {
  createDocument,
  listDocuments,
  markDocumentArchived,
} from "@/lib/server/esign/documents";
export {
  adminCompleteSignatureRequest as completeSignatureRequest,
  createSignatureRequestForContract,
  listSignatureRequests,
} from "@/lib/server/esign/signatures";
