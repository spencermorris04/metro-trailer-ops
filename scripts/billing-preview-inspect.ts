import "dotenv/config";

import { pool } from "@/lib/db";
import { getBillingPreview } from "@/lib/server/billing-preview";

function readArg(name: string) {
  const prefix = `${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length).trim() : null;
}

function readLimit() {
  const value = Number(readArg("--limit") ?? "25");
  return Number.isInteger(value) && value > 0 ? value : 25;
}

async function main() {
  const documentNo = readArg("--document");
  const orderNo = readArg("--order");
  const assetNumber = readArg("--asset");

  const preview = await getBillingPreview({
    documentNo: documentNo ?? undefined,
    orderNo: orderNo ?? undefined,
    assetNumber: assetNumber ?? undefined,
    limit: readLimit(),
  });

  console.log(
    JSON.stringify(
      {
        query: preview.query,
        summary: preview.summary,
        lines: preview.lines.slice(0, 10).map((line) => ({
          documentNo: line.documentNo,
          lineNo: line.lineNo,
          orderNo: line.orderNo,
          assetNumber: line.assetNumber,
          description: line.description,
          dealCode: line.profile.dealCode,
          cadence: line.profile.cadence,
          timing: line.profile.timing,
          status: line.comparison.status,
          actualGross: line.actual.grossAmount,
          previewGross: line.preview.grossAmount,
          period: line.servicePeriod,
          nextCandidate: line.nextCandidate,
        })),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
