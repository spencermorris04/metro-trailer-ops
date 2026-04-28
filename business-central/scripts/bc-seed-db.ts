import "dotenv/config";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  finishBcImportRun,
  reconcileBcImportRun,
  recordBcImportError,
  seedBcAccountingHistory,
  seedBcAssets,
  seedBcBranches,
  seedBcCommercialDocuments,
  seedBcCustomers,
  startBcImportRun,
  type BcAccountingHistorySeedInput,
  type BcAssetSeedInput,
  type BcBranchSeedInput,
  type BcCommercialDocumentSeedInput,
  type BcCustomerSeedInput,
} from "../../src/lib/server/business-central-import";

type ExportFile<T> = {
  exportedAt: string;
  serviceName: string;
  company: string;
  pages: number;
  records: number;
  items: T[];
};

type FixedAssetRow = Record<string, unknown>;
type FixedAssetCardRow = Record<string, unknown>;
type CustomerOverviewRow = Record<string, unknown>;
type SalesListRow = Record<string, unknown>;
type SalesBySalespersonRow = Record<string, unknown>;
type VendorLedgerRow = Record<string, unknown>;
type BankLedgerRow = Record<string, unknown>;
type FaLedgerRow = Record<string, unknown>;

const repoRoot = path.resolve(__dirname, "../..");
const artifactsRoot = path.join(repoRoot, "artifacts", "business-central");

function getString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? value.trim() : "";
}

function getNumber(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

async function loadExport<T>(segments: string[]) {
  const filePath = path.join(artifactsRoot, ...segments);
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as ExportFile<T>;
}

function mapAssetType(code: string): BcAssetSeedInput["type"] {
  const normalized = code.toUpperCase();

  if (normalized.includes("ROAD TRL")) return "road_trailer";
  if (normalized.includes("CARTAG")) return "cartage_trailer";
  if (normalized.includes("STORAG TRL")) return "storage_trailer";
  if (normalized.includes("STORAGE CO")) return "storage_container";
  if (normalized.includes("FLATBD")) return "flatbed_trailer";
  if (normalized.includes("OFFICE")) return "office_trailer";
  if (normalized.includes("REEFER")) return "reefer_trailer";
  if (normalized.includes("YARD TRUCK")) return "yard_truck";
  if (normalized.includes("CHASSIS")) return "chassis";

  return "specialty_trailer";
}

function toBranchInput(code: string): BcBranchSeedInput {
  return {
    externalId: code,
    code,
    name: code,
    payload: { source: "bc-seed-artifacts", code },
  };
}

async function main() {
  const runId = await startBcImportRun({
    entityType: "full_seed",
    jobVersion: "bc-seed-db:v1",
    metadata: {
      source: "artifacts/business-central",
    },
  });

  const summary: Record<string, unknown> = {
    runId,
    startedAt: new Date().toISOString(),
  };

  try {
    const [
      fixedAssetsExport,
      fixedAssetCardExport,
      customersExport,
      salesListExport,
      salesBySalespersonExport,
      vendorLedgerExport,
      bankLedgerExport,
      faLedgerExport,
    ] = await Promise.all([
      loadExport<FixedAssetRow>(["assets", "fixed-assets.json"]),
      loadExport<FixedAssetCardRow>(["assets", "fixed-asset-card.json"]),
      loadExport<CustomerOverviewRow>(["customers", "top-customer-overview.json"]),
      loadExport<SalesListRow>(["orders", "power-bi-sales-list.json"]),
      loadExport<SalesBySalespersonRow>([
        "orders",
        "sales-orders-by-salesperson.json",
      ]),
      loadExport<VendorLedgerRow>(["finance", "vendor-ledger-entries.json"]),
      loadExport<BankLedgerRow>(["finance", "bank-ledger-entries.json"]),
      loadExport<FaLedgerRow>(["assets", "fa-ledger-entries.json"]),
    ]);

    const assetCardByNumber = new Map(
      fixedAssetCardExport.items.map((item) => [getString(item, "No"), item]),
    );

    const branchCodes = new Set<string>();
    for (const item of fixedAssetsExport.items) {
      const code = getString(item, "RMI_Location_Code");
      if (code) branchCodes.add(code);
    }
    for (const item of customersExport.items) {
      const code = getString(item, "Global_Dimension_1_Code");
      if (code) branchCodes.add(code);
    }

    const branchIds = await seedBcBranches(
      Array.from(branchCodes).map((code) => toBranchInput(code)),
    );

    const assets: BcAssetSeedInput[] = fixedAssetsExport.items.map((item) => {
      const number = getString(item, "No");
      const card = assetCardByNumber.get(number) ?? {};
      return {
        externalId: number,
        assetNumber: number,
        branchCode: getString(item, "RMI_Location_Code") || "UNASSIGNED",
        branchName: getString(item, "RMI_Location_Code") || "UNASSIGNED",
        type: mapAssetType(getString(item, "FA_Class_Code")),
        subtype: getString(item, "FA_Subclass_Code") || null,
        serialNumber: getString(item, "Serial_No") || null,
        manufacturer:
          getString(card, "RMI_Manufacturer_Code") || getString(item, "Make") || null,
        modelYear: getNumber(item, "Vehicle_Year") || null,
        registrationNumber:
          getString(card, "RMI_Vehicle_Registration_No") ||
          getString(item, "Vehicle_Registration_No") ||
          null,
        faClassCode: getString(item, "FA_Class_Code") || null,
        faSubclassCode: getString(item, "FA_Subclass_Code") || null,
        bcLocationCode:
          getString(item, "FA_Location_Code") || getString(card, "FA_Location_Code") || null,
        bcDimension1Code: getString(card, "RMI_Global_Dimension_1_Code") || null,
        bcProductNo: getString(item, "RMI_Product_No") || null,
        bcServiceItemNo: getString(item, "RMI_Service_Item_No") || null,
        isBlocked: Boolean(card["Blocked"]),
        isInactive: Boolean(card["Inactive"]),
        isDisposed: Boolean(card["RMI_Disposed"] ?? item["RMI_Disposed"]),
        isOnRent: Boolean(card["RMI_On_Rent"] ?? item["RMI_On_Rent"]),
        isInService: Boolean(card["RMI_In_Service"] ?? item["RMI_In_Service"]),
        underMaintenance: Boolean(card["Under_Maintenance"]),
        bookValue:
          typeof card["BookValue"] === "number" ? Number(card["BookValue"]) : null,
        payload: {
          fixedAssets: item,
          fixedAssetCard: card,
        },
      };
    });
    const assetIds = await seedBcAssets(assets);

    const customers: BcCustomerSeedInput[] = customersExport.items.map((item) => ({
      externalId: getString(item, "No"),
      customerNumber: getString(item, "No"),
      name: getString(item, "Name"),
      customerType: "commercial",
      contactInfo: {
        name: getString(item, "Name"),
      },
      billingAddress: {
        line1: getString(item, "City") || "Unknown",
        city: getString(item, "City") || "Unknown",
        state: "NA",
        postalCode: "00000",
        country: getString(item, "Country_Region_Code") || "US",
      },
      branchCoverage: getString(item, "Global_Dimension_1_Code")
        ? [getString(item, "Global_Dimension_1_Code")]
        : [],
      payload: item,
    }));
    const customerIds = await seedBcCustomers(customers);

    const salesLinesByDocument = new Map<string, BcCommercialDocumentSeedInput>();
    for (const row of salesListExport.items) {
      const documentNo = getString(row, "Document_No");
      if (!documentNo) continue;

      const existing =
        salesLinesByDocument.get(documentNo) ??
        ({
          externalDocumentId: documentNo,
          documentType: getString(row, "AuxiliaryIndex1") || "sales_document",
          documentNo,
          status: getString(row, "AuxiliaryIndex2") || null,
          documentDate:
            getString(row, "Shipment_Date") !== "0001-01-01"
              ? getString(row, "Shipment_Date")
              : null,
          dueDate:
            getString(row, "Due_Date") !== "0001-01-01"
              ? getString(row, "Due_Date")
              : null,
          payload: {
            salesListRows: [],
          },
          lines: [],
        } satisfies BcCommercialDocumentSeedInput);

      (existing.payload.salesListRows as unknown[]).push(row);
      existing.lines?.push({
        externalLineId: `${documentNo}:${String(row["AuxiliaryIndex4"] ?? existing.lines.length + 1)}`,
        lineNo:
          typeof row["AuxiliaryIndex4"] === "number"
            ? Number(row["AuxiliaryIndex4"])
            : null,
        itemNo: getString(row, "Item_No") || null,
        uomCode: null,
        quantity: getNumber(row, "Quantity") || null,
        unitPrice: getNumber(row, "Amount") || null,
        lineAmount: getNumber(row, "Amount") || null,
        payload: row,
      });

      salesLinesByDocument.set(documentNo, existing);
    }

    for (const row of salesBySalespersonExport.items) {
      const documentNo = getString(row, "Document_No");
      const existing = salesLinesByDocument.get(documentNo);
      if (!existing) continue;

      const payload = existing.payload as { salesBySalespersonRows?: unknown[] };
      payload.salesBySalespersonRows = payload.salesBySalespersonRows ?? [];
      payload.salesBySalespersonRows.push(row);
    }

    const documentIds = await seedBcCommercialDocuments(
      Array.from(salesLinesByDocument.values()),
      runId,
    );

    const vendorMap = new Map<string, { vendorNo: string; name: string }>();
    for (const row of vendorLedgerExport.items) {
      const vendorNo = getString(row, "Vendor_No");
      if (!vendorNo) continue;
      vendorMap.set(vendorNo, {
        vendorNo,
        name: getString(row, "Vendor_Name") || vendorNo,
      });
    }

    const accountingHistory: BcAccountingHistorySeedInput = {
      vendors: Array.from(vendorMap.values()).map((vendor) => ({
        vendorNo: vendor.vendorNo,
        name: vendor.name,
      })),
      vendorLedgerEntries: vendorLedgerExport.items.map((row) => ({
        externalEntryNo: String(row["Entry_No"]),
        vendorNo: getString(row, "Vendor_No") || null,
        postingDate: getString(row, "Posting_Date") || null,
        documentNo: getString(row, "Document_No") || null,
        amount: getNumber(row, "Amount"),
        payload: row,
      })),
      bankLedgerEntries: bankLedgerExport.items.map((row) => ({
        externalEntryNo: String(row["Entry_No"]),
        bankAccountNo: getString(row, "Bank_Account_No") || null,
        postingDate: getString(row, "Posting_Date") || null,
        documentNo: getString(row, "Document_No") || null,
        amount: getNumber(row, "Amount"),
        payload: row,
      })),
      faLedgerEntries: faLedgerExport.items.map((row) => ({
        externalEntryNo: String(row["Entry_No"]),
        assetNo: getString(row, "FA_No") || null,
        postingDate: getString(row, "Posting_Date") || null,
        documentNo: getString(row, "Document_No") || null,
        amount: getNumber(row, "Amount_LCY"),
        payload: row,
      })),
    };
    await seedBcAccountingHistory(accountingHistory);

    const reconciliation = await reconcileBcImportRun(runId);

    summary.completedAt = new Date().toISOString();
    summary.branchCount = branchIds.length;
    summary.assetCount = assetIds.length;
    summary.customerCount = customerIds.length;
    summary.documentCount = documentIds.length;
    summary.reconciliation = reconciliation;

    await finishBcImportRun({
      runId,
      status: "succeeded",
      recordsSeen:
        fixedAssetsExport.items.length +
        customersExport.items.length +
        salesListExport.items.length +
        vendorLedgerExport.items.length +
        bankLedgerExport.items.length +
        faLedgerExport.items.length,
      recordsInserted:
        branchIds.length + assetIds.length + customerIds.length + documentIds.length,
      recordsUpdated: 0,
      recordsSkipped: 0,
      recordsFailed: 0,
      metadata: summary,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await recordBcImportError({
      runId,
      entityType: "full_seed",
      message,
    });
    await finishBcImportRun({
      runId,
      status: "failed",
      recordsFailed: 1,
      errorSummary: message,
      metadata: summary,
    });
    throw error;
  } finally {
    const outputDir = path.join(artifactsRoot, "seed");
    await mkdir(outputDir, { recursive: true });
    await writeFile(
      path.join(outputDir, `bc-seed-summary-${runId}.json`),
      JSON.stringify(summary, null, 2),
      "utf8",
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
