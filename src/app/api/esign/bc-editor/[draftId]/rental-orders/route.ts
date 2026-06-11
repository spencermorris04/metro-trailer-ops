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
    const conditions = ["coalesce(nullif(lease_key, ''), document_no) is not null"];
    const params: Array<string | number | null> = [];
    const query = searchParams.get("q")?.trim();
    const customerNo = searchParams.get("customerNo")?.trim();
    const unitNo = searchParams.get("unitNo")?.trim();

    if (query) {
      params.push(likePattern(query));
      conditions.push(`(
        coalesce(nullif(lease_key, ''), document_no) ilike $${params.length} escape E'\\\\'
        or coalesce(document_no, '') ilike $${params.length} escape E'\\\\'
        or coalesce(customer_number, '') ilike $${params.length} escape E'\\\\'
        or coalesce(customer_name, '') ilike $${params.length} escape E'\\\\'
        or coalesce(asset_number, '') ilike $${params.length} escape E'\\\\'
      )`);
    }

    if (!query && customerNo) {
      params.push(customerNo);
      conditions.push(`customer_number = $${params.length}`);
    }

    if (!query && unitNo) {
      params.push(unitNo);
      conditions.push(`asset_number = $${params.length}`);
    }

    params.push(customerNo || null);
    const customerRankParam = params.length;
    params.push(unitNo || null);
    const unitRankParam = params.length;
    params.push(pageSize);
    const limitParam = params.length;

    const result = await pool.query<RentalOrderSearchRow>(
      `
        select
          coalesce(nullif(lease_key, ''), document_no) as rental_order_no,
          (array_agg(customer_number order by posting_date desc nulls last) filter (where customer_number is not null))[1] as customer_number,
          (array_agg(customer_name order by posting_date desc nulls last) filter (where customer_name is not null))[1] as customer_name,
          array_remove(array_agg(distinct asset_number), null) as asset_numbers,
          (array_agg(branch_code order by posting_date desc nulls last) filter (where branch_code is not null))[1] as branch_code,
          min(service_period_start) as ship_date,
          max(coalesce(service_period_end, service_period_start, posting_date)) as last_activity_at,
          count(distinct asset_number)::integer as equipment_count,
          coalesce(sum(gross_amount), 0)::numeric(18, 2)::text as gross_amount,
          max(case when $${customerRankParam}::text is not null and customer_number = $${customerRankParam}::text then 1 else 0 end) as customer_match,
          max(case when $${unitRankParam}::text is not null and asset_number = $${unitRankParam}::text then 1 else 0 end) as unit_match
        from rental_activity_facts
        where ${conditions.join(" and ")}
        group by coalesce(nullif(lease_key, ''), document_no)
        order by customer_match desc,
          unit_match desc,
          max(coalesce(service_period_end, service_period_start, posting_date)) desc nulls last,
          coalesce(nullif(lease_key, ''), document_no) desc
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
