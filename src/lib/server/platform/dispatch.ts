import * as operations from "@/lib/server/platform-operations.production";
import { ensureWorkflowEnabled } from "@/lib/server/feature-flags";

export async function listDispatchTasks(
  filters?: Parameters<typeof operations.listDispatchTasks>[0],
) {
  ensureWorkflowEnabled("dispatch");
  return operations.listDispatchTasks(filters);
}

export async function createDispatchTask(
  payload: Parameters<typeof operations.createDispatchTask>[0],
  userId?: string,
) {
  ensureWorkflowEnabled("dispatch");
  return operations.createDispatchTask(payload, userId);
}

export async function confirmDispatchTask(
  taskId: string,
  payload: Parameters<typeof operations.confirmDispatchTask>[1],
  userId?: string,
) {
  ensureWorkflowEnabled("dispatch");
  return operations.confirmDispatchTask(taskId, payload, userId);
}
