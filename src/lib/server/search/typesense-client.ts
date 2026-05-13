type TypesenseConfig = {
  host: string;
  port: string;
  protocol: string;
  apiKey: string;
  collectionPrefix: string;
};

type TypesenseDocument = Record<string, string | number | boolean | null | string[]>;

export function getTypesenseConfig(): TypesenseConfig | null {
  const host = process.env.TYPESENSE_HOST?.trim();
  const apiKey = process.env.TYPESENSE_API_KEY?.trim();
  if (!host || !apiKey) {
    return null;
  }

  return {
    host,
    port: process.env.TYPESENSE_PORT?.trim() || "443",
    protocol: process.env.TYPESENSE_PROTOCOL?.trim() || "https",
    apiKey,
    collectionPrefix: process.env.TYPESENSE_COLLECTION_PREFIX?.trim() || "metro",
  };
}

export function collectionName(config: TypesenseConfig, name: string) {
  return `${config.collectionPrefix}_${name}`;
}

async function typesenseFetch<T>(
  config: TypesenseConfig,
  path: string,
  init?: RequestInit,
) {
  const response = await fetch(
    `${config.protocol}://${config.host}:${config.port}${path}`,
    {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "X-TYPESENSE-API-KEY": config.apiKey,
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Typesense request failed ${response.status}: ${body}`);
  }

  return (await response.json()) as T;
}

export async function ensureTypesenseCollection(
  config: TypesenseConfig,
  name: string,
) {
  const collection = collectionName(config, name);
  const schema = {
    name: collection,
    fields: [
      { name: "entity_type", type: "string", facet: true },
      { name: "source_provider", type: "string", facet: true, optional: true },
      { name: "title", type: "string" },
      { name: "subtitle", type: "string", optional: true },
      { name: "href", type: "string" },
      { name: "branch_code", type: "string", facet: true, optional: true },
      { name: "customer_number", type: "string", facet: true, optional: true },
      { name: "asset_number", type: "string", facet: true, optional: true },
      { name: "invoice_number", type: "string", facet: true, optional: true },
      { name: "lease_key", type: "string", facet: true, optional: true },
      { name: "status", type: "string", facet: true, optional: true },
      { name: "search_text", type: "string" },
      { name: "updated_at", type: "int64", optional: true },
    ],
    default_sorting_field: "updated_at",
  };

  try {
    await typesenseFetch(config, `/collections/${collection}`);
  } catch {
    await typesenseFetch(config, "/collections", {
      method: "POST",
      body: JSON.stringify(schema),
    });
  }
}

export async function importTypesenseDocuments(
  config: TypesenseConfig,
  collection: string,
  documents: TypesenseDocument[],
) {
  if (documents.length === 0) {
    return;
  }

  await ensureTypesenseCollection(config, collection);
  const ndjson = documents.map((document) => JSON.stringify(document)).join("\n");
  await typesenseFetch(
    config,
    `/collections/${collectionName(config, collection)}/documents/import?action=upsert`,
    {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: ndjson,
    },
  );
}

export async function searchTypesense(
  config: TypesenseConfig,
  collection: string,
  query: string,
  filterBy?: string,
) {
  await ensureTypesenseCollection(config, collection);
  const params = new URLSearchParams({
    q: query,
    query_by: "title,search_text,subtitle,customer_number,asset_number,invoice_number,lease_key",
    sort_by: "_text_match:desc,updated_at:desc",
    per_page: "36",
  });
  if (filterBy) {
    params.set("filter_by", filterBy);
  }

  return typesenseFetch<{
    hits?: Array<{ document: Record<string, unknown>; text_match?: number }>;
  }>(config, `/collections/${collectionName(config, collection)}/documents/search?${params}`);
}
