import { pool } from "@/lib/db";
import { errorResponse, ok } from "@/lib/server/api";
import { getBusinessCentralESignEditorDraft } from "@/lib/server/business-central-esign";

type EditorCustomerSearchRouteContext = {
  params: Promise<{ draftId: string }>;
};

type CustomerSearchRow = {
  customer_id: string;
  customer_number: string;
  name: string;
  customer_type: string;
  billing_city: string | null;
  branch_coverage: string[] | null;
  email: string | null;
  phone: string | null;
  location_id: string | null;
  location_name: string | null;
  location_address: string | null;
  location_contact: string | null;
};

function likePattern(value: string) {
  return `%${value.replace(/[\\%_]/g, (match) => `\\${match}`)}%`;
}

export async function GET(request: Request, context: EditorCustomerSearchRouteContext) {
  try {
    const { draftId } = await context.params;
    const { searchParams } = new URL(request.url);
    await getBusinessCentralESignEditorDraft(
      draftId,
      {
        expires: searchParams.get("expires") ?? undefined,
        session: searchParams.get("session") ?? undefined,
        token: searchParams.get("token") ?? undefined,
      },
    );

    const pageSize = Math.min(12, Math.max(1, Number(searchParams.get("pageSize") ?? "8")));
    const query = searchParams.get("q")?.trim() ?? "";
    if (query.length < 2) {
      return ok({ data: [], count: 0 }, undefined, request);
    }

    const result = await pool.query<CustomerSearchRow>(
      `
        with ranked_customers as (
          select
            cs.customer_id,
            cs.customer_number,
            cs.name,
            cs.customer_type,
            cs.billing_city,
            cs.branch_coverage,
            c.contact_info,
            c.billing_address,
            cs.last_activity_date,
            case
              when cs.customer_number ilike $1 escape E'\\\\' then 0
              when cs.name ilike $1 escape E'\\\\' then 1
              else 2
            end as rank
          from customer_summary cs
          join customers c on c.id = cs.customer_id
          where cs.search_text ilike $1 escape E'\\\\'
          order by rank, cs.last_activity_date desc nulls last, cs.name
          limit $2
        )
        select
          rc.customer_id,
          rc.customer_number,
          rc.name,
          rc.customer_type,
          rc.billing_city,
          rc.branch_coverage,
          rc.contact_info->>'email' as email,
          rc.contact_info->>'phone' as phone,
          loc.id as location_id,
          loc.name as location_name,
          concat_ws(', ',
            nullif(loc.address->>'line1', ''),
            nullif(loc.address->>'city', ''),
            nullif(loc.address->>'state', ''),
            nullif(loc.address->>'postalCode', '')
          ) as location_address,
          coalesce(loc.contact_person->>'name', loc.contact_person->>'contactPerson') as location_contact
        from ranked_customers rc
        left join lateral (
          select *
          from customer_locations
          where customer_id = rc.customer_id
          order by is_primary desc, name
          limit 1
        ) loc on true
        order by rc.rank, rc.last_activity_date desc nulls last, rc.name
      `,
      [likePattern(query), pageSize],
    );

    return ok(
      {
        data: result.rows.map((row) => ({
          id: row.customer_id,
          customerNumber: row.customer_number,
          name: row.name,
          customerType: row.customer_type,
          billingCity: row.billing_city ?? "",
          branchCoverage: row.branch_coverage ?? [],
          contactInfo: {
            email: row.email ?? "",
            phone: row.phone ?? "",
          },
          locations: row.location_id
            ? [
                {
                  id: row.location_id,
                  name: row.location_name ?? "",
                  address: row.location_address ?? "",
                  contactPerson: row.location_contact ?? "",
                },
              ]
            : [],
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
