import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type DatasetResult = {
  key: string;
  kind: "odata" | "api-root";
  label: string;
  group: string;
  description: string;
  status: "exported" | "blocked" | "missing" | "failed";
  httpStatus: number | null;
  records: number;
  pages: number;
  jsonPath: string | null;
  csvPath: string | null;
  error: string;
  sampleFields: string[];
};

type ExportSummary = {
  exportedAt: string;
  company: string;
  environment: string;
  results: DatasetResult[];
};

type BlockedObject = {
  datasetKey: string;
  label: string;
  status: string;
  httpStatus: number | null;
  pageId: number | null;
  pageName: string | null;
  objectName: string | null;
  sourceApp: string | null;
  rawError: string;
  recommendation: string;
};

const repoRoot = process.cwd();
const defaultSummary = path.join(
  repoRoot,
  "artifacts",
  "business-central",
  "full-commercial",
  "bc-export-summary.json",
);

function parseArgs(argv: string[]) {
  let summaryPath = defaultSummary;
  let outDir = path.join(
    repoRoot,
    "artifacts",
    "business-central",
    "permission-checklist",
  );

  for (const arg of argv) {
    if (arg.startsWith("--summary=")) {
      summaryPath = path.resolve(arg.slice("--summary=".length));
      continue;
    }

    if (arg.startsWith("--out-dir=")) {
      outDir = path.resolve(arg.slice("--out-dir=".length));
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return { summaryPath, outDir };
}

function parseBlockedObject(result: DatasetResult): BlockedObject {
  const pageMatch = result.error.match(/\(Page\s+(\d+)\s+(.+?)\s+Execute:/i);
  const sourceAppMatch = result.error.match(/Execute:\s*([^)]+)\)/i);

  const pageId = pageMatch ? Number.parseInt(pageMatch[1] ?? "", 10) : null;
  const objectName = pageMatch?.[2]?.trim() ?? null;
  const sourceApp = sourceAppMatch?.[1]?.trim() ?? null;

  const pageName =
    objectName && objectName.includes("  ")
      ? objectName.split(/\s{2,}/)[0] ?? objectName
      : objectName;

  let recommendation =
    "Grant page Execute to the export application user and verify the underlying tabledata Read permissions.";

  if (sourceApp === "Base Application" || !sourceApp) {
    recommendation =
      "Cover this with the standard BC export permission set and verify the related tabledata Read permissions.";
  } else if (
    sourceApp.includes("Rental Advantage") ||
    sourceApp.includes("METR01-Multiple-Extension")
  ) {
    recommendation =
      "Assign the vendor/custom-app export permission set for this page and ensure the related third-party tabledata Read permissions are included.";
  }

  if (result.status === "failed" && result.httpStatus === 429) {
    recommendation =
      "This surface is reachable but throttled. Keep retry/backoff enabled and consider exporting it in isolation or lower concurrency/page rate.";
  }

  return {
    datasetKey: result.key,
    label: result.label,
    status: result.status,
    httpStatus: result.httpStatus,
    pageId,
    pageName,
    objectName,
    sourceApp,
    rawError: result.error,
    recommendation,
  };
}

function renderMarkdown(summary: ExportSummary, blockedObjects: BlockedObject[]) {
  const blocked = blockedObjects.filter((item) => item.status === "blocked");
  const failed = blockedObjects.filter((item) => item.status === "failed");

  const vendorObjects = blocked.filter(
    (item) =>
      item.sourceApp &&
      item.sourceApp !== "Base Application" &&
      item.sourceApp !== "",
  );
  const standardObjects = blocked.filter(
    (item) => !item.sourceApp || item.sourceApp === "Base Application",
  );

  const lines: string[] = [];
  lines.push("# BC Export Permission Checklist");
  lines.push("");
  lines.push(`Generated from: \`${summary.exportedAt}\``);
  lines.push(`Environment: \`${summary.environment}\``);
  lines.push(`Company: \`${summary.company}\``);
  lines.push("");
  lines.push("## What this is for");
  lines.push("");
  lines.push(
    "Hand this checklist to the Business Central admin and the Rental Advantage / METR01 extension admin so the app-only export principal can read the commercial and rental surfaces needed for ERP seeding.",
  );
  lines.push("");
  lines.push("## Standard BC objects to grant");
  lines.push("");

  if (standardObjects.length === 0) {
    lines.push("No blocked Base Application objects were detected.");
  } else {
    lines.push("| Dataset | Page ID | Object | Source App | Needed |");
    lines.push("|---|---:|---|---|---|");
    for (const item of standardObjects) {
      lines.push(
        `| ${item.label} | ${item.pageId ?? ""} | ${item.objectName ?? ""} | ${item.sourceApp ?? "Standard"} | ${item.recommendation} |`,
      );
    }
  }

  lines.push("");
  lines.push("## Vendor / custom-app objects to grant");
  lines.push("");

  if (vendorObjects.length === 0) {
    lines.push("No blocked third-party objects were detected.");
  } else {
    lines.push("| Dataset | Page ID | Object | Source App | Needed |");
    lines.push("|---|---:|---|---|---|");
    for (const item of vendorObjects) {
      lines.push(
        `| ${item.label} | ${item.pageId ?? ""} | ${item.objectName ?? ""} | ${item.sourceApp ?? ""} | ${item.recommendation} |`,
      );
    }
  }

  lines.push("");
  lines.push("## Throttled but reachable surfaces");
  lines.push("");

  if (failed.length === 0) {
    lines.push("No throttled surfaces were detected.");
  } else {
    lines.push("| Dataset | Status | Records Seen | Recommendation |");
    lines.push("|---|---|---:|---|");
    for (const item of failed) {
      const result = summary.results.find((row) => row.key === item.datasetKey);
      lines.push(
        `| ${item.label} | HTTP ${item.httpStatus ?? ""} | ${result?.records ?? 0} | ${item.recommendation} |`,
      );
    }
  }

  lines.push("");
  lines.push("## Assignment target");
  lines.push("");
  lines.push(
    "Assign the relevant permission sets to the Entra application user used by the export scripts, not to a human BC user.",
  );
  lines.push("");
  lines.push("## Raw blocked objects");
  lines.push("");
  for (const item of blockedObjects) {
    lines.push(`- \`${item.datasetKey}\`: ${item.rawError}`);
  }

  return `${lines.join("\n")}\n`;
}

async function main() {
  const { summaryPath, outDir } = parseArgs(process.argv.slice(2));
  const raw = await readFile(summaryPath, "utf8");
  const summary = JSON.parse(raw) as ExportSummary;
  const blockedObjects = summary.results
    .filter((result) => result.status === "blocked" || result.status === "failed")
    .map((result) => parseBlockedObject(result));

  await mkdir(outDir, { recursive: true });

  const markdownPath = path.join(outDir, "bc-export-permission-checklist.md");
  const jsonPath = path.join(outDir, "bc-export-permission-checklist.json");

  await writeFile(markdownPath, renderMarkdown(summary, blockedObjects), "utf8");
  await writeFile(
    jsonPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        sourceSummary: summaryPath,
        company: summary.company,
        environment: summary.environment,
        blockedObjects,
      },
      null,
      2,
    ),
    "utf8",
  );

  console.log(
    JSON.stringify(
      {
        markdownPath,
        jsonPath,
        blockedCount: blockedObjects.filter((item) => item.status === "blocked").length,
        throttledCount: blockedObjects.filter((item) => item.status === "failed").length,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      { error: error instanceof Error ? error.message : String(error) },
      null,
      2,
    ),
  );
  process.exitCode = 1;
});
