import * as production from "@/lib/server/platform-service.production";
import { ensureWorkflowEnabled } from "@/lib/server/feature-flags";

export async function createPaymentIntentForInvoice(
  invoiceId: string,
  paymentMethodId?: string,
) {
  ensureWorkflowEnabled("payments");
  return production.createPaymentIntentForInvoice({ invoiceId, paymentMethodId });
}

export async function addPaymentMethod(
  payload: {
    customerNumber: string;
    stripePaymentMethodId?: string;
    methodType?: "card" | "ach" | "wire" | "check";
    label?: string;
    last4?: string;
    isDefault?: boolean;
    idempotencyKey?: string;
  },
  userId?: string,
) {
  ensureWorkflowEnabled("payments");
  return production.addPaymentMethod(payload, userId);
}

export async function listPaymentMethods(customerNumber?: string) {
  ensureWorkflowEnabled("payments");
  return production.listPaymentMethods(customerNumber);
}

export async function createPaymentSetupIntent(customerNumber: string) {
  ensureWorkflowEnabled("payments");
  return production.createPaymentSetupIntent(customerNumber);
}

export async function setDefaultPaymentMethod(paymentMethodId: string, userId?: string) {
  ensureWorkflowEnabled("payments");
  return production.setDefaultPaymentMethod(paymentMethodId, userId);
}

export async function listCustomerPaymentHistory(filters?: {
  customerNumber?: string;
  invoiceId?: string;
}) {
  ensureWorkflowEnabled("payments");
  return production.listCustomerPaymentHistory(filters);
}

export async function processStripeWebhook(receiptId: string) {
  ensureWorkflowEnabled("payments");
  return production.processStripeWebhook(receiptId);
}

export async function refundCustomerPayment(
  transactionId: string,
  amount?: number,
  userId?: string,
) {
  ensureWorkflowEnabled("payments");
  return production.refundCustomerPayment(transactionId, amount, userId);
}
