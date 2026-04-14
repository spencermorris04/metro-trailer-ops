import type { ContractStatusKey } from "@/lib/domain/models";

export const actionableSignatureStatuses = [
  "sent",
  "in_progress",
  "partially_signed",
] as const;

export type ContractSignatureState =
  | "not_requested"
  | "awaiting_signers"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "expired";

export type ContractBillingState =
  | "quote"
  | "ready_to_invoice"
  | "current"
  | "overdue"
  | "paid"
  | "closed"
  | "cancelled";

export type ContractCommercialStage =
  | "quote_draft"
  | "signature_pending"
  | "signature_in_progress"
  | "reserved_ready"
  | "active_unbilled"
  | "active_current"
  | "receivables_open"
  | "completed_unbilled"
  | "ready_to_close"
  | "closed"
  | "cancelled";

export function isActionableSignatureStatus(status: string | null | undefined) {
  return actionableSignatureStatuses.includes(
    status as (typeof actionableSignatureStatuses)[number],
  );
}

export function deriveContractSignatureState(status?: string | null): ContractSignatureState {
  switch (status) {
    case "sent":
      return "awaiting_signers";
    case "in_progress":
    case "partially_signed":
      return "in_progress";
    case "completed":
      return "completed";
    case "cancelled":
      return "cancelled";
    case "expired":
      return "expired";
    default:
      return "not_requested";
  }
}

export function deriveContractCommercialState(args: {
  contractStatus: ContractStatusKey;
  signatureStatus?: string | null;
  invoiceCount: number;
  openInvoiceCount: number;
  overdueInvoiceCount: number;
  outstandingBalance: number;
  uninvoicedEventCount: number;
}) {
  const signatureState = deriveContractSignatureState(args.signatureStatus);

  const billingState: ContractBillingState =
    args.contractStatus === "cancelled"
      ? "cancelled"
      : args.contractStatus === "closed"
        ? "closed"
        : args.overdueInvoiceCount > 0
          ? "overdue"
          : args.outstandingBalance > 0
            ? "current"
            : args.invoiceCount > 0
              ? "paid"
              : args.uninvoicedEventCount > 0
                ? "ready_to_invoice"
                : "quote";

  const commercialStage: ContractCommercialStage = (() => {
    if (args.contractStatus === "cancelled") {
      return "cancelled";
    }
    if (args.contractStatus === "closed") {
      return "closed";
    }
    if (args.contractStatus === "quoted" && signatureState === "completed") {
      return "reserved_ready";
    }
    if (signatureState === "awaiting_signers") {
      return "signature_pending";
    }
    if (signatureState === "in_progress") {
      return "signature_in_progress";
    }
    if (args.contractStatus === "quoted") {
      return "quote_draft";
    }
    if (args.contractStatus === "reserved") {
      return "reserved_ready";
    }
    if (args.outstandingBalance > 0) {
      return "receivables_open";
    }
    if (args.contractStatus === "active" && args.uninvoicedEventCount > 0) {
      return "active_unbilled";
    }
    if (args.contractStatus === "active") {
      return "active_current";
    }
    if (args.contractStatus === "completed" && args.uninvoicedEventCount > 0) {
      return "completed_unbilled";
    }
    if (
      args.contractStatus === "completed" &&
      args.outstandingBalance <= 0 &&
      args.openInvoiceCount === 0 &&
      args.uninvoicedEventCount === 0
    ) {
      return "ready_to_close";
    }

    return "active_current";
  })();

  const nextAction =
    commercialStage === "signature_pending"
      ? "Finish signature routing before dispatch or billing."
      : commercialStage === "signature_in_progress"
        ? "Complete all signer steps before execution."
      : commercialStage === "active_unbilled"
          ? "Generate an invoice for posted contract activity."
          : commercialStage === "completed_unbilled"
            ? "Issue the final invoice before closeout."
            : commercialStage === "receivables_open"
              ? "Collect the remaining balance and reconcile open invoices."
              : commercialStage === "reserved_ready"
                ? "Inventory is committed and the contract is ready for dispatch or activation."
              : commercialStage === "ready_to_close"
                ? "Close the contract once no operational holds remain."
                : commercialStage === "quote_draft"
                  ? "Send or complete e-sign to turn the quote into a committed reservation."
                  : null;

  return {
    signatureState,
    billingState,
    commercialStage,
    nextAction,
  };
}
