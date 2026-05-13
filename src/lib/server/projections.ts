import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";

import { pool } from "@/lib/db";
import { rebuildGlobalSearchIndex } from "@/lib/server/search-index";
import { syncTypesenseDocuments } from "@/lib/server/search/search-provider";
import { invalidateWorkspaceCache } from "@/lib/server/workspace-cache";

type ProjectionCounts = Record<string, number>;
type ProjectionTimings = Record<string, number>;

export type ProjectionEvent = {
  id: string;
  eventType: string;
  sourceTable: string;
  sourceId: string;
  entityType?: string | null;
  entityId?: string | null;
  payload?: Record<string, unknown>;
};

export type ProjectionWatermark = {
  projectionName: string;
  lastEventId: string | null;
  lastProcessedAt: string | null;
  projectionVersion: string;
  status: string;
  errorMessage: string | null;
};

export type ProjectionRunResult = {
  id: string;
  rowCounts: ProjectionCounts;
  timingsMs: ProjectionTimings;
};

const PROJECTION_LOCK_KEY = 720_360_002;

async function countRows(tableName: string) {
  const result = await pool.query<{ count: string }>(
    `select count(*)::text as count from ${tableName}`,
  );
  return Number(result.rows[0]?.count ?? 0);
}

async function timed<T>(
  name: string,
  timings: ProjectionTimings,
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

async function setWatermark(
  projectionName: string,
  status: string,
  projectionVersion: string,
  errorMessage?: string | null,
) {
  await pool.query(
    `
      insert into projection_watermarks (
        projection_name,
        last_processed_at,
        projection_version,
        status,
        error_message,
        updated_at
      )
      values ($1, now(), $2, $3, $4, now())
      on conflict (projection_name) do update set
        last_processed_at = excluded.last_processed_at,
        projection_version = excluded.projection_version,
        status = excluded.status,
        error_message = excluded.error_message,
        updated_at = now()
    `,
    [projectionName, projectionVersion, status, errorMessage ?? null],
  );
}

export async function enqueueProjectionEvent(event: Omit<ProjectionEvent, "id">) {
  const id = randomUUID();
  await pool.query(
    `
      insert into projection_events (
        id,
        event_type,
        source_table,
        source_id,
        entity_type,
        entity_id,
        payload
      )
      values ($1, $2, $3, $4, $5, $6, $7::jsonb)
    `,
    [
      id,
      event.eventType,
      event.sourceTable,
      event.sourceId,
      event.entityType ?? null,
      event.entityId ?? null,
      JSON.stringify(event.payload ?? {}),
    ],
  );
  return id;
}

async function rebuildRentalBillingFacts() {
  await replaceFromTemp(
    "rental_billing_facts",
    "create temp table tmp_rental_billing_facts (like rental_billing_facts including defaults) on commit preserve rows",
    `
      insert into tmp_rental_billing_facts (
        id,
        source_provider,
        source_row_id,
        document_type,
        document_no,
        line_no,
        line_key,
        lease_key,
        customer_number,
        customer_id,
        customer_name,
        asset_number,
        asset_id,
        asset_type,
        branch_code,
        location_code,
        deal_code,
        posting_date,
        service_period_start,
        service_period_end,
        line_kind,
        description,
        quantity,
        unit_price,
        gross_amount,
        tax_amount,
        damage_waiver_amount,
        total_amount,
        source_imported_at,
        source_updated_at,
        search_text,
        refreshed_at
      )
      select
        'bc_rmi_line:' || l.id,
        'business_central',
        l.id,
        l.document_type,
        l.document_no,
        l.line_no,
        concat_ws(':', l.document_type, l.document_no, l.line_no::text),
        l.previous_no,
        coalesce(h.bill_to_customer_no, h.sell_to_customer_no),
        c.id,
        c.name,
        case when l.type = 'Fixed Asset' then l.item_no else null end,
        a.id,
        a.type::text,
        coalesce(l.location_code, l.shortcut_dimension1_code, h.location_code, h.shortcut_dimension1_code),
        l.location_code,
        l.deal_code,
        coalesce(l.posting_date, h.posting_date),
        coalesce(l.invoice_from_date, l.from_date),
        coalesce(l.invoice_thru_date, l.thru_date),
        coalesce(l.line_type, l.type),
        l.description,
        l.quantity,
        l.unit_price,
        coalesce(l.gross_amount, 0)::numeric(18,2),
        coalesce(l.tax_amount, 0)::numeric(18,2),
        coalesce(l.damage_waiver_amount, 0)::numeric(18,2),
        (
          coalesce(l.gross_amount, 0) +
          coalesce(l.tax_amount, 0) +
          coalesce(l.damage_waiver_amount, 0)
        )::numeric(18,2),
        l.imported_at,
        greatest(l.imported_at, coalesce(h.imported_at, l.imported_at)),
        concat_ws(
          ' ',
          l.document_no,
          l.previous_no,
          l.item_no,
          l.description,
          coalesce(h.bill_to_customer_no, h.sell_to_customer_no),
          c.name,
          l.deal_code,
          l.location_code,
          l.shortcut_dimension1_code
        ),
        now()
      from bc_rmi_posted_rental_lines l
      left join bc_rmi_posted_rental_invoice_headers h
        on h.document_type = l.document_type
       and h.document_no = l.document_no
      left join customers c
        on c.customer_number = coalesce(h.bill_to_customer_no, h.sell_to_customer_no)
      left join assets a
        on a.asset_number = l.item_no
       and l.type = 'Fixed Asset'
    `,
  );
}

async function rebuildArLedgerFacts() {
  await replaceFromTemp(
    "ar_ledger_facts",
    "create temp table tmp_ar_ledger_facts (like ar_ledger_facts including defaults) on commit preserve rows",
    `
      insert into tmp_ar_ledger_facts (
        id,
        source_provider,
        source_row_id,
        external_entry_no,
        customer_number,
        customer_id,
        customer_name,
        posting_date,
        document_no,
        document_type,
        description,
        amount,
        remaining_amount,
        is_open,
        due_date,
        source_imported_at,
        search_text,
        refreshed_at
      )
      select
        'bc_customer_ledger:' || e.id,
        'business_central',
        e.id,
        e.external_entry_no,
        e.customer_no,
        c.id,
        c.name,
        e.posting_date,
        e.document_no,
        nullif(e.payload->>'Document_Type', ''),
        nullif(e.payload->>'Description', ''),
        coalesce(e.amount, 0)::numeric(18,2),
        coalesce(
          nullif(
            regexp_replace(
              coalesce(e.payload->>'Remaining_Amount', e.payload->>'Remaining_Amt_LCY', e.amount::text, '0'),
              '[^0-9.-]',
              '',
              'g'
            ),
            ''
          )::numeric,
          0
        )::numeric(18,2),
        lower(coalesce(e.payload->>'Open', 'false')) = 'true',
        case
          when coalesce(e.payload->>'Due_Date', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' then (e.payload->>'Due_Date')::timestamptz
          else null
        end,
        e.imported_at,
        concat_ws(' ', e.external_entry_no, e.customer_no, c.name, e.document_no, e.payload->>'Document_Type', e.payload->>'Description'),
        now()
      from bc_customer_ledger_entries e
      left join customers c on c.customer_number = e.customer_no
    `,
  );
}

async function rebuildRentalInvoiceFacts() {
  await replaceFromTemp(
    "rental_invoice_facts",
    "create temp table tmp_rental_invoice_facts (like rental_invoice_facts including defaults) on commit preserve rows",
    `
      insert into tmp_rental_invoice_facts (
        id,
        source_provider,
        source_row_id,
        document_type,
        document_no,
        lease_key,
        previous_document_type,
        customer_number,
        customer_id,
        customer_name,
        posting_date,
        document_date,
        due_date,
        branch_code,
        responsibility_center,
        line_count,
        fixed_asset_line_count,
        equipment_count,
        gross_amount,
        tax_amount,
        damage_waiver_amount,
        total_amount,
        ar_balance,
        status,
        source_imported_at,
        search_text,
        refreshed_at
      )
      with line_stats as (
        select
          document_type,
          document_no,
          count(*)::integer as line_count,
          count(*) filter (where asset_number is not null)::integer as fixed_asset_line_count,
          count(distinct asset_number) filter (where asset_number is not null)::integer as equipment_count,
          coalesce(sum(gross_amount), 0)::numeric(18,2) as gross_amount,
          coalesce(sum(tax_amount), 0)::numeric(18,2) as tax_amount,
          coalesce(sum(damage_waiver_amount), 0)::numeric(18,2) as damage_waiver_amount,
          coalesce(sum(total_amount), 0)::numeric(18,2) as total_amount
        from rental_billing_facts
        where source_provider = 'business_central'
        group by document_type, document_no
      ),
      ledger as (
        select
          document_no,
          coalesce(sum(remaining_amount) filter (where is_open), 0)::numeric(18,2) as ar_balance
        from ar_ledger_facts
        where source_provider = 'business_central'
        group by document_no
      )
      select
        'bc_rmi_invoice:' || h.id,
        'business_central',
        h.id,
        h.document_type,
        h.document_no,
        h.previous_no,
        h.previous_doc_type,
        coalesce(h.bill_to_customer_no, h.sell_to_customer_no),
        c.id,
        c.name,
        h.posting_date,
        h.document_date,
        h.due_date,
        coalesce(h.location_code, h.shortcut_dimension1_code),
        h.responsibility_center,
        coalesce(ls.line_count, 0),
        coalesce(ls.fixed_asset_line_count, 0),
        coalesce(ls.equipment_count, 0),
        coalesce(ls.gross_amount, 0),
        coalesce(ls.tax_amount, 0),
        coalesce(ls.damage_waiver_amount, 0),
        coalesce(ls.total_amount, 0),
        ledger.ar_balance,
        h.document_type,
        h.imported_at,
        concat_ws(
          ' ',
          h.document_no,
          h.previous_no,
          h.bill_to_customer_no,
          h.sell_to_customer_no,
          c.name,
          h.external_document_no,
          h.document_type
        ),
        now()
      from bc_rmi_posted_rental_invoice_headers h
      left join customers c on c.customer_number = coalesce(h.bill_to_customer_no, h.sell_to_customer_no)
      left join line_stats ls
        on ls.document_type = h.document_type
       and ls.document_no = h.document_no
      left join ledger on ledger.document_no = h.document_no
    `,
  );
}

async function rebuildInvoiceLineRegister() {
  await replaceFromTemp(
    "invoice_line_register",
    "create temp table tmp_invoice_line_register (like invoice_line_register including defaults) on commit preserve rows",
    `
      insert into tmp_invoice_line_register (
        id,
        source_provider,
        document_type,
        document_no,
        line_no,
        lease_key,
        customer_number,
        customer_name,
        asset_id,
        asset_number,
        asset_type,
        branch_code,
        line_kind,
        description,
        quantity,
        unit_price,
        gross_amount,
        tax_amount,
        damage_waiver_amount,
        total_amount,
        service_period_start,
        service_period_end,
        posting_date,
        search_text,
        refreshed_at
      )
      select
        id,
        source_provider,
        document_type,
        document_no,
        line_no,
        lease_key,
        customer_number,
        customer_name,
        asset_id,
        asset_number,
        asset_type,
        branch_code,
        line_kind,
        description,
        quantity,
        unit_price,
        gross_amount,
        tax_amount,
        damage_waiver_amount,
        total_amount,
        service_period_start,
        service_period_end,
        posting_date,
        search_text,
        now()
      from rental_billing_facts
    `,
  );
}

async function rebuildEquipmentDetailSummary() {
  await replaceFromTemp(
    "equipment_detail_summary",
    "create temp table tmp_equipment_detail_summary (like equipment_detail_summary including defaults) on commit preserve rows",
    `
      insert into tmp_equipment_detail_summary (
        asset_id,
        asset_number,
        asset_type,
        asset_subtype,
        branch_code,
        branch_name,
        status,
        availability,
        maintenance_status,
        serial_number,
        manufacturer,
        model_year,
        registration_number,
        fa_class_code,
        fa_subclass_code,
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
        first_billed_at,
        latest_billed_at,
        latest_invoice_no,
        latest_lease_key,
        latest_customer_no,
        latest_customer_name,
        source_provider,
        source_external_id,
        source_payload_available,
        search_text,
        refreshed_at
      )
      with billing as (
        select
          asset_number,
          count(*)::integer as invoice_line_count,
          count(distinct document_no)::integer as invoice_count,
          count(distinct lease_key) filter (where lease_key is not null)::integer as lease_count,
          coalesce(sum(gross_amount), 0)::numeric(18,2) as lifetime_revenue,
          min(service_period_start) as first_billed_at,
          max(coalesce(service_period_end, service_period_start, posting_date)) as latest_billed_at
        from rental_billing_facts
        where asset_number is not null
        group by asset_number
      ),
      latest as (
        select *
        from (
          select
            asset_number,
            document_no,
            lease_key,
            customer_number,
            customer_name,
            row_number() over (
              partition by asset_number
              order by coalesce(service_period_end, service_period_start, posting_date) desc nulls last, document_no desc
            ) as rn
          from rental_billing_facts
          where asset_number is not null
        ) ranked
        where rn = 1
      ),
      mappings as (
        select distinct on (internal_id)
          internal_id,
          external_id
        from external_entity_mappings
        where provider = 'business_central'
          and entity_type = 'bc_asset'
        order by internal_id, updated_at desc nulls last
      )
      select
        a.id,
        a.asset_number,
        a.type::text,
        a.subtype,
        b.code,
        b.name,
        a.status::text,
        a.availability::text,
        a.maintenance_status::text,
        a.serial_number,
        a.manufacturer,
        a.model_year,
        a.registration_number,
        a.fa_class_code,
        a.fa_subclass_code,
        a.bc_location_code,
        a.bc_dimension1_code,
        a.bc_product_no,
        a.bc_service_item_no,
        coalesce(a.is_blocked, false),
        coalesce(a.is_inactive, false),
        coalesce(a.is_disposed, false),
        coalesce(a.is_on_rent, false),
        coalesce(a.is_in_service, true),
        coalesce(a.under_maintenance, false),
        a.book_value,
        coalesce(billing.invoice_line_count, 0),
        coalesce(billing.invoice_count, 0),
        coalesce(billing.lease_count, 0),
        coalesce(billing.lifetime_revenue, 0),
        billing.first_billed_at,
        billing.latest_billed_at,
        latest.document_no,
        latest.lease_key,
        latest.customer_number,
        latest.customer_name,
        case when mappings.external_id is not null then 'business_central' else 'internal' end,
        mappings.external_id,
        a.source_payload is not null,
        concat_ws(' ', a.asset_number, a.serial_number, a.registration_number, a.manufacturer, a.fa_class_code, a.fa_subclass_code, b.code, latest.customer_name),
        now()
      from assets a
      left join branches b on b.id = a.branch_id
      left join billing on billing.asset_number = a.asset_number
      left join latest on latest.asset_number = a.asset_number
      left join mappings on mappings.internal_id = a.id
    `,
  );
}

async function rebuildCustomerDetailSummary() {
  await replaceFromTemp(
    "customer_detail_summary",
    "create temp table tmp_customer_detail_summary (like customer_detail_summary including defaults) on commit preserve rows",
    `
      insert into tmp_customer_detail_summary (
        customer_id,
        customer_number,
        name,
        customer_type,
        parent_customer_number,
        responsibility_center,
        billing_city,
        portal_enabled,
        blocked,
        locations,
        contract_count,
        invoice_count,
        lease_count,
        equipment_count,
        lifetime_revenue,
        tax_amount,
        damage_waiver_amount,
        ar_balance,
        first_invoice_date,
        latest_invoice_date,
        latest_activity_date,
        source_provider,
        source_external_id,
        source_payload_available,
        search_text,
        refreshed_at
      )
      with billing as (
        select
          customer_number,
          count(distinct document_no)::integer as invoice_count,
          count(distinct lease_key) filter (where lease_key is not null)::integer as lease_count,
          count(distinct asset_number) filter (where asset_number is not null)::integer as equipment_count,
          coalesce(sum(gross_amount), 0)::numeric(18,2) as lifetime_revenue,
          coalesce(sum(tax_amount), 0)::numeric(18,2) as tax_amount,
          coalesce(sum(damage_waiver_amount), 0)::numeric(18,2) as damage_waiver_amount,
          min(posting_date) as first_invoice_date,
          max(posting_date) as latest_invoice_date,
          max(coalesce(service_period_end, service_period_start, posting_date)) as latest_activity_date
        from rental_billing_facts
        where customer_number is not null
        group by customer_number
      ),
      ar as (
        select
          customer_number,
          coalesce(sum(remaining_amount) filter (where is_open), 0)::numeric(18,2) as ar_balance
        from ar_ledger_facts
        where customer_number is not null
        group by customer_number
      ),
      contract_counts as (
        select customer_id, count(*)::integer as contract_count
        from contracts
        group by customer_id
      ),
      locations as (
        select
          customer_id,
          jsonb_agg(
            jsonb_build_object(
              'id', id,
              'name', name,
              'address', coalesce(address->>'line1', address->>'city', ''),
              'contactPerson', coalesce(contact_info->>'name', contact_info->>'contactPerson', '')
            )
            order by name
          ) as locations
        from customer_locations
        group by customer_id
      ),
      mappings as (
        select distinct on (internal_id)
          internal_id,
          external_id
        from external_entity_mappings
        where provider = 'business_central'
          and entity_type = 'bc_customer'
        order by internal_id, updated_at desc nulls last
      )
      select
        c.id,
        c.customer_number,
        c.name,
        c.customer_type::text,
        nullif(c.source_payload->>'Parent_Customer_No', ''),
        nullif(c.source_payload->>'Responsibility_Center', ''),
        coalesce(c.billing_address->>'city', c.billing_address->>'City'),
        c.portal_enabled,
        lower(coalesce(c.source_payload->>'Blocked', 'false')) not in ('', 'false', 'no', '0'),
        coalesce(locations.locations, '[]'::jsonb),
        coalesce(contract_counts.contract_count, 0),
        coalesce(billing.invoice_count, 0),
        coalesce(billing.lease_count, 0),
        coalesce(billing.equipment_count, 0),
        coalesce(billing.lifetime_revenue, 0),
        coalesce(billing.tax_amount, 0),
        coalesce(billing.damage_waiver_amount, 0),
        coalesce(ar.ar_balance, 0),
        billing.first_invoice_date,
        billing.latest_invoice_date,
        greatest(billing.latest_activity_date, billing.latest_invoice_date),
        case when mappings.external_id is not null then 'business_central' else 'internal' end,
        mappings.external_id,
        c.source_payload is not null,
        concat_ws(' ', c.customer_number, c.name, c.customer_type::text, c.billing_address::text),
        now()
      from customers c
      left join billing on billing.customer_number = c.customer_number
      left join ar on ar.customer_number = c.customer_number
      left join contract_counts on contract_counts.customer_id = c.id
      left join locations on locations.customer_id = c.id
      left join mappings on mappings.internal_id = c.id
    `,
  );
}

async function rebuildRelationshipProjections() {
  await replaceFromTemp(
    "equipment_customer_history",
    "create temp table tmp_equipment_customer_history (like equipment_customer_history including defaults) on commit preserve rows",
    `
      insert into tmp_equipment_customer_history (
        id,
        asset_id,
        asset_number,
        customer_id,
        customer_number,
        customer_name,
        lease_key,
        latest_invoice_no,
        first_billed_at,
        latest_billed_at,
        invoice_count,
        line_count,
        gross_amount,
        refreshed_at
      )
      select
        'equipment_customer:' || md5(concat_ws(':', asset_number, customer_number, coalesce(lease_key, ''))),
        max(asset_id),
        asset_number,
        max(customer_id),
        customer_number,
        max(customer_name),
        lease_key,
        (array_agg(document_no order by posting_date desc nulls last, document_no desc))[1],
        min(service_period_start),
        max(coalesce(service_period_end, service_period_start, posting_date)),
        count(distinct document_no)::integer,
        count(*)::integer,
        coalesce(sum(gross_amount), 0)::numeric(18,2),
        now()
      from rental_billing_facts
      where asset_number is not null
        and customer_number is not null
      group by asset_number, customer_number, lease_key
    `,
  );

  await replaceFromTemp(
    "customer_equipment_history",
    "create temp table tmp_customer_equipment_history (like customer_equipment_history including defaults) on commit preserve rows",
    `
      insert into tmp_customer_equipment_history (
        id,
        customer_id,
        customer_number,
        customer_name,
        asset_id,
        asset_number,
        asset_type,
        latest_invoice_no,
        latest_lease_key,
        first_billed_at,
        latest_billed_at,
        invoice_count,
        line_count,
        gross_amount,
        refreshed_at
      )
      select
        'customer_equipment:' || md5(concat_ws(':', customer_number, asset_number)),
        max(customer_id),
        customer_number,
        max(customer_name),
        max(asset_id),
        asset_number,
        max(asset_type),
        (array_agg(document_no order by posting_date desc nulls last, document_no desc))[1],
        (array_agg(lease_key order by posting_date desc nulls last) filter (where lease_key is not null))[1],
        min(service_period_start),
        max(coalesce(service_period_end, service_period_start, posting_date)),
        count(distinct document_no)::integer,
        count(*)::integer,
        coalesce(sum(gross_amount), 0)::numeric(18,2),
        now()
      from rental_billing_facts
      where customer_number is not null
        and asset_number is not null
      group by customer_number, asset_number
    `,
  );

  await replaceFromTemp(
    "lease_equipment_summary",
    "create temp table tmp_lease_equipment_summary (like lease_equipment_summary including defaults) on commit preserve rows",
    `
      insert into tmp_lease_equipment_summary (
        id,
        lease_key,
        customer_number,
        customer_name,
        asset_id,
        asset_number,
        asset_type,
        invoice_count,
        line_count,
        gross_amount,
        first_billed_at,
        latest_billed_at,
        refreshed_at
      )
      select
        'lease_equipment:' || md5(concat_ws(':', lease_key, asset_number)),
        lease_key,
        max(customer_number),
        max(customer_name),
        max(asset_id),
        asset_number,
        max(asset_type),
        count(distinct document_no)::integer,
        count(*)::integer,
        coalesce(sum(gross_amount), 0)::numeric(18,2),
        min(service_period_start),
        max(coalesce(service_period_end, service_period_start, posting_date)),
        now()
      from rental_billing_facts
      where lease_key is not null
        and asset_number is not null
      group by lease_key, asset_number
    `,
  );
}

async function rebuildEntityActivityFacts() {
  await replaceFromTemp(
    "entity_activity_facts",
    "create temp table tmp_entity_activity_facts (like entity_activity_facts including defaults) on commit preserve rows",
    `
      insert into tmp_entity_activity_facts (
        id,
        entity_type,
        entity_id,
        related_entity_type,
        related_entity_id,
        activity_type,
        activity_at,
        title,
        subtitle,
        amount,
        href,
        source_provider,
        source_row_id,
        search_text,
        refreshed_at
      )
      select
        'asset_invoice:' || id,
        'asset',
        asset_id,
        'invoice',
        document_no,
        'invoice_line',
        posting_date,
        document_no,
        concat_ws(' / ', customer_name, lease_key, asset_number),
        gross_amount,
        '/ar/invoices/' || document_no,
        source_provider,
        source_row_id,
        search_text,
        now()
      from rental_billing_facts
      where asset_id is not null
      union all
      select
        'customer_invoice:' || id,
        'customer',
        customer_id,
        'invoice',
        document_no,
        'invoice_line',
        posting_date,
        document_no,
        concat_ws(' / ', asset_number, lease_key),
        gross_amount,
        '/ar/invoices/' || document_no,
        source_provider,
        source_row_id,
        search_text,
        now()
      from rental_billing_facts
      where customer_id is not null
    `,
  );
}

export async function rebuildServingFacts(): Promise<ProjectionRunResult> {
  const id = randomUUID();
  const timingsMs: ProjectionTimings = {};
  const rowCounts: ProjectionCounts = {};
  const projectionVersion = new Date().toISOString();

  const lock = await pool.query<{ locked: boolean }>(
    "select pg_try_advisory_lock($1) as locked",
    [PROJECTION_LOCK_KEY],
  );
  if (!lock.rows[0]?.locked) {
    throw new Error("A serving projection rebuild is already running.");
  }

  await setWatermark("serving_layer", "running", projectionVersion);
  try {
    await timed("rentalBillingFacts", timingsMs, rebuildRentalBillingFacts);
    rowCounts.rentalBillingFacts = await countRows("rental_billing_facts");

    await timed("arLedgerFacts", timingsMs, rebuildArLedgerFacts);
    rowCounts.arLedgerFacts = await countRows("ar_ledger_facts");

    await timed("rentalInvoiceFacts", timingsMs, rebuildRentalInvoiceFacts);
    rowCounts.rentalInvoiceFacts = await countRows("rental_invoice_facts");

    await timed("invoiceLineRegister", timingsMs, rebuildInvoiceLineRegister);
    rowCounts.invoiceLineRegister = await countRows("invoice_line_register");

    await timed("equipmentDetailSummary", timingsMs, rebuildEquipmentDetailSummary);
    rowCounts.equipmentDetailSummary = await countRows("equipment_detail_summary");

    await timed("customerDetailSummary", timingsMs, rebuildCustomerDetailSummary);
    rowCounts.customerDetailSummary = await countRows("customer_detail_summary");

    await timed("relationshipProjections", timingsMs, rebuildRelationshipProjections);
    rowCounts.equipmentCustomerHistory = await countRows("equipment_customer_history");
    rowCounts.customerEquipmentHistory = await countRows("customer_equipment_history");
    rowCounts.leaseEquipmentSummary = await countRows("lease_equipment_summary");

    await timed("entityActivityFacts", timingsMs, rebuildEntityActivityFacts);
    rowCounts.entityActivityFacts = await countRows("entity_activity_facts");

    await timed("globalSearchDocuments", timingsMs, rebuildGlobalSearchIndex);
    rowCounts.globalSearchDocuments = await countRows("global_search_documents");

    await timed("typesenseSync", timingsMs, () => syncTypesenseDocuments({ full: true }));

    await setWatermark("serving_layer", "ready", projectionVersion);
    await invalidateWorkspaceCache([
      "read-models",
      "finance-dashboard",
      "equipment",
      "customers",
      "invoices",
      "leases",
      "search",
    ]);

    return {
      id,
      rowCounts,
      timingsMs,
    };
  } catch (error) {
    await setWatermark(
      "serving_layer",
      "failed",
      projectionVersion,
      error instanceof Error ? error.message : String(error),
    );
    throw error;
  } finally {
    await pool.query("select pg_advisory_unlock($1)", [PROJECTION_LOCK_KEY]).catch(
      () => undefined,
    );
  }
}

export async function processProjectionEvents(limit = 500): Promise<ProjectionRunResult> {
  const id = randomUUID();
  const timingsMs: ProjectionTimings = {};
  const rowCounts: ProjectionCounts = {};

  const events = await pool.query<{ id: string }>(
    `
      select id
      from projection_events
      where status = 'pending'
      order by created_at
      limit $1
    `,
    [limit],
  );

  if (events.rows.length === 0) {
    return { id, rowCounts: { processedEvents: 0 }, timingsMs };
  }

  // The incremental event envelope is in place; until import writers emit enough
  // affected keys, processing a batch safely refreshes the serving layer.
  await timed("servingRebuild", timingsMs, rebuildServingFacts);

  await pool.query(
    `
      update projection_events
      set status = 'processed',
          processed_at = now(),
          attempt_count = attempt_count + 1,
          error_message = null
      where id = any($1::text[])
    `,
    [events.rows.map((event) => event.id)],
  );

  rowCounts.processedEvents = events.rows.length;
  return { id, rowCounts, timingsMs };
}

export async function refreshAffectedEquipment() {
  return rebuildServingFacts();
}

export async function refreshAffectedCustomer() {
  return rebuildServingFacts();
}

export async function refreshAffectedInvoice() {
  return rebuildServingFacts();
}

export async function refreshAffectedLease() {
  return rebuildServingFacts();
}
