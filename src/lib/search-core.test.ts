import assert from "node:assert/strict";
import test from "node:test";

import { buildRouteSearchResults, rankGlobalSearchResult } from "@/lib/search-core";
import type { NavItem } from "@/lib/navigation";

const navItems: NavItem[] = [
  {
    href: "/assets",
    label: "Assets",
    description: "Fleet master and trailer records",
    icon: "truck",
  },
  {
    href: "/financial",
    label: "Finance",
    description: "Accounting and receivables",
    icon: "dollar",
  },
  {
    href: "/maintenance",
    label: "Maintenance",
    description: "Work order execution",
    icon: "wrench",
  },
];

test("rankGlobalSearchResult prefers exact and prefix matches", () => {
  assert.equal(rankGlobalSearchResult("assets", ["Assets"]), 100);
  assert.equal(rankGlobalSearchResult("asset", ["Assets"]), 80);
  assert.equal(rankGlobalSearchResult("trailer", ["Fleet master and trailer records"]), 55);
  assert.equal(rankGlobalSearchResult("missing", ["Assets"]), 0);
});

test("buildRouteSearchResults finds pages by label and description", () => {
  const results = buildRouteSearchResults("work order", navItems);

  assert.equal(results.length, 1);
  assert.equal(results[0].href, "/maintenance");
  assert.equal(results[0].badge, "Page");
});

test("buildRouteSearchResults returns useful defaults for an empty query", () => {
  const results = buildRouteSearchResults("", navItems);

  assert.equal(results.length, navItems.length);
  assert.deepEqual(results.map((result) => result.href), ["/assets", "/financial", "/maintenance"]);
});
