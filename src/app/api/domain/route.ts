import { assetTransitionMap, contractTransitionMap } from "@/lib/domain/lifecycle";
import { domainCards, integrationBlueprint, roadmapPhases } from "@/lib/platform-data";

export async function GET() {
  return Response.json({
    generatedAt: new Date().toISOString(),
    entities: domainCards,
    contractTransitions: contractTransitionMap,
    assetTransitions: assetTransitionMap,
    integrations: integrationBlueprint,
    roadmapPhases,
  });
}
