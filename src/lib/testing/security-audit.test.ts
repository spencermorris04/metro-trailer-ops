import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { auditRepositoryRoutes, auditRouteSecurity } from "@/lib/testing/security-audit";

test("auditRouteSecurity flags direct demo-store imports", () => {
  const findings = auditRouteSecurity([
    {
      filePath: "src/app/api/example/route.ts",
      content: 'import store from "@/lib/server/demo-store";\nexport async function POST() {}',
    },
  ]);

  assert.equal(findings.some((finding) => finding.message.includes("demo-store")), true);
});

test("repository routes do not import demo-store directly", async () => {
  const findings = await auditRepositoryRoutes(
    path.join(process.cwd(), "src", "app", "api"),
  );

  assert.equal(
    findings.some(
      (finding) =>
        finding.severity === "error" &&
        finding.message.includes("demo-store"),
    ),
    false,
  );
});
