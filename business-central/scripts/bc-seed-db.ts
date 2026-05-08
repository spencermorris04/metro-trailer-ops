import "dotenv/config";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";

import { db, schema } from "../../src/lib/db";
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
type CustomerRow = Record<string, unknown>;
type CustomerCardRow = Record<string, unknown>;
type SalesOrderRow = Record<string, unknown>;
type SalesOrderLineRow = Record<string, unknown>;
type SalesDocumentRow = Record<string, unknown>;
type SalesDocumentLineRow = Record<string, unknown>;
type SalesListRow = Record<string, unknown>;
type SalesHeaderCustomerRow = Record<string, unknown>;
type SalesBySalespersonRow = Record<string, unknown>;
type PostedRentalHeaderRow = Record<string, unknown>;
type PostedRentalLineRow = Record<string, unknown>;
type PostedRentalInvoiceRow = Record<string, unknown>;
type VendorLedgerRow = Record<string, unknown>;
type BankLedgerRow = Record<string, unknown>;
type FaLedgerRow = Record<string, unknown>;

const repoRoot = path.resolve(__dirname, "../..");
const artifactsRoot = path.join(repoRoot, "artifacts", "business-central");

function sanitizeString(value: string) {
  return value.replace(/\uFEFF/g, "").replace(/\u0000/g, "").trim();
}

function sanitizeValue<T>(value: T): T {
  if (typeof value === "string") {
    return sanitizeString(value) as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item)) as T;
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, sanitizeValue(entry)]),
    ) as T;
  }

  return value;
}

function getString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? sanitizeString(value) : "";
}

function getNumber(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

async function loadExport<T>(segments: string[]) {
  const filePath = path.join(artifactsRoot, ...segments);
  const raw = await readFile(filePath, "utf8");
  return sanitizeValue(JSON.parse(raw) as ExportFile<T>);
}

async function loadOptionalExport<T>(segments: string[]) {
  try {
    return await loadExport<T>(segments);
  } catch {
    return null;
  }
}

function getStringAny(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = getString(record, key);
    if (value) return value;
  }
  return "";
}

function getNumberAny(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = getNumber(record, key);
    if (value) return value;
  }
  return 0;
}

function getDateStringAny(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = getString(record, key);
    if (value && value !== "0001-01-01" && value !== "0001-01-01T00:00:00Z") {
      return value;
    }
  }
  return null;
}

function normalizeDocumentType(value: string) {
  const normalized = value.toLowerCase();
  if (normalized.includes("quote")) return "quote";
  if (normalized.includes("invoice")) return "invoice";
  if (normalized.includes("order")) return "order";
  if (normalized.includes("rental")) return "rental";
  if (normalized.includes("posted")) return "posted";
  return normalized || "sales_document";
}

function normalizeContractStatus(value: string) {
  const normalized = value.toLowerCase();
  if (normalized.includes("quote")) return "quoted" as const;
  if (normalized.includes("reserve")) return "reserved" as const;
  if (normalized.includes("cancel")) return "cancelled" as const;
  if (normalized.includes("close") || normalized.includes("complete")) {
    return "closed" as const;
  }
  return "active" as const;
}

function normalizeInvoiceStatus(value: string) {
  const normalized = value.toLowerCase();
  if (normalized.includes("paid")) return "paid" as const;
  if (normalized.includes("overdue")) return "overdue" as const;
  if (normalized.includes("void")) return "voided" as const;
  if (normalized.includes("post") || normalized.includes("sent")) return "sent" as const;
  return "draft" as const;
}

function inferCommercialEventType(itemNo: string | null, description: string | null) {
  const haystack = `${itemNo ?? ""} ${description ?? ""}`.toUpperCase();
  if (haystack.includes("DELIVERY")) return "delivery" as const;
  if (haystack.includes("PICKUP")) return "pickup" as const;
  if (haystack.includes("TAX")) return "tax" as const;
  if (haystack.includes("CREDIT") || haystack.includes("DISCOUNT")) return "credit" as const;
  if (haystack.includes("DAMAGE")) return "damage" as const;
  if (haystack.includes("SURCHARGE") || haystack.includes("FEE")) return "surcharge" as const;
  if (haystack.includes("DEPOSIT")) return "deposit_request" as const;
  if (haystack.includes("ADJUST")) return "adjustment" as const;
  return "rent" as const;
}

function addLineToDocument(
  document: BcCommercialDocumentSeedInput,
  row: Record<string, unknown>,
  lineNo: number | null,
  itemNo: string | null,
  description: string | null,
  quantity: number | null,
  unitPrice: number | null,
  lineAmount: number | null,
  uomCode: string | null,
) {
  document.lines = document.lines ?? [];
  document.lines.push({
    externalLineId: `${document.externalDocumentId}:${String(lineNo ?? document.lines.length + 1)}`,
    lineNo,
    itemNo,
    uomCode,
    quantity,
    unitPrice,
    lineAmount,
    payload: row,
  });
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

async function loadCustomerContext() {
  const customers = await db
    .select({
      id: schema.customers.id,
      customerNumber: schema.customers.customerNumber,
      branchCoverage: schema.customers.branchCoverage,
    })
    .from(schema.customers);

  const locations = await db
    .select({
      id: schema.customerLocations.id,
      customerId: schema.customerLocations.customerId,
      isPrimary: schema.customerLocations.isPrimary,
      createdAt: schema.customerLocations.createdAt,
    })
    .from(schema.customerLocations);

  const locationByCustomerId = new Map<string, string>();
  for (const location of locations.sort((a, b) => {
    if (a.isPrimary === b.isPrimary) {
      return a.createdAt.getTime() - b.createdAt.getTime();
    }
    return a.isPrimary ? -1 : 1;
  })) {
    if (!locationByCustomerId.has(location.customerId)) {
      locationByCustomerId.set(location.customerId, location.id);
    }
  }

  return new Map(
    customers.map((customer) => [
      customer.customerNumber,
      {
        customerId: customer.id,
        locationId: locationByCustomerId.get(customer.id) ?? null,
        branchCode: customer.branchCoverage[0] ?? "UNASSIGNED",
      },
    ]),
  );
}

async function loadBranchContext() {
  const branches = await db
    .select({
      id: schema.branches.id,
      code: schema.branches.code,
    })
    .from(schema.branches);

  return new Map(branches.map((branch) => [branch.code, branch.id]));
}

function createDocumentAccumulator() {
  return new Map<string, BcCommercialDocumentSeedInput>();
}

function getOrCreateDocument(
  documents: Map<string, BcCommercialDocumentSeedInput>,
  externalDocumentId: string,
  documentType: string,
  documentNo: string,
  row: Record<string, unknown>,
) {
  const existing = documents.get(externalDocumentId);
  if (existing) {
    return existing;
  }

  const created: BcCommercialDocumentSeedInput = {
    externalDocumentId,
    documentType,
    documentNo,
    payload: { sourceRows: [row] },
    lines: [],
  };
  documents.set(externalDocumentId, created);
  return created;
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
      customerDetailExport,
      customerCardExport,
      salesOrderExport,
      salesOrderLinesExport,
      salesDocumentsExport,
      salesDocumentLinesExport,
      salesListExport,
      salesHeaderCustomerExport,
      salesBySalespersonExport,
      postedRentalHeaderExport,
      postedRentalLineExport,
      postedRentalInvoiceExport,
      vendorLedgerExport,
      bankLedgerExport,
      faLedgerExport,
    ] = await Promise.all([
      loadExport<FixedAssetRow>(["assets", "fixed-assets.json"]),
      loadExport<FixedAssetCardRow>(["assets", "fixed-asset-card.json"]),
      loadExport<CustomerOverviewRow>(["customers", "top-customer-overview.json"]),
      loadOptionalExport<CustomerRow>(["customers", "customers.json"]),
      loadOptionalExport<CustomerCardRow>(["customers", "customer-card.json"]),
      loadOptionalExport<SalesOrderRow>(["orders", "sales-order.json"]),
      loadOptionalExport<SalesOrderLineRow>(["orders", "sales-order-lines.json"]),
      loadOptionalExport<SalesDocumentRow>(["orders", "sales-documents.json"]),
      loadOptionalExport<SalesDocumentLineRow>(["orders", "sales-document-lines.json"]),
      loadExport<SalesListRow>(["orders", "power-bi-sales-list.json"]),
      loadOptionalExport<SalesHeaderCustomerRow>(["orders", "power-bi-sales-hdr-cust.json"]),
      loadExport<SalesBySalespersonRow>([
        "orders",
        "sales-orders-by-salesperson.json",
      ]),
      loadOptionalExport<PostedRentalHeaderRow>(["rentals", "posted-rental-header.json"]),
      loadOptionalExport<PostedRentalLineRow>(["rentals", "posted-rental-line.json"]),
      loadOptionalExport<PostedRentalInvoiceRow>(["rentals", "posted-rental-invoice.json"]),
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

    const customerDetailByNo = new Map(
      (customerDetailExport?.items ?? []).map((item) => [getString(item, "No"), item]),
    );
    const customerCardByNo = new Map(
      (customerCardExport?.items ?? []).map((item) => [getString(item, "No"), item]),
    );

    const customers: BcCustomerSeedInput[] = customersExport.items.map((item) => {
      const customerNo = getString(item, "No");
      const detail = customerDetailByNo.get(customerNo) ?? {};
      const card = customerCardByNo.get(customerNo) ?? {};
      const branchCode = getString(item, "Global_Dimension_1_Code");
      const city =
        getStringAny(card, ["City", "Bill_to_City"]) ||
        getStringAny(detail, ["City", "Bill_to_City"]) ||
        getString(item, "City") ||
        "Unknown";
      const country =
        getStringAny(card, ["Country_Region_Code", "Bill_to_Country_Region_Code"]) ||
        getStringAny(detail, ["Country_Region_Code", "Bill_to_Country_Region_Code"]) ||
        getString(item, "Country_Region_Code") ||
        "US";

      return {
        externalId: customerNo,
        customerNumber: customerNo,
        name: getString(item, "Name"),
        customerType: "commercial",
        contactInfo: {
          name: getString(item, "Name"),
        },
        billingAddress: {
          line1:
            getStringAny(card, ["Address", "Bill_to_Address"]) ||
            getStringAny(detail, ["Address", "Bill_to_Address"]) ||
            city,
          line2:
            getStringAny(card, ["Address_2", "Bill_to_Address_2"]) ||
            getStringAny(detail, ["Address_2", "Bill_to_Address_2"]) ||
            "",
          city,
          state:
            getStringAny(card, ["County", "State"]) ||
            getStringAny(detail, ["County", "State"]) ||
            "NA",
          postalCode:
            getStringAny(card, ["Post_Code", "Bill_to_Post_Code"]) ||
            getStringAny(detail, ["Post_Code", "Bill_to_Post_Code"]) ||
            "00000",
          country,
        },
        branchCoverage: branchCode ? [branchCode] : [],
        locations: [
          {
            externalId: `${customerNo}:primary`,
            name: `${getString(item, "Name")} Primary Site`,
            address: {
              line1:
                getStringAny(card, ["Address", "Bill_to_Address"]) ||
                getStringAny(detail, ["Address", "Bill_to_Address"]) ||
                city,
              line2:
                getStringAny(card, ["Address_2", "Bill_to_Address_2"]) ||
                getStringAny(detail, ["Address_2", "Bill_to_Address_2"]) ||
                "",
              city,
              state:
                getStringAny(card, ["County", "State"]) ||
                getStringAny(detail, ["County", "State"]) ||
                "NA",
              postalCode:
                getStringAny(card, ["Post_Code", "Bill_to_Post_Code"]) ||
                getStringAny(detail, ["Post_Code", "Bill_to_Post_Code"]) ||
                "00000",
              country,
            },
            isPrimary: true,
            payload: {
              source: "bc-customer-default-location",
              detail,
              card,
              overview: item,
            },
          },
        ],
        payload: {
          overview: item,
          detail,
          card,
        },
      };
    });
    const customerIds = await seedBcCustomers(customers);

    const customerContext = await loadCustomerContext();
    const branchContext = await loadBranchContext();
    const documents = createDocumentAccumulator();

    const attachSnapshots = (document: BcCommercialDocumentSeedInput) => {
      const customerExternalId = document.customerExternalId ?? null;
      if (!customerExternalId) return;

      const customer = customerContext.get(customerExternalId);
      if (!customer?.locationId) return;

      const branchId =
        branchContext.get(customer.branchCode) ??
        Array.from(branchContext.values())[0] ??
        null;

      if (!branchId) return;

      const documentDateString =
        typeof document.documentDate === "string"
          ? document.documentDate
          : typeof document.dueDate === "string"
            ? document.dueDate
            : new Date().toISOString();
      const dueDateString =
        typeof document.dueDate === "string" ? document.dueDate : documentDateString;
      const lineTotal = (document.lines ?? []).reduce(
        (sum, line) =>
          sum +
          Number(
            typeof line.lineAmount === "number"
              ? line.lineAmount
              : typeof line.unitPrice === "number"
                ? line.unitPrice
                : 0,
          ),
        0,
      );

      document.contractSnapshot = {
        contractNumber: document.documentNo,
        customerId: customer.customerId,
        locationId: customer.locationId,
        branchId,
        startDate: new Date(documentDateString),
        endDate: null,
        status: normalizeContractStatus(document.status ?? document.documentType),
        notes: `Seeded from Business Central ${document.documentType} ${document.documentNo}`,
      };

      if (
        document.documentType.includes("invoice") ||
        document.documentType.includes("posted")
      ) {
        document.invoiceSnapshot = {
          invoiceNumber: document.documentNo,
          customerId: customer.customerId,
          invoiceDate: new Date(documentDateString),
          dueDate: new Date(dueDateString),
          status: normalizeInvoiceStatus(document.status ?? document.documentType),
          subtotalAmount: lineTotal.toFixed(2),
          totalAmount: lineTotal.toFixed(2),
          balanceAmount: lineTotal.toFixed(2),
        };
      }
    };

    for (const row of salesListExport.items) {
      const documentNo = getString(row, "Document_No");
      if (!documentNo) continue;
      const document = getOrCreateDocument(
        documents,
        documentNo,
        normalizeDocumentType(getString(row, "AuxiliaryIndex1") || "sales_document"),
        documentNo,
        row,
      );
      document.status = getString(row, "AuxiliaryIndex2") || document.status || null;
      document.documentDate = getDateStringAny(row, [
        "Requested_Delivery_Date",
        "Shipment_Date",
      ]) ?? document.documentDate;
      document.dueDate = getDateStringAny(row, ["Due_Date"]) ?? document.dueDate;
      addLineToDocument(
        document,
        row,
        typeof row["AuxiliaryIndex4"] === "number" ? Number(row["AuxiliaryIndex4"]) : null,
        getString(row, "Item_No") || null,
        getString(row, "Description") || null,
        getNumber(row, "Quantity") || null,
        getNumber(row, "Amount") || null,
        getNumber(row, "Amount") || null,
        null,
      );
    }

    for (const row of salesBySalespersonExport.items) {
      const documentNo = getString(row, "Document_No");
      if (!documentNo) continue;
      const document = documents.get(documentNo);
      if (!document) continue;
      const payload = document.payload as { salesBySalespersonRows?: unknown[] };
      payload.salesBySalespersonRows = payload.salesBySalespersonRows ?? [];
      payload.salesBySalespersonRows.push(row);
    }

    for (const row of salesHeaderCustomerExport?.items ?? []) {
      const documentNo =
        getStringAny(row, ["No", "Document_No", "AuxiliaryIndex3"]) || "";
      if (!documentNo) continue;
      const document = getOrCreateDocument(
        documents,
        documentNo,
        normalizeDocumentType(getStringAny(row, ["AuxiliaryIndex1", "Document_Type"]) || "sales_document"),
        documentNo,
        row,
      );
      document.customerExternalId =
        getStringAny(row, ["Customer_No", "Sell_to_Customer_No", "Bill_to_Customer_No"]) ||
        document.customerExternalId ||
        null;
      document.status =
        getStringAny(row, ["AuxiliaryIndex2", "Status"]) || document.status || null;
      attachSnapshots(document);
    }

    for (const row of salesOrderExport?.items ?? []) {
      const documentNo = getStringAny(row, ["No", "Document_No"]);
      if (!documentNo) continue;
      const document = getOrCreateDocument(documents, documentNo, "sales_order", documentNo, row);
      document.customerExternalId =
        getStringAny(row, ["Sell_to_Customer_No", "Customer_No", "Bill_to_Customer_No"]) ||
        null;
      document.status = getStringAny(row, ["Status", "Document_Type"]) || null;
      document.documentDate =
        getDateStringAny(row, ["Order_Date", "Posting_Date", "Shipment_Date"]) ??
        document.documentDate;
      document.dueDate = getDateStringAny(row, ["Due_Date"]) ?? document.dueDate;
      attachSnapshots(document);
    }

    for (const row of salesOrderLinesExport?.items ?? []) {
      const documentNo = getStringAny(row, ["Document_No", "Document_No_"]);
      if (!documentNo) continue;
      const document = documents.get(documentNo);
      if (!document) continue;
      addLineToDocument(
        document,
        row,
        typeof row["Line_No"] === "number" ? Number(row["Line_No"]) : null,
        getStringAny(row, ["No", "Item_No"]) || null,
        getString(row, "Description") || null,
        getNumberAny(row, ["Quantity", "Qty_to_Ship"]) || null,
        getNumberAny(row, ["Unit_Price", "Amount"]) || null,
        getNumberAny(row, ["Line_Amount", "Amount"]) || null,
        getStringAny(row, ["Unit_of_Measure_Code", "Base_Unit_of_Measure"]) || null,
      );
    }

    for (const row of salesDocumentsExport?.items ?? []) {
      const documentNo = getStringAny(row, ["id", "number", "No"]);
      if (!documentNo) continue;
      const documentType = normalizeDocumentType(
        getStringAny(row, ["documentType", "type", "status"]) || "sales_document",
      );
      const document = getOrCreateDocument(documents, documentNo, documentType, documentNo, row);
      document.customerExternalId =
        getStringAny(row, ["customerNumber", "sellToCustomerNumber", "customerNo"]) || null;
      document.status = getStringAny(row, ["status"]) || null;
      document.documentDate =
        getDateStringAny(row, ["documentDate", "postingDate", "orderDate"]) ??
        document.documentDate;
      document.dueDate = getDateStringAny(row, ["dueDate"]) ?? document.dueDate;
      attachSnapshots(document);
    }

    for (const row of salesDocumentLinesExport?.items ?? []) {
      const documentNo = getStringAny(row, ["documentId", "documentNo"]);
      if (!documentNo) continue;
      const document = documents.get(documentNo);
      if (!document) continue;
      addLineToDocument(
        document,
        row,
        typeof row["sequence"] === "number"
          ? Number(row["sequence"])
          : typeof row["lineNumber"] === "number"
            ? Number(row["lineNumber"])
            : null,
        getStringAny(row, ["itemId", "itemNo", "lineObjectNumber"]) || null,
        getStringAny(row, ["description", "lineDescription"]) || null,
        getNumberAny(row, ["quantity", "quantityShipped"]) || null,
        getNumberAny(row, ["unitPrice", "amountExcludingTax", "lineAmount"]) || null,
        getNumberAny(row, ["lineAmount", "amountExcludingTax"]) || null,
        getStringAny(row, ["unitOfMeasureCode"]) || null,
      );
    }

    for (const row of postedRentalHeaderExport?.items ?? []) {
      const documentNo = getStringAny(row, ["No", "Document_No"]);
      if (!documentNo) continue;
      const document = getOrCreateDocument(documents, documentNo, "posted_rental_invoice", documentNo, row);
      document.customerExternalId =
        getStringAny(row, ["Customer_No", "Bill_to_Customer_No", "Sell_to_Customer_No"]) ||
        null;
      document.status = getStringAny(row, ["Status"]) || "Posted";
      document.documentDate =
        getDateStringAny(row, ["Posting_Date", "Document_Date", "Shipment_Date"]) ??
        document.documentDate;
      document.dueDate = getDateStringAny(row, ["Due_Date"]) ?? document.dueDate;
      attachSnapshots(document);
      if (document.invoiceSnapshot) {
        document.invoiceSnapshot.status = "sent";
      }
    }

    for (const row of postedRentalLineExport?.items ?? []) {
      const documentNo = getStringAny(row, ["Document_No", "No"]);
      if (!documentNo) continue;
      const document = documents.get(documentNo);
      if (!document) continue;
      addLineToDocument(
        document,
        row,
        typeof row["Line_No"] === "number" ? Number(row["Line_No"]) : null,
        getStringAny(row, ["No", "Item_No"]) || null,
        getString(row, "Description") || null,
        getNumberAny(row, ["Quantity", "Qty_Shipped"]) || null,
        getNumberAny(row, ["Unit_Price", "Amount"]) || null,
        getNumberAny(row, ["Amount", "Line_Amount"]) || null,
        getStringAny(row, ["Unit_of_Measure_Code"]) || null,
      );
    }

    for (const row of postedRentalInvoiceExport?.items ?? []) {
      const documentNo = getStringAny(row, ["No", "Document_No"]);
      if (!documentNo) continue;
      const document = getOrCreateDocument(documents, documentNo, "posted_rental_invoice", documentNo, row);
      document.customerExternalId =
        getStringAny(row, ["Customer_No", "Bill_to_Customer_No", "Sell_to_Customer_No"]) ||
        document.customerExternalId ||
        null;
      document.status = getStringAny(row, ["Status"]) || "Posted";
      document.documentDate =
        getDateStringAny(row, ["Posting_Date", "Document_Date"]) ?? document.documentDate;
      document.dueDate = getDateStringAny(row, ["Due_Date"]) ?? document.dueDate;
      attachSnapshots(document);
      if (document.invoiceSnapshot) {
        document.invoiceSnapshot.status = "sent";
      }
    }

    for (const document of Array.from(documents.values())) {
      if (!document.contractSnapshot && !document.invoiceSnapshot) {
        attachSnapshots(document);
      }
      if (document.lines && document.lines.length === 0) {
        document.lines = [];
      }
      const payload = document.payload as { sourceRows?: unknown[] };
      if (!payload.sourceRows) {
        payload.sourceRows = [];
      }
    }

    const documentIds = await seedBcCommercialDocuments(Array.from(documents.values()), runId);

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
