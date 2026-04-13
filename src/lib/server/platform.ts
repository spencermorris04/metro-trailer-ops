import * as demo from "@/lib/server/platform-service";
import * as esign from "@/lib/server/esign";
import * as production from "@/lib/server/platform-service.production";
import * as operations from "@/lib/server/platform-operations.production";
import { ApiError } from "@/lib/server/api";
import { ensureWorkflowEnabled } from "@/lib/server/feature-flags";
import { buildOperationalReports } from "@/lib/server/reporting";
import { isProductionRuntime } from "@/lib/server/runtime";

async function callDemo<T>(value: T | Promise<T>) {
  return Promise.resolve(value);
}

export async function getDashboardSummary() {
  return isProductionRuntime()
    ? production.getDashboardSummary()
    : callDemo(demo.getDashboardSummary());
}

export async function listBranches() {
  return isProductionRuntime()
    ? production.listBranches()
    : callDemo(demo.listBranches());
}

export async function listUsers() {
  return isProductionRuntime() ? production.listUsers() : callDemo(demo.listUsers());
}

export async function listAssets(filters?: Parameters<typeof demo.listAssets>[0]) {
  return isProductionRuntime()
    ? production.listAssets(filters)
    : callDemo(demo.listAssets(filters));
}

export async function createAsset(...args: Parameters<typeof demo.createAsset>) {
  return isProductionRuntime()
    ? production.createAsset(args[0], args[1])
    : callDemo(demo.createAsset(...args));
}

export async function updateAsset(...args: Parameters<typeof demo.updateAsset>) {
  return isProductionRuntime()
    ? production.updateAsset(args[0], args[1], args[2])
    : callDemo(demo.updateAsset(...args));
}

export async function deleteAsset(...args: Parameters<typeof demo.deleteAsset>) {
  return isProductionRuntime()
    ? production.deleteAsset(args[0], args[1])
    : callDemo(demo.deleteAsset(...args));
}

export async function transitionAsset(
  assetId: string,
  toStatus: Parameters<typeof demo.transitionAsset>[1],
  userId?: string,
  reason?: string,
  options?: production.AssetTransitionOptions,
) {
  return isProductionRuntime()
    ? production.transitionAsset(assetId, toStatus, userId, reason, options)
    : callDemo(demo.transitionAsset(assetId, toStatus, userId, reason));
}

export async function listCustomers(filters?: Parameters<typeof demo.listCustomers>[0]) {
  return isProductionRuntime()
    ? production.listCustomers(filters)
    : callDemo(demo.listCustomers(filters));
}

export async function createCustomer(...args: Parameters<typeof demo.createCustomer>) {
  return isProductionRuntime()
    ? production.createCustomer(args[0], args[1])
    : callDemo(demo.createCustomer(...args));
}

export async function updateCustomer(...args: Parameters<typeof demo.updateCustomer>) {
  return isProductionRuntime()
    ? production.updateCustomer(args[0], args[1], args[2])
    : callDemo(demo.updateCustomer(...args));
}

export async function deleteCustomer(...args: Parameters<typeof demo.deleteCustomer>) {
  return isProductionRuntime()
    ? production.deleteCustomer(args[0], args[1])
    : callDemo(demo.deleteCustomer(...args));
}

export async function listContracts(filters?: Parameters<typeof demo.listContracts>[0]) {
  return isProductionRuntime()
    ? production.listContracts(filters)
    : callDemo(demo.listContracts(filters));
}

export async function createContract(
  payload: production.CreateContractInput,
  userId?: string,
) {
  return isProductionRuntime()
    ? production.createContract(payload, userId)
    : callDemo(demo.createContract(payload as never, userId));
}

export async function transitionContract(
  contractId: string,
  toStatus: Parameters<typeof demo.transitionContract>[1],
  userId?: string,
  reason?: string,
  options?: production.ContractTransitionOptions,
) {
  return isProductionRuntime()
    ? production.transitionContract(contractId, toStatus, userId, reason, options)
    : callDemo(demo.transitionContract(contractId, toStatus, userId, reason));
}

export async function amendContract(
  contractId: string,
  payload: production.AmendContractInput,
  userId?: string,
) {
  return isProductionRuntime()
    ? production.amendContract(contractId, payload, userId)
    : callDemo(demo.amendContract(contractId, payload as never, userId));
}

export async function listFinancialEvents(filters?: Parameters<typeof demo.listFinancialEvents>[0]) {
  return isProductionRuntime()
    ? production.listFinancialEvents(filters)
    : callDemo(demo.listFinancialEvents(filters));
}

export async function createFinancialEvent(...args: Parameters<typeof demo.createFinancialEvent>) {
  return isProductionRuntime()
    ? production.createFinancialEvent(args[0], args[1])
    : callDemo(demo.createFinancialEvent(...args));
}

export async function listInvoices(filters?: {
  status?: string;
  customerNumber?: string;
  contractNumber?: string;
  customerName?: string;
  q?: string;
}) {
  return isProductionRuntime()
    ? production.listInvoices({
        status: filters?.status,
        customerNumber: filters?.customerNumber,
        contractNumber: filters?.contractNumber,
      })
    : callDemo(
        demo.listInvoices({
          status: filters?.status,
          customerName: filters?.customerName,
          q: filters?.q,
        }),
      );
}

export async function generateInvoiceForContract(...args: Parameters<typeof demo.generateInvoiceForContract>) {
  return isProductionRuntime()
    ? production.generateInvoiceForContract(args[0], args[1])
    : callDemo(demo.generateInvoiceForContract(...args));
}

export async function listDispatchTasks(filters?: Parameters<typeof demo.listDispatchTasks>[0]) {
  return isProductionRuntime()
    ? (ensureWorkflowEnabled("dispatch"), operations.listDispatchTasks(filters))
    : callDemo(demo.listDispatchTasks(filters));
}

export async function createDispatchTask(...args: Parameters<typeof demo.createDispatchTask>) {
  return isProductionRuntime()
    ? (ensureWorkflowEnabled("dispatch"), operations.createDispatchTask(args[0], args[1]))
    : callDemo(demo.createDispatchTask(...args));
}

export async function confirmDispatchTask(...args: Parameters<typeof demo.confirmDispatchTask>) {
  return isProductionRuntime()
    ? (ensureWorkflowEnabled("dispatch"), operations.confirmDispatchTask(args[0], args[1], args[2]))
    : callDemo(demo.confirmDispatchTask(...args));
}

export async function listInspections(filters?: Parameters<typeof demo.listInspections>[0]) {
  return isProductionRuntime()
    ? (ensureWorkflowEnabled("inspections"), operations.listInspections(filters))
    : callDemo(demo.listInspections(filters));
}

export async function createInspection(...args: Parameters<typeof demo.createInspection>) {
  return isProductionRuntime()
    ? (ensureWorkflowEnabled("inspections"), operations.createInspection(args[0], args[1]))
    : callDemo(demo.createInspection(...args));
}

export async function completeInspection(...args: Parameters<typeof demo.completeInspection>) {
  return isProductionRuntime()
    ? (ensureWorkflowEnabled("inspections"), operations.completeInspection(args[0], args[1], args[2]))
    : callDemo(demo.completeInspection(...args));
}

export async function listWorkOrders(filters?: Parameters<typeof demo.listWorkOrders>[0]) {
  return isProductionRuntime()
    ? (ensureWorkflowEnabled("maintenance"), operations.listWorkOrders(filters))
    : callDemo(demo.listWorkOrders(filters));
}

export async function createWorkOrder(...args: Parameters<typeof demo.createWorkOrder>) {
  return isProductionRuntime()
    ? (ensureWorkflowEnabled("maintenance"), operations.createWorkOrder(args[0], args[1]))
    : callDemo(demo.createWorkOrder(...args));
}

export async function completeWorkOrder(
  workOrderId: string,
  userId?: string,
  notesOrPayload?:
    | string
    | {
        notes?: string;
        actualCost?: number;
        laborHours?: number;
        technicianUserId?: string;
        vendorName?: string;
        laborEntries?: Array<{
          technicianUserId?: string;
          hours: number;
          hourlyRate?: number;
          notes?: string;
        }>;
        partEntries?: Array<{
          partNumber?: string;
          description: string;
          quantity: number;
          unitCost?: number;
        }>;
      },
) {
  return isProductionRuntime()
    ? (ensureWorkflowEnabled("maintenance"),
      operations.completeWorkOrder(workOrderId, userId, notesOrPayload))
    : callDemo(
        demo.completeWorkOrder(
          workOrderId,
          userId,
          typeof notesOrPayload === "string" ? notesOrPayload : notesOrPayload?.notes,
        ),
      );
}

export async function sendInvoice(...args: Parameters<typeof demo.sendInvoice>) {
  return isProductionRuntime()
    ? production.sendInvoice(args[0], args[1])
    : callDemo(demo.sendInvoice(...args));
}

export async function recordInvoicePayment(...args: Parameters<typeof demo.recordInvoicePayment>) {
  return isProductionRuntime()
    ? production.recordInvoicePayment(args[0], args[1], args[2])
    : callDemo(demo.recordInvoicePayment(...args));
}

export async function createPaymentIntentForInvoice(
  invoiceId: string,
  paymentMethodId?: string,
) {
  return isProductionRuntime()
    ? (ensureWorkflowEnabled("payments"), production.createPaymentIntentForInvoice({ invoiceId, paymentMethodId }))
    : callDemo(demo.createPaymentIntentForInvoice(invoiceId));
}

export async function addPaymentMethod(
  payload: {
    customerNumber: string;
    stripePaymentMethodId?: string;
    methodType?: "card" | "ach" | "wire" | "check";
    label?: string;
    last4?: string;
    isDefault?: boolean;
  },
  userId?: string,
) {
  return isProductionRuntime()
    ? (ensureWorkflowEnabled("payments"), production.addPaymentMethod(payload, userId))
    : callDemo(
        demo.addPaymentMethod(
          {
            customerNumber: payload.customerNumber,
            methodType: payload.methodType ?? "card",
            label: payload.label ?? "Payment method",
            last4: payload.last4 ?? "0000",
          },
          userId,
        ),
      );
}

export async function listPaymentMethods(customerNumber?: string) {
  return isProductionRuntime()
    ? (ensureWorkflowEnabled("payments"), production.listPaymentMethods(customerNumber))
    : callDemo(demo.listPaymentMethods(customerNumber));
}

export async function createPaymentSetupIntent(customerNumber: string) {
  if (isProductionRuntime()) {
    ensureWorkflowEnabled("payments");
    return production.createPaymentSetupIntent(customerNumber);
  }

  return {
    mode: "demo",
    provider: "Stripe",
    data: {
      setupIntentId: `seti_demo_${customerNumber}`,
      clientSecret: `seti_demo_${customerNumber}_secret`,
    },
  };
}

export async function setDefaultPaymentMethod(paymentMethodId: string, userId?: string) {
  if (isProductionRuntime()) {
    ensureWorkflowEnabled("payments");
    return production.setDefaultPaymentMethod(paymentMethodId, userId);
  }

  throw new ApiError(501, "Setting a default payment method is not implemented in demo mode.");
}

export async function listCustomerPaymentHistory(filters?: {
  customerNumber?: string;
  invoiceId?: string;
}) {
  if (isProductionRuntime()) {
    ensureWorkflowEnabled("payments");
    return production.listCustomerPaymentHistory(filters);
  }

  return [];
}

export async function processStripeWebhook(receiptId: string) {
  if (isProductionRuntime()) {
    ensureWorkflowEnabled("payments");
    return production.processStripeWebhook(receiptId);
  }

  return { processed: false, eventType: "demo" };
}

export async function refundCustomerPayment(
  transactionId: string,
  amount?: number,
  userId?: string,
) {
  if (isProductionRuntime()) {
    ensureWorkflowEnabled("payments");
    return production.refundCustomerPayment(transactionId, amount, userId);
  }

  throw new ApiError(501, "Refunds are not implemented in demo mode.");
}

export async function listCollectionCases(filters?: Parameters<typeof demo.listCollectionCases>[0]) {
  return isProductionRuntime()
    ? (ensureWorkflowEnabled("collections"), operations.listCollectionCases(filters))
    : callDemo(demo.listCollectionCases(filters));
}

export async function sendCollectionsReminder(...args: Parameters<typeof demo.sendCollectionsReminder>) {
  return isProductionRuntime()
    ? (ensureWorkflowEnabled("collections"), operations.sendCollectionsReminder(args[0], args[1]))
    : callDemo(demo.sendCollectionsReminder(...args));
}

export async function updateCollectionCase(...args: Parameters<typeof demo.updateCollectionCase>) {
  return isProductionRuntime()
    ? (ensureWorkflowEnabled("collections"), operations.updateCollectionCase(args[0], args[1], args[2]))
    : callDemo(demo.updateCollectionCase(...args));
}

export async function evaluateCollectionsWorklist(
  collectionCaseId?: string,
  userId?: string,
) {
  if (isProductionRuntime()) {
    ensureWorkflowEnabled("collections");
    return operations.evaluateCollectionsWorklist(collectionCaseId, userId);
  }

  throw new ApiError(501, "Collections evaluation is not implemented in demo mode.");
}

export async function listTelematics(assetNumber?: string) {
  return isProductionRuntime()
    ? (ensureWorkflowEnabled("telematics"), operations.listTelematics(assetNumber))
    : callDemo(demo.listTelematics(assetNumber));
}

export async function syncTelematics(...args: Parameters<typeof demo.syncTelematics>) {
  return isProductionRuntime()
    ? (ensureWorkflowEnabled("telematics"), operations.syncTelematics(args[0], args[1]))
    : callDemo(demo.syncTelematics(...args));
}

export async function scheduleSkybitzPulls(options?: {
  branchId?: string;
  userId?: string;
}) {
  if (isProductionRuntime()) {
    ensureWorkflowEnabled("telematics");
    return operations.scheduleSkybitzPulls(options);
  }

  throw new ApiError(501, "SkyBitz scheduling is not implemented in demo mode.");
}

export async function listDocuments(contractNumber?: string) {
  return isProductionRuntime()
    ? (ensureWorkflowEnabled("documents"), esign.listDocuments(contractNumber))
    : callDemo(demo.listDocuments(contractNumber));
}

export async function createDocument(...args: Parameters<typeof demo.createDocument>) {
  return isProductionRuntime()
    ? (ensureWorkflowEnabled("documents"), esign.createDocument(args[0], args[1]))
    : callDemo(demo.createDocument(...args));
}

export async function markDocumentArchived(...args: Parameters<typeof demo.markDocumentArchived>) {
  return isProductionRuntime()
    ? (ensureWorkflowEnabled("documents"), esign.markDocumentArchived(args[0], args[1]))
    : callDemo(demo.markDocumentArchived(...args));
}

export async function listSignatureRequests(contractNumber?: string) {
  return isProductionRuntime()
    ? (ensureWorkflowEnabled("signatures"), esign.listSignatureRequests(contractNumber))
    : callDemo(demo.listSignatureRequests(contractNumber));
}

export async function createSignatureRequestForContract(
  payload: Parameters<typeof esign.createSignatureRequestForContract>[0],
  userId?: string,
) {
  return isProductionRuntime()
    ? (ensureWorkflowEnabled("signatures"), esign.createSignatureRequestForContract(payload, userId))
    : callDemo(demo.createSignatureRequestForContract(payload as never, userId));
}

export async function completeSignatureRequest(
  signatureRequestId: string,
  userId?: string,
) {
  return isProductionRuntime()
    ? (ensureWorkflowEnabled("signatures"), esign.adminCompleteSignatureRequest(signatureRequestId, userId))
    : callDemo(demo.completeSignatureRequest(signatureRequestId, userId));
}

export async function listIntegrationJobs(filters?: Parameters<typeof demo.listIntegrationJobs>[0]) {
  return isProductionRuntime()
    ? operations.listIntegrationJobs(filters)
    : callDemo(demo.listIntegrationJobs(filters));
}

export async function getPortalOverview(customerNumber: string) {
  return isProductionRuntime()
    ? production.getPortalOverview(customerNumber)
    : callDemo(demo.getPortalOverview(customerNumber));
}

export async function getReports() {
  return isProductionRuntime()
    ? (ensureWorkflowEnabled("reports"), buildOperationalReports())
    : callDemo(demo.getReports());
}

export async function exportRevenueReport() {
  return isProductionRuntime()
    ? production.exportRevenueReport()
    : callDemo(demo.exportRevenueReport());
}

export async function getCollectionsRecoverySnapshot(...args: Parameters<typeof demo.getCollectionsRecoverySnapshot>) {
  return isProductionRuntime()
    ? (ensureWorkflowEnabled("collections"), ensureWorkflowEnabled("telematics"), operations.getCollectionsRecoverySnapshot(args[0]))
    : callDemo(demo.getCollectionsRecoverySnapshot(...args));
}
