export type RuntimeMode = "demo" | "production";

export function getRuntimeMode(): RuntimeMode {
  const value = process.env.METRO_TRAILER_RUNTIME_MODE?.trim().toLowerCase();

  if (value === "demo") {
    return "demo";
  }

  return "production";
}

export function isProductionRuntime() {
  return getRuntimeMode() === "production";
}

export function isDemoRuntime() {
  return getRuntimeMode() === "demo";
}
