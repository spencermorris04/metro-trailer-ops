import { errorResponse, ok } from "@/lib/server/api";
import { sendCollectionsReminder } from "@/lib/server/platform-service";

type ReminderRouteParams = {
  params: Promise<{
    caseId: string;
  }>;
};

export async function POST(_request: Request, { params }: ReminderRouteParams) {
  try {
    const { caseId } = await params;
    const data = await sendCollectionsReminder(caseId);
    return ok({ message: "Collections reminder sent.", data });
  } catch (error) {
    return errorResponse(error);
  }
}
