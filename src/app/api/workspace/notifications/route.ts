import { z } from "zod";

import { ApiError, errorResponse, ok } from "@/lib/server/api";
import { getActorFromHeaders } from "@/lib/server/authorization";
import { listWorkspaceNotifications } from "@/lib/server/workspace-notifications";

const querySchema = z.object({
  dismissed: z.string().optional(),
});

export async function GET(request: Request) {
  try {
    const actor = await getActorFromHeaders(new Headers(request.headers));
    if (actor?.kind === "portal") {
      throw new ApiError(403, "Staff authentication is required.");
    }

    const { searchParams } = new URL(request.url);
    const parsed = querySchema.parse({
      dismissed: searchParams.get("dismissed") ?? undefined,
    });
    const dismissedIds = parsed.dismissed
      ? parsed.dismissed.split(",").map((value) => value.trim()).filter(Boolean)
      : [];
    const data = await listWorkspaceNotifications(dismissedIds);

    return ok(data, undefined, request);
  } catch (error) {
    return errorResponse(error, request);
  }
}
