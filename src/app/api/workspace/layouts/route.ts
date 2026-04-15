import { z } from "zod";

import { ApiError, errorResponse, ok, readJson } from "@/lib/server/api";
import {
  getWorkspaceActorSummary,
  getWorkspaceLayout,
  listWorkspaceLayouts,
  saveWorkspaceLayout,
} from "@/lib/server/workspace-layouts";

const layoutPayloadSchema = z.object({
  pageKey: z.string().trim().min(1).max(120),
  layout: z.record(z.string(), z.unknown()),
});

export async function GET(request: Request) {
  try {
    const requestHeaders = new Headers(request.headers);
    const { searchParams } = new URL(request.url);
    const pageKey = searchParams.get("pageKey");

    if (!pageKey) {
      const data = await listWorkspaceLayouts(requestHeaders);
      return ok(data, undefined, request);
    }

    const defaults = searchParams.get("defaults");
    const parsedDefaults =
      defaults && defaults.trim().length > 0
        ? z.record(z.string(), z.unknown()).parse(JSON.parse(defaults))
        : {};
    const data = await getWorkspaceLayout(requestHeaders, pageKey, parsedDefaults);

    return ok(data, undefined, request);
  } catch (error) {
    return errorResponse(error, request);
  }
}

export async function PUT(request: Request) {
  try {
    const requestHeaders = new Headers(request.headers);
    const actor = await getWorkspaceActorSummary(requestHeaders);
    const payload = layoutPayloadSchema.parse(await readJson(request));

    if (actor.kind === "anonymous" && process.env.NODE_ENV === "production") {
      throw new ApiError(401, "Authentication is required to persist workspace layout.");
    }

    const data = await saveWorkspaceLayout(
      requestHeaders,
      payload.pageKey,
      payload.layout,
    );

    return ok(
      {
        message: "Workspace layout saved.",
        data,
      },
      undefined,
      request,
    );
  } catch (error) {
    return errorResponse(error, request);
  }
}
