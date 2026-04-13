import { enqueueOutboxJob } from "@/lib/server/outbox";

const DEFAULT_STALE_MINUTES = 180;

export function getTelematicsFreshness(capturedAt: Date) {
  const freshnessMinutes = Math.max(
    0,
    Math.floor((Date.now() - capturedAt.getTime()) / 60_000),
  );
  const staleThreshold = Number(process.env.SKYBITZ_STALE_MINUTES ?? DEFAULT_STALE_MINUTES);

  return {
    freshnessMinutes,
    stale: freshnessMinutes >= staleThreshold,
  };
}

export async function enqueueSkybitzPullJob(options: {
  assetId: string;
  assetNumber: string;
  gpsDeviceId?: string | null;
  externalAssetId?: string | null;
  correlationId?: string | null;
  reason: string;
}) {
  return enqueueOutboxJob({
    jobType: "telematics.pull.skybitz",
    aggregateType: "asset",
    aggregateId: options.assetId,
    provider: "skybitz",
    correlationId: options.correlationId ?? null,
    payload: {
      assetNumber: options.assetNumber,
      gpsDeviceId: options.gpsDeviceId ?? null,
      externalAssetId: options.externalAssetId ?? null,
      reason: options.reason,
    },
  });
}
