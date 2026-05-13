import { pool } from "@/lib/db";
import { numericToNumber, toIso } from "@/lib/server/production-utils";

export type ReportPeriodKey =
  | "this_month"
  | "last_month"
  | "quarter"
  | "ytd"
  | "trailing_12"
  | "custom";

export type RevenueGroupBy =
  | "month"
  | "branch"
  | "equipment"
  | "customer"
  | "lease"
  | "deal_code";

export type ReportPeriodInput = {
  period?: string;
  start?: string;
  end?: string;
};

export type PagedReportInput = ReportPeriodInput & {
  q?: string;
  page?: number;
  pageSize?: number;
};

export type ReportPeriod = {
  key: ReportPeriodKey;
  label: string;
  start: string;
  end: string;
  comparisonStart: string;
  comparisonEnd: string;
};

type SqlValue = string | number | boolean | Date | null;

const PERIOD_LABELS: Record<ReportPeriodKey, string> = {
  this_month: "This month",
  last_month: "Last month",
  quarter: "This quarter",
  ytd: "Year to date",
  trailing_12: "Trailing 12 months",
  custom: "Custom",
};

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addMonths(date: Date, months: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function parseDateParam(value: string | undefined) {
  if (!value) {
    return null;
  }
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function cleanPeriod(value: string | undefined): ReportPeriodKey {
  if (
    value === "last_month" ||
    value === "quarter" ||
    value === "ytd" ||
    value === "trailing_12" ||
    value === "custom"
  ) {
    return value;
  }
  return "this_month";
}

function pageNumber(value: number | undefined) {
  return Math.max(1, Number.isFinite(value ?? NaN) ? value ?? 1 : 1);
}

function pageSizeNumber(value: number | undefined, fallback = 50) {
  return Math.min(100, Math.max(1, Number.isFinite(value ?? NaN) ? value ?? fallback : fallback));
}

function likePattern(value: string) {
  return `%${value.trim().replace(/[%_]/g, "\\$&")}%`;
}

export function resolveReportPeriod(input: ReportPeriodInput = {}): ReportPeriod {
  const now = startOfUtcDay(new Date());
  const currentMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const currentMonthEnd = addMonths(currentMonthStart, 1);
  const key = cleanPeriod(input.period);
  let start = currentMonthStart;
  let end = currentMonthEnd;

  if (key === "last_month") {
    end = currentMonthStart;
    start = addMonths(currentMonthStart, -1);
  } else if (key === "quarter") {
    const quarterStartMonth = Math.floor(now.getUTCMonth() / 3) * 3;
    start = new Date(Date.UTC(now.getUTCFullYear(), quarterStartMonth, 1));
    end = addMonths(start, 3);
  } else if (key === "ytd") {
    start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    end = addDays(now, 1);
  } else if (key === "trailing_12") {
    start = addMonths(currentMonthStart, -11);
    end = currentMonthEnd;
  } else if (key === "custom") {
    start = parseDateParam(input.start) ?? currentMonthStart;
    end = addDays(parseDateParam(input.end) ?? addDays(currentMonthEnd, -1), 1);
    if (end <= start) {
      end = addDays(start, 1);
    }
  }

  const lengthMs = end.getTime() - start.getTime();
  const comparisonEnd = new Date(start);
  const comparisonStart = new Date(start.getTime() - lengthMs);

  return {
    key,
    label: PERIOD_LABELS[key],
    start: isoDate(start),
    end: isoDate(end),
    comparisonStart: isoDate(comparisonStart),
    comparisonEnd: isoDate(comparisonEnd),
  };
}

export function buildPeriodHref(path: string, period: ReportPeriod, overrides: Record<string, string | undefined> = {}) {
  const params = new URLSearchParams();
  params.set("period", period.key);
  if (period.key === "custom") {
    params.set("start", period.start);
    params.set("end", isoDate(addDays(new Date(`${period.end}T00:00:00.000Z`), -1)));
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (value) {
      params.set(key, value);
    }
  }
  return `${path}?${params.toString()}`;
}

async function latestRefreshState() {
  const result = await pool.query<{
    id: string;
    status: string;
    started_at: Date | null;
    finished_at: Date | null;
    error_message: string | null;
  }>(
    `
      select id, status, started_at, finished_at, error_message
      from read_model_refresh_runs
      order by started_at desc
      limit 1
    `,
  );
  return result.rows[0] ?? null;
}

async function latestGlImportState() {
  const [runResult, countResult] = await Promise.all([
    pool.query<{
      id: string;
      entity_type: string;
      status: string;
      records_seen: number;
      records_inserted: number;
      records_failed: number;
      updated_at: Date;
    }>(
      `
        select id, entity_type, status, records_seen, records_inserted, records_failed, updated_at
        from bc_import_runs
        where entity_type ilike '%gl%'
        order by started_at desc
        limit 1
      `,
    ),
    getTableEstimates(["bc_gl_entries"]),
  ]);

  return {
    latestRun: runResult.rows[0] ?? null,
    rowCount: countResult.get("bc_gl_entries") ?? 0,
  };
}

async function importCoverage() {
  const estimates = await getTableEstimates([
    "rental_billing_facts",
    "rental_invoice_facts",
    "ar_ledger_facts",
    "bc_gl_entries",
  ]);
  return {
    rentalBillingFacts: estimates.get("rental_billing_facts") ?? 0,
    rentalInvoiceFacts: estimates.get("rental_invoice_facts") ?? 0,
    arLedgerFacts: estimates.get("ar_ledger_facts") ?? 0,
    bcGlEntries: estimates.get("bc_gl_entries") ?? 0,
  };
}

async function getTableEstimates(tableNames: string[]) {
  const result = await pool.query<{
    relname: string;
    estimated_rows: string;
  }>(
    `
      select
        c.relname,
        greatest(
          0,
          coalesce(nullif(s.n_live_tup, 0), nullif(c.reltuples, -1), 0)
        )::bigint as estimated_rows
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      left join pg_stat_all_tables s on s.relid = c.oid
      where n.nspname = 'public'
        and c.relname = any($1::text[])
    `,
    [tableNames],
  );
  return new Map(result.rows.map((row) => [row.relname, Number(row.estimated_rows)]));
}

export async function getAccountingDashboardView(input: ReportPeriodInput = {}) {
  const period = resolveReportPeriod(input);
  const params = [period.start, period.end, period.comparisonStart, period.comparisonEnd];
  const [
    revenueResult,
    comparisonResult,
    invoiceResult,
    arResult,
    branchResult,
    agingResult,
    refreshState,
    glImport,
    coverage,
    importErrorsResult,
  ] = await Promise.all([
    pool.query<{
      gross_revenue: string | null;
      tax_amount: string | null;
      damage_waiver_amount: string | null;
      invoice_count: string;
      credit_memo_count: string;
      equipment_count: string;
      line_count: string;
    }>(
      `
        select
          coalesce(sum(gross_amount), 0)::numeric(18,2) as gross_revenue,
          coalesce(sum(tax_amount), 0)::numeric(18,2) as tax_amount,
          coalesce(sum(damage_waiver_amount), 0)::numeric(18,2) as damage_waiver_amount,
          count(distinct document_no)::bigint as invoice_count,
          count(distinct document_no) filter (where document_type ilike '%credit%')::bigint as credit_memo_count,
          count(distinct asset_number) filter (where asset_number is not null)::bigint as equipment_count,
          count(*)::bigint as line_count
        from rental_billing_facts
        where posting_date >= $1::date and posting_date < $2::date
      `,
      [period.start, period.end],
    ),
    pool.query<{ gross_revenue: string | null }>(
      `
        select coalesce(sum(gross_amount), 0)::numeric(18,2) as gross_revenue
        from rental_billing_facts
        where posting_date >= $1::date and posting_date < $2::date
      `,
      [period.comparisonStart, period.comparisonEnd],
    ),
    pool.query<{
      invoice_count: string;
      total_amount: string | null;
    }>(
      `
        select
          count(*)::bigint as invoice_count,
          coalesce(sum(total_amount), 0)::numeric(18,2) as total_amount
        from rental_invoice_facts
        where posting_date >= $1::date and posting_date < $2::date
      `,
      [period.start, period.end],
    ),
    pool.query<{
      open_ar_balance: string | null;
      open_invoice_count: string;
    }>(
      `
        select
          coalesce(sum(ar_balance), 0)::numeric(18,2) as open_ar_balance,
          coalesce(sum(open_invoice_count), 0)::bigint as open_invoice_count
        from ar_customer_summary
      `,
    ),
    pool.query<{
      branch_code: string;
      gross_revenue: string | null;
      invoice_count: string;
      line_count: string;
    }>(
      `
        select
          coalesce(branch_code, 'Unassigned') as branch_code,
          coalesce(sum(gross_amount), 0)::numeric(18,2) as gross_revenue,
          count(distinct document_no)::bigint as invoice_count,
          count(*)::bigint as line_count
        from rental_billing_facts
        where posting_date >= $1::date and posting_date < $2::date
        group by coalesce(branch_code, 'Unassigned')
        order by coalesce(sum(gross_amount), 0) desc
        limit 8
      `,
      [period.start, period.end],
    ),
    pool.query<{
      bucket: string;
      balance: string | null;
      entry_count: string;
    }>(
      `
        select bucket, balance, entry_count
        from ar_aging_snapshot
        where bucket = 'Open'
      `,
    ),
    latestRefreshState(),
    latestGlImportState(),
    importCoverage(),
    pool.query<{ count: string }>(
      "select count(*)::bigint as count from bc_import_errors where resolved_at is null",
    ),
  ]);

  const revenue = revenueResult.rows[0];
  const comparisonRevenue = numericToNumber(comparisonResult.rows[0]?.gross_revenue);
  const currentRevenue = numericToNumber(revenue?.gross_revenue);
  const revenueDelta =
    comparisonRevenue === 0 ? null : ((currentRevenue - comparisonRevenue) / comparisonRevenue) * 100;

  return {
    period,
    metrics: {
      grossRevenue: currentRevenue,
      comparisonGrossRevenue: comparisonRevenue,
      revenueDeltaPercent: revenueDelta,
      taxAmount: numericToNumber(revenue?.tax_amount),
      damageWaiverAmount: numericToNumber(revenue?.damage_waiver_amount),
      invoiceCount: Number(revenue?.invoice_count ?? invoiceResult.rows[0]?.invoice_count ?? 0),
      creditMemoCount: Number(revenue?.credit_memo_count ?? 0),
      equipmentCount: Number(revenue?.equipment_count ?? 0),
      lineCount: Number(revenue?.line_count ?? 0),
      invoiceTotal: numericToNumber(invoiceResult.rows[0]?.total_amount),
      openArBalance: numericToNumber(arResult.rows[0]?.open_ar_balance),
      overdueArBalance: 0,
      openArInvoices: Number(arResult.rows[0]?.open_invoice_count ?? 0),
      overdueArInvoices: 0,
      unappliedReceipts: 0,
      unappliedReceiptCount: 0,
      unresolvedImportErrors: Number(importErrorsResult.rows[0]?.count ?? 0),
    },
    arAging: agingResult.rows.map((row) => ({
      bucket: row.bucket,
      balance: numericToNumber(row.balance),
      entryCount: Number(row.entry_count),
    })),
    topBranches: branchResult.rows.map((row) => ({
      branchCode: row.branch_code,
      grossRevenue: numericToNumber(row.gross_revenue),
      invoiceCount: Number(row.invoice_count),
      lineCount: Number(row.line_count),
    })),
    refreshState: refreshState
      ? {
          id: refreshState.id,
          status: refreshState.status,
          startedAt: toIso(refreshState.started_at),
          finishedAt: toIso(refreshState.finished_at),
          errorMessage: refreshState.error_message,
        }
      : null,
    glImport: {
      rowCount: glImport.rowCount,
      latestRun: glImport.latestRun
        ? {
            id: glImport.latestRun.id,
            entityType: glImport.latestRun.entity_type,
            status: glImport.latestRun.status,
            recordsSeen: glImport.latestRun.records_seen,
            recordsInserted: glImport.latestRun.records_inserted,
            recordsFailed: glImport.latestRun.records_failed,
            updatedAt: toIso(glImport.latestRun.updated_at),
          }
        : null,
    },
    coverage,
  };
}

function revenueGroupExpression(groupBy: RevenueGroupBy) {
  if (groupBy === "branch") {
    return {
      key: "coalesce(branch_code, 'Unassigned')",
      label: "coalesce(branch_code, 'Unassigned')",
      hrefType: "branch",
    };
  }
  if (groupBy === "equipment") {
    return {
      key: "coalesce(asset_number, 'Unassigned')",
      label: "concat_ws(' / ', coalesce(asset_number, 'Unassigned'), max(asset_type))",
      hrefType: "equipment",
    };
  }
  if (groupBy === "customer") {
    return {
      key: "coalesce(customer_number, 'Unassigned')",
      label: "concat_ws(' / ', coalesce(customer_number, 'Unassigned'), max(customer_name))",
      hrefType: "customer",
    };
  }
  if (groupBy === "lease") {
    return {
      key: "coalesce(lease_key, 'Unassigned')",
      label: "coalesce(lease_key, 'Unassigned')",
      hrefType: "lease",
    };
  }
  if (groupBy === "deal_code") {
    return {
      key: "coalesce(deal_code, 'Unassigned')",
      label: "coalesce(deal_code, 'Unassigned')",
      hrefType: "deal_code",
    };
  }
  return {
    key: "to_char(date_trunc('month', posting_date), 'YYYY-MM')",
    label: "to_char(date_trunc('month', posting_date), 'YYYY-MM')",
    hrefType: "month",
  };
}

export async function getRevenueReportView(
  input: PagedReportInput & { groupBy?: string } = {},
) {
  const period = resolveReportPeriod(input);
  const groupBy: RevenueGroupBy =
    input.groupBy === "branch" ||
    input.groupBy === "equipment" ||
    input.groupBy === "customer" ||
    input.groupBy === "lease" ||
    input.groupBy === "deal_code"
      ? input.groupBy
      : "month";
  const page = pageNumber(input.page);
  const pageSize = pageSizeNumber(input.pageSize);
  const offset = (page - 1) * pageSize;
  const group = revenueGroupExpression(groupBy);
  const filters = ["posting_date >= $1::date", "posting_date < $2::date"];
  const params: SqlValue[] = [period.start, period.end];
  if (input.q?.trim()) {
    params.push(likePattern(input.q));
    filters.push(
      `(search_text ilike $${params.length} escape '\\' or document_no ilike $${params.length} escape '\\')`,
    );
  }
  const where = filters.join(" and ");

  const [rowsResult, totalResult, summaryResult] = await Promise.all([
    pool.query<{
      group_key: string;
      label: string;
      gross_revenue: string | null;
      tax_amount: string | null;
      damage_waiver_amount: string | null;
      invoice_count: string;
      equipment_count: string;
      line_count: string;
    }>(
      `
        select
          ${group.key} as group_key,
          ${group.label} as label,
          coalesce(sum(gross_amount), 0)::numeric(18,2) as gross_revenue,
          coalesce(sum(tax_amount), 0)::numeric(18,2) as tax_amount,
          coalesce(sum(damage_waiver_amount), 0)::numeric(18,2) as damage_waiver_amount,
          count(distinct document_no)::bigint as invoice_count,
          count(distinct asset_number) filter (where asset_number is not null)::bigint as equipment_count,
          count(*)::bigint as line_count
        from rental_billing_facts
        where ${where}
        group by ${group.key}
        order by coalesce(sum(gross_amount), 0) desc
        limit $${params.length + 1} offset $${params.length + 2}
      `,
      [...params, pageSize, offset],
    ),
    pool.query<{ count: string }>(
      `
        select count(*)::bigint as count
        from (
          select ${group.key}
          from rental_billing_facts
          where ${where}
          group by ${group.key}
        ) grouped
      `,
      params,
    ),
    pool.query<{
      gross_revenue: string | null;
      invoice_count: string;
      line_count: string;
    }>(
      `
        select
          coalesce(sum(gross_amount), 0)::numeric(18,2) as gross_revenue,
          count(distinct document_no)::bigint as invoice_count,
          count(*)::bigint as line_count
        from rental_billing_facts
        where ${where}
      `,
      params,
    ),
  ]);

  return {
    period,
    groupBy,
    page,
    pageSize,
    total: Number(totalResult.rows[0]?.count ?? 0),
    summary: {
      grossRevenue: numericToNumber(summaryResult.rows[0]?.gross_revenue),
      invoiceCount: Number(summaryResult.rows[0]?.invoice_count ?? 0),
      lineCount: Number(summaryResult.rows[0]?.line_count ?? 0),
    },
    data: rowsResult.rows.map((row) => ({
      groupKey: row.group_key,
      label: row.label,
      hrefType: group.hrefType,
      grossRevenue: numericToNumber(row.gross_revenue),
      taxAmount: numericToNumber(row.tax_amount),
      damageWaiverAmount: numericToNumber(row.damage_waiver_amount),
      invoiceCount: Number(row.invoice_count),
      equipmentCount: Number(row.equipment_count),
      lineCount: Number(row.line_count),
    })),
    refreshState: await latestRefreshState(),
  };
}

export async function getInvoiceReportView(input: PagedReportInput & {
  status?: string;
  customerNumber?: string;
  leaseKey?: string;
  source?: string;
} = {}) {
  const period = resolveReportPeriod(input);
  const page = pageNumber(input.page);
  const pageSize = pageSizeNumber(input.pageSize);
  const offset = (page - 1) * pageSize;
  const filters = ["posting_date >= $1::date", "posting_date < $2::date"];
  const params: SqlValue[] = [period.start, period.end];
  if (input.status?.trim()) {
    params.push(input.status);
    filters.push(`status = $${params.length}`);
  }
  if (input.customerNumber?.trim()) {
    params.push(input.customerNumber.trim());
    filters.push(`customer_number = $${params.length}`);
  }
  if (input.leaseKey?.trim()) {
    params.push(input.leaseKey.trim());
    filters.push(`lease_key = $${params.length}`);
  }
  if (input.source?.trim()) {
    params.push(input.source.trim());
    filters.push(`source_provider = $${params.length}`);
  }
  if (input.q?.trim()) {
    params.push(likePattern(input.q));
    filters.push(`search_text ilike $${params.length} escape '\\'`);
  }
  const where = filters.join(" and ");
  const [rowsResult, countResult, summaryResult] = await Promise.all([
    pool.query<{
      id: string;
      document_no: string;
      source_provider: string;
      customer_number: string | null;
      customer_name: string | null;
      lease_key: string | null;
      posting_date: Date | null;
      due_date: Date | null;
      status: string;
      line_count: number;
      fixed_asset_line_count: number;
      equipment_count: number;
      total_amount: string;
      ar_balance: string | null;
    }>(
      `
        select id, document_no, source_provider, customer_number, customer_name, lease_key,
               posting_date, due_date, status, line_count, fixed_asset_line_count,
               equipment_count, total_amount, ar_balance
        from rental_invoice_facts
        where ${where}
        order by posting_date desc nulls last, document_no desc
        limit $${params.length + 1} offset $${params.length + 2}
      `,
      [...params, pageSize, offset],
    ),
    pool.query<{ count: string }>(
      `select count(*)::bigint as count from rental_invoice_facts where ${where}`,
      params,
    ),
    pool.query<{
      total_amount: string | null;
      open_balance: string | null;
      invoice_count: string;
    }>(
      `
        select
          coalesce(sum(total_amount), 0)::numeric(18,2) as total_amount,
          coalesce(sum(ar_balance), 0)::numeric(18,2) as open_balance,
          count(*)::bigint as invoice_count
        from rental_invoice_facts
        where ${where}
      `,
      params,
    ),
  ]);

  return {
    period,
    page,
    pageSize,
    total: Number(countResult.rows[0]?.count ?? 0),
    summary: {
      invoiceCount: Number(summaryResult.rows[0]?.invoice_count ?? 0),
      totalAmount: numericToNumber(summaryResult.rows[0]?.total_amount),
      openBalance: numericToNumber(summaryResult.rows[0]?.open_balance),
    },
    data: rowsResult.rows.map((row) => ({
      id: row.id,
      invoiceNumber: row.document_no,
      sourceProvider: row.source_provider,
      customerNumber: row.customer_number,
      customerName: row.customer_name,
      leaseKey: row.lease_key,
      postingDate: toIso(row.posting_date),
      dueDate: toIso(row.due_date),
      status: row.status,
      lineCount: row.line_count,
      fixedAssetLineCount: row.fixed_asset_line_count,
      equipmentCount: row.equipment_count,
      totalAmount: numericToNumber(row.total_amount),
      arBalance: row.ar_balance == null ? null : numericToNumber(row.ar_balance),
    })),
    refreshState: await latestRefreshState(),
  };
}

export async function getArAgingReportView(input: {
  bucket?: string;
  customerNumber?: string;
  q?: string;
  page?: number;
  pageSize?: number;
} = {}) {
  const page = pageNumber(input.page);
  const pageSize = pageSizeNumber(input.pageSize);
  const offset = (page - 1) * pageSize;
  const bucketSql = `
    case
      when due_date is null or due_date >= current_date then 'Current'
      when current_date - due_date::date <= 30 then '1-30'
      when current_date - due_date::date <= 60 then '31-60'
      when current_date - due_date::date <= 90 then '61-90'
      else '90+'
    end
  `;
  const filters = ["is_open", "remaining_amount > 0"];
  const params: SqlValue[] = [];
  if (input.bucket && input.bucket !== "overdue") {
    params.push(input.bucket);
    filters.push(`${bucketSql} = $${params.length}`);
  } else if (input.bucket === "overdue") {
    filters.push("due_date < current_date");
  }
  if (input.customerNumber?.trim()) {
    params.push(input.customerNumber.trim());
    filters.push(`customer_number = $${params.length}`);
  }
  if (input.q?.trim()) {
    params.push(likePattern(input.q));
    filters.push(`search_text ilike $${params.length} escape '\\'`);
  }
  const where = filters.join(" and ");

  const [rowsResult, countResult, summaryResult, bucketsResult] = await Promise.all([
    pool.query<{
      id: string;
      bucket: string;
      customer_number: string | null;
      customer_name: string | null;
      document_no: string | null;
      document_type: string | null;
      posting_date: Date | null;
      due_date: Date | null;
      remaining_amount: string;
      amount: string;
    }>(
      `
        select id, ${bucketSql} as bucket, customer_number, customer_name, document_no,
               document_type, posting_date, due_date, remaining_amount, amount
        from ar_ledger_facts
        where ${where}
        order by due_date asc nulls last, remaining_amount desc
        limit $${params.length + 1} offset $${params.length + 2}
      `,
      [...params, pageSize, offset],
    ),
    pool.query<{ count: string }>(
      `select count(*)::bigint as count from ar_ledger_facts where ${where}`,
      params,
    ),
    pool.query<{ balance: string | null; entry_count: string }>(
      `
        select coalesce(sum(remaining_amount), 0)::numeric(18,2) as balance, count(*)::bigint as entry_count
        from ar_ledger_facts
        where ${where}
      `,
      params,
    ),
    pool.query<{ bucket: string; balance: string | null; entry_count: string }>(
      `
        select ${bucketSql} as bucket,
               coalesce(sum(remaining_amount), 0)::numeric(18,2) as balance,
               count(*)::bigint as entry_count
        from ar_ledger_facts
        where is_open and remaining_amount > 0
        group by ${bucketSql}
        order by case ${bucketSql} when 'Current' then 0 when '1-30' then 1 when '31-60' then 2 when '61-90' then 3 else 4 end
      `,
    ),
  ]);

  return {
    page,
    pageSize,
    total: Number(countResult.rows[0]?.count ?? 0),
    summary: {
      balance: numericToNumber(summaryResult.rows[0]?.balance),
      entryCount: Number(summaryResult.rows[0]?.entry_count ?? 0),
    },
    buckets: bucketsResult.rows.map((row) => ({
      bucket: row.bucket,
      balance: numericToNumber(row.balance),
      entryCount: Number(row.entry_count),
    })),
    data: rowsResult.rows.map((row) => ({
      id: row.id,
      bucket: row.bucket,
      customerNumber: row.customer_number,
      customerName: row.customer_name,
      documentNo: row.document_no,
      documentType: row.document_type,
      postingDate: toIso(row.posting_date),
      dueDate: toIso(row.due_date),
      remainingAmount: numericToNumber(row.remaining_amount),
      amount: numericToNumber(row.amount),
    })),
    refreshState: await latestRefreshState(),
  };
}

async function groupedReport(
  table: "equipment" | "customer" | "branch" | "deal_code",
  input: PagedReportInput = {},
) {
  const period = resolveReportPeriod(input);
  const page = pageNumber(input.page);
  const pageSize = pageSizeNumber(input.pageSize);
  const offset = (page - 1) * pageSize;
  const config = {
    equipment: {
      table: "equipment_revenue_rollup_monthly",
      key: "asset_number",
      label: "asset_number",
      count: "line_count",
      extra: "0::integer as secondary_count",
    },
    customer: {
      table: "customer_revenue_rollup_monthly",
      key: "customer_number",
      label: "customer_number",
      count: "invoice_count",
      extra: "sum(equipment_count)::integer as secondary_count",
    },
    branch: {
      table: "branch_revenue_rollup_monthly",
      key: "branch_code",
      label: "branch_code",
      count: "line_count",
      extra: "sum(invoice_count)::integer as secondary_count",
    },
    deal_code: {
      table: "deal_code_revenue_rollup_monthly",
      key: "deal_code",
      label: "deal_code",
      count: "line_count",
      extra: "sum(invoice_count)::integer as secondary_count",
    },
  }[table];
  const filters = ["month >= $1::date", "month < $2::date"];
  const params: SqlValue[] = [period.start, period.end];
  if (input.q?.trim()) {
    params.push(likePattern(input.q));
    filters.push(`${config.key} ilike $${params.length} escape '\\'`);
  }
  const where = filters.join(" and ");
  const [rowsResult, countResult, summaryResult] = await Promise.all([
    pool.query<{
      group_key: string;
      label: string;
      gross_revenue: string | null;
      invoice_count: string;
      line_count: string;
      secondary_count: number;
    }>(
      `
        select
          ${config.key} as group_key,
          ${config.label} as label,
          coalesce(sum(gross_revenue), 0)::numeric(18,2) as gross_revenue,
          coalesce(sum(invoice_count), 0)::bigint as invoice_count,
          coalesce(sum(${config.count}), 0)::bigint as line_count,
          ${config.extra}
        from ${config.table}
        where ${where}
        group by ${config.key}
        order by coalesce(sum(gross_revenue), 0) desc
        limit $${params.length + 1} offset $${params.length + 2}
      `,
      [...params, pageSize, offset],
    ),
    pool.query<{ count: string }>(
      `
        select count(*)::bigint as count
        from (
          select ${config.key}
          from ${config.table}
          where ${where}
          group by ${config.key}
        ) grouped
      `,
      params,
    ),
    pool.query<{ gross_revenue: string | null; invoice_count: string }>(
      `
        select coalesce(sum(gross_revenue), 0)::numeric(18,2) as gross_revenue,
               coalesce(sum(invoice_count), 0)::bigint as invoice_count
        from ${config.table}
        where ${where}
      `,
      params,
    ),
  ]);

  return {
    period,
    page,
    pageSize,
    total: Number(countResult.rows[0]?.count ?? 0),
    summary: {
      grossRevenue: numericToNumber(summaryResult.rows[0]?.gross_revenue),
      invoiceCount: Number(summaryResult.rows[0]?.invoice_count ?? 0),
    },
    data: rowsResult.rows.map((row) => ({
      groupKey: row.group_key,
      label: row.label,
      grossRevenue: numericToNumber(row.gross_revenue),
      invoiceCount: Number(row.invoice_count),
      lineCount: Number(row.line_count),
      secondaryCount: Number(row.secondary_count ?? 0),
    })),
    refreshState: await latestRefreshState(),
  };
}

export function getEquipmentRevenueReportView(input: PagedReportInput = {}) {
  return groupedReport("equipment", input);
}

export function getCustomerRevenueReportView(input: PagedReportInput = {}) {
  return groupedReport("customer", input);
}

export function getBranchRevenueReportView(input: PagedReportInput = {}) {
  return groupedReport("branch", input);
}

export function getDealCodeRevenueReportView(input: PagedReportInput = {}) {
  return groupedReport("deal_code", input);
}

export async function getGlHistoryReportView(input: PagedReportInput & {
  accountNo?: string;
  documentNo?: string;
} = {}) {
  const period = resolveReportPeriod(input);
  const page = pageNumber(input.page);
  const pageSize = pageSizeNumber(input.pageSize);
  const offset = (page - 1) * pageSize;
  const filters = ["posting_date >= $1::date", "posting_date < $2::date"];
  const params: SqlValue[] = [period.start, period.end];
  if (input.accountNo?.trim()) {
    params.push(input.accountNo.trim());
    filters.push(`account_no = $${params.length}`);
  }
  if (input.documentNo?.trim()) {
    params.push(input.documentNo.trim());
    filters.push(`document_no = $${params.length}`);
  }
  if (input.q?.trim()) {
    params.push(likePattern(input.q));
    filters.push(
      `(document_no ilike $${params.length} escape '\\' or account_no ilike $${params.length} escape '\\' or description ilike $${params.length} escape '\\')`,
    );
  }
  const where = filters.join(" and ");
  const [rowsResult, countResult, summaryResult, glImport] = await Promise.all([
    pool.query<{
      id: string;
      external_entry_no: string;
      posting_date: Date | null;
      document_no: string | null;
      account_no: string | null;
      description: string | null;
      amount: string | null;
      debit_amount: string | null;
      credit_amount: string | null;
      dimension_set_id: string | null;
    }>(
      `
        select id, external_entry_no, posting_date, document_no, account_no, description,
               amount, debit_amount, credit_amount, dimension_set_id
        from bc_gl_entries
        where ${where}
        order by posting_date desc nulls last, external_entry_no desc
        limit $${params.length + 1} offset $${params.length + 2}
      `,
      [...params, pageSize, offset],
    ),
    pool.query<{ count: string }>(
      `select count(*)::bigint as count from bc_gl_entries where ${where}`,
      params,
    ),
    pool.query<{
      debit_amount: string | null;
      credit_amount: string | null;
      net_amount: string | null;
    }>(
      `
        select
          coalesce(sum(debit_amount), 0)::numeric(18,2) as debit_amount,
          coalesce(sum(credit_amount), 0)::numeric(18,2) as credit_amount,
          coalesce(sum(amount), 0)::numeric(18,2) as net_amount
        from bc_gl_entries
        where ${where}
      `,
      params,
    ),
    latestGlImportState(),
  ]);

  return {
    period,
    page,
    pageSize,
    total: Number(countResult.rows[0]?.count ?? 0),
    summary: {
      debitAmount: numericToNumber(summaryResult.rows[0]?.debit_amount),
      creditAmount: numericToNumber(summaryResult.rows[0]?.credit_amount),
      netAmount: numericToNumber(summaryResult.rows[0]?.net_amount),
    },
    glImport,
    data: rowsResult.rows.map((row) => ({
      id: row.id,
      externalEntryNo: row.external_entry_no,
      postingDate: toIso(row.posting_date),
      documentNo: row.document_no,
      accountNo: row.account_no,
      description: row.description,
      amount: numericToNumber(row.amount),
      debitAmount: numericToNumber(row.debit_amount),
      creditAmount: numericToNumber(row.credit_amount),
      dimensionSetId: row.dimension_set_id,
    })),
  };
}

export async function getReconciliationReportView() {
  const [coverage, refreshState, glImport, errorsResult, unmatchedResult] = await Promise.all([
    importCoverage(),
    latestRefreshState(),
    latestGlImportState(),
    pool.query<{
      entity_type: string;
      count: string;
    }>(
      `
        select entity_type, count(*)::bigint as count
        from bc_import_errors
        where resolved_at is null
        group by entity_type
        order by count(*) desc
        limit 20
      `,
    ),
    pool.query<{
      unmatched_customer_invoices: number | null;
      unmatched_asset_lines: number | null;
    }>(
      `
        select
          coalesce((exceptions->>'unmatchedCustomerInvoices')::integer, 0) as unmatched_customer_invoices,
          coalesce((exceptions->>'unmatchedAssetLines')::integer, 0) as unmatched_asset_lines
        from finance_dashboard_snapshot
        where snapshot_key = 'current'
        limit 1
      `,
    ),
  ]);

  return {
    coverage,
    refreshState,
    glImport,
    unresolvedErrorsByEntity: errorsResult.rows.map((row) => ({
      entityType: row.entity_type,
      count: Number(row.count),
    })),
    unmatched: {
      customerInvoices: Number(unmatchedResult.rows[0]?.unmatched_customer_invoices ?? 0),
      assetLines: Number(unmatchedResult.rows[0]?.unmatched_asset_lines ?? 0),
    },
  };
}
