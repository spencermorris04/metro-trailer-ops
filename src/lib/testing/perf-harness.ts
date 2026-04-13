import { performance } from "node:perf_hooks";

export type SyntheticFleetConfig = {
  branchCount: number;
  assetCount: number;
  contractCount: number;
  invoiceCount: number;
  dispatchTaskCount: number;
};

export type SyntheticFleetDataset = {
  branches: string[];
  assets: Array<{
    assetNumber: string;
    branchId: string;
    status: "available" | "reserved" | "on_rent" | "maintenance";
    customerNumber: string | null;
  }>;
  contracts: Array<{
    contractNumber: string;
    branchId: string;
    customerNumber: string;
    status: "quoted" | "reserved" | "active" | "completed";
  }>;
  invoices: Array<{
    invoiceNumber: string;
    branchId: string;
    customerNumber: string;
    status: "draft" | "sent" | "paid" | "overdue";
    balanceAmount: number;
  }>;
  dispatchTasks: Array<{
    id: string;
    branchId: string;
    status: "scheduled" | "en_route" | "completed";
  }>;
};

export type PerformanceBenchmarkResult = {
  name: string;
  durationMs: number;
  budgetMs: number;
  pass: boolean;
};

const defaultBudgets = {
  assetAvailabilitySearch: 120,
  contractLookup: 90,
  invoiceAging: 100,
  dispatchBoard: 75,
} as const;

function round(value: number) {
  return Number(value.toFixed(2));
}

export function generateSyntheticFleet(config: SyntheticFleetConfig): SyntheticFleetDataset {
  const branches = Array.from({ length: config.branchCount }, (_, index) =>
    `BR-${String(index + 1).padStart(2, "0")}`,
  );

  const assets: SyntheticFleetDataset["assets"] = Array.from(
    { length: config.assetCount },
    (_, index) => {
    const branchId = branches[index % branches.length] ?? "BR-01";
    const statusIndex = index % 8;
    const status: SyntheticFleetDataset["assets"][number]["status"] =
      statusIndex < 4
        ? "available"
        : statusIndex < 6
          ? "reserved"
          : statusIndex === 6
            ? "on_rent"
            : "maintenance";

    return {
      assetNumber: `TR-${String(index + 1).padStart(6, "0")}`,
      branchId,
      status,
      customerNumber:
        index % 3 === 0
          ? `CUST-${String((index % 4000) + 1).padStart(5, "0")}`
          : null,
    };
    },
  );

  const contracts: SyntheticFleetDataset["contracts"] = Array.from(
    { length: config.contractCount },
    (_, index) => {
    const branchId = branches[index % branches.length] ?? "BR-01";
    const statusIndex = index % 5;
    const status: SyntheticFleetDataset["contracts"][number]["status"] =
      statusIndex === 0
        ? "quoted"
        : statusIndex === 1
          ? "reserved"
          : statusIndex < 4
            ? "active"
            : "completed";

    return {
      contractNumber: `CTR-${String(index + 1).padStart(6, "0")}`,
      branchId,
      customerNumber: `CUST-${String((index % 4000) + 1).padStart(5, "0")}`,
      status,
    };
    },
  );

  const invoices: SyntheticFleetDataset["invoices"] = Array.from(
    { length: config.invoiceCount },
    (_, index) => {
    const branchId = branches[index % branches.length] ?? "BR-01";
    const statusIndex = index % 4;
    const status: SyntheticFleetDataset["invoices"][number]["status"] =
      statusIndex === 0
        ? "draft"
        : statusIndex === 1
          ? "sent"
          : statusIndex === 2
            ? "paid"
            : "overdue";

    return {
      invoiceNumber: `INV-${String(index + 1).padStart(6, "0")}`,
      branchId,
      customerNumber: `CUST-${String((index % 4000) + 1).padStart(5, "0")}`,
      status,
      balanceAmount: statusIndex === 2 ? 0 : Number(((index % 37) + 1) * 25),
    };
    },
  );

  const dispatchTasks: SyntheticFleetDataset["dispatchTasks"] = Array.from(
    { length: config.dispatchTaskCount },
    (_, index) => {
      const branchId = branches[index % branches.length] ?? "BR-01";
      const status: SyntheticFleetDataset["dispatchTasks"][number]["status"] =
        index % 4 === 0 ? "scheduled" : index % 4 === 1 ? "en_route" : "completed";
      return {
        id: `DSP-${String(index + 1).padStart(6, "0")}`,
        branchId,
        status,
      };
    },
  );

  return {
    branches,
    assets,
    contracts,
    invoices,
    dispatchTasks,
  };
}

function benchmark(name: string, budgetMs: number, action: () => void): PerformanceBenchmarkResult {
  const start = performance.now();
  action();
  const durationMs = round(performance.now() - start);

  return {
    name,
    durationMs,
    budgetMs,
    pass: durationMs <= budgetMs,
  };
}

export function runSyntheticBenchmarks(dataset: SyntheticFleetDataset) {
  const targetBranch = dataset.branches[0] ?? "BR-01";
  const targetCustomer = dataset.contracts[0]?.customerNumber ?? "CUST-00001";

  return [
    benchmark("assetAvailabilitySearch", defaultBudgets.assetAvailabilitySearch, () => {
      dataset.assets
        .filter((asset) => asset.branchId === targetBranch && asset.status === "available")
        .slice(0, 250);
    }),
    benchmark("contractLookup", defaultBudgets.contractLookup, () => {
      dataset.contracts.filter(
        (contract) =>
          contract.branchId === targetBranch && contract.customerNumber === targetCustomer,
      );
    }),
    benchmark("invoiceAging", defaultBudgets.invoiceAging, () => {
      dataset.invoices.filter(
        (invoice) => invoice.status === "overdue" && invoice.balanceAmount > 0,
      );
    }),
    benchmark("dispatchBoard", defaultBudgets.dispatchBoard, () => {
      dataset.dispatchTasks.filter((task) => task.branchId === targetBranch);
    }),
  ];
}

export function summarizeBenchmarkResults(results: PerformanceBenchmarkResult[]) {
  return {
    pass: results.every((result) => result.pass),
    maxDurationMs: round(Math.max(...results.map((result) => result.durationMs))),
    results,
  };
}
