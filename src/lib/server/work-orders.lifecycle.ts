import type {
  WorkOrderBillableDispositionKey,
  WorkOrderBillingApprovalStatusKey,
  WorkOrderStatusKey,
  WorkOrderVerificationResultKey,
} from "@/lib/domain/models";
import { ApiError } from "@/lib/server/api";

export type WorkOrderLifecycleAction =
  | "assign"
  | "start"
  | "awaiting_parts"
  | "awaiting_vendor"
  | "repair_complete"
  | "verify"
  | "cancel"
  | "close";

export function isBlockingMaintenanceStatus(status: WorkOrderStatusKey) {
  return [
    "open",
    "assigned",
    "in_progress",
    "awaiting_parts",
    "awaiting_vendor",
    "repair_completed",
  ].includes(status);
}

export function isTerminalWorkOrderStatus(status: WorkOrderStatusKey) {
  return ["closed", "cancelled"].includes(status);
}

export function getVerificationFailureStatus(hasAssignment: boolean): WorkOrderStatusKey {
  return hasAssignment ? "assigned" : "open";
}

export function requireWorkOrderTransition(options: {
  currentStatus: WorkOrderStatusKey;
  action: WorkOrderLifecycleAction;
  hasAssignment?: boolean;
  verificationResult?: WorkOrderVerificationResultKey;
}) {
  const { currentStatus, action } = options;

  if (isTerminalWorkOrderStatus(currentStatus)) {
    throw new ApiError(
      409,
      `Work order is ${currentStatus} and cannot transition through ${action}.`,
      {
        currentStatus,
        action,
      },
    );
  }

  switch (action) {
    case "assign":
      if (!["open", "assigned"].includes(currentStatus)) {
        throw new ApiError(409, "Work order can only be assigned while open.", {
          currentStatus,
          action,
        });
      }
      return "assigned" as const;
    case "start":
      if (!["assigned", "in_progress", "awaiting_parts", "awaiting_vendor"].includes(currentStatus)) {
        throw new ApiError(409, "Work can only start from an assigned or waiting state.", {
          currentStatus,
          action,
        });
      }
      return "in_progress" as const;
    case "awaiting_parts":
      if (!["assigned", "in_progress", "awaiting_vendor"].includes(currentStatus)) {
        throw new ApiError(409, "Only assigned or active work can move to awaiting parts.", {
          currentStatus,
          action,
        });
      }
      return "awaiting_parts" as const;
    case "awaiting_vendor":
      if (!["assigned", "in_progress", "awaiting_parts"].includes(currentStatus)) {
        throw new ApiError(409, "Only assigned or active work can move to awaiting vendor.", {
          currentStatus,
          action,
        });
      }
      return "awaiting_vendor" as const;
    case "repair_complete":
      if (!["assigned", "in_progress", "awaiting_parts", "awaiting_vendor"].includes(currentStatus)) {
        throw new ApiError(409, "Repair can only complete from an active maintenance state.", {
          currentStatus,
          action,
        });
      }
      return "repair_completed" as const;
    case "verify":
      if (currentStatus !== "repair_completed") {
        throw new ApiError(409, "Only repair-completed work orders can be verified.", {
          currentStatus,
          action,
        });
      }
      return options.verificationResult === "passed"
        ? ("verified" as const)
        : getVerificationFailureStatus(Boolean(options.hasAssignment));
    case "cancel":
      if (currentStatus === "verified") {
        throw new ApiError(409, "Verified work orders cannot be cancelled.", {
          currentStatus,
          action,
        });
      }
      return "cancelled" as const;
    case "close":
      if (currentStatus !== "verified") {
        throw new ApiError(409, "Only verified work orders can be closed.", {
          currentStatus,
          action,
        });
      }
      return "closed" as const;
    default:
      throw new ApiError(400, `Unsupported work-order action: ${action}`);
  }
}

export function normalizeBillableApprovalStatus(options: {
  disposition: WorkOrderBillableDispositionKey;
  approvalStatus?: WorkOrderBillingApprovalStatusKey | null;
}) {
  if (options.disposition === "customer_damage") {
    return options.approvalStatus ?? "pending_review";
  }

  if (options.disposition === "internal") {
    return "not_required" as const;
  }

  return options.approvalStatus ?? "not_required";
}

export function canGenerateCustomerDamageEvents(options: {
  disposition: WorkOrderBillableDispositionKey;
  approvalStatus: WorkOrderBillingApprovalStatusKey;
  contractId: string | null;
}) {
  return (
    options.disposition === "customer_damage" &&
    options.approvalStatus === "approved" &&
    Boolean(options.contractId)
  );
}

