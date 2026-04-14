import * as workOrders from "@/lib/server/work-orders.production";
import { ensureWorkflowEnabled } from "@/lib/server/feature-flags";

export type {
  AssignWorkOrderInput,
  AwaitingWorkOrderInput,
  CancelWorkOrderInput,
  CloseWorkOrderInput,
  CreateWorkOrderInput,
  RepairCompleteWorkOrderInput,
  StartWorkOrderInput,
  UpdateWorkOrderInput,
  VerifyWorkOrderInput,
  WorkOrderListFilters,
} from "@/lib/server/work-orders.production";

export async function listWorkOrders(
  filters?: Parameters<typeof workOrders.listWorkOrders>[0],
) {
  ensureWorkflowEnabled("maintenance");
  return workOrders.listWorkOrders(filters);
}

export async function createWorkOrder(
  payload: Parameters<typeof workOrders.createWorkOrder>[0],
  userId?: string,
) {
  ensureWorkflowEnabled("maintenance");
  return workOrders.createWorkOrder(payload, userId);
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
        vendorId?: string;
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
  ensureWorkflowEnabled("maintenance");
  return workOrders.markWorkOrderRepairComplete(
    workOrderId,
    typeof notesOrPayload === "string"
      ? {
          repairSummary: notesOrPayload,
        }
      : {
          repairSummary:
            notesOrPayload?.notes ?? "Repair completed and ready for verification.",
          notes: notesOrPayload?.notes,
          actualCost: notesOrPayload?.actualCost,
          laborHours: notesOrPayload?.laborHours,
          technicianUserId: notesOrPayload?.technicianUserId,
          vendorId: notesOrPayload?.vendorId,
          vendorName: notesOrPayload?.vendorName,
          laborEntries: notesOrPayload?.laborEntries,
          partEntries: notesOrPayload?.partEntries,
        },
    userId,
  );
}

export async function getWorkOrderDetail(workOrderId: string) {
  ensureWorkflowEnabled("maintenance");
  return workOrders.getWorkOrderDetail(workOrderId);
}

export async function updateWorkOrder(
  workOrderId: string,
  payload: Parameters<typeof workOrders.updateWorkOrder>[1],
  userId?: string,
) {
  ensureWorkflowEnabled("maintenance");
  return workOrders.updateWorkOrder(workOrderId, payload, userId);
}

export async function assignWorkOrder(
  workOrderId: string,
  payload: Parameters<typeof workOrders.assignWorkOrder>[1],
  userId?: string,
) {
  ensureWorkflowEnabled("maintenance");
  return workOrders.assignWorkOrder(workOrderId, payload, userId);
}

export async function startWorkOrder(
  workOrderId: string,
  payload: Parameters<typeof workOrders.startWorkOrder>[1],
  userId?: string,
) {
  ensureWorkflowEnabled("maintenance");
  return workOrders.startWorkOrder(workOrderId, payload, userId);
}

export async function markWorkOrderAwaitingParts(
  workOrderId: string,
  payload: Parameters<typeof workOrders.markWorkOrderAwaitingParts>[1],
  userId?: string,
) {
  ensureWorkflowEnabled("maintenance");
  return workOrders.markWorkOrderAwaitingParts(workOrderId, payload, userId);
}

export async function markWorkOrderAwaitingVendor(
  workOrderId: string,
  payload: Parameters<typeof workOrders.markWorkOrderAwaitingVendor>[1],
  userId?: string,
) {
  ensureWorkflowEnabled("maintenance");
  return workOrders.markWorkOrderAwaitingVendor(workOrderId, payload, userId);
}

export async function markWorkOrderRepairComplete(
  workOrderId: string,
  payload: Parameters<typeof workOrders.markWorkOrderRepairComplete>[1],
  userId?: string,
) {
  ensureWorkflowEnabled("maintenance");
  return workOrders.markWorkOrderRepairComplete(workOrderId, payload, userId);
}

export async function verifyWorkOrder(
  workOrderId: string,
  payload: Parameters<typeof workOrders.verifyWorkOrder>[1],
  userId?: string,
) {
  ensureWorkflowEnabled("maintenance");
  return workOrders.verifyWorkOrder(workOrderId, payload, userId);
}

export async function cancelWorkOrder(
  workOrderId: string,
  payload: Parameters<typeof workOrders.cancelWorkOrder>[1],
  userId?: string,
) {
  ensureWorkflowEnabled("maintenance");
  return workOrders.cancelWorkOrder(workOrderId, payload, userId);
}

export async function closeWorkOrder(
  workOrderId: string,
  payload: Parameters<typeof workOrders.closeWorkOrder>[1],
  userId?: string,
) {
  ensureWorkflowEnabled("maintenance");
  return workOrders.closeWorkOrder(workOrderId, payload, userId);
}

export async function listTechnicianWorkloads() {
  ensureWorkflowEnabled("maintenance");
  return workOrders.listTechnicianWorkloads();
}

export async function listVendorQueue() {
  ensureWorkflowEnabled("maintenance");
  return workOrders.listVendorQueue();
}

export async function listVerificationQueue() {
  ensureWorkflowEnabled("maintenance");
  return workOrders.listVerificationQueue();
}
