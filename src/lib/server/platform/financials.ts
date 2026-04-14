import * as production from "@/lib/server/platform-service.production";

export {
  createFinancialEvent,
  getFinancialOverview,
  getInvoiceHistory,
  generateInvoiceForContract,
  recordInvoicePayment,
  sendInvoice,
  type CreateFinancialEventInput,
} from "@/lib/server/platform-service.production";

export async function listFinancialEvents(filters?: {
  contractNumber?: string;
  eventType?: string;
  status?: string;
}) {
  return production.listFinancialEvents(filters);
}

export async function listInvoices(filters?: {
  status?: string;
  customerNumber?: string;
  contractNumber?: string;
  customerName?: string;
  q?: string;
}) {
  return production.listInvoices({
    status: filters?.status,
    customerNumber: filters?.customerNumber,
    contractNumber: filters?.contractNumber,
  });
}
