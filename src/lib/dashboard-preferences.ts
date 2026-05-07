export const dashboardWidgetIds = [
  "fleet-summary",
  "fleet-category",
  "open-repairs",
  "branch-pressure",
  "execution-queues",
  "contracts",
  "open-ar",
  "source-documents",
  "bc-health",
  "top-customers",
  "recent-invoices",
] as const;

export type DashboardWidgetId = (typeof dashboardWidgetIds)[number];

export type DashboardPreset = {
  id: string;
  label: string;
  description: string;
  widgetOrder: DashboardWidgetId[];
  visibleWidgets: DashboardWidgetId[];
};

export type DashboardPreferences = {
  activeDashboardId: string;
  presets: DashboardPreset[];
};

export const defaultDashboardPresets: DashboardPreset[] = [
  {
    id: "inventory",
    label: "Inventory Control",
    description: "Fleet availability, branch pressure, repairs, and movement queues.",
    widgetOrder: [
      "fleet-summary",
      "fleet-category",
      "open-repairs",
      "branch-pressure",
      "execution-queues",
      "top-customers",
      "recent-invoices",
      "bc-health",
    ],
    visibleWidgets: [
      "fleet-summary",
      "fleet-category",
      "open-repairs",
      "branch-pressure",
      "execution-queues",
      "top-customers",
      "recent-invoices",
      "bc-health",
    ],
  },
  {
    id: "commercial",
    label: "Commercial Desk",
    description: "Contracts, receivables, invoices, customers, and source document context.",
    widgetOrder: [
      "contracts",
      "open-ar",
      "recent-invoices",
      "top-customers",
      "source-documents",
      "bc-health",
      "fleet-summary",
      "execution-queues",
    ],
    visibleWidgets: [
      "contracts",
      "open-ar",
      "recent-invoices",
      "top-customers",
      "source-documents",
      "bc-health",
      "fleet-summary",
      "execution-queues",
    ],
  },
  {
    id: "accounting",
    label: "Accounting Close",
    description: "AR, AP, source documents, import health, and operational blockers.",
    widgetOrder: [
      "open-ar",
      "recent-invoices",
      "source-documents",
      "bc-health",
      "contracts",
      "open-repairs",
      "execution-queues",
      "branch-pressure",
    ],
    visibleWidgets: [
      "open-ar",
      "recent-invoices",
      "source-documents",
      "bc-health",
      "contracts",
      "open-repairs",
      "execution-queues",
      "branch-pressure",
    ],
  },
];

const widgetIdSet = new Set<string>(dashboardWidgetIds);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeWidgetList(value: unknown, fallback: DashboardWidgetId[]) {
  const seen = new Set<string>();
  const fromInput = Array.isArray(value)
    ? value.filter((item): item is DashboardWidgetId => {
        if (typeof item !== "string" || !widgetIdSet.has(item) || seen.has(item)) {
          return false;
        }
        seen.add(item);
        return true;
      })
    : [];

  const normalized = fromInput.length > 0 ? fromInput : fallback;
  return [
    ...normalized,
    ...dashboardWidgetIds.filter((id) => !normalized.includes(id)),
  ];
}

function normalizeVisibleWidgets(
  value: unknown,
  fallback: DashboardWidgetId[],
): DashboardWidgetId[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const seen = new Set<string>();
  const normalized = value.filter((item): item is DashboardWidgetId => {
    if (typeof item !== "string" || !widgetIdSet.has(item) || seen.has(item)) {
      return false;
    }
    seen.add(item);
    return true;
  });

  return normalized.length > 0 ? normalized : fallback;
}

function normalizePreset(value: unknown, fallback: DashboardPreset) {
  if (!isRecord(value)) {
    return fallback;
  }

  const widgetOrder = normalizeWidgetList(value.widgetOrder, fallback.widgetOrder);
  const visibleWidgets = normalizeVisibleWidgets(value.visibleWidgets, fallback.visibleWidgets)
    .filter((id) => widgetOrder.includes(id));

  return {
    id: typeof value.id === "string" && value.id.trim() ? value.id.trim() : fallback.id,
    label:
      typeof value.label === "string" && value.label.trim()
        ? value.label.trim()
        : fallback.label,
    description:
      typeof value.description === "string" && value.description.trim()
        ? value.description.trim()
        : fallback.description,
    widgetOrder,
    visibleWidgets: visibleWidgets.length > 0 ? visibleWidgets : fallback.visibleWidgets,
  } satisfies DashboardPreset;
}

export function normalizeDashboardPreferences(value: unknown): DashboardPreferences {
  const input = isRecord(value) ? value : {};
  const inputPresets = Array.isArray(input.presets) ? input.presets : [];
  const normalizedPresets = defaultDashboardPresets.map((fallback) => {
    const matchingInput = inputPresets.find(
      (preset) => isRecord(preset) && preset.id === fallback.id,
    );
    return normalizePreset(matchingInput, fallback);
  });

  const customPresets = inputPresets
    .filter(
      (preset): preset is Record<string, unknown> =>
        isRecord(preset) &&
        typeof preset.id === "string" &&
        !defaultDashboardPresets.some((fallback) => fallback.id === preset.id),
    )
    .map((preset) =>
      normalizePreset(preset, {
        id: preset.id as string,
        label: preset.id as string,
        description: "Custom dashboard",
        widgetOrder: [...dashboardWidgetIds],
        visibleWidgets: [...dashboardWidgetIds],
      }),
    );

  const presets = [...normalizedPresets, ...customPresets];
  const requestedActive =
    typeof input.activeDashboardId === "string" ? input.activeDashboardId : null;
  const activeDashboardId = presets.some((preset) => preset.id === requestedActive)
    ? requestedActive!
    : defaultDashboardPresets[0].id;

  return {
    activeDashboardId,
    presets,
  };
}

export function getActiveDashboardPreset(preferences: DashboardPreferences) {
  return (
    preferences.presets.find((preset) => preset.id === preferences.activeDashboardId) ??
    preferences.presets[0] ??
    defaultDashboardPresets[0]
  );
}
