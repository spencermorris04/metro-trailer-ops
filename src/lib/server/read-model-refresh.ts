import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";

import { pool } from "@/lib/db";
import { rebuildGlobalSearchIndex } from "@/lib/server/search-index";
import { invalidateWorkspaceCache } from "@/lib/server/workspace-cache";

type RefreshCounts = Record<string, number>;
type RefreshTimings = Record<string, number>;

type RefreshResult = {
  id: string;
  summaryVersion: string;
  rowCounts: RefreshCounts;
  timingsMs: RefreshTimings;
};

const REFRESH_LOCK_KEY = 720_360_001;

async function countRows(tableName: string) {
  const result = await pool.query<{ count: string }>(
    `select count(*)::text as count from ${tableName}`,
  );
  return Number(result.rows[0]?.count ?? 0);
}

async function timed<T>(
  name: string,
  timings: RefreshTimings,
  fn: () => Promise<T>,
) {
  const start = performance.now();
  try {
    return await fn();
  } finally {
    timings[name] = Number((performance.now() - start).toFixed(2));
  }
}

async function replaceFromTemp(tableName: string, createTempSql: string, insertTempSql: string) {
  const client = await pool.connect();
  const tempName = `tmp_${tableName}`;
  try {
    await client.query(`drop table if exists ${tempName}`);
    await client.query(createTempSql);
    await client.query(insertTempSql);
    await client.query("begin");
    await client.query(`truncate table ${tableName}`);
    await client.query(`insert into ${tableName} select * from ${tempName}`);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    await client.query(`drop table if exists ${tempName}`).catch(() => undefined);
    client.release();
  }
}

async function refreshInvoiceRegisterSummary() {
  await replaceFromTemp(
    "invoice_register_summary",
    "create temp table tmp_invoice_register_summary (like invoice_register_summary including defaults) on commit preserve rows",
    `
      insert into tmp_invoice_register_summary (
        id,
        source,
        document_type,
        document_no,
        customer_number,
        customer_name,
        previous_no,
        previous_document_type,
        posting_date,
        due_date,
        status,
        line_count,
        fixed_asset_line_count,
        equipment_count,
        gross_amount,
        tax_amount,
        damage_waiver_amount,
        total_amount,
        ar_balance,
        latest_activity_at,
        amount_source,
        search_text,
        refreshed_at
      )
      with line_stats as (
        select
          document_type,
          document_no,
          count(*)::integer as line_count,
          count(*) filter (where type = 'Fixed Asset')::integer as fixed_asset_line_count,
          count(distinct item_no) filter (where type = 'Fixed Asset' and item_no is not null)::integer as equipment_count,
          coalesce(sum(gross_amount), 0)::numeric(18,2) as gross_amount,
          coalesce(sum(tax_amount), 0)::numeric(18,2) as tax_amount,
          coalesce(sum(damage_waiver_amount), 0)::numeric(18,2) as damage_waiver_amount,
          max(coalesce(invoice_thru_date, invoice_from_date, posting_date)) as latest_activity_at
        from bc_rmi_posted_rental_lines
        group by document_type, document_no
      ),
      ledger as (
        select
          document_no,
          coalesce(
            sum(
              case
                when lower(coalesce(payload->>'Open', 'false')) = 'true' then
                  coalesce(nullif(regexp_replace(coalesce(payload->>'Remaining_Amount', payload->>'Remaining_Amt_LCY', amount::text, '0'), '[^0-9.-]', '', 'g'), '')::numeric, 0)
                else 0
              end
            ),
            0
          )::numeric(18,2) as ar_balance
        from bc_customer_ledger_entries
        where document_no is not null
        group by document_no
      )
      select
        'bc:' || h.id,
        'business_central',
        h.document_type,
        h.document_no,
        coalesce(h.bill_to_customer_no, h.sell_to_customer_no),
        coalesce(c.name, h.bill_to_customer_no, h.sell_to_customer_no, 'Unknown customer'),
        h.previous_no,
        h.previous_doc_type,
        coalesce(h.document_date, h.posting_date),
        h.due_date,
        case
          when h.document_type ilike '%credit%' then 'credit_memo'
          when coalesce(ls.line_count, 0) = 0 then 'header_only'
          else 'posted'
        end,
        coalesce(ls.line_count, 0),
        coalesce(ls.fixed_asset_line_count, 0),
        coalesce(ls.equipment_count, 0),
        coalesce(ls.gross_amount, 0),
        coalesce(ls.tax_amount, 0),
        coalesce(ls.damage_waiver_amount, 0),
        coalesce(ls.gross_amount, 0),
        ledger.ar_balance,
        coalesce(ls.latest_activity_at, h.posting_date),
        case when coalesce(ls.line_count, 0) > 0 then 'rmi_lines' else 'header_payload' end,
        concat_ws(' ', h.document_no, h.previous_no, h.bill_to_customer_no, h.sell_to_customer_no, c.name, h.external_document_no, h.document_type),
        now()
      from bc_rmi_posted_rental_invoice_headers h
      left join line_stats ls on ls.document_type = h.document_type and ls.document_no = h.document_no
      left join customers c on c.customer_number = coalesce(h.bill_to_customer_no, h.sell_to_customer_no)
      left join ledger on ledger.document_no = h.document_no
      union all
      select
        'app:' || i.id,
        'app',
        coalesce(i.source_document_type, 'Metro AR Invoice'),
        i.invoice_number,
        cust.customer_number,
        cust.name,
        coalesce(i.legacy_order_no, ct.contract_number),
        i.source_document_type,
        i.invoice_date,
        i.due_date,
        i.status::text,
        0,
        0,
        0,
        coalesce(i.subtotal_amount, i.total_amount, 0)::numeric(18,2),
        coalesce(i.tax_amount, 0)::numeric(18,2),
        0::numeric(18,2),
        coalesce(i.total_amount, 0)::numeric(18,2),
        i.balance_amount::numeric(18,2),
        i.invoice_date,
        'app_invoice',
        concat_ws(' ', i.invoice_number, i.legacy_order_no, ct.contract_number, cust.customer_number, cust.name),
        now()
      from invoices i
      join customers cust on cust.id = i.customer_id
      left join contracts ct on ct.id = i.contract_id
    `,
  );
}

async function refreshLeaseSummary() {
  await replaceFromTemp(
    "lease_summary",
    "create temp table tmp_lease_summary (like lease_summary including defaults) on commit preserve rows",
    `
      insert into tmp_lease_summary (
        lease_key,
        source,
        customer_number,
        customer_name,
        first_invoice_date,
        latest_invoice_date,
        invoice_count,
        line_count,
        equipment_count,
        gross_revenue,
        latest_activity_at,
        status,
        search_text,
        refreshed_at
      )
      with bc as (
        select
          h.previous_no as lease_key,
          (array_agg(coalesce(h.bill_to_customer_no, h.sell_to_customer_no) order by h.posting_date desc nulls last, h.document_no desc))[1] as customer_number,
          (array_agg(coalesce(c.name, h.bill_to_customer_no, h.sell_to_customer_no) order by h.posting_date desc nulls last, h.document_no desc))[1] as customer_name,
          min(h.posting_date) as first_invoice_date,
          max(h.posting_date) as latest_invoice_date,
          count(distinct h.document_no)::integer as invoice_count,
          count(l.id)::integer as line_count,
          count(distinct l.item_no) filter (where l.type = 'Fixed Asset' and l.item_no is not null)::integer as equipment_count,
          coalesce(sum(l.gross_amount), 0)::numeric(18,2) as gross_revenue,
          max(coalesce(l.invoice_thru_date, l.invoice_from_date, l.posting_date, h.posting_date)) as latest_activity_at,
          string_agg(distinct h.document_no, ' ') as invoice_tokens
        from bc_rmi_posted_rental_invoice_headers h
        left join bc_rmi_posted_rental_lines l on l.document_type = h.document_type and l.document_no = h.document_no
        left join customers c on c.customer_number = coalesce(h.bill_to_customer_no, h.sell_to_customer_no)
        where h.previous_doc_type = 'Order'
          and h.previous_no is not null
        group by h.previous_no
      )
      select
        lease_key,
        'business_central',
        customer_number,
        coalesce(customer_name, 'Unknown customer'),
        first_invoice_date,
        latest_invoice_date,
        invoice_count,
        line_count,
        equipment_count,
        gross_revenue,
        latest_activity_at,
        'Posted history',
        concat_ws(' ', lease_key, customer_number, customer_name, invoice_tokens),
        now()
      from bc
      union all
      select
        ct.contract_number,
        'app',
        cust.customer_number,
        cust.name,
        min(i.invoice_date),
        max(i.invoice_date),
        count(distinct i.id)::integer,
        count(distinct cl.id)::integer,
        count(distinct cl.asset_id) filter (where cl.asset_id is not null)::integer,
        coalesce(sum(distinct i.total_amount), 0)::numeric(18,2),
        max(coalesce(i.invoice_date, ct.updated_at)),
        ct.status::text,
        concat_ws(' ', ct.contract_number, cust.customer_number, cust.name),
        now()
      from contracts ct
      join customers cust on cust.id = ct.customer_id
      left join invoices i on i.contract_id = ct.id
      left join contract_lines cl on cl.contract_id = ct.id
      where not exists (
        select 1
        from bc
        where bc.lease_key = ct.contract_number
      )
      group by ct.contract_number, cust.customer_number, cust.name, ct.status
    `,
  );
}

async function refreshArSummaries() {
  await replaceFromTemp(
    "ar_customer_summary",
    "create temp table tmp_ar_customer_summary (like ar_customer_summary including defaults) on commit preserve rows",
    `
      insert into tmp_ar_customer_summary (
        customer_number,
        ar_balance,
        open_invoice_count,
        entry_count,
        latest_posting_date,
        refreshed_at
      )
      select
        customer_no,
        coalesce(sum(
          case
            when lower(coalesce(payload->>'Open', 'false')) = 'true' then
              coalesce(nullif(regexp_replace(coalesce(payload->>'Remaining_Amount', payload->>'Remaining_Amt_LCY', amount::text, '0'), '[^0-9.-]', '', 'g'), '')::numeric, 0)
            else 0
          end
        ), 0)::numeric(18,2),
        count(distinct document_no) filter (where lower(coalesce(payload->>'Open', 'false')) = 'true')::integer,
        count(*)::integer,
        max(posting_date),
        now()
      from bc_customer_ledger_entries
      where customer_no is not null
      group by customer_no
    `,
  );

  await replaceFromTemp(
    "ar_aging_snapshot",
    "create temp table tmp_ar_aging_snapshot (like ar_aging_snapshot including defaults) on commit preserve rows",
    `
      insert into tmp_ar_aging_snapshot (bucket, balance, entry_count, refreshed_at)
      select
        case when lower(coalesce(payload->>'Open', 'false')) = 'true' then 'Open' else 'Closed' end,
        coalesce(sum(
          case
            when lower(coalesce(payload->>'Open', 'false')) = 'true' then
              coalesce(nullif(regexp_replace(coalesce(payload->>'Remaining_Amount', payload->>'Remaining_Amt_LCY', amount::text, '0'), '[^0-9.-]', '', 'g'), '')::numeric, 0)
            else coalesce(amount, 0)
          end
        ), 0)::numeric(18,2),
        count(*)::integer,
        now()
      from bc_customer_ledger_entries
      group by case when lower(coalesce(payload->>'Open', 'false')) = 'true' then 'Open' else 'Closed' end
    `,
  );
}

async function refreshEquipmentSummary() {
  await replaceFromTemp(
    "equipment_summary",
    "create temp table tmp_equipment_summary (like equipment_summary including defaults) on commit preserve rows",
    `
      insert into tmp_equipment_summary (
        asset_id,
        asset_number,
        asset_type,
        asset_subtype,
        fa_class_code,
        fa_subclass_code,
        manufacturer,
        model_year,
        serial_number,
        registration_number,
        branch_id,
        branch_code,
        branch_name,
        status,
        availability,
        maintenance_status,
        bc_location_code,
        bc_dimension1_code,
        bc_product_no,
        bc_service_item_no,
        is_blocked,
        is_inactive,
        is_disposed,
        is_on_rent,
        is_in_service,
        under_maintenance,
        book_value,
        invoice_line_count,
        invoice_count,
        lease_count,
        lifetime_revenue,
        last12m_revenue,
        latest_invoice_no,
        latest_lease_key,
        latest_customer_no,
        latest_customer_name,
        latest_billed_from,
        latest_billed_thru,
        latest_activity_at,
        source_provider,
        source_payload_available,
        search_text,
        refreshed_at
      )
      with line_stats as (
        select
          item_no as asset_number,
          count(*)::integer as invoice_line_count,
          count(distinct document_no)::integer as invoice_count,
          count(distinct previous_no) filter (where previous_no is not null)::integer as lease_count,
          coalesce(sum(gross_amount), 0)::numeric(18,2) as lifetime_revenue,
          coalesce(sum(gross_amount) filter (where posting_date >= current_date - interval '12 months'), 0)::numeric(18,2) as last12m_revenue
        from bc_rmi_posted_rental_lines
        where type = 'Fixed Asset'
          and item_no is not null
        group by item_no
      ),
      latest as (
        select *
        from (
          select
            l.item_no as asset_number,
            l.document_no,
            l.previous_no,
            h.bill_to_customer_no,
            h.sell_to_customer_no,
            c.name as customer_name,
            l.invoice_from_date,
            l.invoice_thru_date,
            coalesce(l.invoice_thru_date, l.invoice_from_date, l.posting_date) as activity_at,
            row_number() over (
              partition by l.item_no
              order by coalesce(l.invoice_thru_date, l.invoice_from_date, l.posting_date) desc nulls last, l.document_no desc, l.line_no desc
            ) as rn
          from bc_rmi_posted_rental_lines l
          left join bc_rmi_posted_rental_invoice_headers h on h.document_type = l.document_type and h.document_no = l.document_no
          left join customers c on c.customer_number = coalesce(h.bill_to_customer_no, h.sell_to_customer_no)
          where l.type = 'Fixed Asset'
            and l.item_no is not null
        ) ranked
        where rn = 1
      )
      select
        a.id,
        a.asset_number,
        a.type::text,
        a.subtype,
        a.fa_class_code,
        a.fa_subclass_code,
        a.manufacturer,
        a.model_year,
        a.serial_number,
        a.registration_number,
        a.branch_id,
        b.code,
        b.name,
        a.status::text,
        a.availability::text,
        a.maintenance_status::text,
        a.bc_location_code,
        a.bc_dimension1_code,
        a.bc_product_no,
        a.bc_service_item_no,
        a.is_blocked,
        a.is_inactive,
        a.is_disposed,
        a.is_on_rent,
        a.is_in_service,
        a.under_maintenance,
        a.book_value::numeric(14,2),
        coalesce(ls.invoice_line_count, 0),
        coalesce(ls.invoice_count, 0),
        coalesce(ls.lease_count, 0),
        coalesce(ls.lifetime_revenue, 0),
        coalesce(ls.last12m_revenue, 0),
        latest.document_no,
        latest.previous_no,
        coalesce(latest.bill_to_customer_no, latest.sell_to_customer_no),
        latest.customer_name,
        latest.invoice_from_date,
        latest.invoice_thru_date,
        latest.activity_at,
        case when a.source_payload is not null then 'business_central'::integration_provider else null::integration_provider end,
        a.source_payload is not null,
        concat_ws(' ', a.asset_number, a.type::text, a.subtype, a.serial_number, a.registration_number, a.manufacturer, b.code, b.name, a.fa_class_code, a.fa_subclass_code, latest.document_no, latest.previous_no, latest.customer_name),
        now()
      from assets a
      left join branches b on b.id = a.branch_id
      left join line_stats ls on ls.asset_number = a.asset_number
      left join latest on latest.asset_number = a.asset_number
    `,
  );
}

async function refreshCustomerSummary() {
  await replaceFromTemp(
    "customer_summary",
    "create temp table tmp_customer_summary (like customer_summary including defaults) on commit preserve rows",
    `
      insert into tmp_customer_summary (
        customer_id,
        customer_number,
        name,
        customer_type,
        parent_customer_number,
        responsibility_center,
        blocked,
        portal_enabled,
        branch_coverage,
        billing_city,
        location_count,
        location_names,
        contract_count,
        invoice_count,
        lease_count,
        equipment_count,
        lifetime_revenue,
        last12m_revenue,
        ar_balance,
        open_invoice_count,
        last_invoice_date,
        last_activity_date,
        source_provider,
        source_payload_available,
        search_text,
        refreshed_at
      )
      with location_stats as (
        select
          customer_id,
          count(*)::integer as location_count,
          jsonb_agg(name order by is_primary desc, name) as location_names
        from customer_locations
        group by customer_id
      ),
      contract_stats as (
        select customer_id, count(*)::integer as contract_count
        from contracts
        group by customer_id
      ),
      invoice_stats as (
        select
          coalesce(h.bill_to_customer_no, h.sell_to_customer_no) as customer_number,
          count(distinct h.document_no)::integer as invoice_count,
          count(distinct h.previous_no) filter (where h.previous_no is not null)::integer as lease_count,
          count(distinct l.item_no) filter (where l.type = 'Fixed Asset' and l.item_no is not null)::integer as equipment_count,
          coalesce(sum(l.gross_amount), 0)::numeric(18,2) as lifetime_revenue,
          coalesce(sum(l.gross_amount) filter (where coalesce(l.posting_date, h.posting_date) >= current_date - interval '12 months'), 0)::numeric(18,2) as last12m_revenue,
          max(h.posting_date) as last_invoice_date,
          max(coalesce(l.invoice_thru_date, l.invoice_from_date, l.posting_date, h.posting_date)) as last_activity_date
        from bc_rmi_posted_rental_invoice_headers h
        left join bc_rmi_posted_rental_lines l on l.document_type = h.document_type and l.document_no = h.document_no
        where coalesce(h.bill_to_customer_no, h.sell_to_customer_no) is not null
        group by coalesce(h.bill_to_customer_no, h.sell_to_customer_no)
      )
      select
        c.id,
        c.customer_number,
        c.name,
        c.customer_type::text,
        null::text,
        c.responsibility_center,
        false,
        c.portal_enabled,
        to_jsonb(c.branch_coverage),
        c.billing_address->>'city',
        coalesce(ls.location_count, 0),
        coalesce(ls.location_names, '[]'::jsonb),
        coalesce(cs.contract_count, 0),
        coalesce(inv.invoice_count, 0),
        coalesce(inv.lease_count, 0),
        coalesce(inv.equipment_count, 0),
        coalesce(inv.lifetime_revenue, 0),
        coalesce(inv.last12m_revenue, 0),
        coalesce(ar.ar_balance, 0),
        coalesce(ar.open_invoice_count, 0),
        inv.last_invoice_date,
        greatest(inv.last_activity_date, ar.latest_posting_date),
        case when c.source_payload is not null then 'business_central'::integration_provider else null::integration_provider end,
        c.source_payload is not null,
        concat_ws(' ', c.customer_number, c.name, c.responsibility_center, c.billing_address->>'city', c.billing_address->>'state', c.registration_number),
        now()
      from customers c
      left join location_stats ls on ls.customer_id = c.id
      left join contract_stats cs on cs.customer_id = c.id
      left join invoice_stats inv on inv.customer_number = c.customer_number
      left join ar_customer_summary ar on ar.customer_number = c.customer_number
    `,
  );
}

async function refreshRevenueRollups() {
  await replaceFromTemp(
    "revenue_rollup_monthly",
    "create temp table tmp_revenue_rollup_monthly (like revenue_rollup_monthly including defaults) on commit preserve rows",
    `
      insert into tmp_revenue_rollup_monthly
      select
        date_trunc('month', posting_date) as month,
        coalesce(sum(gross_amount), 0)::numeric(18,2),
        coalesce(sum(tax_amount), 0)::numeric(18,2),
        coalesce(sum(damage_waiver_amount), 0)::numeric(18,2),
        count(distinct document_no)::integer,
        count(distinct item_no) filter (where type = 'Fixed Asset' and item_no is not null)::integer,
        count(*)::integer,
        now()
      from bc_rmi_posted_rental_lines
      where posting_date is not null
      group by date_trunc('month', posting_date)
    `,
  );

  await replaceFromTemp(
    "equipment_revenue_rollup_monthly",
    "create temp table tmp_equipment_revenue_rollup_monthly (like equipment_revenue_rollup_monthly including defaults) on commit preserve rows",
    `
      insert into tmp_equipment_revenue_rollup_monthly
      select
        item_no || ':' || date_trunc('month', posting_date)::date::text,
        date_trunc('month', posting_date),
        item_no,
        coalesce(sum(gross_amount), 0)::numeric(18,2),
        count(distinct document_no)::integer,
        count(*)::integer,
        now()
      from bc_rmi_posted_rental_lines
      where type = 'Fixed Asset'
        and item_no is not null
        and posting_date is not null
      group by item_no, date_trunc('month', posting_date)
    `,
  );

  await replaceFromTemp(
    "customer_revenue_rollup_monthly",
    "create temp table tmp_customer_revenue_rollup_monthly (like customer_revenue_rollup_monthly including defaults) on commit preserve rows",
    `
      insert into tmp_customer_revenue_rollup_monthly
      select
        coalesce(h.bill_to_customer_no, h.sell_to_customer_no) || ':' || date_trunc('month', coalesce(l.posting_date, h.posting_date))::date::text,
        date_trunc('month', coalesce(l.posting_date, h.posting_date)),
        coalesce(h.bill_to_customer_no, h.sell_to_customer_no),
        coalesce(sum(l.gross_amount), 0)::numeric(18,2),
        count(distinct h.document_no)::integer,
        count(distinct l.item_no) filter (where l.type = 'Fixed Asset' and l.item_no is not null)::integer,
        now()
      from bc_rmi_posted_rental_invoice_headers h
      left join bc_rmi_posted_rental_lines l on l.document_type = h.document_type and l.document_no = h.document_no
      where coalesce(h.bill_to_customer_no, h.sell_to_customer_no) is not null
        and coalesce(l.posting_date, h.posting_date) is not null
      group by coalesce(h.bill_to_customer_no, h.sell_to_customer_no), date_trunc('month', coalesce(l.posting_date, h.posting_date))
    `,
  );

  await replaceFromTemp(
    "branch_revenue_rollup_monthly",
    "create temp table tmp_branch_revenue_rollup_monthly (like branch_revenue_rollup_monthly including defaults) on commit preserve rows",
    `
      insert into tmp_branch_revenue_rollup_monthly
      select
        coalesce(location_code, shortcut_dimension1_code, 'Unassigned') || ':' || date_trunc('month', posting_date)::date::text,
        date_trunc('month', posting_date),
        coalesce(location_code, shortcut_dimension1_code, 'Unassigned'),
        coalesce(sum(gross_amount), 0)::numeric(18,2),
        count(distinct document_no)::integer,
        count(*)::integer,
        now()
      from bc_rmi_posted_rental_lines
      where posting_date is not null
      group by coalesce(location_code, shortcut_dimension1_code, 'Unassigned'), date_trunc('month', posting_date)
    `,
  );

  await replaceFromTemp(
    "deal_code_revenue_rollup_monthly",
    "create temp table tmp_deal_code_revenue_rollup_monthly (like deal_code_revenue_rollup_monthly including defaults) on commit preserve rows",
    `
      insert into tmp_deal_code_revenue_rollup_monthly
      select
        coalesce(deal_code, 'Unassigned') || ':' || date_trunc('month', posting_date)::date::text,
        date_trunc('month', posting_date),
        coalesce(deal_code, 'Unassigned'),
        coalesce(sum(gross_amount), 0)::numeric(18,2),
        count(distinct document_no)::integer,
        count(*)::integer,
        now()
      from bc_rmi_posted_rental_lines
      where posting_date is not null
      group by coalesce(deal_code, 'Unassigned'), date_trunc('month', posting_date)
    `,
  );
}

async function refreshFinanceDashboardSnapshot() {
  await replaceFromTemp(
    "finance_dashboard_snapshot",
    "create temp table tmp_finance_dashboard_snapshot (like finance_dashboard_snapshot including defaults) on commit preserve rows",
    `
      insert into tmp_finance_dashboard_snapshot (
        snapshot_key,
        period_start,
        period_end,
        gross_revenue,
        tax_amount,
        damage_waiver_amount,
        invoice_count,
        credit_memo_count,
        equipment_count,
        lease_count,
        ar_balance,
        open_ar_balance,
        unapplied_receipts,
        revenue_by_month,
        revenue_by_equipment_type,
        revenue_by_branch,
        revenue_by_customer,
        revenue_by_lease,
        revenue_by_deal_code,
        ar_aging,
        recent_activity,
        exceptions,
        source_row_counts,
        refreshed_at
      )
      select
        'current',
        current_date - interval '24 months',
        now(),
        coalesce((select sum(gross_revenue) from revenue_rollup_monthly), 0)::numeric(18,2),
        coalesce((select sum(tax_amount) from revenue_rollup_monthly), 0)::numeric(18,2),
        coalesce((select sum(damage_waiver_amount) from revenue_rollup_monthly), 0)::numeric(18,2),
        coalesce((select count(*) from invoice_register_summary where source = 'business_central'), 0)::integer,
        coalesce((select count(*) from invoice_register_summary where source = 'business_central' and document_type ilike '%credit%'), 0)::integer,
        coalesce((select count(*) from equipment_summary where invoice_line_count > 0), 0)::integer,
        coalesce((select count(*) from lease_summary where source = 'business_central'), 0)::integer,
        coalesce((select sum(ar_balance) from ar_customer_summary), 0)::numeric(18,2),
        coalesce((select sum(ar_balance) from ar_customer_summary), 0)::numeric(18,2),
        0::numeric(18,2),
        coalesce((select jsonb_agg(jsonb_build_object('month', month, 'grossRevenue', gross_revenue, 'invoiceCount', invoice_count, 'equipmentCount', equipment_count) order by month desc) from (select * from revenue_rollup_monthly order by month desc limit 18) rows), '[]'::jsonb),
        coalesce((select jsonb_agg(jsonb_build_object('equipmentType', asset_type, 'grossRevenue', gross, 'lineCount', line_count, 'equipmentCount', equipment_count) order by gross desc) from (select asset_type, sum(lifetime_revenue) as gross, sum(invoice_line_count)::integer as line_count, count(*)::integer as equipment_count from equipment_summary group by asset_type order by sum(lifetime_revenue) desc limit 12) rows), '[]'::jsonb),
        coalesce((select jsonb_agg(jsonb_build_object('branchCode', branch_code, 'grossRevenue', gross, 'lineCount', line_count) order by gross desc) from (select branch_code, sum(gross_revenue) as gross, sum(line_count)::integer as line_count from branch_revenue_rollup_monthly group by branch_code order by sum(gross_revenue) desc limit 12) rows), '[]'::jsonb),
        coalesce((select jsonb_agg(jsonb_build_object('customerNumber', customer_number, 'customerName', name, 'grossRevenue', lifetime_revenue, 'invoiceCount', invoice_count) order by lifetime_revenue desc) from (select customer_number, name, lifetime_revenue, invoice_count from customer_summary order by lifetime_revenue desc limit 12) rows), '[]'::jsonb),
        coalesce((select jsonb_agg(jsonb_build_object('leaseKey', lease_key, 'customerNumber', customer_number, 'customerName', customer_name, 'grossRevenue', gross_revenue, 'invoiceCount', invoice_count, 'equipmentCount', equipment_count) order by gross_revenue desc) from (select * from lease_summary order by gross_revenue desc limit 12) rows), '[]'::jsonb),
        coalesce((select jsonb_agg(jsonb_build_object('dealCode', deal_code, 'grossRevenue', gross, 'lineCount', line_count) order by gross desc) from (select deal_code, sum(gross_revenue) as gross, sum(line_count)::integer as line_count from deal_code_revenue_rollup_monthly group by deal_code order by sum(gross_revenue) desc limit 12) rows), '[]'::jsonb),
        coalesce((select jsonb_agg(jsonb_build_object('bucket', bucket, 'balance', balance, 'entryCount', entry_count) order by bucket) from ar_aging_snapshot), '[]'::jsonb),
        coalesce((select jsonb_agg(jsonb_build_object('entryNo', document_no, 'documentNo', document_no, 'orderNo', previous_no, 'equipmentNo', null, 'customerNo', customer_number, 'postingDate', posting_date, 'grossAmount', total_amount, 'dealCode', null) order by posting_date desc nulls last) from (select * from invoice_register_summary where source = 'business_central' order by posting_date desc nulls last, document_no desc limit 20) rows), '[]'::jsonb),
        jsonb_build_object(
          'unmatchedAssetLines', 0,
          'unmatchedCustomerInvoices', (select count(*) from invoice_register_summary where source = 'business_central' and customer_number is not null and not exists (select 1 from customers c where c.customer_number = invoice_register_summary.customer_number)),
          'missingDimensionLines', 0
        ),
        jsonb_build_object(
          'equipmentSummary', (select count(*) from equipment_summary),
          'customerSummary', (select count(*) from customer_summary),
          'invoiceRegisterSummary', (select count(*) from invoice_register_summary),
          'leaseSummary', (select count(*) from lease_summary)
        ),
        now()
    `,
  );
}

export async function refreshAllReadModels(): Promise<RefreshResult> {
  const id = `read-model-${new Date().toISOString()}-${randomUUID()}`;
  const summaryVersion = new Date().toISOString();
  const rowCounts: RefreshCounts = {};
  const timingsMs: RefreshTimings = {};

  const lockResult = await pool.query<{ locked: boolean }>(
    "select pg_try_advisory_lock($1) as locked",
    [REFRESH_LOCK_KEY],
  );
  if (!lockResult.rows[0]?.locked) {
    throw new Error("A read-model refresh is already running.");
  }

  await pool.query(
    `
      insert into read_model_refresh_runs (id, status, summary_version)
      values ($1, 'running', $2)
    `,
    [id, summaryVersion],
  );

  try {
    await timed("invoiceRegisterSummary", timingsMs, refreshInvoiceRegisterSummary);
    rowCounts.invoiceRegisterSummary = await countRows("invoice_register_summary");

    await timed("leaseSummary", timingsMs, refreshLeaseSummary);
    rowCounts.leaseSummary = await countRows("lease_summary");

    await timed("arSummaries", timingsMs, refreshArSummaries);
    rowCounts.arCustomerSummary = await countRows("ar_customer_summary");
    rowCounts.arAgingSnapshot = await countRows("ar_aging_snapshot");

    await timed("equipmentSummary", timingsMs, refreshEquipmentSummary);
    rowCounts.equipmentSummary = await countRows("equipment_summary");

    await timed("customerSummary", timingsMs, refreshCustomerSummary);
    rowCounts.customerSummary = await countRows("customer_summary");

    await timed("revenueRollups", timingsMs, refreshRevenueRollups);
    rowCounts.revenueRollupMonthly = await countRows("revenue_rollup_monthly");
    rowCounts.equipmentRevenueRollupMonthly = await countRows(
      "equipment_revenue_rollup_monthly",
    );
    rowCounts.customerRevenueRollupMonthly = await countRows(
      "customer_revenue_rollup_monthly",
    );
    rowCounts.branchRevenueRollupMonthly = await countRows(
      "branch_revenue_rollup_monthly",
    );
    rowCounts.dealCodeRevenueRollupMonthly = await countRows(
      "deal_code_revenue_rollup_monthly",
    );

    await timed("financeDashboardSnapshot", timingsMs, refreshFinanceDashboardSnapshot);
    rowCounts.financeDashboardSnapshot = await countRows("finance_dashboard_snapshot");

    await timed("globalSearchIndex", timingsMs, async () => {
      rowCounts.globalSearchDocuments = await rebuildGlobalSearchIndex();
    });

    await timed("cacheInvalidation", timingsMs, async () => {
      await invalidateWorkspaceCache([
        "read-models",
        "equipment-summary",
        "customer-summary",
        "finance-dashboard",
        "invoice-register",
        "lease-summary",
      ]);
    });

    await pool.query(
      `
        update read_model_refresh_runs
        set status = 'succeeded',
            finished_at = now(),
            row_counts = $2::jsonb,
            timings_ms = $3::jsonb
        where id = $1
      `,
      [id, JSON.stringify(rowCounts), JSON.stringify(timingsMs)],
    );

    return { id, summaryVersion, rowCounts, timingsMs };
  } catch (error) {
    await pool.query(
      `
        update read_model_refresh_runs
        set status = 'failed',
            finished_at = now(),
            error_message = $2,
            row_counts = $3::jsonb,
            timings_ms = $4::jsonb
        where id = $1
      `,
      [
        id,
        error instanceof Error ? error.message : String(error),
        JSON.stringify(rowCounts),
        JSON.stringify(timingsMs),
      ],
    );
    throw error;
  } finally {
    await pool.query("select pg_advisory_unlock($1)", [REFRESH_LOCK_KEY]).catch(
      () => undefined,
    );
  }
}
