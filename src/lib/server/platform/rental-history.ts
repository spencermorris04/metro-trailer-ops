import { pool } from "@/lib/db";
import { numericToNumber, toIso } from "@/lib/server/production-utils";
import {
  getBusinessCentralInvoiceAmount,
  getBusinessCentralInvoiceStatus,
  payloadText,
  readLineImportState,
} from "@/lib/server/rental-history-core";
import { getAssetListView, getContractDetailView } from "@/lib/server/platform/v1";

type SqlValue = string | number | boolean | null;

export type RentalSourceFilter = "all" | "app" | "business_central";

export type PagedRentalFilters = {
  q?: string;
  source?: RentalSourceFilter;
  page?: number;
  pageSize?: number;
};

function pageNumber(value: number | undefined) {
  return Math.max(1, value ?? 1);
}

function pageSizeNumber(value: number | undefined, fallback = 25) {
  return Math.min(100, Math.max(1, value ?? fallback));
}

function sourceFilter(value: RentalSourceFilter | undefined) {
  return value ?? "all";
}

function likePattern(value: string) {
  return `%${value.trim().replace(/[%_]/g, "\\$&")}%`;
}

export { getBusinessCentralInvoiceAmount, getBusinessCentralInvoiceStatus };

async function getLineImportState() {
  const result = await pool.query<{
    checkpoint_data: Record<string, unknown> | null;
  }>(
    `
      select checkpoint_data
      from bc_import_checkpoints
      where entity_type = 'raw:posted-rental-line'
      limit 1
    `,
  );
  return readLineImportState(result.rows[0]?.checkpoint_data ?? null);
}

function buildInvoiceSearchCondition(
  alias: "app" | "bc",
  q: string | undefined,
  params: SqlValue[],
) {
  if (!q?.trim()) {
    return "";
  }
  params.push(likePattern(q));
  const idx = params.length;
  if (alias === "app") {
    return `
      and (
        i.invoice_number ilike $${idx} escape '\\'
        or coalesce(i.legacy_invoice_no, '') ilike $${idx} escape '\\'
        or coalesce(i.legacy_order_no, '') ilike $${idx} escape '\\'
        or cust.customer_number ilike $${idx} escape '\\'
        or cust.name ilike $${idx} escape '\\'
        or coalesce(ct.contract_number, '') ilike $${idx} escape '\\'
      )
    `;
  }
  return `
    and (
      h.document_no ilike $${idx} escape '\\'
      or coalesce(h.previous_no, '') ilike $${idx} escape '\\'
      or coalesce(h.bill_to_customer_no, '') ilike $${idx} escape '\\'
      or coalesce(h.sell_to_customer_no, '') ilike $${idx} escape '\\'
      or coalesce(c.name, '') ilike $${idx} escape '\\'
      or exists (
        select 1
        from bc_rmi_posted_rental_lines l
        where l.document_type = h.document_type
          and l.document_no = h.document_no
          and (
            coalesce(l.item_no, '') ilike $${idx} escape '\\'
            or coalesce(l.description, '') ilike $${idx} escape '\\'
          )
      )
    )
  `;
}

function buildLeaseSearchCondition(
  alias: "app" | "bc",
  q: string | undefined,
  params: SqlValue[],
) {
  if (!q?.trim()) {
    return "";
  }
  params.push(likePattern(q));
  const idx = params.length;
  if (alias === "app") {
    return `
      and (
        ct.contract_number ilike $${idx} escape '\\'
        or cust.customer_number ilike $${idx} escape '\\'
        or cust.name ilike $${idx} escape '\\'
        or coalesce(ct.source_document_no, '') ilike $${idx} escape '\\'
      )
    `;
  }
  return `
    and (
      h.previous_no ilike $${idx} escape '\\'
      or h.document_no ilike $${idx} escape '\\'
      or coalesce(h.bill_to_customer_no, '') ilike $${idx} escape '\\'
      or coalesce(c.name, '') ilike $${idx} escape '\\'
      or exists (
        select 1
        from bc_rmi_posted_rental_lines l
        where l.previous_doc_type = h.previous_doc_type
          and l.previous_no = h.previous_no
          and (
            coalesce(l.item_no, '') ilike $${idx} escape '\\'
            or coalesce(l.description, '') ilike $${idx} escape '\\'
          )
      )
    )
  `;
}

export async function getAssetsOverviewView() {
  const result = await pool.query<{
    total_assets: string;
    on_rent_assets: string;
    in_service_assets: string;
    maintenance_assets: string;
    disposed_assets: string;
    total_customers: string;
    total_branches: string;
    app_leases: string;
    app_invoices: string;
    app_open_invoice_count: string;
    app_open_invoice_balance: string | null;
    app_events: string;
    bc_invoice_headers: string;
    bc_posted_headers: string;
    bc_credit_memos: string;
    bc_lines: string;
    bc_fixed_asset_lines: string;
    bc_lines_matched_to_assets: string;
    bc_invoice_headers_matched_to_customers: string;
    bc_distinct_order_keys: string;
    bc_customer_ledger_entries: string;
    bc_gl_entries: string;
    bc_dimension_set_entries: string;
    bc_import_errors: string;
    line_checkpoint_data: Record<string, unknown> | null;
  }>(
    `
      select
        (select count(*)::bigint from assets) as total_assets,
        (select count(*)::bigint from assets where is_on_rent = true) as on_rent_assets,
        (select count(*)::bigint from assets where is_in_service = true) as in_service_assets,
        (select count(*)::bigint from assets where under_maintenance = true) as maintenance_assets,
        (select count(*)::bigint from assets where is_disposed = true) as disposed_assets,
        (select count(*)::bigint from customers) as total_customers,
        (select count(*)::bigint from branches) as total_branches,
        (select count(*)::bigint from contracts) as app_leases,
        (select count(*)::bigint from invoices) as app_invoices,
        (select count(*)::bigint from invoices where balance_amount > 0 and status <> 'voided') as app_open_invoice_count,
        (select coalesce(sum(balance_amount), 0)::numeric(18,2) from invoices where balance_amount > 0 and status <> 'voided') as app_open_invoice_balance,
        (select count(*)::bigint from commercial_events) as app_events,
        (select count(*)::bigint from bc_rmi_posted_rental_invoice_headers) as bc_invoice_headers,
        (select count(*)::bigint from bc_rmi_posted_rental_headers) as bc_posted_headers,
        (select count(*)::bigint from bc_rmi_posted_rental_headers where document_type = 'Posted Credit Memo') as bc_credit_memos,
        (select count(*)::bigint from bc_rmi_posted_rental_lines) as bc_lines,
        (select count(*)::bigint from bc_rmi_posted_rental_lines where type = 'Fixed Asset') as bc_fixed_asset_lines,
        (select count(*)::bigint from bc_rmi_posted_rental_lines l join assets a on a.asset_number = l.item_no where l.type = 'Fixed Asset') as bc_lines_matched_to_assets,
        (select count(*)::bigint from bc_rmi_posted_rental_invoice_headers h join customers c on c.customer_number = h.bill_to_customer_no) as bc_invoice_headers_matched_to_customers,
        (select count(distinct previous_no)::bigint from bc_rmi_posted_rental_invoice_headers where previous_doc_type = 'Order' and previous_no is not null) as bc_distinct_order_keys,
        (select count(*)::bigint from bc_customer_ledger_entries) as bc_customer_ledger_entries,
        (select count(*)::bigint from bc_gl_entries) as bc_gl_entries,
        (select count(*)::bigint from bc_dimension_set_entries) as bc_dimension_set_entries,
        (select count(*)::bigint from bc_import_errors where resolved_at is null) as bc_import_errors,
        (select checkpoint_data from bc_import_checkpoints where entity_type = 'raw:posted-rental-line' limit 1) as line_checkpoint_data
    `,
  );

  const row = result.rows[0];
  const lineImport = readLineImportState(row.line_checkpoint_data);
  const lineImportPercent =
    lineImport.total && lineImport.total > 0
      ? Math.min(1, lineImport.recordsSeen / lineImport.total)
      : null;

  return {
    metrics: {
      totalAssets: Number(row.total_assets),
      onRentAssets: Number(row.on_rent_assets),
      inServiceAssets: Number(row.in_service_assets),
      maintenanceAssets: Number(row.maintenance_assets),
      disposedAssets: Number(row.disposed_assets),
      totalCustomers: Number(row.total_customers),
      totalBranches: Number(row.total_branches),
      appLeases: Number(row.app_leases),
      appInvoices: Number(row.app_invoices),
      appOpenInvoiceCount: Number(row.app_open_invoice_count),
      appOpenInvoiceBalance: numericToNumber(row.app_open_invoice_balance),
      appEvents: Number(row.app_events),
      bcInvoiceHeaders: Number(row.bc_invoice_headers),
      bcPostedHeaders: Number(row.bc_posted_headers),
      bcCreditMemos: Number(row.bc_credit_memos),
      bcLines: Number(row.bc_lines),
      bcFixedAssetLines: Number(row.bc_fixed_asset_lines),
      bcLinesMatchedToAssets: Number(row.bc_lines_matched_to_assets),
      bcInvoiceHeadersMatchedToCustomers: Number(
        row.bc_invoice_headers_matched_to_customers,
      ),
      bcDistinctOrderKeys: Number(row.bc_distinct_order_keys),
      bcCustomerLedgerEntries: Number(row.bc_customer_ledger_entries),
      bcGlEntries: Number(row.bc_gl_entries),
      bcDimensionSetEntries: Number(row.bc_dimension_set_entries),
      bcImportErrors: Number(row.bc_import_errors),
    },
    lineImport: {
      ...lineImport,
      percent: lineImportPercent,
    },
    accountingHistoryReady:
      Number(row.bc_customer_ledger_entries) > 0 &&
      Number(row.bc_gl_entries) > 0 &&
      Number(row.bc_dimension_set_entries) > 0,
  };
}

export async function getFleetListView(filters?: Parameters<typeof getAssetListView>[0]) {
  return getAssetListView(filters);
}

export async function getAssetRentalDetailView(assetId: string) {
  const assetResult = await pool.query<{
    id: string;
    asset_number: string;
  }>(
    `
      select id, asset_number
      from assets
      where id = $1 or asset_number = $1
      limit 1
    `,
    [assetId],
  );
  const asset = assetResult.rows[0];
  if (!asset) {
    return null;
  }

  const [summaryResult, recentLinesResult, revenueByMonthResult, leaseResult] =
    await Promise.all([
      pool.query<{
        invoice_line_count: string;
        invoice_count: string;
        lease_count: string;
        gross_amount: string | null;
        first_period: Date | null;
        last_period: Date | null;
      }>(
        `
          select
            count(*)::bigint as invoice_line_count,
            count(distinct document_no)::bigint as invoice_count,
            (count(distinct previous_no) filter (where previous_no is not null))::bigint as lease_count,
            coalesce(sum(gross_amount), 0)::numeric(18,2) as gross_amount,
            min(invoice_from_date) as first_period,
            max(invoice_thru_date) as last_period
          from bc_rmi_posted_rental_lines
          where type = 'Fixed Asset'
            and item_no = $1
        `,
        [asset.asset_number],
      ),
      pool.query<{
        id: string;
        document_type: string;
        document_no: string;
        previous_no: string | null;
        bill_to_customer_no: string | null;
        customer_name: string | null;
        line_no: number;
        description: string | null;
        quantity: string | null;
        unit_price: string | null;
        gross_amount: string | null;
        invoice_from_date: Date | null;
        invoice_thru_date: Date | null;
        posting_date: Date | null;
      }>(
        `
          select
            l.id,
            l.document_type,
            l.document_no,
            l.previous_no,
            h.bill_to_customer_no,
            c.name as customer_name,
            l.line_no,
            l.description,
            l.quantity,
            l.unit_price,
            l.gross_amount,
            l.invoice_from_date,
            l.invoice_thru_date,
            l.posting_date
          from bc_rmi_posted_rental_lines l
          left join bc_rmi_posted_rental_invoice_headers h
            on h.document_type = l.document_type
           and h.document_no = l.document_no
          left join customers c on c.customer_number = h.bill_to_customer_no
          where l.type = 'Fixed Asset'
            and l.item_no = $1
          order by l.posting_date desc nulls last, l.document_no desc, l.line_no
          limit 100
        `,
        [asset.asset_number],
      ),
      pool.query<{
        month: Date;
        line_count: string;
        invoice_count: string;
        gross_amount: string | null;
      }>(
        `
          select
            date_trunc('month', coalesce(invoice_from_date, posting_date)) as month,
            count(*)::bigint as line_count,
            count(distinct document_no)::bigint as invoice_count,
            coalesce(sum(gross_amount), 0)::numeric(18,2) as gross_amount
          from bc_rmi_posted_rental_lines
          where type = 'Fixed Asset'
            and item_no = $1
            and coalesce(invoice_from_date, posting_date) is not null
          group by 1
          order by month desc
          limit 24
        `,
        [asset.asset_number],
      ),
      pool.query<{
        lease_key: string;
        invoice_count: string;
        gross_amount: string | null;
        first_period: Date | null;
        last_period: Date | null;
        customer_number: string | null;
        customer_name: string | null;
      }>(
        `
          select
            l.previous_no as lease_key,
            count(distinct l.document_no)::bigint as invoice_count,
            coalesce(sum(l.gross_amount), 0)::numeric(18,2) as gross_amount,
            min(l.invoice_from_date) as first_period,
            max(l.invoice_thru_date) as last_period,
            max(h.bill_to_customer_no) as customer_number,
            max(c.name) as customer_name
          from bc_rmi_posted_rental_lines l
          left join bc_rmi_posted_rental_invoice_headers h
            on h.document_type = l.document_type
           and h.document_no = l.document_no
          left join customers c on c.customer_number = h.bill_to_customer_no
          where l.type = 'Fixed Asset'
            and l.item_no = $1
            and l.previous_no is not null
          group by l.previous_no
          order by max(l.posting_date) desc nulls last
          limit 50
        `,
        [asset.asset_number],
      ),
    ]);

  const summary = summaryResult.rows[0];

  return {
    assetId: asset.id,
    assetNumber: asset.asset_number,
    summary: {
      invoiceLineCount: Number(summary?.invoice_line_count ?? 0),
      invoiceCount: Number(summary?.invoice_count ?? 0),
      leaseCount: Number(summary?.lease_count ?? 0),
      grossAmount: numericToNumber(summary?.gross_amount),
      firstPeriod: toIso(summary?.first_period),
      lastPeriod: toIso(summary?.last_period),
    },
    recentLines: recentLinesResult.rows.map((row) => ({
      id: row.id,
      invoiceNumber: row.document_no,
      documentType: row.document_type,
      leaseKey: row.previous_no,
      customerNumber: row.bill_to_customer_no,
      customerName: row.customer_name,
      lineNo: row.line_no,
      description: row.description,
      quantity: numericToNumber(row.quantity),
      unitPrice: numericToNumber(row.unit_price),
      grossAmount: numericToNumber(row.gross_amount),
      invoiceFromDate: toIso(row.invoice_from_date),
      invoiceThruDate: toIso(row.invoice_thru_date),
      postingDate: toIso(row.posting_date),
    })),
    revenueByMonth: revenueByMonthResult.rows.map((row) => ({
      month: toIso(row.month),
      lineCount: Number(row.line_count),
      invoiceCount: Number(row.invoice_count),
      grossAmount: numericToNumber(row.gross_amount),
    })),
    leases: leaseResult.rows.map((row) => ({
      leaseKey: row.lease_key,
      invoiceCount: Number(row.invoice_count),
      grossAmount: numericToNumber(row.gross_amount),
      firstPeriod: toIso(row.first_period),
      lastPeriod: toIso(row.last_period),
      customerNumber: row.customer_number,
      customerName: row.customer_name,
    })),
  };
}

export async function getInvoiceRegisterView(filters?: PagedRentalFilters) {
  const source = sourceFilter(filters?.source);
  const page = pageNumber(filters?.page);
  const pageSize = pageSizeNumber(filters?.pageSize, 50);
  const offset = (page - 1) * pageSize;
  const lineImport = await getLineImportState();

  const countParams: SqlValue[] = [];
  const appSearch = buildInvoiceSearchCondition("app", filters?.q, countParams);
  const bcSearch = buildInvoiceSearchCondition("bc", filters?.q, countParams);
  countParams.push(source);
  const sourceIdx = countParams.length;

  const totalResult = await pool.query<{ total: string }>(
    `
      with app_rows as (
        select i.id
        from invoices i
        join customers cust on cust.id = i.customer_id
        left join contracts ct on ct.id = i.contract_id
        where $${sourceIdx}::text in ('all', 'app')
        ${appSearch}
      ),
      bc_rows as (
        select h.id
        from bc_rmi_posted_rental_invoice_headers h
        left join customers c on c.customer_number = h.bill_to_customer_no
        where $${sourceIdx}::text in ('all', 'business_central')
        ${bcSearch}
      )
      select ((select count(*) from app_rows) + (select count(*) from bc_rows))::bigint as total
    `,
    countParams,
  );

  const params: SqlValue[] = [];
  const appPageSearch = buildInvoiceSearchCondition("app", filters?.q, params);
  const bcPageSearch = buildInvoiceSearchCondition("bc", filters?.q, params);
  params.push(source);
  const sourceParam = params.length;
  params.push(pageSize);
  const limitParam = params.length;
  params.push(offset);
  const offsetParam = params.length;

  const result = await pool.query<{
    row_source: string;
    id: string;
    invoice_number: string;
    customer_number: string | null;
    customer_name: string | null;
    lease_key: string | null;
    status: string;
    invoice_date: Date | null;
    due_date: Date | null;
    total_amount: string | null;
    balance_amount: string | null;
    source_document_type: string | null;
    source_document_no: string | null;
    previous_document_type: string | null;
    previous_document_no: string | null;
    source_payload: Record<string, unknown> | null;
    line_count: string | null;
    fixed_asset_line_count: string | null;
    line_total: string | null;
    line_tax: string | null;
    asset_numbers: string | null;
  }>(
    `
      with app_rows as (
        select
          'app'::text as row_source,
          i.id,
          i.invoice_number,
          cust.customer_number,
          cust.name as customer_name,
          ct.contract_number as lease_key,
          i.status::text as status,
          i.invoice_date,
          i.due_date,
          i.total_amount::numeric(18,2) as total_amount,
          i.balance_amount::numeric(18,2) as balance_amount,
          coalesce(i.source_document_type, 'Metro AR Invoice') as source_document_type,
          coalesce(i.source_document_no, i.invoice_number) as source_document_no,
          null::text as previous_document_type,
          i.legacy_order_no as previous_document_no,
          i.source_snapshot as source_payload
        from invoices i
        join customers cust on cust.id = i.customer_id
        left join contracts ct on ct.id = i.contract_id
        where $${sourceParam}::text in ('all', 'app')
        ${appPageSearch}
      ),
      bc_rows as (
        select
          'business_central'::text as row_source,
          h.id,
          h.document_no as invoice_number,
          coalesce(h.bill_to_customer_no, h.sell_to_customer_no) as customer_number,
          coalesce(c.name, h.bill_to_customer_no, h.sell_to_customer_no) as customer_name,
          h.previous_no as lease_key,
          h.document_type as status,
          coalesce(h.document_date, h.posting_date) as invoice_date,
          h.due_date,
          null::numeric(18,2) as total_amount,
          null::numeric(18,2) as balance_amount,
          h.document_type as source_document_type,
          h.document_no as source_document_no,
          h.previous_doc_type as previous_document_type,
          h.previous_no as previous_document_no,
          h.source_payload
        from bc_rmi_posted_rental_invoice_headers h
        left join customers c on c.customer_number = h.bill_to_customer_no
        where $${sourceParam}::text in ('all', 'business_central')
        ${bcPageSearch}
      ),
      selected as (
        select *
        from (
          select * from app_rows
          union all
          select * from bc_rows
        ) combined
        order by invoice_date desc nulls last, invoice_number desc
        limit $${limitParam}
        offset $${offsetParam}
      ),
      line_rollup as (
        select
          l.document_type,
          l.document_no,
          count(*)::bigint as line_count,
          count(*) filter (where l.type = 'Fixed Asset')::bigint as fixed_asset_line_count,
          coalesce(sum(l.gross_amount), 0)::numeric(18,2) as line_total,
          coalesce(sum(l.tax_amount), 0)::numeric(18,2) as line_tax,
          string_agg(distinct l.item_no, ', ' order by l.item_no) filter (where l.type = 'Fixed Asset') as asset_numbers
        from bc_rmi_posted_rental_lines l
        join selected s
          on s.row_source = 'business_central'
         and s.source_document_type = l.document_type
         and s.source_document_no = l.document_no
        group by l.document_type, l.document_no
      )
      select
        selected.*,
        line_rollup.line_count,
        line_rollup.fixed_asset_line_count,
        line_rollup.line_total,
        line_rollup.line_tax,
        line_rollup.asset_numbers
      from selected
      left join line_rollup
        on selected.row_source = 'business_central'
       and selected.source_document_type = line_rollup.document_type
       and selected.source_document_no = line_rollup.document_no
      order by selected.invoice_date desc nulls last, selected.invoice_number desc
    `,
    params,
  );

  const data = result.rows.map((row) => {
    const lineCount = Number(row.line_count ?? 0);
    if (row.row_source === "business_central") {
      const amount = getBusinessCentralInvoiceAmount({
        lineCount,
        lineTotal: row.line_total,
        sourcePayload: row.source_payload,
      });
      return {
        id: row.id,
        source: "business_central" as const,
        invoiceNumber: row.invoice_number,
        customerNumber: row.customer_number,
        customerName: row.customer_name ?? "Unknown customer",
        leaseKey: row.lease_key,
        status: getBusinessCentralInvoiceStatus({
          documentType: row.status,
          lineCount,
          lineImportComplete: lineImport.done,
        }),
        invoiceDate: toIso(row.invoice_date),
        dueDate: toIso(row.due_date),
        totalAmount: amount.amount,
        balanceAmount: null,
        balanceStatus:
          "Pending BC customer ledger import" as const,
        amountSource: amount.source,
        sourceDocumentType: row.source_document_type,
        sourceDocumentNo: row.source_document_no,
        previousDocumentType: row.previous_document_type,
        previousDocumentNo: row.previous_document_no,
        lineCount,
        fixedAssetLineCount: Number(row.fixed_asset_line_count ?? 0),
        lineTax: numericToNumber(row.line_tax),
        assetNumbers: row.asset_numbers ?? "",
      };
    }
    return {
      id: row.id,
      source: "app" as const,
      invoiceNumber: row.invoice_number,
      customerNumber: row.customer_number,
      customerName: row.customer_name ?? "Unknown customer",
      leaseKey: row.lease_key,
      status: row.status,
      invoiceDate: toIso(row.invoice_date),
      dueDate: toIso(row.due_date),
      totalAmount: numericToNumber(row.total_amount),
      balanceAmount: numericToNumber(row.balance_amount),
      balanceStatus: "Available" as const,
      amountSource: "app_invoice" as const,
      sourceDocumentType: row.source_document_type,
      sourceDocumentNo: row.source_document_no,
      previousDocumentType: row.previous_document_type,
      previousDocumentNo: row.previous_document_no,
      lineCount,
      fixedAssetLineCount: Number(row.fixed_asset_line_count ?? 0),
      lineTax: numericToNumber(row.line_tax),
      assetNumbers: row.asset_numbers ?? "",
    };
  });

  return {
    data,
    total: Number(totalResult.rows[0]?.total ?? 0),
    page,
    pageSize,
    source,
    lineImport,
    openBalanceAvailable: false,
  };
}

export async function getInvoiceDetailView(invoiceNo: string) {
  const lineImport = await getLineImportState();
  const appInvoiceResult = await pool.query<{
    id: string;
    invoice_number: string;
    customer_number: string;
    customer_name: string;
    lease_key: string | null;
    invoice_date: Date;
    due_date: Date;
    status: string;
    total_amount: string;
    balance_amount: string;
    source_document_type: string | null;
    source_document_no: string | null;
    source_snapshot: Record<string, unknown> | null;
  }>(
    `
      select
        i.id,
        i.invoice_number,
        c.customer_number,
        c.name as customer_name,
        ct.contract_number as lease_key,
        i.invoice_date,
        i.due_date,
        i.status::text,
        i.total_amount,
        i.balance_amount,
        i.source_document_type,
        i.source_document_no,
        i.source_snapshot
      from invoices i
      join customers c on c.id = i.customer_id
      left join contracts ct on ct.id = i.contract_id
      where i.id = $1 or i.invoice_number = $1 or i.legacy_invoice_no = $1
      limit 1
    `,
    [invoiceNo],
  );

  if (appInvoiceResult.rows[0]) {
    const invoice = appInvoiceResult.rows[0];
    const linesResult = await pool.query<{
      id: string;
      line_no: number | null;
      description: string;
      quantity: string;
      unit_price: string;
      total_amount: string;
      asset_id: string | null;
      asset_number: string | null;
      service_period_start: Date | null;
      service_period_end: Date | null;
      line_kind: string | null;
      source_item_no: string | null;
    }>(
      `
        select
          il.id,
          il.source_line_no as line_no,
          il.description,
          il.quantity,
          il.unit_price,
          il.total_amount,
          a.id as asset_id,
          a.asset_number,
          il.service_period_start,
          il.service_period_end,
          il.line_kind::text,
          il.source_item_no
        from invoice_lines il
        left join assets a on a.id = il.asset_id
        where il.invoice_id = $1
        order by il.source_line_no nulls last, il.created_at
      `,
      [invoice.id],
    );
    return {
      source: "app" as const,
      summary: {
        id: invoice.id,
        invoiceNumber: invoice.invoice_number,
        customerNumber: invoice.customer_number,
        customerName: invoice.customer_name,
        leaseKey: invoice.lease_key,
        status: invoice.status,
        invoiceDate: toIso(invoice.invoice_date),
        dueDate: toIso(invoice.due_date),
        totalAmount: numericToNumber(invoice.total_amount),
        balanceAmount: numericToNumber(invoice.balance_amount),
        balanceStatus: "Available" as const,
        amountSource: "app_invoice" as const,
        sourceDocumentType: invoice.source_document_type,
        sourceDocumentNo: invoice.source_document_no,
        rawPayload: invoice.source_snapshot,
      },
      lines: linesResult.rows.map((line) => ({
        id: line.id,
        lineNo: line.line_no,
        lineType: line.line_kind,
        type: "App invoice line",
        assetId: line.asset_id,
        itemNo: line.asset_number ?? line.source_item_no,
        assetNumber: line.asset_number,
        description: line.description,
        quantity: numericToNumber(line.quantity),
        unitPrice: numericToNumber(line.unit_price),
        grossAmount: numericToNumber(line.total_amount),
        taxAmount: 0,
        damageWaiverAmount: 0,
        invoiceFromDate: toIso(line.service_period_start),
        invoiceThruDate: toIso(line.service_period_end),
        postingDate: toIso(invoice.invoice_date),
      })),
      assets: [],
      lineImport,
    };
  }

  const headerResult = await pool.query<{
    id: string;
    document_type: string;
    document_no: string;
    previous_doc_type: string | null;
    previous_no: string | null;
    sell_to_customer_no: string | null;
    bill_to_customer_no: string | null;
    customer_name: string | null;
    posting_date: Date | null;
    document_date: Date | null;
    due_date: Date | null;
    location_code: string | null;
    responsibility_center: string | null;
    source_payload: Record<string, unknown>;
  }>(
    `
      select
        h.id,
        h.document_type,
        h.document_no,
        h.previous_doc_type,
        h.previous_no,
        h.sell_to_customer_no,
        h.bill_to_customer_no,
        c.name as customer_name,
        h.posting_date,
        h.document_date,
        h.due_date,
        h.location_code,
        h.responsibility_center,
        h.source_payload
      from bc_rmi_posted_rental_invoice_headers h
      left join customers c on c.customer_number = h.bill_to_customer_no
      where h.document_no = $1
      limit 1
    `,
    [invoiceNo],
  );
  const header = headerResult.rows[0];
  if (!header) {
    return null;
  }

  const [linesResult, assetsResult] = await Promise.all([
    pool.query<{
      id: string;
      line_no: number;
      sequence_no: number | null;
      line_type: string | null;
      type: string | null;
      item_no: string | null;
      asset_id: string | null;
      asset_number: string | null;
      asset_type: string | null;
      description: string | null;
      quantity: string | null;
      unit_of_measure_code: string | null;
      unit_price: string | null;
      gross_amount: string | null;
      tax_amount: string | null;
      damage_waiver_amount: string | null;
      invoice_from_date: Date | null;
      invoice_thru_date: Date | null;
      posting_date: Date | null;
      deal_code: string | null;
      billing_for: string | null;
    }>(
      `
        select
          l.id,
          l.line_no,
          l.sequence_no,
          l.line_type,
          l.type,
          l.item_no,
          a.id as asset_id,
          a.asset_number,
          a.type::text as asset_type,
          l.description,
          l.quantity,
          l.unit_of_measure_code,
          l.unit_price,
          l.gross_amount,
          l.tax_amount,
          l.damage_waiver_amount,
          l.invoice_from_date,
          l.invoice_thru_date,
          l.posting_date,
          l.deal_code,
          l.billing_for
        from bc_rmi_posted_rental_lines l
        left join assets a on a.asset_number = l.item_no and l.type = 'Fixed Asset'
        where l.document_type = $1
          and l.document_no = $2
        order by l.line_no
      `,
      [header.document_type, header.document_no],
    ),
    pool.query<{
      asset_id: string;
      asset_number: string;
      asset_type: string;
      line_count: string;
      gross_amount: string | null;
      first_period: Date | null;
      last_period: Date | null;
    }>(
      `
        select
          a.id as asset_id,
          a.asset_number,
          a.type::text as asset_type,
          count(*)::bigint as line_count,
          coalesce(sum(l.gross_amount), 0)::numeric(18,2) as gross_amount,
          min(l.invoice_from_date) as first_period,
          max(l.invoice_thru_date) as last_period
        from bc_rmi_posted_rental_lines l
        join assets a on a.asset_number = l.item_no
        where l.document_type = $1
          and l.document_no = $2
          and l.type = 'Fixed Asset'
        group by a.id, a.asset_number, a.type
        order by a.asset_number
      `,
      [header.document_type, header.document_no],
    ),
  ]);

  const lineCount = linesResult.rows.length;
  const lineTotal = linesResult.rows.reduce(
    (sum, line) => sum + numericToNumber(line.gross_amount),
    0,
  );
  const amount = getBusinessCentralInvoiceAmount({
    lineCount,
    lineTotal,
    sourcePayload: header.source_payload,
  });

  return {
    source: "business_central" as const,
    summary: {
      id: header.id,
      invoiceNumber: header.document_no,
      customerNumber: header.bill_to_customer_no ?? header.sell_to_customer_no,
      customerName:
        header.customer_name ??
        payloadText(header.source_payload, ["BilltoName", "SelltoCustomerName", "Name"]) ??
        header.bill_to_customer_no ??
        "Unknown customer",
      leaseKey: header.previous_no,
      status: getBusinessCentralInvoiceStatus({
        documentType: header.document_type,
        lineCount,
        lineImportComplete: lineImport.done,
      }),
      invoiceDate: toIso(header.document_date) ?? toIso(header.posting_date),
      dueDate: toIso(header.due_date),
      totalAmount: amount.amount,
      balanceAmount: null,
      balanceStatus: "Pending BC customer ledger import" as const,
      amountSource: amount.source,
      sourceDocumentType: header.document_type,
      sourceDocumentNo: header.document_no,
      previousDocumentType: header.previous_doc_type,
      previousDocumentNo: header.previous_no,
      locationCode: header.location_code,
      responsibilityCenter: header.responsibility_center,
      rawPayload: header.source_payload,
    },
    lines: linesResult.rows.map((line) => ({
      id: line.id,
      lineNo: line.line_no,
      sequenceNo: line.sequence_no,
      lineType: line.line_type,
      type: line.type,
      itemNo: line.item_no,
      assetId: line.asset_id,
      assetNumber: line.asset_number,
      assetType: line.asset_type,
      description: line.description,
      quantity: numericToNumber(line.quantity),
      unitOfMeasureCode: line.unit_of_measure_code,
      unitPrice: numericToNumber(line.unit_price),
      grossAmount: numericToNumber(line.gross_amount),
      taxAmount: numericToNumber(line.tax_amount),
      damageWaiverAmount: numericToNumber(line.damage_waiver_amount),
      invoiceFromDate: toIso(line.invoice_from_date),
      invoiceThruDate: toIso(line.invoice_thru_date),
      postingDate: toIso(line.posting_date),
      dealCode: line.deal_code,
      billingFor: line.billing_for,
    })),
    assets: assetsResult.rows.map((asset) => ({
      assetId: asset.asset_id,
      assetNumber: asset.asset_number,
      assetType: asset.asset_type,
      lineCount: Number(asset.line_count),
      grossAmount: numericToNumber(asset.gross_amount),
      firstPeriod: toIso(asset.first_period),
      lastPeriod: toIso(asset.last_period),
    })),
    lineImport,
  };
}

export async function getLeaseRegisterView(filters?: PagedRentalFilters) {
  const source = sourceFilter(filters?.source);
  const page = pageNumber(filters?.page);
  const pageSize = pageSizeNumber(filters?.pageSize, 50);
  const offset = (page - 1) * pageSize;
  const lineImport = await getLineImportState();

  const countParams: SqlValue[] = [];
  const appSearch = buildLeaseSearchCondition("app", filters?.q, countParams);
  const bcSearch = buildLeaseSearchCondition("bc", filters?.q, countParams);
  countParams.push(source);
  const sourceIdx = countParams.length;

  const countResult = await pool.query<{ total: string }>(
    `
      with app_rows as (
        select ct.id
        from contracts ct
        join customers cust on cust.id = ct.customer_id
        where $${sourceIdx}::text in ('all', 'app')
        ${appSearch}
      ),
      bc_rows as (
        select h.previous_no
        from bc_rmi_posted_rental_invoice_headers h
        left join customers c on c.customer_number = h.bill_to_customer_no
        where $${sourceIdx}::text in ('all', 'business_central')
          and h.previous_doc_type = 'Order'
          and h.previous_no is not null
        ${bcSearch}
        group by h.previous_no
      )
      select ((select count(*) from app_rows) + (select count(*) from bc_rows))::bigint as total
    `,
    countParams,
  );

  const params: SqlValue[] = [];
  const appPageSearch = buildLeaseSearchCondition("app", filters?.q, params);
  const bcPageSearch = buildLeaseSearchCondition("bc", filters?.q, params);
  params.push(source);
  const sourceParam = params.length;
  params.push(pageSize);
  const limitParam = params.length;
  params.push(offset);
  const offsetParam = params.length;

  const result = await pool.query<{
    row_source: string;
    id: string;
    lease_key: string;
    customer_number: string | null;
    customer_name: string | null;
    status: string | null;
    start_date: Date | null;
    end_date: Date | null;
    branch_code: string | null;
    branch_name: string | null;
    invoice_count: string | null;
    asset_count: string | null;
    line_count: string | null;
    gross_amount: string | null;
    latest_invoice_date: Date | null;
    first_invoice_date: Date | null;
    source_document_type: string | null;
  }>(
    `
      with app_rows as (
        select
          'app'::text as row_source,
          ct.id,
          ct.contract_number as lease_key,
          cust.customer_number,
          cust.name as customer_name,
          ct.status::text,
          ct.start_date,
          ct.end_date,
          b.code as branch_code,
          b.name as branch_name,
          count(distinct i.id)::bigint as invoice_count,
          (count(distinct cl.asset_id) filter (where cl.asset_id is not null))::bigint as asset_count,
          count(distinct cl.id)::bigint as line_count,
          coalesce(sum(distinct i.total_amount), 0)::numeric(18,2) as gross_amount,
          max(i.invoice_date) as latest_invoice_date,
          min(i.invoice_date) as first_invoice_date,
          coalesce(ct.source_document_type, 'Metro Lease') as source_document_type
        from contracts ct
        join customers cust on cust.id = ct.customer_id
        join branches b on b.id = ct.branch_id
        left join contract_lines cl on cl.contract_id = ct.id
        left join invoices i on i.contract_id = ct.id
        where $${sourceParam}::text in ('all', 'app')
        ${appPageSearch}
        group by ct.id, ct.contract_number, cust.customer_number, cust.name, ct.status, ct.start_date, ct.end_date, b.code, b.name, ct.source_document_type
      ),
      bc_rows as (
        select
          'business_central'::text as row_source,
          h.previous_no as id,
          h.previous_no as lease_key,
          (array_agg(coalesce(h.bill_to_customer_no, h.sell_to_customer_no) order by h.posting_date desc nulls last))[1] as customer_number,
          (array_agg(coalesce(c.name, h.bill_to_customer_no, h.sell_to_customer_no) order by h.posting_date desc nulls last))[1] as customer_name,
          'Posted history'::text as status,
          min(h.posting_date) as start_date,
          max(h.posting_date) as end_date,
          null::text as branch_code,
          null::text as branch_name,
          count(distinct h.document_no)::bigint as invoice_count,
          null::bigint as asset_count,
          null::bigint as line_count,
          null::numeric(18,2) as gross_amount,
          max(h.posting_date) as latest_invoice_date,
          min(h.posting_date) as first_invoice_date,
          'RMI Posted Rental Order'::text as source_document_type
        from bc_rmi_posted_rental_invoice_headers h
        left join customers c on c.customer_number = h.bill_to_customer_no
        where $${sourceParam}::text in ('all', 'business_central')
          and h.previous_doc_type = 'Order'
          and h.previous_no is not null
        ${bcPageSearch}
        group by h.previous_no
      ),
      selected as (
        select *
        from (
          select * from app_rows
          union all
          select * from bc_rows
        ) combined
        order by latest_invoice_date desc nulls last, lease_key desc
        limit $${limitParam}
        offset $${offsetParam}
      ),
      bc_line_rollup as (
        select
          l.previous_no as lease_key,
          count(*)::bigint as line_count,
          (count(distinct l.item_no) filter (where l.type = 'Fixed Asset'))::bigint as asset_count,
          coalesce(sum(l.gross_amount), 0)::numeric(18,2) as gross_amount
        from bc_rmi_posted_rental_lines l
        join selected s
          on s.row_source = 'business_central'
         and s.lease_key = l.previous_no
        group by l.previous_no
      )
      select
        selected.row_source,
        selected.id,
        selected.lease_key,
        selected.customer_number,
        selected.customer_name,
        selected.status,
        selected.start_date,
        selected.end_date,
        selected.branch_code,
        selected.branch_name,
        selected.invoice_count,
        coalesce(selected.asset_count, bc_line_rollup.asset_count) as asset_count,
        coalesce(selected.line_count, bc_line_rollup.line_count) as line_count,
        coalesce(selected.gross_amount, bc_line_rollup.gross_amount) as gross_amount,
        selected.latest_invoice_date,
        selected.first_invoice_date,
        selected.source_document_type
      from selected
      left join bc_line_rollup
        on selected.row_source = 'business_central'
       and selected.lease_key = bc_line_rollup.lease_key
      order by selected.latest_invoice_date desc nulls last, selected.lease_key desc
    `,
    params,
  );

  return {
    data: result.rows.map((row) => ({
      id: row.id,
      source: row.row_source === "business_central" ? "business_central" : "app",
      leaseKey: row.lease_key,
      customerNumber: row.customer_number,
      customerName: row.customer_name ?? "Unknown customer",
      status: row.status ?? "unknown",
      startDate: toIso(row.start_date),
      endDate: toIso(row.end_date),
      branchCode: row.branch_code,
      branchName: row.branch_name,
      invoiceCount: Number(row.invoice_count ?? 0),
      assetCount: Number(row.asset_count ?? 0),
      lineCount: Number(row.line_count ?? 0),
      grossAmount: numericToNumber(row.gross_amount),
      latestInvoiceDate: toIso(row.latest_invoice_date),
      firstInvoiceDate: toIso(row.first_invoice_date),
      sourceDocumentType: row.source_document_type,
      completeness:
        row.row_source === "business_central" && !lineImport.done
          ? "Lines partial"
          : "Lines imported",
    })),
    total: Number(countResult.rows[0]?.total ?? 0),
    page,
    pageSize,
    source,
    lineImport,
  };
}

export async function getLeaseDetailView(leaseKey: string) {
  const canonical = await getContractDetailView(leaseKey);
  const lineImport = await getLineImportState();

  const summaryResult = await pool.query<{
    lease_key: string;
    customer_number: string | null;
    customer_name: string | null;
    invoice_count: string;
    first_invoice_date: Date | null;
    latest_invoice_date: Date | null;
    due_date: Date | null;
    location_code: string | null;
    responsibility_center: string | null;
  }>(
    `
      select
        h.previous_no as lease_key,
        (array_agg(coalesce(h.bill_to_customer_no, h.sell_to_customer_no) order by h.posting_date desc nulls last))[1] as customer_number,
        (array_agg(coalesce(c.name, h.bill_to_customer_no, h.sell_to_customer_no) order by h.posting_date desc nulls last))[1] as customer_name,
        count(distinct h.document_no)::bigint as invoice_count,
        min(h.posting_date) as first_invoice_date,
        max(h.posting_date) as latest_invoice_date,
        max(h.due_date) as due_date,
        (array_agg(h.location_code order by h.posting_date desc nulls last))[1] as location_code,
        (array_agg(h.responsibility_center order by h.posting_date desc nulls last))[1] as responsibility_center
      from bc_rmi_posted_rental_invoice_headers h
      left join customers c on c.customer_number = h.bill_to_customer_no
      where h.previous_no = $1
      group by h.previous_no
    `,
    [leaseKey],
  );
  const summary = summaryResult.rows[0];

  if (!canonical && !summary) {
    return null;
  }

  const [invoiceResult, lineResult, assetResult] = await Promise.all([
    pool.query<{
      document_no: string;
      document_type: string;
      posting_date: Date | null;
      document_date: Date | null;
      due_date: Date | null;
      bill_to_customer_no: string | null;
      customer_name: string | null;
      line_count: string | null;
      line_total: string | null;
    }>(
      `
        select
          h.document_no,
          h.document_type,
          h.posting_date,
          h.document_date,
          h.due_date,
          h.bill_to_customer_no,
          c.name as customer_name,
          lr.line_count,
          lr.line_total
        from bc_rmi_posted_rental_invoice_headers h
        left join customers c on c.customer_number = h.bill_to_customer_no
        left join (
          select document_type, document_no, count(*)::bigint as line_count, coalesce(sum(gross_amount), 0)::numeric(18,2) as line_total
          from bc_rmi_posted_rental_lines
          where previous_no = $1
          group by document_type, document_no
        ) lr on lr.document_type = h.document_type and lr.document_no = h.document_no
        where h.previous_no = $1
        order by h.posting_date desc nulls last, h.document_no desc
        limit 100
      `,
      [leaseKey],
    ),
    pool.query<{
      id: string;
      document_no: string;
      line_no: number;
      item_no: string | null;
      asset_id: string | null;
      asset_number: string | null;
      line_type: string | null;
      type: string | null;
      description: string | null;
      gross_amount: string | null;
      invoice_from_date: Date | null;
      invoice_thru_date: Date | null;
      posting_date: Date | null;
    }>(
      `
        select
          l.id,
          l.document_no,
          l.line_no,
          l.item_no,
          a.id as asset_id,
          a.asset_number,
          l.line_type,
          l.type,
          l.description,
          l.gross_amount,
          l.invoice_from_date,
          l.invoice_thru_date,
          l.posting_date
        from bc_rmi_posted_rental_lines l
        left join assets a on a.asset_number = l.item_no and l.type = 'Fixed Asset'
        where l.previous_no = $1
        order by l.posting_date desc nulls last, l.document_no desc, l.line_no
        limit 250
      `,
      [leaseKey],
    ),
    pool.query<{
      asset_id: string;
      asset_number: string;
      asset_type: string;
      invoice_count: string;
      gross_amount: string | null;
      first_period: Date | null;
      last_period: Date | null;
    }>(
      `
        select
          a.id as asset_id,
          a.asset_number,
          a.type::text as asset_type,
          count(distinct l.document_no)::bigint as invoice_count,
          coalesce(sum(l.gross_amount), 0)::numeric(18,2) as gross_amount,
          min(l.invoice_from_date) as first_period,
          max(l.invoice_thru_date) as last_period
        from bc_rmi_posted_rental_lines l
        join assets a on a.asset_number = l.item_no
        where l.previous_no = $1
          and l.type = 'Fixed Asset'
        group by a.id, a.asset_number, a.type
        order by gross_amount desc nulls last, a.asset_number
        limit 100
      `,
      [leaseKey],
    ),
  ]);

  return {
    summary: summary
      ? {
          source: "business_central" as const,
          leaseKey: summary.lease_key,
          customerNumber: summary.customer_number,
          customerName: summary.customer_name ?? "Unknown customer",
          invoiceCount: Number(summary.invoice_count),
          firstInvoiceDate: toIso(summary.first_invoice_date),
          latestInvoiceDate: toIso(summary.latest_invoice_date),
          dueDate: toIso(summary.due_date),
          locationCode: summary.location_code,
          responsibilityCenter: summary.responsibility_center,
          completeness: lineImport.done ? "Lines imported" : "Lines partial",
        }
      : {
          source: "app" as const,
          leaseKey: canonical!.summary.contractNumber,
          customerNumber: null,
          customerName: canonical!.summary.customerName,
          invoiceCount: canonical!.summary.invoiceCount ?? 0,
          firstInvoiceDate: canonical!.summary.startDate,
          latestInvoiceDate: canonical!.summary.endDate,
          dueDate: null,
          locationCode: null,
          responsibilityCenter: null,
          completeness: "App-native",
        },
    canonical,
    invoices: invoiceResult.rows.map((row) => {
      const lineCount = Number(row.line_count ?? 0);
      const amount = getBusinessCentralInvoiceAmount({
        lineCount,
        lineTotal: row.line_total,
        sourcePayload: null,
      });
      return {
        invoiceNumber: row.document_no,
        documentType: row.document_type,
        postingDate: toIso(row.posting_date),
        invoiceDate: toIso(row.document_date) ?? toIso(row.posting_date),
        dueDate: toIso(row.due_date),
        customerNumber: row.bill_to_customer_no,
        customerName: row.customer_name,
        status: getBusinessCentralInvoiceStatus({
          documentType: row.document_type,
          lineCount,
          lineImportComplete: lineImport.done,
        }),
        lineCount,
        totalAmount: amount.amount,
      };
    }),
    lines: lineResult.rows.map((row) => ({
      id: row.id,
      invoiceNumber: row.document_no,
      lineNo: row.line_no,
      itemNo: row.item_no,
      assetId: row.asset_id,
      assetNumber: row.asset_number,
      lineType: row.line_type,
      type: row.type,
      description: row.description,
      grossAmount: numericToNumber(row.gross_amount),
      invoiceFromDate: toIso(row.invoice_from_date),
      invoiceThruDate: toIso(row.invoice_thru_date),
      postingDate: toIso(row.posting_date),
    })),
    assets: assetResult.rows.map((row) => ({
      assetId: row.asset_id,
      assetNumber: row.asset_number,
      assetType: row.asset_type,
      invoiceCount: Number(row.invoice_count),
      grossAmount: numericToNumber(row.gross_amount),
      firstPeriod: toIso(row.first_period),
      lastPeriod: toIso(row.last_period),
    })),
    lineImport,
  };
}
