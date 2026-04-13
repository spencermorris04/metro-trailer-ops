export type RuntimeMode = "demo" | "production";

export function getRuntimeMode(): RuntimeMode {
  const value = process.env.METRO_TRAILER_RUNTIME_MODE?.trim().toLowerCase();

  if (value === "production" || value === "database") {
    return "production";
  }

  return "demo";
}

export function isProductionRuntime() {
  return getRuntimeMode() === "production";
}

export function isDemoRuntime() {
  return getRuntimeMode() === "demo";
}
