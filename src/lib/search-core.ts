import { navigationItems, type NavItem } from "@/lib/navigation";

export type GlobalSearchResult = {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  href: string;
  badge?: string;
  source?: string;
  score: number;
};

export type GlobalSearchGroup = {
  id: string;
  label: string;
  results: GlobalSearchResult[];
};

function normalize(value: string) {
  return value.trim().toLowerCase();
}

export function rankGlobalSearchResult(
  query: string,
  values: Array<string | null | undefined>,
) {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) {
    return 0;
  }

  let best = 0;
  for (const rawValue of values) {
    const value = normalize(rawValue ?? "");
    if (!value) {
      continue;
    }
    if (value === normalizedQuery) {
      best = Math.max(best, 100);
      continue;
    }
    if (value.startsWith(normalizedQuery)) {
      best = Math.max(best, 80);
      continue;
    }
    if (value.includes(normalizedQuery)) {
      best = Math.max(best, 55);
    }
  }

  return best;
}

export function buildRouteSearchResults(
  query: string,
  items: NavItem[] = navigationItems,
): GlobalSearchResult[] {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) {
    return items.slice(0, 8).map((item, index) => ({
      id: `route:${item.href}`,
      type: "Page",
      title: item.label,
      subtitle: item.description,
      href: item.href,
      badge: "Page",
      source: "navigation",
      score: 20 - index,
    }));
  }

  return items
    .map((item) => {
      const score = rankGlobalSearchResult(normalizedQuery, [
        item.label,
        item.description,
        item.href,
      ]);
      return {
        id: `route:${item.href}`,
        type: "Page",
        title: item.label,
        subtitle: item.description,
        href: item.href,
        badge: "Page",
        source: "navigation",
        score,
      };
    })
    .filter((result) => result.score > 0)
    .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title))
    .slice(0, 8);
}

export function groupSearchResults(
  groups: GlobalSearchGroup[],
): GlobalSearchGroup[] {
  return groups
    .map((group) => ({
      ...group,
      results: [...group.results].sort(
        (left, right) => right.score - left.score || left.title.localeCompare(right.title),
      ),
    }))
    .filter((group) => group.results.length > 0);
}
