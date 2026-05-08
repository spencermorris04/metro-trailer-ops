import "dotenv/config";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { db, schema } from "../../src/lib/db";
import {
  finishBcImportRun,
  reconcileBcImportRun,
  recordBcImportError,
  seedBcCustomerCards,
  seedBcCommercialDocuments,
  seedBcCustomers,
  seedBcRmiPostedRentalHeaders,
  seedBcRmiPostedRentalInvoiceHeaders,
  seedBcRmiPostedRentalLines,
  seedBcRmiRentalLedgerEntries,
  seedBcSalesDocumentLines,
  seedBcSalesDocuments,
  startBcImportRun,
  type BcCommercialDocumentSeedInput,
  type BcCustomerSeedInput,
  type BcRmiPostedRentalHeaderSeedInput,
  type BcRmiPostedRentalInvoiceHeaderSeedInput,
  type BcRmiPostedRentalLineSeedInput,
  type BcRmiRentalLedgerEntrySeedInput,
  type BcSalesDocumentLineSeedInput,
  type BcSalesDocumentSeedInput,
} from "../../src/lib/server/business-central-import";

type ExportFile<T> = {
  exportedAt: string;
  serviceName: string;
  company: string;
  pages: number;
  records: number;
  items: T[];
};

type CustomerCardRow = Record<string, unknown>;
type SalesDocumentRow = Record<string, unknown>;
type SalesDocumentLineRow = Record<string, unknown>;
type PostedRentalHeaderRow = Record<string, unknown>;
type PostedRentalLineRow = Record<string, unknown>;
type PostedRentalInvoiceRow = Record<string, unknown>;
type RentalLedgerEntryRow = Record<string, unknown>;

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

async function loadExport<T>(segments: string[]) {
  const filePath = path.join(artifactsRoot, ...segments);
  const raw = await readFile(filePath, "utf8");
  return sanitizeValue(JSON.parse(raw) as ExportFile<T>);
}

async function loadFirstExport<T>(candidates: string[][]) {
  const errors: string[] = [];

  for (const segments of candidates) {
    try {
      return await loadExport<T>(segments);
    } catch (error) {
      errors.push(
        `${segments.join("/")}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  throw new Error(`No export file could be loaded:\n${errors.join("\n")}`);
}

function getString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? sanitizeString(value) : "";
}

function getStringAny(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = getString(record, key);
    if (value) return value;
  }
  return "";
}

function getNumber(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
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

function normalizeContractStatus(value: string) {
  const normalized = value.toLowerCase();
  if (normalized.includes("quote")) return "quoted" as const;
  if (normalized.includes("reserve")) return "reserved" as const;
  if (normalized.includes("cancel")) return "cancelled" as const;
  if (normalized.includes("close")) return "closed" as const;
  if (normalized.includes("complete") || normalized.includes("posted")) return "completed" as const;
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

function inferPrimaryBranch(customer: CustomerCardRow) {
  return (
    getStringAny(customer, [
      "Responsibility_Center",
      "Location_Code",
      "Gen_Bus_Posting_Group",
    ]) || "UNASSIGNED"
  );
}

function toCustomerSeed(customer: CustomerCardRow): BcCustomerSeedInput {
  const customerNumber = getString(customer, "No");
  const name = getString(customer, "Name");
  const branchCode = inferPrimaryBranch(customer);

  return {
    externalId: customerNumber,
    customerNumber,
    name,
    customerType: "commercial",
    contactInfo: {
      name: getString(customer, "ContactName") || name,
      email: getString(customer, "E_Mail") || null,
      phone: getString(customer, "Phone_No") || null,
    },
    billingAddress: {
      line1: getString(customer, "Address") || "Unknown",
      line2: getString(customer, "Address_2") || "",
      city: getString(customer, "City") || "Unknown",
      state: getString(customer, "County") || "NA",
      postalCode: getString(customer, "Post_Code") || "00000",
      country: getString(customer, "Country_Region_Code") || "US",
    },
    branchCoverage: branchCode ? [branchCode] : [],
    creditLimit: getNumber(customer, "Credit_Limit_LCY") || null,
    taxExempt: !Boolean(customer["Tax_Liable"]),
    responsibilityCenter: getString(customer, "Responsibility_Center") || null,
    defaultSalesTeam: getString(customer, "RMI_Default_Sales_Team") || null,
    defaultDealCode: getString(customer, "RMI_Default_Deal_Code") || null,
    damageWaiverDeclined:
      typeof customer.RMI_Damage_Waiver_Declined === "boolean"
        ? customer.RMI_Damage_Waiver_Declined
        : null,
    insuranceCertRequired:
      typeof customer.RMI_Insurance_Cert_Required === "boolean"
        ? customer.RMI_Insurance_Cert_Required
        : null,
    insuranceExpirationDate:
      getDateStringAny(customer, ["RMI_Insurance_Expiration_Date"]) ?? null,
    insurancePolicyNo: getString(customer, "RMI_Insurance_Policy_No") || null,
    registrationNumber: getString(customer, "Registration_Number") || null,
    portalEnabled: false,
    locations: [
      {
        externalId: `${customerNumber}:primary`,
        name: `${name} Primary Site`,
        address: {
          line1: getString(customer, "Address") || "Unknown",
          line2: getString(customer, "Address_2") || "",
          city: getString(customer, "City") || "Unknown",
          state: getString(customer, "County") || "NA",
          postalCode: getString(customer, "Post_Code") || "00000",
          country: getString(customer, "Country_Region_Code") || "US",
        },
        contactPerson: {
          name: getString(customer, "ContactName") || name,
          phone: getString(customer, "Phone_No") || null,
          email: getString(customer, "E_Mail") || null,
        },
        isPrimary: true,
        payload: customer,
      },
    ],
    payload: customer,
  };
}

function toCustomerCardRawSeed(customer: CustomerCardRow) {
  return {
    customerNo: getString(customer, "No"),
    name: getString(customer, "Name") || "Unknown Customer",
    customerType: getString(customer, "Customer_Type") || null,
    parentNo: getString(customer, "Parent_No") || null,
    parentName: getString(customer, "Parent_Name") || null,
    blocked: getString(customer, "Blocked") || null,
    responsibilityCenter: getString(customer, "Responsibility_Center") || null,
    salespersonCode: getString(customer, "Salesperson_Code") || null,
    defaultSalesTeam: getString(customer, "RMI_Default_Sales_Team") || null,
    defaultDealCode: getString(customer, "RMI_Default_Deal_Code") || null,
    damageWaiverDeclined: getBooleanAny(customer, ["RMI_Damage_Waiver_Declined"]),
    insuranceCertRequired: getBooleanAny(customer, ["RMI_Insurance_Cert_Required"]),
    insuranceExpirationDate:
      getDateStringAny(customer, ["RMI_Insurance_Expiration_Date"]) ?? null,
    insurancePolicyNo: getString(customer, "RMI_Insurance_Policy_No") || null,
    registrationNumber: getString(customer, "Registration_Number") || null,
    balanceLcy: getNumericValueAny(customer, ["Balance_LCY"]),
    balanceDueLcy: getNumericValueAny(customer, ["Balance_Due_LCY"]),
    creditLimitLcy: getNumericValueAny(customer, ["Credit_Limit_LCY"]),
    payload: customer,
  };
}

function toSalesDocumentRawSeed(row: SalesDocumentRow): BcSalesDocumentSeedInput {
  return {
    externalId: getString(row, "id") || null,
    documentType: getStringAny(row, ["documentType"]) || "sales_document",
    documentNo: getStringAny(row, ["number", "No"]),
    sellToCustomerNo: getStringAny(row, ["sellToCustomerNumber"]) || null,
    billToCustomerNo: getStringAny(row, ["billToCustomerNumber"]) || null,
    status: getString(row, "status") || null,
    orderDate: getDateStringAny(row, ["orderDate"]) ?? null,
    postingDate: getDateStringAny(row, ["postingDate"]) ?? null,
    documentDate: getDateStringAny(row, ["documentDate"]) ?? null,
    dueDate: getDateStringAny(row, ["dueDate"]) ?? null,
    shipmentDate: getDateStringAny(row, ["shipmentDate"]) ?? null,
    locationCode: getString(row, "locationCode") || null,
    shortcutDimension1Code: getString(row, "shortcutDimension1Code") || null,
    shortcutDimension2Code: getString(row, "shortcutDimension2Code") || null,
    amount: getNumericValueAny(row, ["amount"]),
    amountIncludingVat: getNumericValueAny(row, ["amountIncludingVAT", "amountIncludingVat"]),
    dimensionSetId: getIntegerAny(row, ["dimensionSetId", "DimensionSetID"]),
    payload: row,
  };
}

function toSalesDocumentLineRawSeed(
  row: SalesDocumentLineRow,
): BcSalesDocumentLineSeedInput | null {
  const documentType = getStringAny(row, ["documentType"]) || "sales_document";
  const documentNo = getStringAny(row, ["documentNumber", "documentNo"]);
  const lineNo = getIntegerAny(row, ["lineNumber", "lineNo"]);
  if (!documentNo || lineNo === null) return null;

  return {
    documentType,
    documentNo,
    lineNo,
    sellToCustomerNo: getString(row, "sellToCustomerNumber") || null,
    type: getString(row, "type") || null,
    itemNo: getStringAny(row, ["number", "itemNo"]) || null,
    description: getString(row, "description") || null,
    quantity: getNumericValueAny(row, ["quantity"]),
    outstandingQuantity: getNumericValueAny(row, ["outstandingQuantity"]),
    qtyToInvoice: getNumericValueAny(row, ["qtyToInvoice"]),
    unitPrice: getNumericValueAny(row, ["unitPrice"]),
    amount: getNumericValueAny(row, ["amount"]),
    lineAmount: getNumericValueAny(row, ["lineAmount"]),
    amountIncludingVat: getNumericValueAny(row, ["amountIncludingVat", "amountIncludingVAT"]),
    locationCode: getString(row, "locationCode") || null,
    shipmentDate: getDateStringAny(row, ["shipmentDate"]) ?? null,
    requestedDeliveryDate: getDateStringAny(row, ["requestedDeliveryDate"]) ?? null,
    plannedDeliveryDate: getDateStringAny(row, ["plannedDeliveryDate"]) ?? null,
    shortcutDimension1Code: getString(row, "shortcutDimension1Code") || null,
    shortcutDimension2Code: getString(row, "shortcutDimension2Code") || null,
    dimensionSetId: getIntegerAny(row, ["dimensionSetId", "DimensionSetID"]),
    payload: row,
  };
}

function toPostedRentalHeaderRawSeed(
  row: PostedRentalHeaderRow,
): BcRmiPostedRentalHeaderSeedInput {
  return {
    externalId: getString(row, "id") || null,
    documentType: getStringAny(row, ["DocumentType", "Document_Type"]) || "Posted Invoice",
    documentNo: getStringAny(row, ["No", "DocumentNo"]),
    previousDocType: getString(row, "PreviousDocType") || null,
    previousNo: getString(row, "PreviousNo") || null,
    sellToCustomerNo: getString(row, "SelltoCustomerNo") || null,
    billToCustomerNo: getString(row, "BilltoCustomerNo") || null,
    shipToCode: getString(row, "ShiptoCode") || getString(row, "Code") || null,
    postingDate: getDateStringAny(row, ["PostingDate"]) ?? null,
    orderDate: getDateStringAny(row, ["OrderDate"]) ?? null,
    selectThruDate: getDateStringAny(row, ["SelectThruDate"]) ?? null,
    documentDate: getDateStringAny(row, ["DocumentDate"]) ?? null,
    dueDate: getDateStringAny(row, ["DueDate"]) ?? null,
    shipmentDate: getDateStringAny(row, ["ShipmentDate"]) ?? null,
    returnDate: getDateStringAny(row, ["ReturnDate"]) ?? null,
    locationCode: getString(row, "LocationCode") || null,
    responsibilityCenter: getStringAny(row, ["ResponsibilityCenter", "Responsibility_Center"]) || null,
    shortcutDimension1Code: getString(row, "ShortcutDimension1Code") || null,
    shortcutDimension2Code: getString(row, "ShortcutDimension2Code") || null,
    status: getString(row, "Status") || null,
    sourceCode: getString(row, "SourceCode") || null,
    externalDocumentNo: getString(row, "ExternalDocumentNo") || null,
    dimensionSetId: getIntegerAny(row, ["DimensionSetID", "dimensionSetId"]),
    payload: row,
  };
}

function toPostedRentalLineRawSeed(
  row: PostedRentalLineRow,
): BcRmiPostedRentalLineSeedInput | null {
  const documentType = getString(row, "DocumentType") || "Posted Invoice";
  const documentNo = getString(row, "DocumentNo");
  const lineNo = getIntegerAny(row, ["LineNo"]);
  if (!documentNo || lineNo === null) return null;

  return {
    externalId: getString(row, "id") || null,
    documentType,
    documentNo,
    lineNo,
    sequenceNo: getIntegerAny(row, ["SequenceNo"]),
    lineType: getString(row, "LineType") || null,
    type: getString(row, "Type") || null,
    itemNo: getString(row, "No") || null,
    description: getString(row, "Description") || null,
    quantity: getNumericValueAny(row, ["Quantity"]),
    unitOfMeasureCode: getString(row, "UnitOfMeasureCode") || null,
    unitPrice: getNumericValueAny(row, ["UnitPrice"]),
    grossAmount: getNumericValueAny(row, ["GrossAmount", "LineAmount"]),
    grossAmountLcy: getNumericValueAny(row, ["GrossAmountLCY"]),
    lineDiscountAmount: getNumericValueAny(row, ["LineDiscountAmount"]),
    invoiceDiscountAmount: getNumericValueAny(row, ["InvoiceDiscountAmount"]),
    taxAmount: getNumericValueAny(row, ["TaxAmount"]),
    damageWaiverAmount: getNumericValueAny(row, ["DamageWaiverAmount"]),
    fromDate: getDateStringAny(row, ["FromDate"]) ?? null,
    thruDate: getDateStringAny(row, ["ThruDate"]) ?? null,
    invoiceFromDate: getDateStringAny(row, ["InvoiceFromDate", "FromDate"]) ?? null,
    invoiceThruDate: getDateStringAny(row, ["InvoiceThruDate", "InvoicedThruDate", "ThruDate"]) ?? null,
    shipmentDate: getDateStringAny(row, ["ShipmentDate"]) ?? null,
    returnDate: getDateStringAny(row, ["ReturnDate"]) ?? null,
    postingDate: getDateStringAny(row, ["PostingDate", "FAPostingDate"]) ?? null,
    previousDocType: getString(row, "PreviousDocType") || null,
    previousNo: getString(row, "PreviousNo") || null,
    dealCode: getString(row, "DealCode") || null,
    dealLength: getNumericValueAny(row, ["DealLength"]),
    billingFor: getString(row, "BillingFor") || null,
    locationCode: getString(row, "LocationCode") || null,
    shortcutDimension1Code: getString(row, "ShortcutDimension1Code") || null,
    shortcutDimension2Code: getString(row, "ShortcutDimension2Code") || null,
    taxGroupCode: getString(row, "TaxGroupCode") || null,
    dimensionSetId: getIntegerAny(row, ["DimensionSetID"]),
    payload: row,
  };
}

function toRentalLedgerRawSeed(
  row: RentalLedgerEntryRow,
): BcRmiRentalLedgerEntrySeedInput | null {
  const entryNo = getString(row, "EntryNo") || String(row.EntryNo ?? "");
  if (!entryNo) return null;

  return {
    externalEntryNo: entryNo,
    documentType: getString(row, "DocumentType") || null,
    documentNo: getString(row, "DocumentNo") || null,
    orderNo: getString(row, "OrderNo") || null,
    postingDate: getDateStringAny(row, ["PostingDate"]) ?? null,
    billToCustomerNo: getString(row, "BilltoCustomerNo") || null,
    typeOrdered: getString(row, "TypeOrdered") || null,
    noOrdered: getString(row, "NoOrdered") || null,
    typeShipped: getString(row, "TypeShipped") || null,
    noShipped: getString(row, "NoShipped") || null,
    serialNoShipped: getString(row, "SerialNoShipped") || null,
    quantity: getNumericValueAny(row, ["Quantity"]),
    fromDate: getDateStringAny(row, ["FromDate"]) ?? null,
    thruDate: getDateStringAny(row, ["ThruDate"]) ?? null,
    rentalDays: getNumericValueAny(row, ["RentalDays"]),
    unitPrice: getNumericValueAny(row, ["UnitPrice"]),
    grossAmount: getNumericValueAny(row, ["GrossAmount"]),
    grossAmountLcy: getNumericValueAny(row, ["GrossAmountLCY"]),
    lineDiscountAmount: getNumericValueAny(row, ["LineDiscountAmount"]),
    invoiceDiscountAmount: getNumericValueAny(row, ["InvoiceDiscountAmount"]),
    dealCode: getString(row, "DealCode") || null,
    shortcutDimension1Code: getString(row, "ShortcutDimension1Code") || null,
    shortcutDimension2Code: getString(row, "ShortcutDimension2Code") || null,
    payload: row,
  };
}

function toPostedRentalInvoiceHeaderRawSeed(
  row: PostedRentalInvoiceRow,
): BcRmiPostedRentalInvoiceHeaderSeedInput {
  return {
    documentType: getStringAny(row, ["Document_Type", "DocumentType"]) || "Posted Invoice",
    documentNo: getString(row, "No"),
    previousDocType: getString(row, "PreviousDocType") || null,
    previousNo: getString(row, "PreviousNo") || null,
    sellToCustomerNo: getString(row, "SelltoCustomerNo") || null,
    billToCustomerNo: getString(row, "BilltoCustomerNo") || null,
    postingDate: getDateStringAny(row, ["PostingDate"]) ?? null,
    documentDate: getDateStringAny(row, ["DocumentDate"]) ?? null,
    dueDate: getDateStringAny(row, ["DueDate"]) ?? null,
    locationCode: getString(row, "LocationCode") || null,
    responsibilityCenter: getString(row, "ResponsibilityCenter") || null,
    shortcutDimension1Code: getString(row, "ShortcutDimension1Code") || null,
    shortcutDimension2Code: getString(row, "ShortcutDimension2Code") || null,
    externalDocumentNo: getString(row, "ExternalDocumentNo") || null,
    payload: row,
  };
}

function main() {
  return run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

async function run() {
  const runId = await startBcImportRun({
    entityType: "commercial_seed",
    jobVersion: "bc-seed-commercial-db:v1",
    metadata: {
      source: "artifacts/business-central/commercial-live",
    },
  });

  const summary: Record<string, unknown> = {
    runId,
    startedAt: new Date().toISOString(),
  };

  try {
    console.log("[1/6] Loading exported BC commercial datasets...");

    const [
      customerCardExport,
      salesDocumentExport,
      salesDocumentLineExport,
      postedRentalHeaderExport,
      postedRentalLineExport,
      postedRentalInvoiceExport,
      rentalLedgerExport,
      wsRentalLedgerExport,
    ] = await Promise.all([
      loadFirstExport<CustomerCardRow>([
        ["rmi-permission-probe-2", "customers", "customer-card.json"],
        ["customers", "customer-card.json"],
        ["commercial-seed", "customers", "customer-card.json"],
      ]),
      loadFirstExport<SalesDocumentRow>([
        ["rmi-permission-probe-2", "orders", "sales-documents.json"],
        ["commercial-live", "orders", "sales-documents.json"],
        ["commercial-seed", "orders", "sales-documents.json"],
      ]),
      loadFirstExport<SalesDocumentLineRow>([
        ["rmi-permission-probe-2", "orders", "sales-document-lines.json"],
        ["commercial-live", "orders", "sales-document-lines.json"],
        ["commercial-seed", "orders", "sales-document-lines.json"],
      ]),
      loadFirstExport<PostedRentalHeaderRow>([
        ["rmi-permission-probe-2", "rentals", "posted-rental-header.json"],
      ]),
      loadFirstExport<PostedRentalLineRow>([
        ["rmi-permission-probe-2", "rentals", "posted-rental-line.json"],
      ]),
      loadFirstExport<PostedRentalInvoiceRow>([
        ["commercial-live", "rentals", "posted-rental-invoice.json"],
        ["rmi-permission-probe-2", "rentals", "posted-rental-invoice.json"],
      ]),
      loadFirstExport<RentalLedgerEntryRow>([
        ["commercial-live", "rentals", "rental-ledger-entries.json"],
        ["rmi-permission-probe-2", "rentals", "rental-ledger-entries.json"],
      ]),
      loadFirstExport<RentalLedgerEntryRow>([
        ["rmi-permission-probe-2", "rentals", "ws-rental-ledger-entries.json"],
      ]),
    ]);

    const referencedCustomerNumbers = new Set<string>();
    for (const row of salesDocumentExport.items) {
      const customerNo =
        getStringAny(row, ["sellToCustomerNumber", "billToCustomerNumber"]) || "";
      if (customerNo) referencedCustomerNumbers.add(customerNo);
    }
    for (const row of postedRentalInvoiceExport.items) {
      const customerNo =
        getStringAny(row, ["BilltoCustomerNo", "SelltoCustomerNo"]) || "";
      if (customerNo) referencedCustomerNumbers.add(customerNo);
    }
    for (const row of postedRentalHeaderExport.items) {
      const customerNo =
        getStringAny(row, ["BilltoCustomerNo", "SelltoCustomerNo"]) || "";
      if (customerNo) referencedCustomerNumbers.add(customerNo);
    }

    console.log("[2/6] Landing typed raw BC/RMI tables...");

    const customerCardSeeds = customerCardExport.items
      .map((row) => toCustomerCardRawSeed(row))
      .filter((row) => row.customerNo);
    const postedRentalHeaderSeeds = postedRentalHeaderExport.items
      .map((row) => toPostedRentalHeaderRawSeed(row))
      .filter((row) => row.documentNo);
    const postedRentalLineSeeds = postedRentalLineExport.items
      .map((row) => toPostedRentalLineRawSeed(row))
      .filter((row): row is BcRmiPostedRentalLineSeedInput => Boolean(row));
    const rentalLedgerSeeds = [
      ...rentalLedgerExport.items,
      ...wsRentalLedgerExport.items,
    ]
      .map((row) => toRentalLedgerRawSeed(row))
      .filter((row): row is BcRmiRentalLedgerEntrySeedInput => Boolean(row));
    const postedRentalInvoiceHeaderSeeds = postedRentalInvoiceExport.items
      .map((row) => toPostedRentalInvoiceHeaderRawSeed(row))
      .filter((row) => row.documentNo);
    const salesDocumentSeeds = salesDocumentExport.items
      .map((row) => toSalesDocumentRawSeed(row))
      .filter((row) => row.documentNo);
    const salesDocumentLineSeeds = salesDocumentLineExport.items
      .map((row) => toSalesDocumentLineRawSeed(row))
      .filter((row): row is BcSalesDocumentLineSeedInput => Boolean(row));

    await Promise.all([
      seedBcCustomerCards(customerCardSeeds, runId),
      seedBcRmiPostedRentalHeaders(postedRentalHeaderSeeds, runId),
      seedBcRmiPostedRentalLines(postedRentalLineSeeds, runId),
      seedBcRmiRentalLedgerEntries(rentalLedgerSeeds, runId),
      seedBcRmiPostedRentalInvoiceHeaders(postedRentalInvoiceHeaderSeeds, runId),
      seedBcSalesDocuments(salesDocumentSeeds, runId),
      seedBcSalesDocumentLines(salesDocumentLineSeeds, runId),
    ]);

    console.log(
      `[3/6] Seeding customer masters and default locations for ${referencedCustomerNumbers.size} referenced customers...`,
    );

    const selectedCustomerCards = customerCardExport.items.filter((row) =>
      referencedCustomerNumbers.has(getString(row, "No")),
    );
    const customerSeeds = selectedCustomerCards.map((row) => toCustomerSeed(row));
    await seedBcCustomers(customerSeeds);

    const seededCustomersRows = await db
      .select({
        id: schema.customers.id,
        customerNumber: schema.customers.customerNumber,
        branchCoverage: schema.customers.branchCoverage,
      })
      .from(schema.customers);
    const seededLocationsRows = await db
      .select({
        id: schema.customerLocations.id,
        customerId: schema.customerLocations.customerId,
        isPrimary: schema.customerLocations.isPrimary,
      })
      .from(schema.customerLocations);
    const branchesRows = await db
      .select({
        id: schema.branches.id,
        code: schema.branches.code,
      })
      .from(schema.branches);
    const assetRows = await db
      .select({
        id: schema.assets.id,
        assetNumber: schema.assets.assetNumber,
        branchId: schema.assets.branchId,
      })
      .from(schema.assets);

    const branchIdByCode = new Map(branchesRows.map((branch) => [branch.code, branch.id]));
    const assetByNumber = new Map(
      assetRows.map((asset) => [asset.assetNumber, asset]),
    );
    const primaryLocationByCustomerId = new Map<string, string>();
    for (const location of seededLocationsRows) {
      if (location.isPrimary || !primaryLocationByCustomerId.has(location.customerId)) {
        primaryLocationByCustomerId.set(location.customerId, location.id);
      }
    }

    const customerIndex = new Map(
      seededCustomersRows.map((customer) => [
        customer.customerNumber,
        {
          customerId: customer.id,
          locationId: primaryLocationByCustomerId.get(customer.id) ?? null,
          branchCode: customer.branchCoverage[0] ?? "UNASSIGNED",
          branchId:
            branchIdByCode.get(customer.branchCoverage[0] ?? "UNASSIGNED") ?? null,
        },
      ]),
    );

    const seededCustomers = customerSeeds.length;

    console.log("[4/6] Building contract documents from BC sales documents...");

    const salesDocumentLinesByDoc = new Map<string, SalesDocumentLineRow[]>();
    for (const row of salesDocumentLineExport.items) {
      const documentNo = getStringAny(row, ["documentNumber", "documentNo"]);
      if (!documentNo) continue;
      const lines = salesDocumentLinesByDoc.get(documentNo) ?? [];
      lines.push(row);
      salesDocumentLinesByDoc.set(documentNo, lines);
    }

    const commercialDocuments: BcCommercialDocumentSeedInput[] = [];

    for (const header of salesDocumentExport.items) {
      const documentNo = getStringAny(header, ["number", "No"]);
      if (!documentNo) continue;
      const customerNo =
        getStringAny(header, ["sellToCustomerNumber", "billToCustomerNumber"]) || "";
      const customer = customerIndex.get(customerNo);
      if (!customer?.locationId || !customer.branchId) continue;

      const lines = (salesDocumentLinesByDoc.get(documentNo) ?? []).map((line) => {
        const itemNo = getStringAny(line, ["number", "itemId"]) || null;
        const asset = itemNo ? assetByNumber.get(itemNo) : null;

        return {
          externalLineId: `${documentNo}:${String(line.lineNumber ?? line.sequence ?? 0)}`,
          lineNo:
            typeof line.lineNumber === "number"
              ? Number(line.lineNumber)
              : typeof line.sequence === "number"
                ? Number(line.sequence)
                : null,
          itemNo,
          uomCode: getStringAny(line, ["unitOfMeasureCode", "unitOfMeasure"]) || null,
          quantity: getNumericValueAny(line, ["quantity"]),
          unitPrice: getNumericValueAny(line, ["unitPrice"]),
          lineAmount: getNumericValueAny(line, ["lineAmount", "amount"]),
          assetId: asset?.id ?? null,
          lineKind: inferContractLineKind(line),
          sourceLineType: getString(line, "type") || null,
          sourceSequenceNo: getIntegerAny(line, ["sequence", "lineNumber"]),
          invoiceFromDate: getDateStringAny(line, ["shipmentDate"]) ?? null,
          invoiceThruDate: getDateStringAny(line, ["shipmentDate"]) ?? null,
          shipmentDate: getDateStringAny(line, ["shipmentDate"]) ?? null,
          taxGroupCode: getString(line, "taxGroupCode") || null,
          serviceBranchId:
            asset?.branchId ??
            branchIdByCode.get(getString(line, "shortcutDimension1Code")) ??
            branchIdByCode.get(getString(line, "locationCode")) ??
            customer.branchId,
          serviceLocationCode: getString(line, "locationCode") || null,
          customerLocationId: customer.locationId,
          legacyOrderNo: documentNo,
          revenueRecognitionBasis: inferRevenueRecognitionBasis(line),
          payload: line,
        };
      });

      commercialDocuments.push({
        externalDocumentId: documentNo,
        documentType: getStringAny(header, ["documentType"]) || "sales_document",
        documentNo,
        customerExternalId: customerNo,
        status: getStringAny(header, ["status"]) || null,
        documentDate:
          getDateStringAny(header, ["documentDate", "orderDate", "shipmentDate"]) ?? null,
        dueDate: getDateStringAny(header, ["dueDate"]) ?? null,
        payload: header,
        lines,
        contractSnapshot: {
          contractNumber: documentNo,
          customerId: customer.customerId,
          locationId: customer.locationId,
          branchId: customer.branchId,
          agreementKind:
            getStringAny(header, ["documentType"]).toLowerCase().includes("quote")
              ? "quote"
              : "rental_order",
          legacySourceSystem: "business_central",
          legacyDocumentNo: documentNo,
          serviceBranchId: customer.branchId,
          serviceLocationCode: getString(header, "locationCode") || null,
          agreementState: getStringAny(header, ["documentType", "status"]) || null,
          importCompleteness: lines.length > 0 ? "lines_complete" : "header_only",
          legacyOpenedAt: new Date(
            getDateStringAny(header, ["orderDate", "documentDate", "shipmentDate"]) ??
              new Date().toISOString(),
          ),
          startDate: new Date(
            getDateStringAny(header, ["documentDate", "orderDate", "shipmentDate"]) ??
              new Date().toISOString(),
          ),
          endDate: null,
          status: normalizeContractStatus(getStringAny(header, ["documentType", "status"])),
          notes: `Seeded from BC sales document ${documentNo}`,
        },
      });
    }

    console.log(
      `[5/6] Building invoice documents from ${postedRentalInvoiceExport.items.length} posted rental invoice headers, ${postedRentalLineExport.items.length} posted rental lines, and ${rentalLedgerExport.items.length + wsRentalLedgerExport.items.length} rental ledger lines...`,
    );

    const rentalLedgerByDocument = new Map<string, RentalLedgerEntryRow[]>();
    for (const row of rentalLedgerExport.items) {
      const documentNo = getStringAny(row, ["DocumentNo"]);
      if (!documentNo) continue;
      const lines = rentalLedgerByDocument.get(documentNo) ?? [];
      lines.push(row);
      rentalLedgerByDocument.set(documentNo, lines);
    }
    for (const row of wsRentalLedgerExport.items) {
      const documentNo = getStringAny(row, ["DocumentNo"]);
      if (!documentNo) continue;
      const lines = rentalLedgerByDocument.get(documentNo) ?? [];
      lines.push(row);
      rentalLedgerByDocument.set(documentNo, lines);
    }

    const postedRentalLinesByDoc = new Map<string, PostedRentalLineRow[]>();
    for (const row of postedRentalLineExport.items) {
      const documentNo = getStringAny(row, ["DocumentNo"]);
      if (!documentNo) continue;
      const lines = postedRentalLinesByDoc.get(documentNo) ?? [];
      lines.push(row);
      postedRentalLinesByDoc.set(documentNo, lines);
    }

    let invoiceDocumentsBuilt = 0;
    for (const header of postedRentalInvoiceExport.items) {
      const documentNo = getStringAny(header, ["No"]);
      if (!documentNo) continue;
      const customerNo =
        getStringAny(header, ["BilltoCustomerNo", "SelltoCustomerNo"]) || "";
      const customer = customerIndex.get(customerNo);
      if (!customer?.locationId || !customer.branchId) continue;

      const postedLines = postedRentalLinesByDoc.get(documentNo) ?? [];
      const ledgerLines = rentalLedgerByDocument.get(documentNo) ?? [];
      const sourceLines = postedLines.length > 0 ? postedLines : ledgerLines;
      if (sourceLines.length === 0) {
        continue;
      }

      const lines = sourceLines.map((line, index) => {
        const isPostedLine = "LineNo" in line;
        const itemNo = getStringAny(line, isPostedLine ? ["No"] : ["NoOrdered", "NoShipped"]) || null;
        const asset = itemNo ? assetByNumber.get(itemNo) : null;
        const lineNo =
          getIntegerAny(line, isPostedLine ? ["LineNo"] : ["EntryNo"]) ?? index + 1;
        const previousNo = getStringAny(line, ["PreviousNo", "OrderNo"]) || getString(header, "PreviousNo") || null;

        return {
          externalLineId: `${documentNo}:${String(lineNo)}`,
          lineNo,
          itemNo,
          uomCode: getStringAny(line, ["UnitOfMeasureCode", "UnitOfMeasure"]) || null,
          quantity: getNumericValueAny(line, ["Quantity"]),
          unitPrice: getNumericValueAny(line, ["UnitPrice"]),
          lineAmount: getNumericValueAny(line, ["GrossAmount", "GrossAmountLCY", "LineAmount"]),
          assetId: asset?.id ?? null,
          lineKind: inferContractLineKind(line),
          sourceLineType:
            getStringAny(line, ["LineType", "TypeOrdered", "TypeShipped", "Type"]) || null,
          sourceSequenceNo: getIntegerAny(line, ["SequenceNo", "EntryNo"]),
          sourceDealCode: getStringAny(line, ["DealCode"]) || null,
          sourceDealLength: getNumericValueAny(line, ["DealLength", "RentalDays"]),
          billingFor: getString(line, "BillingFor") || null,
          invoiceFromDate: getDateStringAny(line, ["InvoiceFromDate", "FromDate"]) ?? null,
          invoiceThruDate:
            getDateStringAny(line, ["InvoiceThruDate", "InvoicedThruDate", "ThruDate"]) ??
            null,
          shipmentDate: getDateStringAny(line, ["ShipmentDate"]) ?? null,
          returnDate: getDateStringAny(line, ["ReturnDate"]) ?? null,
          taxGroupCode: getString(line, "TaxGroupCode") || null,
          legacyPostingDate:
            getDateStringAny(line, ["PostingDate", "FAPostingDate"]) ??
            getDateStringAny(header, ["PostingDate"]) ??
            null,
          serviceBranchId:
            asset?.branchId ??
            branchIdByCode.get(getString(line, "ShortcutDimension1Code")) ??
            branchIdByCode.get(getString(line, "LocationCode")) ??
            customer.branchId,
          serviceLocationCode: getString(line, "LocationCode") || getString(header, "LocationCode") || null,
          customerLocationId: customer.locationId,
          legacyOrderNo: previousNo,
          legacyInvoiceNo: documentNo,
          revenueRecognitionBasis: inferRevenueRecognitionBasis(line),
          payload: line,
        };
      });

      const subtotal = lines.reduce(
        (sum, line) => sum + Number(line.lineAmount ?? 0),
        0,
      );

      commercialDocuments.push({
        externalDocumentId: documentNo,
        documentType: "posted_rental_invoice",
        documentNo,
        customerExternalId: customerNo,
        status: "Posted",
        documentDate:
          getDateStringAny(header, ["DocumentDate", "PostingDate"]) ?? null,
        dueDate: getDateStringAny(header, ["DueDate"]) ?? null,
        payload: header,
        lines,
        contractSnapshot: getString(header, "PreviousNo")
          ? {
              contractNumber: getString(header, "PreviousNo"),
              customerId: customer.customerId,
              locationId: customer.locationId,
              branchId: customer.branchId,
              agreementKind: "legacy_posted_invoice",
              legacySourceSystem: "business_central",
              legacyDocumentNo: getString(header, "PreviousNo"),
              legacyPreviousDocumentNo: getString(header, "PreviousNo"),
              legacyPreviousDocumentType: getString(header, "PreviousDocType") || null,
              serviceBranchId: customer.branchId,
              serviceLocationCode: getString(header, "LocationCode") || null,
              agreementState: "posted_history",
              importCompleteness:
                postedLines.length > 0 ? "lines_complete" : "ledger_complete",
              legacyOpenedAt: new Date(
                getDateStringAny(header, ["PostingDate", "DocumentDate"]) ??
                  new Date().toISOString(),
              ),
              postedAt: new Date(
                getDateStringAny(header, ["PostingDate", "DocumentDate"]) ??
                  new Date().toISOString(),
              ),
              startDate: new Date(
                getDateStringAny(header, ["DocumentDate", "PostingDate"]) ??
                  new Date().toISOString(),
              ),
              endDate: null,
              status: "completed",
              notes: `Seeded from BC posted rental invoice ${documentNo}`,
            }
          : undefined,
        invoiceSnapshot: {
          invoiceNumber: documentNo,
          customerId: customer.customerId,
          invoiceDate: new Date(
            getDateStringAny(header, ["DocumentDate", "PostingDate"]) ??
              new Date().toISOString(),
          ),
          dueDate: new Date(
            getDateStringAny(header, ["DueDate", "DocumentDate", "PostingDate"]) ??
              new Date().toISOString(),
          ),
          status: normalizeInvoiceStatus("Posted"),
          legacyInvoiceNo: documentNo,
          legacyOrderNo: getString(header, "PreviousNo") || null,
          invoiceSourceKind: "bc_posted_rental",
          importCompleteness:
            postedLines.length > 0 ? "lines_complete" : "ledger_complete",
          postingDate: new Date(
            getDateStringAny(header, ["PostingDate", "DocumentDate"]) ??
              new Date().toISOString(),
          ),
          responsibilityCenter: getString(header, "ResponsibilityCenter") || null,
          dimensionSetId: getIntegerAny(header, ["DimensionSetID"]),
          subtotalAmount: subtotal.toFixed(2),
          taxAmount: "0.00",
          totalAmount: subtotal.toFixed(2),
          balanceAmount: subtotal.toFixed(2),
        },
      });
      invoiceDocumentsBuilt += 1;
    }

    console.log(
      `[6/6] Writing ${commercialDocuments.length} commercial documents into the app schema...`,
    );

    const documentIds = await seedBcCommercialDocuments(commercialDocuments, runId);

    const reconciliation = await reconcileBcImportRun(runId);
    summary.completedAt = new Date().toISOString();
    summary.referencedCustomerCount = referencedCustomerNumbers.size;
    summary.seededCustomerCount = seededCustomers;
    summary.rawCustomerCardCount = customerCardSeeds.length;
    summary.rawPostedRentalHeaderCount = postedRentalHeaderSeeds.length;
    summary.rawPostedRentalLineCount = postedRentalLineSeeds.length;
    summary.rawRentalLedgerEntryCount = rentalLedgerSeeds.length;
    summary.rawPostedRentalInvoiceHeaderCount = postedRentalInvoiceHeaderSeeds.length;
    summary.rawSalesDocumentCount = salesDocumentSeeds.length;
    summary.rawSalesDocumentLineCount = salesDocumentLineSeeds.length;
    summary.commercialDocumentCount = commercialDocuments.length;
    summary.invoiceDocumentCount = invoiceDocumentsBuilt;
    summary.reconciliation = reconciliation;

    await finishBcImportRun({
      runId,
      status: "succeeded",
      recordsSeen:
        selectedCustomerCards.length +
        salesDocumentExport.items.length +
        salesDocumentLineExport.items.length +
        postedRentalHeaderExport.items.length +
        postedRentalLineExport.items.length +
        postedRentalInvoiceExport.items.length +
        rentalLedgerExport.items.length +
        wsRentalLedgerExport.items.length,
      recordsInserted: seededCustomers + documentIds.length,
      recordsUpdated: 0,
      recordsSkipped: 0,
      recordsFailed: 0,
      metadata: summary,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await recordBcImportError({
      runId,
      entityType: "commercial_seed",
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
      path.join(outputDir, `bc-commercial-seed-summary-${runId}.json`),
      JSON.stringify(summary, null, 2),
      "utf8",
    );
  }
}

function getNumberAny(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = getNumber(record, key);
    if (value) return value;
  }
  return 0;
}

function getNumericValueAny(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() !== "") return value.trim();
  }
  return null;
}

function getIntegerAny(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isInteger(value)) return value;
    if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number.parseInt(value.trim(), 10);
      if (Number.isInteger(parsed)) return parsed;
    }
  }
  return null;
}

function getBooleanAny(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (["true", "yes", "1"].includes(normalized)) return true;
      if (["false", "no", "0"].includes(normalized)) return false;
    }
  }
  return null;
}

function inferContractLineKind(record: Record<string, unknown>) {
  const haystack = `${getStringAny(record, [
    "LineType",
    "type",
    "Type",
    "postingGroup",
    "GenProdPostingGroup",
  ])} ${getStringAny(record, ["number", "No", "description", "Description"])}`.toUpperCase();

  if (haystack.includes("DELIVERY")) return "delivery" as const;
  if (haystack.includes("PICKUP")) return "pickup" as const;
  if (haystack.includes("DAMAGE")) return "damage_waiver" as const;
  if (haystack.includes("TAX")) return "tax" as const;
  if (haystack.includes("CREDIT") || haystack.includes("DISCOUNT")) {
    return "credit" as const;
  }
  if (haystack.includes("SALE")) return "sale" as const;
  if (haystack.includes("BUYOUT")) return "buyout" as const;
  if (haystack.includes("LEASE")) return "lease" as const;
  if (haystack.includes("RESOURCE")) return "resource" as const;
  if (haystack.includes("SERVICE") || haystack.includes("FEE")) return "service" as const;

  return "rental" as const;
}

function inferRevenueRecognitionBasis(record: Record<string, unknown>) {
  const kind = inferContractLineKind(record);
  if (kind === "tax") return "tax" as const;
  if (kind === "damage_waiver") return "damage" as const;
  if (kind === "credit") return "credit" as const;
  if (kind === "delivery" || kind === "pickup" || kind === "service" || kind === "resource") {
    return "one_time" as const;
  }
  if (kind === "buyout" || kind === "sale") return "buyout" as const;

  return "rental_period" as const;
}

void main();
