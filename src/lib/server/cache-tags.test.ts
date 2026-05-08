import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assetInvalidationTags,
  cacheTags,
  contractInvalidationTags,
  customerInvalidationTags,
} from "@/lib/server/cache-tags";

describe("cache tag invalidation groups", () => {
  it("invalidates asset list, detail, dashboard, and search tags", () => {
    assert.deepEqual(assetInvalidationTags("asset_123"), [
      cacheTags.assets,
      cacheTags.dashboard,
      cacheTags.search,
      cacheTags.asset("asset_123"),
    ]);
  });

  it("invalidates customer list, detail, dashboard, and search tags", () => {
    assert.deepEqual(customerInvalidationTags("customer_123"), [
      cacheTags.customers,
      cacheTags.dashboard,
      cacheTags.search,
      cacheTags.customer("customer_123"),
    ]);
  });

  it("invalidates contract list, detail, dashboard, and search tags", () => {
    assert.deepEqual(contractInvalidationTags("contract_123"), [
      cacheTags.contracts,
      cacheTags.dashboard,
      cacheTags.search,
      cacheTags.contract("contract_123"),
    ]);
  });
});
