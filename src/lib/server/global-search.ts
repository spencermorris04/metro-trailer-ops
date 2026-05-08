import {
  buildRouteSearchResults,
  groupSearchResults,
  type GlobalSearchGroup,
  type GlobalSearchResult,
} from "@/lib/search-core";
import { queryGlobalSearchIndex } from "@/lib/server/search-index";

type SearchOptions = {
  query: string;
  store?: string | null;
};

function bySource(results: GlobalSearchResult[], source: string) {
  return results.filter((result) => result.source === source);
}

function byType(results: GlobalSearchResult[], type: string) {
  return results.filter((result) => result.type === type);
}

function businessCentralDocuments(results: GlobalSearchResult[]) {
  return results.filter(
    (result) => result.source === "business_central" && result.type === "BC Source",
  );
}

function ledgerKeys(results: GlobalSearchResult[]) {
  return results.filter(
    (result) => result.source === "business_central" && result.type !== "BC Source",
  );
}

export async function searchWorkspace({ query, store }: SearchOptions) {
  const trimmed = query.trim();
  const pageResults = buildRouteSearchResults(trimmed);

  if (!trimmed) {
    return {
      query: trimmed,
      store: store ?? "all",
      groups: groupSearchResults([
        {
          id: "pages",
          label: "Pages",
          results: pageResults,
        },
      ]),
    };
  }

  const indexedResults = await queryGlobalSearchIndex(trimmed, store);
  const groups: GlobalSearchGroup[] = groupSearchResults([
    { id: "pages", label: "Pages", results: pageResults },
    { id: "assets", label: "Fleet", results: bySource(indexedResults, "assets") },
    { id: "customers", label: "Customers", results: bySource(indexedResults, "customers") },
    {
      id: "commercial",
      label: "Contracts and Invoices",
      results: [
        ...bySource(indexedResults, "contracts"),
        ...bySource(indexedResults, "invoices"),
      ],
    },
    {
      id: "service",
      label: "Service Work",
      results: [
        ...byType(indexedResults, "Work Order"),
        ...byType(indexedResults, "Inspection"),
      ],
    },
    {
      id: "business-central",
      label: "Business Central",
      results: businessCentralDocuments(indexedResults),
    },
    { id: "ledger-keys", label: "Ledger Keys", results: ledgerKeys(indexedResults) },
  ]);

  return {
    query: trimmed,
    store: store ?? "all",
    groups,
    resultCount: groups.reduce((sum, group) => sum + group.results.length, 0),
  };
}
