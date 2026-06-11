import { pool } from "@/lib/db";
import { errorResponse, ok } from "@/lib/server/api";
import { getBusinessCentralESignEditorDraft } from "@/lib/server/business-central-esign";

type EditorRentalOrderSearchRouteContext = {
  params: Promise<{ draftId: string }>;
};

type RentalOrderSearchRow = {
  rental_order_no: string;
  customer_number: string | null;
  customer_name: string | null;
  asset_numbers: string[] | null;
  branch_code: string | null;
  ship_date: Date | null;
  last_activity_at: Date | null;
  equipment_count: number;
  gross_amount: string | null;
  customer_match: number;
  unit_match: number;
  search_rank: number;
};

function likePattern(value: string) {
  return `%${value.replace(/[\\%_]/g, (match) => `\\${match}`)}%`;
}

export async function GET(request: Request, context: EditorRentalOrderSearchRouteContext) {
  try {
    const { draftId } = await context.params;
    const { searchParams } = new URL(request.url);
    await getBusinessCentralESignEditorDraft(draftId, {
      expires: searchParams.get("expires") ?? undefined,
      session: searchParams.get("session") ?? undefined,
      token: searchParams.get("token") ?? undefined,
    });

    const pageSize = Math.min(12, Math.max(1, Number(searchParams.get("pageSize") ?? "8")));
    const conditions = ["ls.lease_key is not null", "ls.source = 'business_central'"];
    const params: Array<string | number | null> = [];
    const query = searchParams.get("q")?.trim();
    const customerNo = searchParams.get("customerNo")?.trim();
    const unitNo = searchParams.get("unitNo")?.trim();

    if (query) {
      params.push(likePattern(query));
      conditions.push(`(
        ls.lease_key ilike $${params.length} escape E'\\\\'
        or coalesce(ls.customer_number, '') ilike $${params.length} escape E'\\\\'
        or coalesce(ls.customer_name, '') ilike $${params.length} escape E'\\\\'
        or coalesce(ls.search_text, '') ilike $${params.length} escape E'\\\\'
        or exists (
          select 1
          from lease_equipment_summary les
          where les.lease_key = ls.lease_key
            and coalesce(les.asset_number, '') ilike $${params.length} escape E'\\\\'
        )
      )`);
    }

    if (!query && customerNo) {
      params.push(customerNo);
      conditions.push(`ls.customer_number = $${params.length}`);
    }

    if (!query && unitNo) {
      params.push(unitNo);
      conditions.push(`exists (
        select 1
        from lease_equipment_summary les
        where les.lease_key = ls.lease_key
          and les.asset_number = $${params.length}
      )`);
    }

    params.push(customerNo || null);
    const customerRankParam = params.length;
    params.push(unitNo || null);
    const unitRankParam = params.length;
    params.push(query ? likePattern(query) : null);
    const searchRankPatternParam = params.length;
    params.push(query ? (query.toUpperCase().startsWith("RO") ? query : `RO${query}`) : null);
    const searchRankExactParam = params.length;
    params.push(pageSize);
    const limitParam = params.length;

    const result = await pool.query<RentalOrderSearchRow>(
      `
        select
          ls.lease_key as rental_order_no,
          ls.customer_number,
          ls.customer_name,
          coalesce(assets.asset_numbers, '{}'::text[]) as asset_numbers,
          null::text as branch_code,
          ls.first_invoice_date as ship_date,
          coalesce(ls.latest_activity_at, ls.latest_invoice_date, ls.first_invoice_date) as last_activity_at,
          ls.equipment_count,
          coalesce(ls.gross_revenue, 0)::numeric(18, 2)::text as gross_amount,
          case when $${customerRankParam}::text is not null and ls.customer_number = $${customerRankParam}::text then 1 else 0 end as customer_match,
          case when $${unitRankParam}::text is not null and coalesce(assets.asset_numbers, '{}'::text[]) @> array[$${unitRankParam}::text] then 1 else 0 end as unit_match,
          case
            when $${searchRankExactParam}::text is not null and upper(ls.lease_key) = upper($${searchRankExactParam}::text) then 0
            when $${searchRankPatternParam}::text is not null and ls.lease_key ilike $${searchRankPatternParam}::text escape E'\\\\' then 1
            when $${searchRankPatternParam}::text is not null and coalesce(ls.customer_number, '') ilike $${searchRankPatternParam}::text escape E'\\\\' then 2
            when $${searchRankPatternParam}::text is not null and coalesce(ls.customer_name, '') ilike $${searchRankPatternParam}::text escape E'\\\\' then 3
            else 4
          end as search_rank
        from lease_summary ls
        left join lateral (
          select array_remove(array_agg(distinct les.asset_number order by les.asset_number), null) as asset_numbers
          from lease_equipment_summary les
          where les.lease_key = ls.lease_key
        ) assets on true
        where ${conditions.join(" and ")}
        order by search_rank,
          customer_match desc,
          unit_match desc,
          coalesce(ls.latest_activity_at, ls.latest_invoice_date, ls.first_invoice_date) desc nulls last,
          ls.lease_key desc
        limit $${limitParam}
      `,
      params,
    );

    return ok(
      {
        data: result.rows.map((row) => ({
          rentalOrderNo: row.rental_order_no,
          customerNumber: row.customer_number ?? "",
          customerName: row.customer_name ?? "",
          assetNumbers: row.asset_numbers ?? [],
          branchCode: row.branch_code ?? "",
          shipDate: row.ship_date?.toISOString() ?? "",
          lastActivityAt: row.last_activity_at?.toISOString() ?? "",
          equipmentCount: row.equipment_count,
          grossAmount: row.gross_amount ?? "0.00",
        })),
        count: result.rowCount,
      },
      undefined,
      request,
    );
  } catch (error) {
    return errorResponse(error, request);
  }
}
