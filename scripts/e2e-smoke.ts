type Scenario = {
  name: string;
  requiredEnv: string[];
  steps: Array<{
    method: "GET" | "POST";
    path: string;
    body?: Record<string, unknown>;
    usePortalCookie?: boolean;
  }>;
};

const scenarios: Scenario[] = [
  {
    name: "core-lifecycle",
    requiredEnv: ["E2E_BASE_URL", "E2E_STAFF_COOKIE", "E2E_BRANCH_ID", "E2E_CUSTOMER_ID"],
    steps: [
      {
        method: "POST",
        path: "/api/assets",
        body: {
          assetNumber: "E2E-TR-0001",
          branchId: process.env.E2E_BRANCH_ID,
          type: "box_trailer",
          status: "available",
        },
      },
      {
        method: "POST",
        path: "/api/contracts",
        body: {
          customerId: process.env.E2E_CUSTOMER_ID,
          branchId: process.env.E2E_BRANCH_ID,
          status: "quoted",
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 86_400_000).toISOString(),
          lines: [],
        },
      },
    ],
  },
  {
    name: "portal-and-payments",
    requiredEnv: ["E2E_BASE_URL", "E2E_PORTAL_COOKIE"],
    steps: [
      { method: "GET", path: "/api/portal/me", usePortalCookie: true },
      { method: "GET", path: "/api/payments/history", usePortalCookie: true },
    ],
  },
  {
    name: "signatures",
    requiredEnv: ["E2E_BASE_URL", "E2E_SIGNATURE_REQUEST_ID"],
    steps: [
      {
        method: "GET",
        path: `/api/signatures/${process.env.E2E_SIGNATURE_REQUEST_ID ?? "missing"}`,
      },
    ],
  },
];

async function main() {
  const baseUrl = process.env.E2E_BASE_URL;
  if (!baseUrl) {
    process.stdout.write(
      "E2E_BASE_URL is not set. The smoke harness is installed but no environment is configured.\n",
    );
    return;
  }

  const report: Array<{
    name: string;
    status: "passed" | "skipped" | "failed";
    detail: string;
  }> = [];

  for (const scenario of scenarios) {
    const missing = scenario.requiredEnv.filter((name) => !process.env[name]);
    if (missing.length > 0) {
      report.push({
        name: scenario.name,
        status: "skipped",
        detail: `Missing env: ${missing.join(", ")}`,
      });
      continue;
    }

    try {
      for (const step of scenario.steps) {
        const response = await fetch(new URL(step.path, baseUrl), {
          method: step.method,
          headers: {
            "content-type": "application/json",
            ...(step.usePortalCookie
              ? { cookie: process.env.E2E_PORTAL_COOKIE as string }
              : process.env.E2E_STAFF_COOKIE
                ? { cookie: process.env.E2E_STAFF_COOKIE }
                : {}),
          },
          body: step.body ? JSON.stringify(step.body) : undefined,
        });

        if (!response.ok) {
          throw new Error(`${step.method} ${step.path} failed with ${response.status}`);
        }
      }

      report.push({
        name: scenario.name,
        status: "passed",
        detail: `${scenario.steps.length} step(s) completed`,
      });
    } catch (error) {
      report.push({
        name: scenario.name,
        status: "failed",
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.some((entry) => entry.status === "failed")) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
