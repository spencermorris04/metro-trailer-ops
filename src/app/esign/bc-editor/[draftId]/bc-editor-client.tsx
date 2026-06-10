"use client";

import { useMemo, useState, useTransition } from "react";

import type {
  DocusealFieldDefinition,
  DocusealTemplateDefinition,
} from "@/lib/docuseal/templates";
import type { DocusealDraft } from "@/lib/server/docuseal-prefill";

type SaveResult = {
  data?: {
    draft: DocusealDraft;
    template: DocusealTemplateDefinition;
  };
  error?: string;
  message?: string;
};

type EditorProps = {
  draft: DocusealDraft;
  template: DocusealTemplateDefinition;
  expires: number;
  token: string;
};

const sectionOrder = [
  "Customer and order",
  "Equipment",
  "Rates and terms",
  "Special instructions",
  "Execution",
  "Inspection out",
  "Tire readings",
  "Inspection in",
  "Receipt",
  "Other",
];

const tireRows = [
  ["L.O. Front", "tire_lo_front_gauge_out", "tire_lo_front_gauge_in"],
  ["L.I. Front", "tire_li_front_gauge_out", "tire_li_front_gauge_in"],
  ["L.O. Rear", "tire_lo_rear_gauge_out", "tire_lo_rear_gauge_in"],
  ["L.I. Rear", "tire_li_rear_gauge_out", "tire_li_rear_gauge_in"],
  ["R.O. Front", "tire_ro_front_gauge_out", "tire_ro_front_gauge_in"],
  ["R.I. Front", "tire_ri_front_gauge_out", "tire_ri_front_gauge_in"],
  ["R.O. Rear", "tire_ro_rear_gauge_out", "tire_ro_rear_gauge_in"],
  ["R.I. Rear", "tire_ri_rear_gauge_out", "tire_ri_rear_gauge_in"],
] as const;

function groupFields(fields: DocusealFieldDefinition[]) {
  const grouped = fields.reduce<Record<string, DocusealFieldDefinition[]>>((acc, field) => {
    acc[field.section] ??= [];
    acc[field.section].push(field);
    return acc;
  }, {});

  return Object.entries(grouped).sort(([left], [right]) => {
    const leftIndex = sectionOrder.indexOf(left);
    const rightIndex = sectionOrder.indexOf(right);
    return (leftIndex === -1 ? 999 : leftIndex) - (rightIndex === -1 ? 999 : rightIndex);
  });
}

function isSignatureField(field: DocusealFieldDefinition) {
  const haystack = `${field.name} ${field.label}`.toLowerCase();
  return haystack.includes("signature") || haystack.includes("sign here");
}

function getFieldColumns(section: string) {
  if (section === "Special instructions" || section === "Inspection in") {
    return "md:grid-cols-2";
  }

  if (section === "Rates and terms" || section === "Inspection out") {
    return "md:grid-cols-3";
  }

  return "md:grid-cols-2 xl:grid-cols-3";
}

function valueFor(values: Record<string, string>, fieldName: string) {
  return values[fieldName] ?? "";
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: DocusealFieldDefinition;
  value: string;
  onChange: (name: string, value: string) => void;
}) {
  if (isSignatureField(field)) {
    return (
      <div className="rounded border border-amber-300 bg-amber-50 px-2 py-2 text-[0.74rem] font-semibold text-amber-900">
        Customer completes this field in the live E-Sign document.
      </div>
    );
  }

  if (field.multiline) {
    return (
      <textarea
        value={value}
        rows={3}
        onChange={(event) => onChange(field.name, event.target.value)}
        className="min-h-20 w-full resize-y rounded-sm border border-slate-300 bg-white px-2 py-1.5 text-[0.8rem] text-slate-950 shadow-inner outline-none focus:border-cyan-700 focus:ring-1 focus:ring-cyan-700"
      />
    );
  }

  return (
    <input
      value={value}
      onChange={(event) => onChange(field.name, event.target.value)}
      className="h-8 w-full rounded-sm border border-slate-300 bg-white px-2 text-[0.8rem] text-slate-950 shadow-inner outline-none focus:border-cyan-700 focus:ring-1 focus:ring-cyan-700"
    />
  );
}

function GenericSection({
  section,
  fields,
  values,
  onChange,
}: {
  section: string;
  fields: DocusealFieldDefinition[];
  values: Record<string, string>;
  onChange: (name: string, value: string) => void;
}) {
  return (
    <section className="border-t border-slate-300 bg-white">
      <div className="px-4 py-2">
        <h2 className="text-[0.92rem] font-semibold text-slate-950">{section}</h2>
      </div>
      <div className={`grid gap-x-8 gap-y-2 px-4 pb-4 ${getFieldColumns(section)}`}>
        {fields.map((field) => (
          <label key={field.name} className="grid grid-cols-[minmax(9rem,14rem)_1fr] items-start gap-2">
            <span className="overflow-hidden text-ellipsis border-b border-dotted border-slate-300 pr-2 pt-1.5 text-[0.78rem] text-slate-700">
              {field.label}
            </span>
            <FieldInput field={field} value={valueFor(values, field.name)} onChange={onChange} />
          </label>
        ))}
      </div>
    </section>
  );
}

function TireSection({
  fields,
  values,
  onChange,
}: {
  fields: DocusealFieldDefinition[];
  values: Record<string, string>;
  onChange: (name: string, value: string) => void;
}) {
  const byName = new Map(fields.map((field) => [field.name, field]));
  const rendered = new Set<string>();

  return (
    <section className="border-t border-slate-300 bg-white">
      <div className="px-4 py-2">
        <h2 className="text-[0.92rem] font-semibold text-slate-950">Tire readings</h2>
      </div>
      <div className="overflow-x-auto px-4 pb-4">
        <table className="min-w-[720px] w-full border-collapse text-[0.78rem]">
          <thead>
            <tr className="border-y border-slate-300 bg-slate-100 text-left text-slate-700">
              <th className="w-44 px-2 py-2 font-semibold">Position</th>
              <th className="px-2 py-2 font-semibold">Gauge out</th>
              <th className="px-2 py-2 font-semibold">Gauge in</th>
            </tr>
          </thead>
          <tbody>
            {tireRows.map(([label, outName, inName]) => {
              const outField = byName.get(outName);
              const inField = byName.get(inName);
              if (!outField && !inField) {
                return null;
              }

              if (outField) {
                rendered.add(outField.name);
              }
              if (inField) {
                rendered.add(inField.name);
              }

              return (
                <tr key={label} className="border-b border-slate-200">
                  <td className="px-2 py-1.5 font-semibold text-slate-800">{label}</td>
                  <td className="px-2 py-1.5">
                    {outField ? (
                      <FieldInput
                        field={outField}
                        value={valueFor(values, outField.name)}
                        onChange={onChange}
                      />
                    ) : null}
                  </td>
                  <td className="px-2 py-1.5">
                    {inField ? (
                      <FieldInput
                        field={inField}
                        value={valueFor(values, inField.name)}
                        onChange={onChange}
                      />
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {fields.some((field) => !rendered.has(field.name)) ? (
        <div className="grid gap-x-8 gap-y-2 px-4 pb-4 md:grid-cols-2">
          {fields
            .filter((field) => !rendered.has(field.name))
            .map((field) => (
              <label key={field.name} className="grid grid-cols-[minmax(9rem,14rem)_1fr] items-start gap-2">
                <span className="overflow-hidden text-ellipsis border-b border-dotted border-slate-300 pr-2 pt-1.5 text-[0.78rem] text-slate-700">
                  {field.label}
                </span>
                <FieldInput field={field} value={valueFor(values, field.name)} onChange={onChange} />
              </label>
            ))}
        </div>
      ) : null}
    </section>
  );
}

export function BusinessCentralESignEditorClient({
  draft,
  template,
  expires,
  token,
}: EditorProps) {
  const [values, setValues] = useState<Record<string, string>>({
    ...Object.fromEntries(template.fields.map((field) => [field.name, ""])),
    ...draft.values,
  });
  const [status, setStatus] = useState("Ready");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const groupedFields = useMemo(() => groupFields(template.fields), [template.fields]);
  const filledCount = template.fields.filter((field) => values[field.name]?.trim()).length;

  function updateValue(name: string, nextValue: string) {
    setValues((current) => ({ ...current, [name]: nextValue }));
    setStatus("Unsaved changes");
    setError("");
  }

  function saveDraft() {
    startTransition(async () => {
      setStatus("Saving...");
      setError("");

      const response = await fetch(`/api/esign/bc-editor/${encodeURIComponent(draft.id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expires, token, values }),
      });
      const payload = (await response.json().catch(() => null)) as SaveResult | null;

      if (!response.ok || payload?.error) {
        setStatus("Save failed");
        setError(payload?.error ?? "The draft could not be saved.");
        return;
      }

      setStatus("Saved");
      if (payload?.data?.draft.values) {
        setValues({
          ...Object.fromEntries(template.fields.map((field) => [field.name, ""])),
          ...payload.data.draft.values,
        });
      }
    });
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <header className="sticky top-0 z-20 border-b border-slate-300 bg-white px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Metro E-Sign editor
            </p>
            <h1 className="truncate text-lg font-semibold leading-tight text-slate-950">
              {draft.templateName}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-sm border border-slate-300 bg-slate-50 px-2 py-1 text-[0.72rem] font-semibold text-slate-700">
              {filledCount}/{template.fields.length} fields
            </span>
            <span className="rounded-sm border border-slate-300 bg-slate-50 px-2 py-1 text-[0.72rem] font-semibold text-slate-700">
              {status}
            </span>
            <button
              type="button"
              onClick={saveDraft}
              disabled={isPending || draft.status === "sent"}
              className="h-8 rounded-sm bg-slate-950 px-4 text-[0.76rem] font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              Save
            </button>
          </div>
        </div>
        {error ? (
          <div className="mt-2 rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-[0.76rem] font-semibold text-red-700">
            {error}
          </div>
        ) : null}
      </header>

      <div className="mx-auto max-w-[1500px] border-x border-slate-300 bg-white">
        {groupedFields.map(([section, fields]) =>
          section === "Tire readings" ? (
            <TireSection
              key={section}
              fields={fields}
              values={values}
              onChange={updateValue}
            />
          ) : (
            <GenericSection
              key={section}
              section={section}
              fields={fields}
              values={values}
              onChange={updateValue}
            />
          ),
        )}
      </div>
    </main>
  );
}
