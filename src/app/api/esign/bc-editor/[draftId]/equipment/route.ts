import { pool } from "@/lib/db";
import { errorResponse, ok } from "@/lib/server/api";
import { getBusinessCentralESignEditorDraft } from "@/lib/server/business-central-esign";

type EditorEquipmentSearchRouteContext = {
  params: Promise<{ draftId: string }>;
};

type EquipmentSearchRow = {
  asset_id: string;
  asset_number: string;
  asset_type: string;
  asset_subtype: string | null;
  branch_code: string | null;
  branch_name: string | null;
  status: string | null;
  availability: string | null;
  maintenance_status: string | null;
  serial_number: string | null;
  manufacturer: string | null;
  model_year: number | null;
  registration_number: string | null;
  bc_location_code: string | null;
  bc_product_no: string | null;
  is_on_rent: boolean;
  is_blocked: boolean;
  is_inactive: boolean;
  is_disposed: boolean;
  under_maintenance: boolean;
  book_value: string | null;
};

function likePattern(value: string) {
  return `%${value.replace(/[\\%_]/g, (match) => `\\${match}`)}%`;
}

export async function GET(request: Request, context: EditorEquipmentSearchRouteContext) {
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

    const rentableOnly = searchParams.get("rentableOnly") !== "false";
    const params: Array<string | number | boolean> = [likePattern(query)];
    const conditions = ["search_text ilike $1 escape E'\\\\'"];

    if (rentableOnly) {
      conditions.push("coalesce(status, 'available') = 'available'");
      conditions.push("coalesce(availability, 'rentable') = 'rentable'");
      conditions.push("is_on_rent = false");
      conditions.push("is_blocked = false");
      conditions.push("is_inactive = false");
      conditions.push("is_disposed = false");
      conditions.push("under_maintenance = false");
    }

    params.push(pageSize);
    const limitParam = params.length;

    const result = await pool.query<EquipmentSearchRow>(
      `
        select
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
          bc_location_code,
          bc_product_no,
          is_on_rent,
          is_blocked,
          is_inactive,
          is_disposed,
          under_maintenance,
          book_value::text
        from equipment_summary
        where ${conditions.join(" and ")}
        order by
          case when asset_number ilike $1 escape E'\\\\' then 0 else 1 end,
          latest_activity_at desc nulls last,
          asset_number
        limit $${limitParam}
      `,
      params,
    );

    return ok(
      {
        data: result.rows.map((asset) => ({
          id: asset.asset_id,
          assetNumber: asset.asset_number,
          type: asset.asset_type,
          subtype: asset.asset_subtype,
          branch: asset.branch_name ?? asset.branch_code ?? "Unassigned",
          branchCode: asset.branch_code,
          status: asset.status ?? "available",
          availability: asset.availability ?? "rentable",
          maintenanceStatus: asset.maintenance_status ?? "clear",
          serialNumber: asset.serial_number,
          manufacturer: asset.manufacturer,
          modelYear: asset.model_year,
          registrationNumber: asset.registration_number,
          bcLocationCode: asset.bc_location_code,
          bcProductNo: asset.bc_product_no,
          isOnRent: asset.is_on_rent,
          isBlocked: asset.is_blocked,
          isInactive: asset.is_inactive,
          isDisposed: asset.is_disposed,
          underMaintenance: asset.under_maintenance,
          bookValue: Number(asset.book_value ?? 0),
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
