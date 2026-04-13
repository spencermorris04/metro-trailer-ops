import { completeQuickBooksOAuth } from "@/lib/server/quickbooks-service";

function buildRedirectUrl(path: string, params: Record<string, string>) {
  const appUrl = process.env.APP_URL?.trim() || "http://localhost:3000";
  const url = new URL(path.startsWith("http") ? path : `${appUrl}${path}`);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return url;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const realmId = searchParams.get("realmId");

  if (!code || !state || !realmId) {
    return Response.redirect(
      buildRedirectUrl("/integrations", {
        quickbooks: "error",
        reason: "missing_callback_parameters",
      }),
      302,
    );
  }

  try {
    const result = await completeQuickBooksOAuth({
      code,
      state,
      realmId,
    });

    return Response.redirect(
      buildRedirectUrl(result.redirectPath ?? "/integrations", {
        quickbooks: "connected",
        realmId,
      }),
      302,
    );
  } catch {
    return Response.redirect(
      buildRedirectUrl("/integrations", {
        quickbooks: "error",
        reason: "callback_failed",
      }),
      302,
    );
  }
}
