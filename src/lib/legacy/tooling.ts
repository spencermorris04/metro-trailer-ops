export type LegacyFlatRecord = Record<string, string>;

export type LegacyImportBundle = {
  assets: LegacyFlatRecord[];
  customers: LegacyFlatRecord[];
  contracts: LegacyFlatRecord[];
  contractLines: LegacyFlatRecord[];
  invoices: LegacyFlatRecord[];
  invoiceLines: LegacyFlatRecord[];
};

export type NormalizedLegacyAsset = {
  legacyId: string;
  assetNumber: string;
  branchCode: string;
  status: string;
  gpsDeviceId: string | null;
  maintenanceStatus: string | null;
};

export type NormalizedLegacyCustomer = {
  legacyId: string;
  customerNumber: string;
  name: string;
  customerType: string;
  billingCity: string | null;
};

export type NormalizedLegacyContract = {
  legacyId: string;
  contractNumber: string;
  customerNumber: string;
  branchCode: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  open: boolean;
};

export type NormalizedLegacyInvoice = {
  legacyId: string;
  invoiceNumber: string;
  contractNumber: string | null;
  customerNumber: string;
  status: string;
  totalAmount: number;
  balanceAmount: number;
  open: boolean;
};

export type NormalizedLegacySnapshot = {
  assets: NormalizedLegacyAsset[];
  customers: NormalizedLegacyCustomer[];
  contracts: NormalizedLegacyContract[];
  invoices: NormalizedLegacyInvoice[];
  summary: {
    assetCount: number;
    customerCount: number;
    contractCount: number;
    openContractCount: number;
    invoiceCount: number;
    openInvoiceCount: number;
    invoiceTotalAmount: number;
    invoiceBalanceAmount: number;
  };
};

export type ParitySnapshot = {
  assets: Array<{ assetNumber: string; branchCode?: string | null; status?: string | null }>;
  contracts: Array<{
    contractNumber: string;
    customerNumber?: string | null;
    status?: string | null;
    open?: boolean | null;
  }>;
  invoices: Array<{
    invoiceNumber: string;
    customerNumber?: string | null;
    totalAmount?: number | null;
    balanceAmount?: number | null;
    open?: boolean | null;
  }>;
};

export type ParityReport = {
  generatedAt: string;
  counts: {
    assets: { legacy: number; production: number; delta: number };
    openContracts: { legacy: number; production: number; delta: number };
    invoices: { legacy: number; production: number; delta: number };
    openInvoices: { legacy: number; production: number; delta: number };
  };
  balances: {
    invoiceTotalAmount: { legacy: number; production: number; delta: number };
    invoiceBalanceAmount: { legacy: number; production: number; delta: number };
  };
  samples: {
    missingAssetsInProduction: string[];
    missingContractsInProduction: string[];
    missingInvoicesInProduction: string[];
  };
  pass: boolean;
};

const aliasMap = {
  legacyId: ["id", "legacy_id", "legacyid", "no.", "document_no", "number"],
  assetNumber: ["asset_number", "unit_number", "trailer_number", "number", "no.", "asset no."],
  branchCode: ["branch_code", "branch", "location_code", "branch_id", "location"],
  status: ["status", "state", "document_status"],
  gpsDeviceId: ["gps_device_id", "skybitz_device_id", "device_id"],
  maintenanceStatus: ["maintenance_status", "service_status"],
  customerNumber: ["customer_number", "customer_no", "customer no.", "customer_id"],
  customerName: ["name", "customer_name", "customer"],
  customerType: ["customer_type", "type"],
  billingCity: ["billing_city", "city"],
  contractNumber: ["contract_number", "document_no", "contract_no", "reservation_no"],
  startDate: ["start_date", "rental_start", "begin_date", "date_from"],
  endDate: ["end_date", "rental_end", "date_to", "return_date"],
  invoiceNumber: ["invoice_number", "document_no", "invoice_no"],
  totalAmount: ["total_amount", "amount", "invoice_amount", "total"],
  balanceAmount: ["balance_amount", "remaining_amount", "open_amount", "balance"],
} as const;

function normalizeKey(value: string) {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, "_");
}

function findValue(record: LegacyFlatRecord, aliases: readonly string[]) {
  const normalizedEntries = Object.entries(record).map(([key, value]) => [
    normalizeKey(key),
    value,
  ] as const);

  for (const alias of aliases) {
    const normalizedAlias = normalizeKey(alias);
    const match = normalizedEntries.find(([key]) => key === normalizedAlias);
    if (match && String(match[1]).trim().length > 0) {
      return String(match[1]).trim();
    }
  }

  return null;
}

function normalizeStatus(value: string | null) {
  const raw = (value ?? "").trim().toLowerCase();
  if (!raw) {
    return "unknown";
  }
  if (["open", "active", "reserved", "on_rent", "on rent"].includes(raw)) {
    return raw.replace(/\s+/g, "_");
  }
  if (["closed", "complete", "completed"].includes(raw)) {
    return "completed";
  }
  if (["cancelled", "canceled"].includes(raw)) {
    return "cancelled";
  }
  return raw.replace(/\s+/g, "_");
}

function toNumber(value: string | null) {
  if (!value) {
    return 0;
  }
  const normalized = value.replace(/[$,]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toIsoDate(value: string | null) {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
}

function isOpenStatus(status: string) {
  return ["open", "quoted", "reserved", "active", "on_rent", "sent", "overdue"].includes(
    status,
  );
}

export function parseCsv(text: string) {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(current);
      if (row.some((cell) => cell.trim().length > 0)) {
        rows.push(row);
      }
      row = [];
      current = "";
      continue;
    }

    current += char;
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current);
    if (row.some((cell) => cell.trim().length > 0)) {
      rows.push(row);
    }
  }

  if (rows.length === 0) {
    return [];
  }

  const [headerRow, ...dataRows] = rows;
  return dataRows.map((dataRow) => {
    const record: LegacyFlatRecord = {};
    headerRow.forEach((header, index) => {
      record[header] = dataRow[index] ?? "";
    });
    return record;
  });
}

export function normalizeLegacyImport(bundle: LegacyImportBundle): NormalizedLegacySnapshot {
  const assets = bundle.assets.map((record, index) => {
    const assetNumber =
      findValue(record, aliasMap.assetNumber) ?? `LEGACY-ASSET-${index + 1}`;
    const status = normalizeStatus(findValue(record, aliasMap.status));

    return {
      legacyId: findValue(record, aliasMap.legacyId) ?? assetNumber,
      assetNumber,
      branchCode: findValue(record, aliasMap.branchCode) ?? "UNKNOWN",
      status,
      gpsDeviceId: findValue(record, aliasMap.gpsDeviceId),
      maintenanceStatus: findValue(record, aliasMap.maintenanceStatus),
    };
  });

  const customers = bundle.customers.map((record, index) => {
    const customerNumber =
      findValue(record, aliasMap.customerNumber) ?? `LEGACY-CUSTOMER-${index + 1}`;

    return {
      legacyId: findValue(record, aliasMap.legacyId) ?? customerNumber,
      customerNumber,
      name: findValue(record, aliasMap.customerName) ?? customerNumber,
      customerType: normalizeStatus(findValue(record, aliasMap.customerType)),
      billingCity: findValue(record, aliasMap.billingCity),
    };
  });

  const contracts = bundle.contracts.map((record, index) => {
    const contractNumber =
      findValue(record, aliasMap.contractNumber) ?? `LEGACY-CONTRACT-${index + 1}`;
    const status = normalizeStatus(findValue(record, aliasMap.status));

    return {
      legacyId: findValue(record, aliasMap.legacyId) ?? contractNumber,
      contractNumber,
      customerNumber: findValue(record, aliasMap.customerNumber) ?? "UNKNOWN",
      branchCode: findValue(record, aliasMap.branchCode) ?? "UNKNOWN",
      status,
      startDate: toIsoDate(findValue(record, aliasMap.startDate)),
      endDate: toIsoDate(findValue(record, aliasMap.endDate)),
      open: isOpenStatus(status),
    };
  });

  const invoices = bundle.invoices.map((record, index) => {
    const invoiceNumber =
      findValue(record, aliasMap.invoiceNumber) ?? `LEGACY-INVOICE-${index + 1}`;
    const status = normalizeStatus(findValue(record, aliasMap.status));
    const totalAmount = toNumber(findValue(record, aliasMap.totalAmount));
    const balanceAmount = toNumber(findValue(record, aliasMap.balanceAmount));

    return {
      legacyId: findValue(record, aliasMap.legacyId) ?? invoiceNumber,
      invoiceNumber,
      contractNumber: findValue(record, aliasMap.contractNumber),
      customerNumber: findValue(record, aliasMap.customerNumber) ?? "UNKNOWN",
      status,
      totalAmount,
      balanceAmount,
      open: isOpenStatus(status) || balanceAmount > 0,
    };
  });

  return {
    assets,
    customers,
    contracts,
    invoices,
    summary: {
      assetCount: assets.length,
      customerCount: customers.length,
      contractCount: contracts.length,
      openContractCount: contracts.filter((contract) => contract.open).length,
      invoiceCount: invoices.length,
      openInvoiceCount: invoices.filter((invoice) => invoice.open).length,
      invoiceTotalAmount: Number(
        invoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0).toFixed(2),
      ),
      invoiceBalanceAmount: Number(
        invoices.reduce((sum, invoice) => sum + invoice.balanceAmount, 0).toFixed(2),
      ),
    },
  };
}

function roundCurrency(value: number) {
  return Number(value.toFixed(2));
}

function summarizeProduction(snapshot: ParitySnapshot) {
  const openContracts = snapshot.contracts.filter((contract) => contract.open).length;
  const openInvoices = snapshot.invoices.filter((invoice) => invoice.open).length;
  const invoiceTotalAmount = roundCurrency(
    snapshot.invoices.reduce((sum, invoice) => sum + Number(invoice.totalAmount ?? 0), 0),
  );
  const invoiceBalanceAmount = roundCurrency(
    snapshot.invoices.reduce((sum, invoice) => sum + Number(invoice.balanceAmount ?? 0), 0),
  );

  return {
    assetCount: snapshot.assets.length,
    openContractCount: openContracts,
    invoiceCount: snapshot.invoices.length,
    openInvoiceCount: openInvoices,
    invoiceTotalAmount,
    invoiceBalanceAmount,
  };
}

function sampleMissing(source: string[], target: Set<string>) {
  return source.filter((value) => !target.has(value)).slice(0, 25);
}

export function buildParityReport(
  legacySnapshot: NormalizedLegacySnapshot,
  productionSnapshot: ParitySnapshot,
): ParityReport {
  const productionSummary = summarizeProduction(productionSnapshot);
  const productionAssets = new Set(productionSnapshot.assets.map((asset) => asset.assetNumber));
  const productionContracts = new Set(
    productionSnapshot.contracts.map((contract) => contract.contractNumber),
  );
  const productionInvoices = new Set(
    productionSnapshot.invoices.map((invoice) => invoice.invoiceNumber),
  );

  const counts = {
    assets: {
      legacy: legacySnapshot.summary.assetCount,
      production: productionSummary.assetCount,
      delta: productionSummary.assetCount - legacySnapshot.summary.assetCount,
    },
    openContracts: {
      legacy: legacySnapshot.summary.openContractCount,
      production: productionSummary.openContractCount,
      delta: productionSummary.openContractCount - legacySnapshot.summary.openContractCount,
    },
    invoices: {
      legacy: legacySnapshot.summary.invoiceCount,
      production: productionSummary.invoiceCount,
      delta: productionSummary.invoiceCount - legacySnapshot.summary.invoiceCount,
    },
    openInvoices: {
      legacy: legacySnapshot.summary.openInvoiceCount,
      production: productionSummary.openInvoiceCount,
      delta: productionSummary.openInvoiceCount - legacySnapshot.summary.openInvoiceCount,
    },
  };

  const balances = {
    invoiceTotalAmount: {
      legacy: legacySnapshot.summary.invoiceTotalAmount,
      production: productionSummary.invoiceTotalAmount,
      delta: roundCurrency(
        productionSummary.invoiceTotalAmount - legacySnapshot.summary.invoiceTotalAmount,
      ),
    },
    invoiceBalanceAmount: {
      legacy: legacySnapshot.summary.invoiceBalanceAmount,
      production: productionSummary.invoiceBalanceAmount,
      delta: roundCurrency(
        productionSummary.invoiceBalanceAmount - legacySnapshot.summary.invoiceBalanceAmount,
      ),
    },
  };

  const samples = {
    missingAssetsInProduction: sampleMissing(
      legacySnapshot.assets.map((asset) => asset.assetNumber),
      productionAssets,
    ),
    missingContractsInProduction: sampleMissing(
      legacySnapshot.contracts.map((contract) => contract.contractNumber),
      productionContracts,
    ),
    missingInvoicesInProduction: sampleMissing(
      legacySnapshot.invoices.map((invoice) => invoice.invoiceNumber),
      productionInvoices,
    ),
  };

  const pass =
    Object.values(counts).every((entry) => entry.delta === 0) &&
    Object.values(balances).every((entry) => entry.delta === 0) &&
    Object.values(samples).every((entry) => entry.length === 0);

  return {
    generatedAt: new Date().toISOString(),
    counts,
    balances,
    samples,
    pass,
  };
}

export function renderParityReportMarkdown(report: ParityReport) {
  const lines = [
    "# Legacy Reconciliation Report",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "## Counts",
    "",
    "| Metric | Legacy | Production | Delta |",
    "| --- | ---: | ---: | ---: |",
    `| Assets | ${report.counts.assets.legacy} | ${report.counts.assets.production} | ${report.counts.assets.delta} |`,
    `| Open contracts | ${report.counts.openContracts.legacy} | ${report.counts.openContracts.production} | ${report.counts.openContracts.delta} |`,
    `| Invoices | ${report.counts.invoices.legacy} | ${report.counts.invoices.production} | ${report.counts.invoices.delta} |`,
    `| Open invoices | ${report.counts.openInvoices.legacy} | ${report.counts.openInvoices.production} | ${report.counts.openInvoices.delta} |`,
    "",
    "## Balances",
    "",
    "| Metric | Legacy | Production | Delta |",
    "| --- | ---: | ---: | ---: |",
    `| Invoice total amount | ${report.balances.invoiceTotalAmount.legacy.toFixed(2)} | ${report.balances.invoiceTotalAmount.production.toFixed(2)} | ${report.balances.invoiceTotalAmount.delta.toFixed(2)} |`,
    `| Invoice balance amount | ${report.balances.invoiceBalanceAmount.legacy.toFixed(2)} | ${report.balances.invoiceBalanceAmount.production.toFixed(2)} | ${report.balances.invoiceBalanceAmount.delta.toFixed(2)} |`,
    "",
    "## Samples",
    "",
    `- Missing assets in production: ${report.samples.missingAssetsInProduction.join(", ") || "none"}`,
    `- Missing contracts in production: ${report.samples.missingContractsInProduction.join(", ") || "none"}`,
    `- Missing invoices in production: ${report.samples.missingInvoicesInProduction.join(", ") || "none"}`,
    "",
    `Overall pass: ${report.pass ? "yes" : "no"}`,
    "",
  ];

  return lines.join("\n");
}
