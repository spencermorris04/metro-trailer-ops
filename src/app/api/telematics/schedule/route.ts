import { telematicsScheduleSchema } from "@/lib/domain/validators";
import { errorResponse, ok, readJson } from "@/lib/server/api";
import { requireApiPermission } from "@/lib/server/authorization";
import { scheduleSkybitzPulls } from "@/lib/server/platform";

export async function POST(request: Request) {
  try {
    const actor = await requireApiPermission(request, "integrations.manage");
    const payload = telematicsScheduleSchema.parse(await readJson(request).catch(() => ({})));
    const data = await scheduleSkybitzPulls({
      branchId: payload.branchId,
      userId: actor.userId ?? undefined,
    });

    return ok({
      message: "SkyBitz pull jobs scheduled.",
      data,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
