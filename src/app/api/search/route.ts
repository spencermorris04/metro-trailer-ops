import { z } from "zod";

import { ApiError, errorResponse, ok } from "@/lib/server/api";
import { getActorFromHeaders } from "@/lib/server/authorization";
import { searchWorkspace } from "@/lib/server/global-search";

const searchSchema = z.object({
  q: z.string().trim().max(120).default(""),
  store: z.string().trim().max(120).optional(),
});

export async function GET(request: Request) {
  try {
    const actor = await getActorFromHeaders(new Headers(request.headers));
    if (actor?.kind === "portal") {
      throw new ApiError(403, "Staff authentication is required.");
    }

    const { searchParams } = new URL(request.url);
    const input = searchSchema.parse({
      q: searchParams.get("q") ?? "",
      store: searchParams.get("store") ?? undefined,
    });

    const data = await searchWorkspace({
      query: input.q,
      store: input.store ?? "all",
    });

    return ok(data, undefined, request);
  } catch (error) {
    return errorResponse(error, request);
  }
}
