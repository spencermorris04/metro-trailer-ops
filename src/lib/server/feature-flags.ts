import { ApiError } from "@/lib/server/api";
import { isProductionRuntime } from "@/lib/server/runtime";

export const workflowCatalog = [
  "assets",
  "customers",
  "contracts",
  "dispatch",
  "inspections",
  "maintenance",
  "collections",
  "telematics",
  "documents",
  "signatures",
  "payments",
  "quickbooks",
  "record360",
  "reports",
] as const;

export type WorkflowKey = (typeof workflowCatalog)[number];

type BranchWorkflowMap = Partial<Record<string, WorkflowKey[]>>;

function parseWorkflowList(raw: string | undefined) {
  if (!raw) {
    return [] as WorkflowKey[];
  }

  return raw
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter((value): value is WorkflowKey =>
      workflowCatalog.includes(value as WorkflowKey),
    );
}

function parseBranchDisabledWorkflows(raw: string | undefined): BranchWorkflowMap {
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, string[]>;
    return Object.fromEntries(
      Object.entries(parsed).map(([branchId, workflows]) => [
        branchId,
        workflows
          .map((value) => value.trim().toLowerCase())
          .filter((value): value is WorkflowKey =>
            workflowCatalog.includes(value as WorkflowKey),
          ),
      ]),
    );
  } catch {
    return {};
  }
}

export function getWorkflowFlags(branchId?: string | null) {
  const globallyDisabled = new Set(
    parseWorkflowList(process.env.METRO_TRAILER_DISABLED_WORKFLOWS),
  );
  const branchDisabled = parseBranchDisabledWorkflows(
    process.env.METRO_TRAILER_BRANCH_DISABLED_WORKFLOWS,
  );
  const disabledForBranch = new Set(branchId ? branchDisabled[branchId] ?? [] : []);

  const workflows = Object.fromEntries(
    workflowCatalog.map((workflow) => [
      workflow,
      !(globallyDisabled.has(workflow) || disabledForBranch.has(workflow)),
    ]),
  ) as Record<WorkflowKey, boolean>;

  return {
    runtimeMode: isProductionRuntime() ? "production" : "demo",
    branchId: branchId ?? null,
    workflows,
    disabledGlobally: [...globallyDisabled],
    disabledForBranch: [...disabledForBranch],
  };
}

export function ensureWorkflowEnabled(
  workflow: WorkflowKey,
  options?: {
    branchId?: string | null;
    reason?: string;
  },
) {
  const snapshot = getWorkflowFlags(options?.branchId ?? null);

  if (snapshot.workflows[workflow]) {
    return snapshot;
  }

  throw new ApiError(
    503,
    `${workflow} workflow is disabled in production configuration.`,
    {
      workflow,
      branchId: options?.branchId ?? null,
      reason: options?.reason ?? null,
      disabledGlobally: snapshot.disabledGlobally,
      disabledForBranch: snapshot.disabledForBranch,
    },
  );
}
