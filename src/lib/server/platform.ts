import * as demo from "@/lib/server/platform-service";
import * as production from "@/lib/server/platform-service.production";
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

export async function transitionAsset(...args: Parameters<typeof demo.transitionAsset>) {
  return isProductionRuntime()
    ? production.transitionAsset(args[0], args[1], args[2], args[3])
    : callDemo(demo.transitionAsset(...args));
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

export async function createContract(...args: Parameters<typeof demo.createContract>) {
  return isProductionRuntime()
    ? production.createContract(args[0], args[1])
    : callDemo(demo.createContract(...args));
}

export async function transitionContract(...args: Parameters<typeof demo.transitionContract>) {
  return isProductionRuntime()
    ? production.transitionContract(args[0], args[1], args[2], args[3])
    : callDemo(demo.transitionContract(...args));
}

export async function amendContract(...args: Parameters<typeof demo.amendContract>) {
  return isProductionRuntime()
    ? production.amendContract(args[0], args[1], args[2])
    : callDemo(demo.amendContract(...args));
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
  return callDemo(demo.listDispatchTasks(filters));
}

export async function createDispatchTask(...args: Parameters<typeof demo.createDispatchTask>) {
  return callDemo(demo.createDispatchTask(...args));
}

export async function confirmDispatchTask(...args: Parameters<typeof demo.confirmDispatchTask>) {
  return callDemo(demo.confirmDispatchTask(...args));
}

export async function listInspections(filters?: Parameters<typeof demo.listInspections>[0]) {
  return callDemo(demo.listInspections(filters));
}

export async function createInspection(...args: Parameters<typeof demo.createInspection>) {
  return callDemo(demo.createInspection(...args));
}

export async function completeInspection(...args: Parameters<typeof demo.completeInspection>) {
  return callDemo(demo.completeInspection(...args));
}

export async function listWorkOrders(filters?: Parameters<typeof demo.listWorkOrders>[0]) {
  return callDemo(demo.listWorkOrders(filters));
}

export async function createWorkOrder(...args: Parameters<typeof demo.createWorkOrder>) {
  return callDemo(demo.createWorkOrder(...args));
}

export async function completeWorkOrder(...args: Parameters<typeof demo.completeWorkOrder>) {
  return callDemo(demo.completeWorkOrder(...args));
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

export async function createPaymentIntentForInvoice(...args: Parameters<typeof demo.createPaymentIntentForInvoice>) {
  return isProductionRuntime()
    ? production.createPaymentIntentForInvoice(args[0])
    : callDemo(demo.createPaymentIntentForInvoice(...args));
}

export async function addPaymentMethod(...args: Parameters<typeof demo.addPaymentMethod>) {
  return isProductionRuntime()
    ? production.addPaymentMethod(args[0], args[1])
    : callDemo(demo.addPaymentMethod(...args));
}

export async function listPaymentMethods(customerNumber?: string) {
  return isProductionRuntime()
    ? production.listPaymentMethods(customerNumber)
    : callDemo(demo.listPaymentMethods(customerNumber));
}

export async function listCollectionCases(filters?: Parameters<typeof demo.listCollectionCases>[0]) {
  return callDemo(demo.listCollectionCases(filters));
}

export async function sendCollectionsReminder(...args: Parameters<typeof demo.sendCollectionsReminder>) {
  return callDemo(demo.sendCollectionsReminder(...args));
}

export async function updateCollectionCase(...args: Parameters<typeof demo.updateCollectionCase>) {
  return callDemo(demo.updateCollectionCase(...args));
}

export async function listTelematics(assetNumber?: string) {
  return callDemo(demo.listTelematics(assetNumber));
}

export async function syncTelematics(...args: Parameters<typeof demo.syncTelematics>) {
  return callDemo(demo.syncTelematics(...args));
}

export async function listDocuments(contractNumber?: string) {
  return callDemo(demo.listDocuments(contractNumber));
}

export async function createDocument(...args: Parameters<typeof demo.createDocument>) {
  return callDemo(demo.createDocument(...args));
}

export async function markDocumentArchived(...args: Parameters<typeof demo.markDocumentArchived>) {
  return callDemo(demo.markDocumentArchived(...args));
}

export async function listSignatureRequests(contractNumber?: string) {
  return callDemo(demo.listSignatureRequests(contractNumber));
}

export async function createSignatureRequestForContract(...args: Parameters<typeof demo.createSignatureRequestForContract>) {
  return callDemo(demo.createSignatureRequestForContract(...args));
}

export async function completeSignatureRequest(...args: Parameters<typeof demo.completeSignatureRequest>) {
  return callDemo(demo.completeSignatureRequest(...args));
}

export async function listIntegrationJobs(filters?: Parameters<typeof demo.listIntegrationJobs>[0]) {
  return callDemo(demo.listIntegrationJobs(filters));
}

export async function getPortalOverview(customerNumber: string) {
  return isProductionRuntime()
    ? production.getPortalOverview(customerNumber)
    : callDemo(demo.getPortalOverview(customerNumber));
}

export async function getReports() {
  return isProductionRuntime() ? production.getReports() : callDemo(demo.getReports());
}

export async function exportRevenueReport() {
  return isProductionRuntime()
    ? production.exportRevenueReport()
    : callDemo(demo.exportRevenueReport());
}

export async function getCollectionsRecoverySnapshot(...args: Parameters<typeof demo.getCollectionsRecoverySnapshot>) {
  return callDemo(demo.getCollectionsRecoverySnapshot(...args));
}
