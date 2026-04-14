import { ensureWorkflowEnabled } from "@/lib/server/feature-flags";
import { buildOperationalReports } from "@/lib/server/reporting";

export { exportRevenueReport } from "@/lib/server/platform-service.production";

export async function getReports() {
  ensureWorkflowEnabled("reports");
  return buildOperationalReports();
}
