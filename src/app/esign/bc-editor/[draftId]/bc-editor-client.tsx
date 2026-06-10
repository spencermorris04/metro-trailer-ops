"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type {
  DocusealFieldDefinition,
  DocusealTemplateDefinition,
} from "@/lib/docuseal/templates";
import type { DocusealDraft } from "@/lib/server/docuseal-prefill";

type ApiResult<T> = {
  data?: T;
  error?: string;
  message?: string;
};

type EditorPayload = {
  draft: DocusealDraft;
  template: DocusealTemplateDefinition;
};

type CustomerSearchResult = {
  id: string;
  customerNumber: string;
  name: string;
  customerType: string;
  billingCity: string;
  branchCoverage: string[];
  contactInfo?: {
    email?: string;
    phone?: string;
  };
  locations: Array<{
    id: string;
    name: string;
    address?: string;
    contactPerson?: string;
  }>;
};

type EquipmentSearchResult = {
  id: string;
  assetNumber: string;
  type: string;
  subtype: string | null;
  branch: string;
  branchCode: string | null;
  status: string;
  availability: string;
  maintenanceStatus: string;
  serialNumber: string | null;
  manufacturer: string | null;
  modelYear: number | null;
  registrationNumber: string | null;
  bcLocationCode: string | null;
  bcProductNo: string | null;
  isOnRent: boolean;
  isBlocked: boolean;
  isInactive: boolean;
  isDisposed: boolean;
  underMaintenance: boolean;
  bookValue: number;
};

type EditorProps = {
  draft: DocusealDraft;
  template: DocusealTemplateDefinition;
  templates: DocusealTemplateDefinition[];
  expires: number;
  token: string;
};

const signingLinkVariable = "{submitter.link}";
const signingLinkMarkdown = `[Review and Submit](${signingLinkVariable})`;
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

function emptyValues(template: DocusealTemplateDefinition) {
  return Object.fromEntries(template.fields.map((field) => [field.name, ""]));
}

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

function getPrimaryCustomerLocation(customer: CustomerSearchResult) {
  return customer.locations[0] ?? null;
}

function getCustomerLocationText(customer: CustomerSearchResult) {
  const location = getPrimaryCustomerLocation(customer);
  return location?.address?.trim() || location?.name?.trim() || customer.billingCity || "";
}

function applyCustomerToValues(
  current: Record<string, string>,
  customer: CustomerSearchResult,
) {
  const primaryLocation = getPrimaryCustomerLocation(customer);

  return {
    ...current,
    customer_number: customer.customerNumber,
    ordered_by: primaryLocation?.contactPerson?.trim() || current.ordered_by || "",
    lessee_name: customer.name,
    lessee_company_name: customer.name,
    lessee_location: getCustomerLocationText(customer),
  };
}

function getEquipmentStoreKey(equipment: EquipmentSearchResult | null) {
  return (
    equipment?.branchCode?.trim() ||
    equipment?.bcLocationCode?.trim() ||
    equipment?.branch?.trim() ||
    ""
  );
}

function getEquipmentType(equipment: EquipmentSearchResult) {
  return equipment.subtype?.trim() || equipment.type;
}

function applyEquipmentToValues(
  current: Record<string, string>,
  equipment: EquipmentSearchResult,
) {
  return {
    ...current,
    unit_number: equipment.assetNumber,
    unit_type: getEquipmentType(equipment),
    unit_description: [equipment.modelYear, equipment.manufacturer, getEquipmentType(equipment)]
      .filter(Boolean)
      .join(" "),
    vin_number: equipment.serialNumber ?? "",
    tag_number: equipment.registrationNumber ?? "",
    rental_rate_per_day: current.rental_rate_per_day,
  };
}

function includesSigningLink(value: string) {
  return /\{+submitter\.link\}+/i.test(value);
}

function FieldInput({
  disabled,
  field,
  value,
  onChange,
}: {
  disabled: boolean;
  field: DocusealFieldDefinition;
  value: string;
  onChange: (name: string, value: string) => void;
}) {
  if (isSignatureField(field)) {
    return (
      <div className="rounded-sm border border-amber-300 bg-amber-50 px-2 py-2 text-[0.74rem] font-semibold text-amber-900">
        Customer completes this in the live E-Sign document.
      </div>
    );
  }

  const commonClass =
    "w-full rounded-sm border border-slate-300 bg-white px-2 text-[0.8rem] text-slate-950 shadow-inner outline-none focus:border-cyan-700 focus:ring-1 focus:ring-cyan-700 disabled:bg-slate-100 disabled:text-slate-600";

  if (field.multiline) {
    return (
      <textarea
        value={value}
        rows={3}
        disabled={disabled}
        onChange={(event) => onChange(field.name, event.target.value)}
        className={`${commonClass} min-h-20 resize-y py-1.5`}
      />
    );
  }

  return (
    <input
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(field.name, event.target.value)}
      className={`${commonClass} h-8`}
    />
  );
}

function GenericSection({
  disabled,
  section,
  fields,
  values,
  onChange,
}: {
  disabled: boolean;
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
            <FieldInput
              disabled={disabled}
              field={field}
              value={values[field.name] ?? ""}
              onChange={onChange}
            />
          </label>
        ))}
      </div>
    </section>
  );
}

function TireSection({
  disabled,
  fields,
  values,
  onChange,
}: {
  disabled: boolean;
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
                        disabled={disabled}
                        field={outField}
                        value={values[outField.name] ?? ""}
                        onChange={onChange}
                      />
                    ) : null}
                  </td>
                  <td className="px-2 py-1.5">
                    {inField ? (
                      <FieldInput
                        disabled={disabled}
                        field={inField}
                        value={values[inField.name] ?? ""}
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
                <FieldInput
                  disabled={disabled}
                  field={field}
                  value={values[field.name] ?? ""}
                  onChange={onChange}
                />
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
  templates,
  expires,
  token,
}: EditorProps) {
  const messageTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [currentDraft, setCurrentDraft] = useState(draft);
  const [currentTemplate, setCurrentTemplate] = useState(template);
  const [values, setValues] = useState<Record<string, string>>({
    ...emptyValues(template),
    ...draft.values,
  });
  const [customerName, setCustomerName] = useState(draft.customerName);
  const [customerEmail, setCustomerEmail] = useState(draft.customerEmail);
  const [rentalOrderNo, setRentalOrderNo] = useState(draft.values.rental_order_number ?? "");
  const [subject, setSubject] = useState(draft.subject);
  const [message, setMessage] = useState(draft.message);
  const [customerQuery, setCustomerQuery] = useState(draft.customerName);
  const [customerResults, setCustomerResults] = useState<CustomerSearchResult[]>([]);
  const [equipmentQuery, setEquipmentQuery] = useState(draft.values.unit_number ?? "");
  const [equipmentResults, setEquipmentResults] = useState<EquipmentSearchResult[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentSearchResult | null>(null);
  const [rentableOnly, setRentableOnly] = useState(true);
  const [busy, setBusy] = useState("");
  const [feedback, setFeedback] = useState("Ready");
  const groupedFields = useMemo(() => groupFields(currentTemplate.fields), [currentTemplate]);
  const disabled = Boolean(busy) || currentDraft.status === "sent";
  const filledCount = currentTemplate.fields.filter((field) => values[field.name]?.trim()).length;
  const messageHasSigningLink = includesSigningLink(message);
  const location = getEquipmentStoreKey(selectedEquipment) || currentDraft.location;

  function publishEditorState(next?: {
    draft?: DocusealDraft;
    values?: Record<string, string>;
    customerName?: string;
    customerEmail?: string;
    rentalOrderNo?: string;
    location?: string;
  }) {
    const draftToPublish = next?.draft ?? currentDraft;
    const valuesToPublish = next?.values ?? values;

    window.parent.postMessage(
      {
        type: "metro-esign-editor-state",
        payload: {
          customerNo: valuesToPublish.customer_number ?? "",
          customerName: next?.customerName ?? customerName,
          customerEmail: next?.customerEmail ?? customerEmail,
          unitNo: valuesToPublish.unit_number ?? "",
          unitDescription: valuesToPublish.unit_description ?? "",
          rentalOrderNo: next?.rentalOrderNo ?? rentalOrderNo,
          location: next?.location ?? location,
          status: draftToPublish.status,
          signingUrl: draftToPublish.docusealSubmitterUrl ?? "",
          docusealSubmissionId: draftToPublish.docusealSubmissionId ?? 0,
        },
      },
      "*",
    );
  }

  useEffect(() => {
    publishEditorState();
  });

  useEffect(() => {
    if (currentDraft.status === "sent") {
      return;
    }
    const query = customerQuery.trim();
    if (query.length < 2) {
      setCustomerResults([]);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const params = new URLSearchParams({
        q: query,
        pageSize: "8",
        expires: String(expires),
        token,
      });
      const response = await fetch(
        `/api/esign/bc-editor/${encodeURIComponent(currentDraft.id)}/customers?${params.toString()}`,
        { signal: controller.signal },
      );
      const payload = (await response.json().catch(() => null)) as
        | ApiResult<CustomerSearchResult[]>
        | null;
      setCustomerResults(response.ok ? payload?.data ?? [] : []);
    }, 180);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [currentDraft.id, currentDraft.status, customerQuery, expires, token]);

  useEffect(() => {
    if (currentDraft.status === "sent") {
      return;
    }
    const query = equipmentQuery.trim();
    if (query.length < 2) {
      setEquipmentResults([]);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const params = new URLSearchParams({
        q: query,
        pageSize: "8",
        rentableOnly: String(rentableOnly),
        expires: String(expires),
        token,
      });
      const response = await fetch(
        `/api/esign/bc-editor/${encodeURIComponent(currentDraft.id)}/equipment?${params.toString()}`,
        { signal: controller.signal },
      );
      const payload = (await response.json().catch(() => null)) as
        | ApiResult<EquipmentSearchResult[]>
        | null;
      setEquipmentResults(response.ok ? payload?.data ?? [] : []);
    }, 180);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [currentDraft.id, currentDraft.status, equipmentQuery, expires, rentableOnly, token]);

  function loadPayload(payload: EditorPayload) {
    setCurrentDraft(payload.draft);
    setCurrentTemplate(payload.template);
    setValues({ ...emptyValues(payload.template), ...payload.draft.values });
    setCustomerName(payload.draft.customerName);
    setCustomerEmail(payload.draft.customerEmail);
    setRentalOrderNo(payload.draft.values.rental_order_number ?? "");
    setSubject(payload.draft.subject);
    setMessage(payload.draft.message);
    setCustomerQuery(payload.draft.customerName);
    setEquipmentQuery(payload.draft.values.unit_number ?? "");
  }

  function updateValue(name: string, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
    if (name === "rental_order_number") {
      setRentalOrderNo(value);
    }
    setFeedback("Unsaved changes");
  }

  function insertSigningLink() {
    const textarea = messageTextareaRef.current;
    if (!textarea) {
      setMessage((current) => `${current.trimEnd()}\n\n${signingLinkMarkdown}`);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const nextMessage = `${message.slice(0, start)}${signingLinkMarkdown}${message.slice(end)}`;
    setMessage(nextMessage);
    window.setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + signingLinkMarkdown.length, start + signingLinkMarkdown.length);
    }, 0);
  }

  function selectCustomer(customer: CustomerSearchResult) {
    setCustomerName(customer.name);
    setCustomerQuery(customer.name);
    setCustomerEmail(customer.contactInfo?.email ?? customerEmail);
    setValues((current) => applyCustomerToValues(current, customer));
    setCustomerResults([]);
    setFeedback(`Selected ${customer.name} (${customer.customerNumber}).`);
  }

  function selectEquipment(equipment: EquipmentSearchResult) {
    setSelectedEquipment(equipment);
    setEquipmentQuery(equipment.assetNumber);
    setValues((current) => applyEquipmentToValues(current, equipment));
    setEquipmentResults([]);
    setFeedback(`Selected ${equipment.assetNumber} from ${equipment.branch}.`);
  }

  async function submitJson<T>(url: string, body: unknown) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json().catch(() => null)) as ApiResult<T> | null;
    if (!response.ok || payload?.error) {
      throw new Error(payload?.error ?? "Request failed.");
    }
    if (!payload) {
      throw new Error("Request failed.");
    }
    return payload;
  }

  async function saveDraft() {
    setBusy("save");
    try {
      const result = await submitJson<EditorPayload>(
        `/api/esign/bc-editor/${encodeURIComponent(currentDraft.id)}`,
        {
          expires,
          token,
          location: getEquipmentStoreKey(selectedEquipment) || currentDraft.location,
          customerName,
          customerEmail,
          subject,
          message,
          values: {
            ...values,
            rental_order_number: rentalOrderNo,
          },
        },
      );
      if (result.data) {
        loadPayload(result.data);
        publishEditorState({
          draft: result.data.draft,
          values: result.data.draft.values,
          customerName: result.data.draft.customerName,
          customerEmail: result.data.draft.customerEmail,
          rentalOrderNo: result.data.draft.values.rental_order_number ?? rentalOrderNo,
          location: result.data.draft.location,
        });
      }
      setFeedback(result.message ?? "Saved.");
      return true;
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Unable to save.");
      return false;
    } finally {
      setBusy("");
    }
  }

  async function switchTemplate(templateKey: string) {
    if (templateKey === currentTemplate.key || currentDraft.status === "sent") {
      return;
    }

    setBusy("template");
    try {
      const result = await submitJson<EditorPayload>(
        `/api/esign/bc-editor/${encodeURIComponent(currentDraft.id)}/template`,
        {
          expires,
          token,
          templateKey,
          location: getEquipmentStoreKey(selectedEquipment) || currentDraft.location,
          values: {
            ...values,
            rental_order_number: rentalOrderNo,
          },
        },
      );
      if (result.data) {
        loadPayload(result.data);
      }
      setFeedback(result.message ?? "Template changed.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Unable to change template.");
    } finally {
      setBusy("");
    }
  }

  async function runAction(action: "prepare" | "send" | "invalidate") {
    if (action !== "invalidate") {
      const saved = await saveDraft();
      if (!saved) {
        return;
      }
    }

    setBusy(action);
    try {
      const result = await submitJson<EditorPayload>(
        `/api/esign/bc-editor/${encodeURIComponent(currentDraft.id)}/action`,
        { expires, token, action },
      );
      if (result.data) {
        loadPayload(result.data);
        publishEditorState({
          draft: result.data.draft,
          values: result.data.draft.values,
          customerName: result.data.draft.customerName,
          customerEmail: result.data.draft.customerEmail,
          rentalOrderNo: result.data.draft.values.rental_order_number ?? rentalOrderNo,
          location: result.data.draft.location,
        });
        if (action === "prepare" && result.data.draft.docusealSubmitterUrl) {
          window.open(result.data.draft.docusealSubmitterUrl, "_blank", "noopener,noreferrer");
        }
      }
      setFeedback(
        action === "send"
          ? "E-Sign document sent."
          : action === "prepare"
            ? "Preview opened."
            : "Sent document invalidated.",
      );
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : `Unable to ${action}.`);
    } finally {
      setBusy("");
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-300 bg-white px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Metro E-Sign
            </p>
            <h1 className="truncate text-lg font-semibold leading-tight text-slate-950">
              {currentDraft.templateName}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-sm border border-slate-300 bg-slate-50 px-2 py-1 text-[0.72rem] font-semibold text-slate-700">
              {filledCount}/{currentTemplate.fields.length} fields
            </span>
            <span className="rounded-sm border border-slate-300 bg-slate-50 px-2 py-1 text-[0.72rem] font-semibold text-slate-700">
              {currentDraft.status}
            </span>
            <button
              type="button"
              onClick={saveDraft}
              disabled={disabled}
              className="h-8 rounded-sm border border-slate-300 bg-white px-3 text-[0.76rem] font-semibold text-slate-900 disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => runAction("prepare")}
              disabled={Boolean(busy)}
              className="h-8 rounded-sm border border-slate-300 bg-white px-3 text-[0.76rem] font-semibold text-slate-900 disabled:opacity-50"
            >
              Preview
            </button>
            {currentDraft.status === "sent" ? (
              <button
                type="button"
                onClick={() => runAction("invalidate")}
                disabled={Boolean(busy)}
                className="h-8 rounded-sm border border-red-300 bg-red-50 px-3 text-[0.76rem] font-semibold text-red-700 disabled:opacity-50"
              >
                Void sent document
              </button>
            ) : (
              <button
                type="button"
                onClick={() => runAction("send")}
                disabled={Boolean(busy)}
                className="h-8 rounded-sm bg-slate-950 px-4 text-[0.76rem] font-semibold text-white disabled:bg-slate-400"
              >
                Send E-Sign Document
              </button>
            )}
          </div>
        </div>
        <div className="mt-2 text-[0.76rem] font-semibold text-slate-600">{busy ? "Working..." : feedback}</div>
      </header>

      <div className="mx-auto max-w-[1500px] border-x border-slate-300 bg-white">
        <section className="grid gap-3 p-4 lg:grid-cols-5">
          <label className="grid gap-1">
            <span className="text-[0.72rem] font-semibold text-slate-600">Template</span>
            <select
              value={currentTemplate.key}
              disabled={disabled}
              onChange={(event) => switchTemplate(event.target.value)}
              className="h-9 rounded-sm border border-slate-300 bg-white px-2 text-[0.8rem] font-semibold text-slate-950"
            >
              {templates
                .filter((item) => item.active)
                .map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.name}
                  </option>
                ))}
            </select>
          </label>

          <label className="relative grid gap-1">
            <span className="text-[0.72rem] font-semibold text-slate-600">Customer</span>
            <input
              value={customerQuery}
              disabled={disabled}
              onChange={(event) => {
                setCustomerQuery(event.target.value);
                setCustomerName(event.target.value);
              }}
              className="h-9 rounded-sm border border-slate-300 bg-white px-2 text-[0.8rem] text-slate-950"
            />
            {customerResults.length > 0 ? (
              <div className="absolute left-0 right-0 top-full z-40 max-h-64 overflow-auto border border-slate-300 bg-white shadow-lg">
                {customerResults.map((customer) => (
                  <button
                    key={customer.id}
                    type="button"
                    onClick={() => selectCustomer(customer)}
                    className="block w-full border-b border-slate-100 px-2 py-2 text-left text-[0.78rem] hover:bg-slate-100"
                  >
                    <span className="font-semibold">{customer.name}</span>
                    <span className="block text-slate-500">
                      {customer.customerNumber} {customer.billingCity ? `/ ${customer.billingCity}` : ""}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </label>

          <label className="relative grid gap-1">
            <span className="text-[0.72rem] font-semibold text-slate-600">Unit/Trailer</span>
            <input
              value={equipmentQuery}
              disabled={disabled}
              onChange={(event) => setEquipmentQuery(event.target.value)}
              className="h-9 rounded-sm border border-slate-300 bg-white px-2 text-[0.8rem] text-slate-950"
            />
            {equipmentResults.length > 0 ? (
              <div className="absolute left-0 right-0 top-full z-40 max-h-72 overflow-auto border border-slate-300 bg-white shadow-lg">
                {equipmentResults.map((equipment) => (
                  <button
                    key={equipment.id}
                    type="button"
                    onClick={() => selectEquipment(equipment)}
                    className="block w-full border-b border-slate-100 px-2 py-2 text-left text-[0.78rem] hover:bg-slate-100"
                  >
                    <span className="font-semibold">{equipment.assetNumber}</span>
                    <span className="block text-slate-500">
                      {getEquipmentType(equipment)} / {equipment.branch} / {equipment.status}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </label>

          <label className="grid gap-1">
            <span className="text-[0.72rem] font-semibold text-slate-600">Rental order no.</span>
            <input
              value={rentalOrderNo}
              disabled={disabled}
              onChange={(event) => {
                setRentalOrderNo(event.target.value);
                updateValue("rental_order_number", event.target.value);
              }}
              className="h-9 rounded-sm border border-slate-300 bg-white px-2 text-[0.8rem] text-slate-950"
            />
          </label>

          <label className="flex items-end gap-2 pb-2 text-[0.76rem] font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={rentableOnly}
              onChange={(event) => setRentableOnly(event.target.checked)}
              className="size-4"
            />
            Rentable units only
          </label>
        </section>

        <section className="grid gap-3 border-t border-slate-300 p-4 lg:grid-cols-[1fr_1fr_2fr]">
          <label className="grid gap-1">
            <span className="text-[0.72rem] font-semibold text-slate-600">Customer email</span>
            <input
              value={customerEmail}
              disabled={disabled}
              onChange={(event) => setCustomerEmail(event.target.value)}
              className="h-9 rounded-sm border border-slate-300 bg-white px-2 text-[0.8rem] text-slate-950"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-[0.72rem] font-semibold text-slate-600">Subject</span>
            <input
              value={subject}
              disabled={disabled}
              onChange={(event) => setSubject(event.target.value)}
              className="h-9 rounded-sm border border-slate-300 bg-white px-2 text-[0.8rem] text-slate-950"
            />
          </label>
          <label className="grid gap-1">
            <span className="flex items-center justify-between text-[0.72rem] font-semibold text-slate-600">
              <span>Email message</span>
              <button
                type="button"
                onClick={insertSigningLink}
                disabled={disabled}
                className="rounded-sm border border-slate-300 bg-white px-2 py-1 text-[0.68rem] font-semibold text-slate-700 disabled:opacity-50"
              >
                Insert signing link
              </button>
            </span>
            <textarea
              ref={messageTextareaRef}
              value={message}
              disabled={disabled}
              rows={3}
              onChange={(event) => setMessage(event.target.value)}
              className="min-h-20 rounded-sm border border-slate-300 bg-white px-2 py-1.5 text-[0.8rem] text-slate-950"
            />
            {!messageHasSigningLink ? (
              <span className="text-[0.7rem] font-semibold text-amber-700">
                Add {"{submitter.link}"} so the email includes the live signing link.
              </span>
            ) : null}
          </label>
        </section>

        {groupedFields.map(([section, fields]) =>
          section === "Tire readings" ? (
            <TireSection
              key={section}
              disabled={disabled}
              fields={fields}
              values={values}
              onChange={updateValue}
            />
          ) : (
            <GenericSection
              key={section}
              disabled={disabled}
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
