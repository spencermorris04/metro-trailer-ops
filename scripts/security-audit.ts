import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { auditRepositoryRoutes } from "../src/lib/testing/security-audit";

function getArg(flag: string, fallback?: string) {
  const index = process.argv.indexOf(flag);
  if (index >= 0) {
    return process.argv[index + 1] ?? fallback;
  }

  return fallback;
}

async function main() {
  const outputDirectory =
    getArg("--out") ??
    path.join(
      process.cwd(),
      "artifacts",
      "security-audit",
      new Date().toISOString().replace(/[:.]/g, "-"),
    );
  const findings = await auditRepositoryRoutes(path.join(process.cwd(), "src", "app", "api"));

  await mkdir(outputDirectory, { recursive: true });
  await writeFile(
    path.join(outputDirectory, "findings.json"),
    JSON.stringify(findings, null, 2),
    "utf8",
  );

  const markdown = [
    "# Security Audit",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    findings.length === 0
      ? "No findings."
      : findings
          .map((finding) => `- [${finding.severity}] ${finding.filePath}: ${finding.message}`)
          .join("\n"),
    "",
  ].join("\n");

  await writeFile(path.join(outputDirectory, "findings.md"), markdown, "utf8");
  process.stdout.write(`${markdown}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
