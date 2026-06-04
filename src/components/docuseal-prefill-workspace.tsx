"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type {
  DocusealFieldDefinition,
  DocusealTemplateDefinition,
} from "@/lib/docuseal/templates";
import type { DocusealDraft } from "@/lib/server/docuseal-prefill";
import { formatDate } from "@/lib/format";

type ApiResult<T> = {
  data?: T;
  message?: string;
  error?: string;
};

function emptyValues(template: DocusealTemplateDefinition) {
  return Object.fromEntries(template.fields.map((field) => [field.name, ""]));
}

function sectionFields(template: DocusealTemplateDefinition) {
  return template.fields.reduce<Record<string, DocusealFieldDefinition[]>>((acc, field) => {
    acc[field.section] ??= [];
    acc[field.section].push(field);
    return acc;
  }, {});
}

function getFilledCount(template: DocusealTemplateDefinition, values: Record<string, string>) {
  return template.fields.filter((field) => values[field.name]?.trim()).length;
}

function getInitialTemplate(
  templates: DocusealTemplateDefinition[],
  drafts: DocusealDraft[],
) {
  const draftTemplateKey = drafts[0]?.templateKey;
  return templates.find((template) => template.key === draftTemplateKey) ?? templates[0];
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomItem<T>(items: T[]) {
  return items[randomInt(0, items.length - 1)];
}

function randomDateParts() {
  const date = new Date();
  date.setDate(date.getDate() + randomInt(1, 21));

  return {
    date: date.toLocaleDateString("en-US"),
    day: String(date.getDate()),
    month: date.toLocaleString("en-US", { month: "long" }),
    year: String(date.getFullYear()).slice(-2),
    fullYear: String(date.getFullYear()),
  };
}

function buildRandomVin() {
  const characters = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789";
  return Array.from({ length: 17 }, () => characters[randomInt(0, characters.length - 1)]).join(
    "",
  );
}

function buildRandomTestData(template: DocusealTemplateDefinition) {
  const customers = [
    {
      name: "Volunteer Logistics LLC",
      contact: "Morgan Ellis",
      address: "1412 Freight Way, Nashville, TN 37209",
      email: "morgan.ellis@example.com",
    },
    {
      name: "Cumberland Distribution Co.",
      contact: "Taylor Reed",
      address: "802 Industrial Park Dr, La Vergne, TN 37086",
      email: "taylor.reed@example.com",
    },
    {
      name: "Summit Grocery Supply",
      contact: "Jordan Carter",
      address: "225 Commerce Blvd, Hendersonville, TN 37075",
      email: "jordan.carter@example.com",
    },
  ];
  const equipmentTypes = ["53 ft dry van", "48 ft dry van", "Reefer trailer"];
  const conditionValues = ["Good", "OK", "No visible damage", "Serviceable"];
  const contact = randomItem(customers);
  const signedDate = randomDateParts();
  const inspectionDate = randomDateParts();
  const unitNumber = `MT${randomInt(12000, 98999)}`;
  const orderNumber = `SO-${randomInt(240000, 249999)}`;
  const monthlyRate = randomInt(725, 1450);
  const weeklyRate = Math.round(monthlyRate / 4);
  const dailyRate = Math.round(weeklyRate / 5);

  const fieldValues: Record<string, string> = {};

  for (const field of template.fields) {
    if (field.name.startsWith("tire_")) {
      fieldValues[field.name] = `${randomInt(7, 14)}/32`;
      continue;
    }

    if (field.name.startsWith("special_instructions_line_")) {
      fieldValues[field.name] = randomItem([
        "Customer to call dispatch one hour before pickup.",
        "Trailer must be swept and returned with doors secured.",
        "Use Nashville yard for pickup and return.",
        "Verify unit number before leaving the yard.",
        "Customer requested weekday pickup between 8 AM and 3 PM.",
      ]);
      continue;
    }

    if (field.name.startsWith("inspection_out_comments_line_")) {
      fieldValues[field.name] = randomItem([
        "Normal wear noted at pickup.",
        "Lights checked before release.",
        "No active leaks observed.",
        "Landing gear tested and operational.",
      ]);
      continue;
    }

    if (field.name.startsWith("inspection_in_notes_line_")) {
      fieldValues[field.name] = randomItem([
        "Return inspection pending customer sign-off.",
        "No new damage reported at intake.",
        "Photos attached to inspection record.",
        "Clean interior at return.",
      ]);
      continue;
    }

    switch (field.name) {
      case "customer_phone":
        fieldValues[field.name] = `615-555-${randomInt(1000, 9999)}`;
        break;
      case "ordered_by":
        fieldValues[field.name] = contact.contact;
        break;
      case "customer_number":
        fieldValues[field.name] = `C${randomInt(10000, 99999)}`;
        break;
      case "order_number":
        fieldValues[field.name] = orderNumber;
        break;
      case "purchase_order_number":
        fieldValues[field.name] = `PO-${randomInt(50000, 99999)}`;
        break;
      case "agreement_date":
        fieldValues[field.name] = signedDate.date;
        break;
      case "lessee_name":
      case "lessee_company_name":
        fieldValues[field.name] = contact.name;
        break;
      case "lessee_location":
        fieldValues[field.name] = contact.address;
        break;
      case "unit_number":
        fieldValues[field.name] = unitNumber;
        break;
      case "unit_type":
        fieldValues[field.name] = randomItem(equipmentTypes);
        break;
      case "vin_number":
        fieldValues[field.name] = buildRandomVin();
        break;
      case "tag_number":
        fieldValues[field.name] = `TN ${randomInt(100000, 999999)}`;
        break;
      case "rental_rate_per_day":
        fieldValues[field.name] = String(dailyRate);
        break;
      case "rental_rate_per_week":
        fieldValues[field.name] = String(weeklyRate);
        break;
      case "rental_rate_per_month":
        fieldValues[field.name] = String(monthlyRate);
        break;
      case "rental_rate_additional_terms":
        fieldValues[field.name] = "plus applicable fees";
        break;
      case "subject_to_amount":
        fieldValues[field.name] = String(randomInt(500, 1500));
        break;
      case "subject_to_terms":
        fieldValues[field.name] = "damage deposit";
        break;
      case "minimum_lease_period":
        fieldValues[field.name] = `${randomInt(1, 6)} months`;
        break;
      case "agreement_signed_day":
        fieldValues[field.name] = signedDate.day;
        break;
      case "agreement_signed_month":
        fieldValues[field.name] = signedDate.month;
        break;
      case "agreement_signed_year":
        fieldValues[field.name] = signedDate.year;
        break;
      case "lessee_authorized_agent":
      case "received_from":
        fieldValues[field.name] = contact.contact;
        break;
      case "lessee_authorized_agent_title":
        fieldValues[field.name] = randomItem(["Operations Manager", "Fleet Manager", "Controller"]);
        break;
      case "metro_authorized_agent":
      case "inspection_in_inspected_by":
      case "received_by":
        fieldValues[field.name] = randomItem(["Spencer Morris", "Alex Johnson", "Chris Martin"]);
        break;
      case "metro_authorized_agent_title":
        fieldValues[field.name] = randomItem(["Leasing Manager", "Branch Manager", "Dispatch"]);
        break;
      case "special_instructions_cpu":
        fieldValues[field.name] = "Y";
        break;
      case "special_instructions_pickup":
        fieldValues[field.name] = signedDate.date;
        break;
      case "inspection_in_month":
        fieldValues[field.name] = inspectionDate.month;
        break;
      case "inspection_in_day":
        fieldValues[field.name] = inspectionDate.day;
        break;
      case "inspection_in_year":
        fieldValues[field.name] = inspectionDate.fullYear;
        break;
      case "dun":
        fieldValues[field.name] = `DLN-${randomInt(100000, 999999)}`;
        break;
      case "print_name":
        fieldValues[field.name] = contact.contact;
        break;
      default:
        if (field.name.startsWith("inspection_out_")) {
          fieldValues[field.name] = randomItem(conditionValues);
        } else {
          fieldValues[field.name] = randomItem(["Confirmed", "N/A", "OK"]);
        }
    }
  }

  return {
    customerEmail: contact.email,
    customerName: contact.name,
    message: `Please review the prepared Metro Trailer document for ${unitNumber} and complete any remaining fields.`,
    subject: "Your signature is requested for a Metro Trailer Document",
    values: fieldValues,
  };
}

export function DocusealPrefillWorkspace({
  templates,
  drafts: initialDrafts,
}: {
  templates: DocusealTemplateDefinition[];
  drafts: DocusealDraft[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [drafts, setDrafts] = useState(initialDrafts);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState(
    getInitialTemplate(templates, initialDrafts)?.key ?? "",
  );
  const [selectedDraftId, setSelectedDraftId] = useState(initialDrafts[0]?.id ?? "");
  const selectedDraft = drafts.find((draft) => draft.id === selectedDraftId) ?? null;
  const selectedTemplate =
    templates.find((template) => template.key === (selectedDraft?.templateKey ?? selectedTemplateKey)) ??
    templates[0];
  const [customerName, setCustomerName] = useState(selectedDraft?.customerName ?? "");
  const [customerEmail, setCustomerEmail] = useState(selectedDraft?.customerEmail ?? "");
  const [subject, setSubject] = useState(
    selectedDraft?.subject ?? "Your signature is requested for a Metro Trailer Document",
  );
  const [message, setMessage] = useState(
    selectedDraft?.message ??
      "Please review the prepared Metro Trailer document and complete any remaining fields.",
  );
  const [values, setValues] = useState<Record<string, string>>(
    selectedDraft?.values ?? emptyValues(selectedTemplate),
  );
  const [feedback, setFeedback] = useState<string | null>(null);

  const groupedFields = useMemo(() => sectionFields(selectedTemplate), [selectedTemplate]);
  const filledCount = getFilledCount(selectedTemplate, values);

  function loadDraft(draft: DocusealDraft) {
    const draftTemplate =
      templates.find((template) => template.key === draft.templateKey) ?? selectedTemplate;

    setSelectedDraftId(draft.id);
    setSelectedTemplateKey(draft.templateKey);
    setCustomerName(draft.customerName);
    setCustomerEmail(draft.customerEmail);
    setSubject(draft.subject);
    setMessage(draft.message);
    setValues({ ...emptyValues(draftTemplate), ...draft.values });
    setFeedback(null);
  }

  function updateValue(name: string, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  function fillRandomTestData() {
    const testData = buildRandomTestData(selectedTemplate);

    setCustomerName(testData.customerName);
    setCustomerEmail(testData.customerEmail);
    setSubject(testData.subject);
    setMessage(testData.message);
    setValues({ ...emptyValues(selectedTemplate), ...testData.values });
    setFeedback("Random test data filled. Review before saving or sending.");
  }

  async function submitJson<T>(url: string, method: string, body?: unknown) {
    const response = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const result = (await response.json().catch(() => null)) as ApiResult<T> | null;
    if (!response.ok) {
      throw new Error(result?.error ?? "Request failed.");
    }
    return result;
  }

  function createDraft() {
    startTransition(async () => {
      try {
        setFeedback(null);
        const result = await submitJson<DocusealDraft>("/api/docuseal/drafts", "POST", {
          templateKey: selectedTemplateKey,
          customerName,
          customerEmail,
          subject,
          message,
          values,
        });
        if (result?.data) {
          setDrafts((current) => [result.data!, ...current]);
          loadDraft(result.data);
        }
        setFeedback(result?.message ?? "Draft created.");
        router.refresh();
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : "Unable to create draft.");
      }
    });
  }

  function saveDraft() {
    if (!selectedDraft) {
      createDraft();
      return;
    }

    startTransition(async () => {
      try {
        setFeedback(null);
        const result = await submitJson<DocusealDraft>(
          `/api/docuseal/drafts/${selectedDraft.id}`,
          "PATCH",
          {
            customerName,
            customerEmail,
            subject,
            message,
            values,
          },
        );
        if (result?.data) {
          setDrafts((current) =>
            current.map((draft) => (draft.id === result.data!.id ? result.data! : draft)),
          );
          loadDraft(result.data);
        }
        setFeedback(result?.message ?? "Draft saved.");
        router.refresh();
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : "Unable to save draft.");
      }
    });
  }

  function sendDraft() {
    if (!selectedDraft) {
      setFeedback("Create or save a draft before sending.");
      return;
    }

    startTransition(async () => {
      try {
        setFeedback(null);
        const result = await submitJson<DocusealDraft>(
          `/api/docuseal/drafts/${selectedDraft.id}/send`,
          "POST",
        );
        if (result?.data) {
          setDrafts((current) =>
            current.map((draft) => (draft.id === result.data!.id ? result.data! : draft)),
          );
          loadDraft(result.data);
        }
        setFeedback(result?.message ?? "Submission sent.");
        router.refresh();
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : "Unable to send draft.");
      }
    });
  }

  return (
    <div className="grid gap-2 xl:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="panel overflow-hidden">
        <div className="border-b border-[var(--line)] px-3 py-2">
          <p className="eyebrow">Drafts</p>
          <h2 className="mt-1 text-[0.85rem] font-semibold text-slate-900">
            Employee prep queue
          </h2>
        </div>
        <div className="max-h-[calc(100vh-220px)] divide-y divide-[var(--line)] overflow-auto">
          {drafts.length === 0 ? (
            <div className="px-3 py-4 text-[0.75rem] text-slate-500">
              No prefill drafts yet.
            </div>
          ) : (
            drafts.map((draft) => (
              <button
                key={draft.id}
                type="button"
                onClick={() => loadDraft(draft)}
                className={`block w-full px-3 py-2 text-left ${
                  draft.id === selectedDraftId ? "bg-slate-100" : "bg-white hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[0.8rem] font-semibold text-slate-900">
                    {draft.customerName || "Unnamed customer"}
                  </span>
                  <span className="rounded-sm border border-[var(--line)] px-1.5 py-0.5 text-[0.6rem] uppercase tracking-[0.06em] text-slate-500">
                    {draft.status}
                  </span>
                </div>
                <p className="mt-1 truncate text-[0.68rem] text-slate-500">
                  {draft.location} - {draft.templateName}
                </p>
                <p className="mt-1 text-[0.65rem] text-slate-400">
                  Updated {formatDate(draft.updatedAt)}
                </p>
              </button>
            ))
          )}
        </div>
      </aside>

      <main className="space-y-2">
        <section className="panel overflow-hidden">
          <div className="grid gap-px border-b border-[var(--line)] bg-[var(--line)] md:grid-cols-4">
            <div className="bg-white px-3 py-2">
              <p className="workspace-metric-label">Template</p>
              <p className="truncate text-[0.8rem] font-semibold text-slate-900">
                {selectedTemplate.location} road trailer
              </p>
            </div>
            <div className="bg-white px-3 py-2">
              <p className="workspace-metric-label">Fields complete</p>
              <p className="text-[0.8rem] font-semibold text-slate-900">
                {filledCount}/{selectedTemplate.fields.length}
              </p>
            </div>
            <div className="bg-white px-3 py-2">
              <p className="workspace-metric-label">DocuSeal template</p>
              <p className="text-[0.8rem] font-semibold text-slate-900">
                #{selectedTemplate.docusealTemplateId}
              </p>
            </div>
            <div className="bg-white px-3 py-2">
              <p className="workspace-metric-label">Customer link</p>
              {selectedDraft?.docusealSubmitterUrl ? (
                <a
                  href={selectedDraft.docusealSubmitterUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[0.8rem] font-semibold text-[var(--brand)]"
                >
                  Open DocuSeal
                </a>
              ) : (
                <p className="text-[0.8rem] font-semibold text-slate-900">Not sent</p>
              )}
            </div>
          </div>

          <div className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-1 text-[0.75rem] text-slate-600">
              <span className="font-medium">Template</span>
              <select
                value={selectedTemplateKey}
                disabled={Boolean(selectedDraft)}
                onChange={(event) => {
                  const nextTemplate = templates.find(
                    (template) => template.key === event.target.value,
                  );
                  setSelectedTemplateKey(event.target.value);
                  if (nextTemplate) {
                    setValues(emptyValues(nextTemplate));
                  }
                }}
                className="workspace-input w-full"
              >
                {templates.map((template) => (
                  <option key={template.key} value={template.key}>
                    {template.location} - {template.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-[0.75rem] text-slate-600">
              <span className="font-medium">Customer name</span>
              <input
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                className="workspace-input w-full"
              />
            </label>
            <label className="space-y-1 text-[0.75rem] text-slate-600">
              <span className="font-medium">Customer email</span>
              <input
                type="email"
                value={customerEmail}
                onChange={(event) => setCustomerEmail(event.target.value)}
                className="workspace-input w-full"
              />
            </label>
            <label className="space-y-1 text-[0.75rem] text-slate-600">
              <span className="font-medium">Subject</span>
              <input
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                className="workspace-input w-full"
              />
            </label>
            <label className="space-y-1 text-[0.75rem] text-slate-600 md:col-span-2 xl:col-span-4">
              <span className="font-medium">Email message</span>
              <textarea
                rows={2}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                className="workspace-input w-full resize-y"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line)] px-3 py-2">
            <p className="text-[0.72rem] text-slate-500">
              Filled fields are sent to DocuSeal as read-only. Empty fields remain available to the customer.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-secondary"
                disabled={pending}
                onClick={fillRandomTestData}
              >
                Fill test data
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={pending}
                onClick={createDraft}
              >
                New draft
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={pending}
                onClick={saveDraft}
              >
                Save
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={pending || selectedDraft?.status === "sent"}
                onClick={sendDraft}
              >
                Send through DocuSeal
              </button>
            </div>
          </div>
          {feedback ? (
            <div className="border-t border-[var(--line)] px-3 py-2 text-[0.75rem] text-slate-600">
              {feedback}
            </div>
          ) : null}
        </section>

        {Object.entries(groupedFields).map(([section, fields]) => (
          <section key={section} className="panel overflow-hidden">
            <div className="border-b border-[var(--line)] px-3 py-2">
              <h3 className="text-[0.82rem] font-semibold text-slate-900">{section}</h3>
            </div>
            <div className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-3">
              {fields.map((field) => (
                <label
                  key={field.name}
                  className={`space-y-1 text-[0.75rem] text-slate-600 ${
                    field.multiline ? "md:col-span-2 xl:col-span-3" : ""
                  }`}
                >
                  <span className="flex items-center justify-between gap-2 font-medium">
                    <span>{field.label}</span>
                    <span className="mono text-[0.6rem] font-normal text-slate-400">
                      {field.name}
                    </span>
                  </span>
                  {field.multiline ? (
                    <textarea
                      rows={2}
                      value={values[field.name] ?? ""}
                      onChange={(event) => updateValue(field.name, event.target.value)}
                      className="workspace-input w-full resize-y"
                    />
                  ) : (
                    <input
                      value={values[field.name] ?? ""}
                      onChange={(event) => updateValue(field.name, event.target.value)}
                      className="workspace-input w-full"
                    />
                  )}
                </label>
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
