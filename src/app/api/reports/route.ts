import { errorResponse, ok } from "@/lib/server/api";
import { exportRevenueReport, getReports } from "@/lib/server/platform-service";

export async function GET() {
  return ok({
    data: getReports(),
  });
}

export async function POST() {
  try {
    const exportResult = await exportRevenueReport();
    return ok({
      message: "Revenue report export prepared.",
      data: exportResult.data,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
