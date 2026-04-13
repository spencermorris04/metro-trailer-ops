export const workerJobTypes = [
  "audit.write",
  "webhook.process.stripe",
  "webhook.process.quickbooks",
  "webhook.process.record360",
  "notification.send.email",
  "collections.evaluate",
  "report.rollup.daily",
  "invoice.sync.quickbooks",
  "payment.sync.quickbooks",
  "inspection.request.record360",
  "inspection.ingest.record360",
  "telematics.pull.skybitz",
] as const;

export type WorkerJobType = (typeof workerJobTypes)[number];

export function isWorkerJobType(value: string): value is WorkerJobType {
  return workerJobTypes.includes(value as WorkerJobType);
}
