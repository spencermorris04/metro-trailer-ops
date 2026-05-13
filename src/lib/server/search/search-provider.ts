import { pool } from "@/lib/db";
import type { GlobalSearchResult } from "@/lib/search-core";
import { queryGlobalSearchIndex } from "@/lib/server/search-index";
import {
  getTypesenseConfig,
  importTypesenseDocuments,
  searchTypesense,
} from "@/lib/server/search/typesense-client";
import { getOrSetWorkspaceCache } from "@/lib/server/workspace-cache";

export type SearchProviderResult = GlobalSearchResult & {
  entityId?: string;
  entityType?: string;
};

function compact(parts: Array<string | null | undefined>) {
  return parts.filter(Boolean).join(" / ");
}

function mapTypesenseHit(hit: { document: Record<string, unknown>; text_match?: number }) {
  const document = hit.document;
  return {
    id: String(document.id ?? `${document.entity_type}:${document.entity_id}`),
    entityId: String(document.entity_id ?? ""),
    entityType: String(document.entity_type ?? ""),
    type: String(document.type ?? document.entity_type ?? "Result"),
    title: String(document.title ?? ""),
    subtitle: String(document.subtitle ?? ""),
    href: String(document.href ?? "/"),
    badge: document.source_provider == null ? undefined : String(document.source_provider),
    source: String(document.source ?? document.entity_type ?? "workspace"),
    score: Number(hit.text_match ?? 0),
  } satisfies SearchProviderResult;
}

export async function searchWorkspaceEntities(
  query: string,
  store?: string | null,
): Promise<SearchProviderResult[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  return getOrSetWorkspaceCache(
    `search:v1:${store ?? "all"}:${trimmed.toLowerCase()}`,
    ["search"],
    45,
    async () => {
      const config = getTypesenseConfig();
      if (config) {
        try {
          const filter =
            store && store !== "all" ? `branch_code:=${JSON.stringify(store)}` : undefined;
          const result = await searchTypesense(config, "workspace_entities", trimmed, filter);
          return (result.hits ?? []).map(mapTypesenseHit);
        } catch (error) {
          console.error("Typesense search failed; falling back to Postgres.", error);
        }
      }

      return (await queryGlobalSearchIndex(trimmed, store)).map((result) => ({
        ...result,
        entityId: result.id,
        entityType: result.type,
      }));
    },
  );
}

export async function syncTypesenseDocuments(options?: { full?: boolean }) {
  const config = getTypesenseConfig();
  if (!config) {
    return 0;
  }

  const batchSize = 5000;
  const maxRows = options?.full ? Number.POSITIVE_INFINITY : 10_000;
  let synced = 0;
  let offset = 0;

  while (synced < maxRows) {
    const limit = Math.min(batchSize, maxRows - synced);
    const result = await pool.query<{
      id: string;
      entity_type: string;
      entity_id: string;
      title: string;
      subtitle: string | null;
      href: string;
      branch_id: string | null;
      search_text: string;
      keywords: string[];
      updated_at: Date;
    }>(
      `
        select
          id,
          entity_type,
          entity_id,
          title,
          subtitle,
          href,
          branch_id,
          search_text,
          keywords,
          updated_at
        from global_search_documents
        order by updated_at desc, id
        limit $1
        offset $2
      `,
      [limit, offset],
    );
    if (result.rows.length === 0) {
      break;
    }

    const documents = result.rows.map((row) => ({
      id: row.id,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      type: row.entity_type,
      source: row.entity_type,
      source_provider: row.entity_type.startsWith("bc_") ? "business_central" : "internal",
      title: row.title,
      subtitle: row.subtitle ?? compact(row.keywords),
      href: row.href,
      branch_code: row.branch_id,
      customer_number: row.keywords?.find((keyword) => keyword?.startsWith("C")) ?? null,
      asset_number: row.entity_type === "asset" ? row.title : null,
      invoice_number: row.entity_type.includes("invoice") ? row.title : null,
      lease_key: row.entity_type.includes("lease") ? row.title : null,
      status: null,
      search_text: row.search_text,
      updated_at: Math.floor(new Date(row.updated_at).getTime() / 1000),
    }));

    await importTypesenseDocuments(
      config,
      "workspace_entities",
      documents,
    );
    synced += documents.length;
    offset += documents.length;
  }

  return synced;
}
