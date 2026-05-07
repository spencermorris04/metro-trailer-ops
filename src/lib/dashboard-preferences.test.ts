import assert from "node:assert/strict";
import test from "node:test";

import {
  dashboardWidgetIds,
  defaultDashboardPresets,
  getActiveDashboardPreset,
  normalizeDashboardPreferences,
} from "@/lib/dashboard-preferences";

test("normalizeDashboardPreferences returns default presets for empty input", () => {
  const preferences = normalizeDashboardPreferences(null);

  assert.equal(preferences.activeDashboardId, defaultDashboardPresets[0].id);
  assert.equal(preferences.presets.length, defaultDashboardPresets.length);
  assert.deepEqual(preferences.presets[0].visibleWidgets, defaultDashboardPresets[0].visibleWidgets);
});

test("normalizeDashboardPreferences removes unknown widgets and preserves known order", () => {
  const preferences = normalizeDashboardPreferences({
    activeDashboardId: "commercial",
    presets: [
      {
        id: "commercial",
        label: "Commercial",
        description: "Custom commercial desk",
        widgetOrder: ["open-ar", "unknown", "contracts", "open-ar"],
        visibleWidgets: ["open-ar", "unknown"],
      },
    ],
  });

  const active = getActiveDashboardPreset(preferences);

  assert.equal(preferences.activeDashboardId, "commercial");
  assert.equal(active.widgetOrder[0], "open-ar");
  assert.equal(active.widgetOrder[1], "contracts");
  assert.equal(active.visibleWidgets.length, 1);
  assert.equal(active.visibleWidgets[0], "open-ar");
  assert.deepEqual(
    new Set(active.widgetOrder),
    new Set(dashboardWidgetIds),
  );
});

test("normalizeDashboardPreferences falls back when active dashboard is missing", () => {
  const preferences = normalizeDashboardPreferences({
    activeDashboardId: "missing",
  });

  assert.equal(preferences.activeDashboardId, defaultDashboardPresets[0].id);
});
