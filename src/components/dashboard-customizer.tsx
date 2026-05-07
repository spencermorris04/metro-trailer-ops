"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  IconChevronLeft,
  IconChevronRight,
  IconSettings,
  IconX,
} from "@/components/icons";
import {
  defaultDashboardPresets,
  getActiveDashboardPreset,
  normalizeDashboardPreferences,
  type DashboardPreferences,
  type DashboardPreset,
  type DashboardWidgetId,
} from "@/lib/dashboard-preferences";

type WidgetOption = {
  id: DashboardWidgetId;
  label: string;
  description: string;
};

function withPreset(
  preferences: DashboardPreferences,
  presetId: string,
  updater: (preset: DashboardPreset) => DashboardPreset,
) {
  return {
    ...preferences,
    presets: preferences.presets.map((preset) =>
      preset.id === presetId ? updater(preset) : preset,
    ),
  };
}

async function saveDashboardPreferences(preferences: DashboardPreferences) {
  await fetch("/api/workspace/layouts", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      pageKey: "dashboards",
      layout: preferences,
    }),
  });
}

export function DashboardCustomizer({
  preferences,
  widgets,
}: {
  preferences: DashboardPreferences;
  widgets: WidgetOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [currentPreferences, setCurrentPreferences] = useState(preferences);
  const activePreset = getActiveDashboardPreset(currentPreferences);
  const widgetMap = useMemo(
    () => new Map(widgets.map((widget) => [widget.id, widget])),
    [widgets],
  );

  async function persist(nextPreferences: DashboardPreferences) {
    const normalized = normalizeDashboardPreferences(nextPreferences);
    setCurrentPreferences(normalized);
    await saveDashboardPreferences(normalized);
    router.refresh();
  }

  function activatePreset(id: string) {
    void persist({ ...currentPreferences, activeDashboardId: id });
  }

  function toggleWidget(id: DashboardWidgetId) {
    void persist(
      withPreset(currentPreferences, activePreset.id, (preset) => {
        const visible = new Set(preset.visibleWidgets);
        if (visible.has(id)) {
          visible.delete(id);
        } else {
          visible.add(id);
        }

        return {
          ...preset,
          visibleWidgets: preset.widgetOrder.filter((widgetId) => visible.has(widgetId)),
        };
      }),
    );
  }

  function moveWidget(id: DashboardWidgetId, direction: -1 | 1) {
    void persist(
      withPreset(currentPreferences, activePreset.id, (preset) => {
        const order = [...preset.widgetOrder];
        const index = order.indexOf(id);
        const nextIndex = index + direction;
        if (index < 0 || nextIndex < 0 || nextIndex >= order.length) {
          return preset;
        }

        const [widgetId] = order.splice(index, 1);
        order.splice(nextIndex, 0, widgetId);

        return {
          ...preset,
          widgetOrder: order,
          visibleWidgets: order.filter((orderedId) =>
            preset.visibleWidgets.includes(orderedId),
          ),
        };
      }),
    );
  }

  function resetPreset() {
    const fallback = defaultDashboardPresets.find((preset) => preset.id === activePreset.id);
    if (!fallback) {
      return;
    }

    void persist(
      withPreset(currentPreferences, activePreset.id, () => ({
        ...fallback,
      })),
    );
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-secondary">
        <IconSettings size={14} />
        Customize
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[100] bg-slate-950/50"
          onMouseDown={() => setOpen(false)}
        >
          <aside
            className="ml-auto h-screen w-[min(460px,100vw)] overflow-y-auto bg-white text-slate-900 shadow-2xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div>
                <div className="text-sm font-semibold">Dashboard Settings</div>
                <div className="text-[0.72rem] text-slate-500">{activePreset.label}</div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-900"
              >
                <IconX size={18} />
              </button>
            </div>

            <div className="grid gap-5 p-4">
              <section>
                <div className="workspace-section-label">Saved Dashboards</div>
                <div className="mt-2 grid gap-2">
                  {currentPreferences.presets.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => activatePreset(preset.id)}
                      className={`border px-3 py-2 text-left ${
                        preset.id === activePreset.id
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <span className="block text-[0.82rem] font-semibold">{preset.label}</span>
                      <span
                        className={`mt-1 block text-[0.72rem] leading-5 ${
                          preset.id === activePreset.id ? "text-slate-300" : "text-slate-500"
                        }`}
                      >
                        {preset.description}
                      </span>
                    </button>
                  ))}
                </div>
              </section>

              <section>
                <div className="flex items-center justify-between gap-3">
                  <div className="workspace-section-label">Visible Widgets</div>
                  <button
                    type="button"
                    onClick={resetPreset}
                    className="text-[0.72rem] font-semibold text-slate-500 hover:text-slate-900"
                  >
                    Reset preset
                  </button>
                </div>
                <div className="mt-2 divide-y divide-slate-100 border border-slate-200">
                  {activePreset.widgetOrder.map((id) => {
                    const widget = widgetMap.get(id);
                    if (!widget) {
                      return null;
                    }
                    const visible = activePreset.visibleWidgets.includes(id);

                    return (
                      <div key={id} className="grid grid-cols-[1fr_auto] gap-3 px-3 py-2">
                        <label className="flex min-w-0 items-start gap-2">
                          <input
                            type="checkbox"
                            checked={visible}
                            onChange={() => toggleWidget(id)}
                            className="mt-1"
                          />
                          <span className="min-w-0">
                            <span className="block text-[0.8rem] font-semibold text-slate-900">
                              {widget.label}
                            </span>
                            <span className="mt-0.5 block text-[0.7rem] leading-5 text-slate-500">
                              {widget.description}
                            </span>
                          </span>
                        </label>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => moveWidget(id, -1)}
                            className="border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                            title="Move earlier"
                          >
                            <IconChevronLeft size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveWidget(id, 1)}
                            className="border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                            title="Move later"
                          >
                            <IconChevronRight size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
