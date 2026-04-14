import assert from "node:assert/strict";
import test from "node:test";

import {
  canGenerateCustomerDamageEvents,
  getVerificationFailureStatus,
  isBlockingMaintenanceStatus,
  normalizeBillableApprovalStatus,
  requireWorkOrderTransition,
} from "@/lib/server/work-orders.lifecycle";

test("work-order lifecycle enforces repair completion before verification and close", () => {
  assert.equal(
    requireWorkOrderTransition({
      currentStatus: "assigned",
      action: "start",
    }),
    "in_progress",
  );

  assert.equal(
    requireWorkOrderTransition({
      currentStatus: "in_progress",
      action: "repair_complete",
    }),
    "repair_completed",
  );

  assert.equal(
    requireWorkOrderTransition({
      currentStatus: "repair_completed",
      action: "verify",
      verificationResult: "passed",
    }),
    "verified",
  );

  assert.equal(
    requireWorkOrderTransition({
      currentStatus: "verified",
      action: "close",
    }),
    "closed",
  );
});

test("failed verification falls back to assigned when ownership exists", () => {
  assert.equal(
    requireWorkOrderTransition({
      currentStatus: "repair_completed",
      action: "verify",
      verificationResult: "failed",
      hasAssignment: true,
    }),
    "assigned",
  );

  assert.equal(getVerificationFailureStatus(false), "open");
  assert.equal(getVerificationFailureStatus(true), "assigned");
});

test("blocking maintenance statuses stop asset release until verification passes", () => {
  assert.equal(isBlockingMaintenanceStatus("open"), true);
  assert.equal(isBlockingMaintenanceStatus("awaiting_vendor"), true);
  assert.equal(isBlockingMaintenanceStatus("repair_completed"), true);
  assert.equal(isBlockingMaintenanceStatus("verified"), false);
  assert.equal(isBlockingMaintenanceStatus("closed"), false);
});

test("customer damage billing requires approval and a linked contract", () => {
  assert.equal(
    normalizeBillableApprovalStatus({
      disposition: "customer_damage",
    }),
    "pending_review",
  );

  assert.equal(
    canGenerateCustomerDamageEvents({
      disposition: "customer_damage",
      approvalStatus: "approved",
      contractId: "contract_1",
    }),
    true,
  );

  assert.equal(
    canGenerateCustomerDamageEvents({
      disposition: "customer_damage",
      approvalStatus: "pending_review",
      contractId: "contract_1",
    }),
    false,
  );

  assert.equal(
    canGenerateCustomerDamageEvents({
      disposition: "customer_damage",
      approvalStatus: "approved",
      contractId: null,
    }),
    false,
  );
});

test("invalid transitions throw clear lifecycle errors", () => {
  assert.throws(
    () =>
      requireWorkOrderTransition({
        currentStatus: "open",
        action: "close",
      }),
    /only verified work orders can be closed/i,
  );

  assert.throws(
    () =>
      requireWorkOrderTransition({
        currentStatus: "verified",
        action: "cancel",
      }),
    /cannot be cancelled/i,
  );
});
