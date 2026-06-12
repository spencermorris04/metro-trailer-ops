import "dotenv/config";

import {
  validateBillingPreviewDocuments,
  validateBillingPreviewSample,
} from "@/lib/server/billing-preview";

function readArg(name: string) {
  const prefix = `${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : null;
}

function readDocumentArgs() {
  const explicit = process.argv
    .filter((arg) => arg.startsWith("--document="))
    .map((arg) => arg.slice("--document=".length));
  const commaSeparated = readArg("--documents")
    ?.split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return [...explicit, ...(commaSeparated ?? [])].filter(Boolean);
}

function readSampleSize() {
  const value = Number(readArg("--sample") ?? "25");
  return Number.isInteger(value) && value > 0 ? value : 25;
}

async function main() {
  const documentNos = readDocumentArgs();
  const result =
    documentNos.length > 0
      ? await validateBillingPreviewDocuments(documentNos)
      : await validateBillingPreviewSample(readSampleSize());

  console.log("Billing preview validation");
  console.log(`Generated: ${result.generatedAt}`);
  console.log(`Documents: ${result.documentCount}`);
  console.log(`Source lines: ${result.sourceLineCount}`);
  console.log(`Supported lines: ${result.supportedLineCount}`);
  console.log(`Matched lines: ${result.matchedLineCount}`);
  console.log(`Mismatched lines: ${result.mismatchedLineCount}`);
  console.log(`Unsupported lines: ${result.unsupportedLineCount}`);
  console.log(`Actual gross: ${result.actualGrossAmount.toFixed(2)}`);
  console.log(`Preview gross: ${result.previewGrossAmount.toFixed(2)}`);
  console.log(`Sampled documents: ${result.sampledDocumentNos.join(", ")}`);

  if (result.mismatches.length > 0) {
    console.table(result.mismatches);
  }

  if (result.supportedLineCount === 0) {
    throw new Error("Validation did not find any supported BC/RMI lines.");
  }

  if (result.mismatchedLineCount > 0) {
    throw new Error("Billing preview validation found gross amount mismatches.");
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    const { pool } = await import("@/lib/db");
    await pool.end();
  });
