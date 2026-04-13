import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export type RouteSecurityFinding = {
  severity: "error" | "warning";
  filePath: string;
  message: string;
};

type AuditedRouteFile = {
  filePath: string;
  content: string;
};

const routeGuardPatterns = [
  "requireApiPermission(",
  "requireStaffApiPermission(",
  "requireAuthenticatedApiActor(",
  "requireScopedResourceAccess(",
  "requirePortalContextFromHeaders(",
  "getPortalCustomerNumberFromHeaders(",
];

const mutatingMethodPattern = /export\s+async\s+function\s+(POST|PUT|PATCH|DELETE)\s*\(/;

function isWebhookRoute(filePath: string) {
  return filePath.includes(`${path.sep}webhooks${path.sep}`);
}

function isPublicSignerRoute(filePath: string) {
  return (
    filePath.includes(`${path.sep}api${path.sep}signatures${path.sep}`) &&
    (filePath.includes(`${path.sep}sign${path.sep}`) ||
      filePath.includes(`${path.sep}otp${path.sep}`))
  );
}

function isHealthRoute(filePath: string) {
  return (
    filePath.endsWith(`${path.sep}health${path.sep}route.ts`) ||
    filePath.endsWith(`${path.sep}ready${path.sep}route.ts`)
  );
}

export function auditRouteSecurity(files: AuditedRouteFile[]) {
  const findings: RouteSecurityFinding[] = [];

  for (const file of files) {
    if (file.content.includes("demo-store")) {
      findings.push({
        severity: "error",
        filePath: file.filePath,
        message: "Route imports demo-store directly.",
      });
    }

    const hasMutation = mutatingMethodPattern.test(file.content);
    const guarded = routeGuardPatterns.some((pattern) => file.content.includes(pattern));

    if (
      hasMutation &&
      !guarded &&
      !isWebhookRoute(file.filePath) &&
      !isPublicSignerRoute(file.filePath) &&
      !isHealthRoute(file.filePath)
    ) {
      findings.push({
        severity: "error",
        filePath: file.filePath,
        message: "Mutating route is missing an explicit auth guard helper.",
      });
    }

    if (
      isWebhookRoute(file.filePath) &&
      /process(Stripe|QuickBooks|Record360)Webhook\(/.test(file.content)
    ) {
      findings.push({
        severity: "warning",
        filePath: file.filePath,
        message: "Webhook route still appears to perform inline processing after enqueue.",
      });
    }

    if (
      file.filePath.endsWith(
        `${path.sep}documents${path.sep}[documentId]${path.sep}download${path.sep}route.ts`,
      ) &&
      !file.content.includes("resolveDocumentScope(") &&
      !file.content.includes("requirePortalContextFromHeaders(") &&
      !file.content.includes("requireScopedResourceAccess(")
    ) {
      findings.push({
        severity: "warning",
        filePath: file.filePath,
        message: "Document download route is missing an obvious scope-enforcement helper.",
      });
    }
  }

  return findings;
}

export async function findRouteFiles(rootDirectory: string) {
  const results: string[] = [];
  const queue = [rootDirectory];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const nextPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(nextPath);
      } else if (entry.isFile() && entry.name === "route.ts") {
        results.push(nextPath);
      }
    }
  }

  return results;
}

export async function auditRepositoryRoutes(rootDirectory: string) {
  const routeFiles = await findRouteFiles(rootDirectory);
  const files = await Promise.all(
    routeFiles.map(async (filePath) => ({
      filePath,
      content: await readFile(filePath, "utf8"),
    })),
  );

  return auditRouteSecurity(files);
}
