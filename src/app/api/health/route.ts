export async function GET() {
  return Response.json({
    status: "ok",
    service: "metro-trailer",
    checkedAt: new Date().toISOString(),
    scope: [
      "domain-model",
      "lifecycle-rules",
      "starter-route-handlers",
      "product-shell",
    ],
  });
}
