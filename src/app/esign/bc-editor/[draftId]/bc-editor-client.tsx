"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";

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

type NoticeTone = "neutral" | "success" | "warning" | "error";
type SearchState = "idle" | "loading" | "done" | "error";
type ActiveSearch = "customer" | "equipment" | "rentalOrder" | null;

type EditorPayload = {
  draft: DocusealDraft;
  template: DocusealTemplateDefinition;
};

type EditorActor = {
  bcUserId: string;
  bcUserSecurityId: string;
  companyName: string;
};

type EditorCapabilities = {
  canEdit: boolean;
  canSend: boolean;
  canVoid: boolean;
  canManageTemplates: boolean;
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

type RentalOrderSearchResult = {
  rentalOrderNo: string;
  customerNumber: string;
  customerName: string;
  assetNumbers: string[];
  branchCode: string;
  shipDate: string;
  lastActivityAt: string;
  equipmentCount: number;
  grossAmount: string;
};

type EditorProps = {
  draft: DocusealDraft;
  template: DocusealTemplateDefinition;
  templates: DocusealTemplateDefinition[];
  expires: number;
  session: string;
  token: string;
  actor: EditorActor;
  capabilities: EditorCapabilities;
};

const signingLinkVariable = "{submitter.link}";
const signingLinkMarkdown = `[Review and Submit](${signingLinkVariable})`;
const legacyDefaultEmailMessages = new Set([
  `Please review the prepared Metro Trailer document and complete any remaining fields.\n\n${signingLinkMarkdown}`,
  `Please review the prepared Metro Trailer document and complete any remaining fields. Click the Review and Submit link below to open the document. If the button is missing, copy and paste this link into your browser: ${signingLinkVariable} ${signingLinkMarkdown}`,
  `Hello, Metro Trailer has prepared an E-Sign document for your review. Please click the Review and Submit link to open the document and complete any remaining fields. ${signingLinkMarkdown} If the button is missing, copy and paste this link into your browser: ${signingLinkVariable} Thank you, Metro Trailer`,
]);
const defaultEmailMessage = `Hello,

Metro Trailer has prepared an E-Sign document for your review.

Please click the Review and Submit link below to open the document and complete any remaining fields.

${signingLinkMarkdown}

If the button is missing, copy and paste this link into your browser:
${signingLinkVariable}

Thank you,
Metro Trailer`;
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

function formatShortDate(value: string) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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

function normalizeEmailMessage(value: string) {
  const trimmed = value.trim();
  if (!trimmed || legacyDefaultEmailMessages.has(trimmed)) {
    return defaultEmailMessage;
  }
  return value;
}

function renderMessagePreview(value: string) {
  const tokenRegex = /(\[Review and Submit\]\(\{submitter\.link\}\)|\{submitter\.link\})/gi;
  return value.split(tokenRegex).map((part, index) => {
    if (!part) {
      return null;
    }

    if (
      /^\[Review and Submit\]\(\{submitter\.link\}\)$/i.test(part) ||
      /^\{submitter\.link\}$/i.test(part)
    ) {
      return (
        <span
          key={`${part}-${index}`}
          className="mx-0.5 inline-flex rounded-sm border border-[#0071f4]/30 bg-[#0071f4]/10 px-1.5 py-0.5 font-semibold text-[#002b5c]"
        >
          {part}
        </span>
      );
    }

    return <span key={`${part}-${index}`}>{part}</span>;
  });
}

function FieldInput({
  disabled,
  field,
  value,
  onChange,
  missing,
}: {
  disabled: boolean;
  field: DocusealFieldDefinition;
  value: string;
  onChange: (name: string, value: string) => void;
  missing: boolean;
}) {
  if (isSignatureField(field)) {
    return (
      <div className="rounded-sm border border-amber-300 bg-amber-50 px-2 py-2 text-[0.74rem] font-semibold text-amber-900">
        Customer completes this in the live E-Sign document.
      </div>
    );
  }

  const commonClass =
    `w-full rounded-sm border bg-white px-2 text-[0.8rem] text-slate-950 shadow-inner outline-none disabled:bg-slate-100 disabled:text-slate-600 ${
      missing
        ? "border-red-500 ring-1 ring-red-500 focus:border-red-600 focus:ring-red-600"
        : "border-slate-300 focus:border-[#0071f4] focus:ring-1 focus:ring-[#0071f4]"
    }`;

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

function EmailMessageEditor({
  disabled,
  value,
  textareaRef,
  onChange,
}: {
  disabled: boolean;
  value: string;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onChange: (value: string) => void;
}) {
  const overlayRef = useRef<HTMLDivElement | null>(null);

  return (
    <div className="relative min-h-48 rounded-sm border border-slate-300 bg-white focus-within:border-[#0071f4] focus-within:ring-1 focus-within:ring-[#0071f4]">
      <div
        ref={overlayRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words px-3 py-2 text-[0.82rem] leading-6 text-slate-950"
      >
        {renderMessagePreview(value)}
        {value.endsWith("\n") ? " " : null}
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        disabled={disabled}
        rows={8}
        spellCheck={false}
        onScroll={(event) => {
          if (overlayRef.current) {
            overlayRef.current.scrollTop = event.currentTarget.scrollTop;
            overlayRef.current.scrollLeft = event.currentTarget.scrollLeft;
          }
        }}
        onChange={(event) => onChange(event.target.value)}
        className="relative z-10 min-h-48 w-full resize-y rounded-sm border-0 bg-transparent px-3 py-2 text-[0.82rem] leading-6 text-transparent caret-slate-950 outline-none selection:bg-[#0071f4]/25 disabled:bg-slate-100/70 disabled:caret-transparent"
      />
    </div>
  );
}

function GenericSection({
  disabled,
  section,
  fields,
  values,
  missingFields,
  onChange,
}: {
  disabled: boolean;
  section: string;
  fields: DocusealFieldDefinition[];
  values: Record<string, string>;
  missingFields: Set<string>;
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
              missing={missingFields.has(field.name)}
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
  missingFields,
  onChange,
}: {
  disabled: boolean;
  fields: DocusealFieldDefinition[];
  values: Record<string, string>;
  missingFields: Set<string>;
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
                        missing={missingFields.has(outField.name)}
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
                        missing={missingFields.has(inField.name)}
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
                  missing={missingFields.has(field.name)}
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
  session,
  token,
  actor,
  capabilities,
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
  const [rentalOrderQuery, setRentalOrderQuery] = useState(
    draft.values.rental_order_number ?? "",
  );
  const [subject, setSubject] = useState(draft.subject);
  const [message, setMessage] = useState(normalizeEmailMessage(draft.message));
  const [customerQuery, setCustomerQuery] = useState(draft.customerName);
  const [customerResults, setCustomerResults] = useState<CustomerSearchResult[]>([]);
  const [equipmentQuery, setEquipmentQuery] = useState(draft.values.unit_number ?? "");
  const [equipmentResults, setEquipmentResults] = useState<EquipmentSearchResult[]>([]);
  const [rentalOrderResults, setRentalOrderResults] = useState<RentalOrderSearchResult[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentSearchResult | null>(null);
  const [rentableOnly, setRentableOnly] = useState(true);
  const [busy, setBusy] = useState("");
  const [feedback, setFeedback] = useState("Ready");
  const [noticeTone, setNoticeTone] = useState<NoticeTone>("neutral");
  const [activeSearch, setActiveSearch] = useState<ActiveSearch>(null);
  const [customerSearchState, setCustomerSearchState] = useState<SearchState>("idle");
  const [equipmentSearchState, setEquipmentSearchState] = useState<SearchState>("idle");
  const [rentalOrderSearchState, setRentalOrderSearchState] = useState<SearchState>("idle");
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [forceSend, setForceSend] = useState(false);
  const groupedFields = useMemo(() => groupFields(currentTemplate.fields), [currentTemplate]);
  const disabled = Boolean(busy) || currentDraft.status === "sent" || !capabilities.canEdit;
  const actionAuth = useMemo(
    () => ({
      expires,
      session,
      token,
    }),
    [expires, session, token],
  );
  const filledCount = currentTemplate.fields.filter((field) => values[field.name]?.trim()).length;
  const requiredFields = useMemo(
    () => currentTemplate.fields.filter((field) => !isSignatureField(field)),
    [currentTemplate.fields],
  );
  const missingRequiredFields = useMemo(
    () => requiredFields.filter((field) => !String(values[field.name] ?? "").trim()),
    [requiredFields, values],
  );
  const missingFields = useMemo(
    () => new Set(validationAttempted ? missingRequiredFields.map((field) => field.name) : []),
    [missingRequiredFields, validationAttempted],
  );
  const messageHasSigningLink = includesSigningLink(message);
  const location = getEquipmentStoreKey(selectedEquipment) || currentDraft.location;
  const noticeClass =
    noticeTone === "error"
      ? "border-red-400 bg-red-50 text-red-800"
      : noticeTone === "warning"
        ? "border-amber-300 bg-amber-50 text-amber-800"
        : noticeTone === "success"
          ? "border-[#0071f4]/30 bg-[#0071f4]/10 text-[#002b5c]"
          : "border-slate-200 bg-slate-50 text-slate-700";

  function setNotice(message: string, tone: NoticeTone = "neutral") {
    setFeedback(message);
    setNoticeTone(tone);
  }

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
          emailRecipient: customerEmail,
          emailSubject: subject,
          bcUserId: actor.bcUserId,
        },
      },
      "*",
    );
  }

  useEffect(() => {
    if (currentDraft.status === "sent") {
      return;
    }
    const query = customerQuery.trim();
    if (query.length < 2) {
      setCustomerResults([]);
      setCustomerSearchState("idle");
      return;
    }

    const controller = new AbortController();
    setCustomerSearchState("loading");
    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          q: query,
          pageSize: "8",
          expires: String(expires),
          session,
          token,
        });
        const response = await fetch(
          `/api/esign/bc-editor/${encodeURIComponent(currentDraft.id)}/customers?${params.toString()}`,
          { signal: controller.signal },
        );
        const payload = (await response.json().catch(() => null)) as
          | ApiResult<CustomerSearchResult[]>
          | null;
        if (!controller.signal.aborted) {
          setCustomerResults(response.ok ? payload?.data ?? [] : []);
          setCustomerSearchState(response.ok ? "done" : "error");
        }
      } catch {
        if (!controller.signal.aborted) {
          setCustomerResults([]);
          setCustomerSearchState("error");
        }
      }
    }, 80);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [currentDraft.id, currentDraft.status, customerQuery, expires, session, token]);

  useEffect(() => {
    if (currentDraft.status === "sent") {
      return;
    }
    const query = equipmentQuery.trim();
    if (query.length < 2) {
      setEquipmentResults([]);
      setEquipmentSearchState("idle");
      return;
    }

    const controller = new AbortController();
    setEquipmentSearchState("loading");
    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          q: query,
          pageSize: "8",
          rentableOnly: String(rentableOnly),
          expires: String(expires),
          session,
          token,
        });
        const response = await fetch(
          `/api/esign/bc-editor/${encodeURIComponent(currentDraft.id)}/equipment?${params.toString()}`,
          { signal: controller.signal },
        );
        const payload = (await response.json().catch(() => null)) as
          | ApiResult<EquipmentSearchResult[]>
          | null;
        if (!controller.signal.aborted) {
          setEquipmentResults(response.ok ? payload?.data ?? [] : []);
          setEquipmentSearchState(response.ok ? "done" : "error");
        }
      } catch {
        if (!controller.signal.aborted) {
          setEquipmentResults([]);
          setEquipmentSearchState("error");
        }
      }
    }, 80);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [currentDraft.id, currentDraft.status, equipmentQuery, expires, rentableOnly, session, token]);

  useEffect(() => {
    if (currentDraft.status === "sent") {
      return;
    }
    const query = rentalOrderQuery.trim();
    const customerNo = values.customer_number?.trim() ?? "";
    const unitNo = values.unit_number?.trim() ?? "";
    if (query.length < 2 && !customerNo && !unitNo) {
      setRentalOrderResults([]);
      setRentalOrderSearchState("idle");
      return;
    }

    const controller = new AbortController();
    setRentalOrderSearchState("loading");
    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          q: query,
          pageSize: "8",
          customerNo,
          unitNo,
          expires: String(expires),
          session,
          token,
        });
        const response = await fetch(
          `/api/esign/bc-editor/${encodeURIComponent(currentDraft.id)}/rental-orders?${params.toString()}`,
          { signal: controller.signal },
        );
        const payload = (await response.json().catch(() => null)) as
          | ApiResult<RentalOrderSearchResult[]>
          | null;
        if (!controller.signal.aborted) {
          setRentalOrderResults(response.ok ? payload?.data ?? [] : []);
          setRentalOrderSearchState(response.ok ? "done" : "error");
        }
      } catch {
        if (!controller.signal.aborted) {
          setRentalOrderResults([]);
          setRentalOrderSearchState("error");
        }
      }
    }, 80);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [
    currentDraft.id,
    currentDraft.status,
    expires,
    rentalOrderQuery,
    session,
    token,
    values.customer_number,
    values.unit_number,
  ]);

  function loadPayload(payload: EditorPayload) {
    setCurrentDraft(payload.draft);
    setCurrentTemplate(payload.template);
    setValues({ ...emptyValues(payload.template), ...payload.draft.values });
    setCustomerName(payload.draft.customerName);
    setCustomerEmail(payload.draft.customerEmail);
    setRentalOrderNo(payload.draft.values.rental_order_number ?? "");
    setRentalOrderQuery(payload.draft.values.rental_order_number ?? "");
    setSubject(payload.draft.subject);
    setMessage(normalizeEmailMessage(payload.draft.message));
    setCustomerQuery(payload.draft.customerName);
    setEquipmentQuery(payload.draft.values.unit_number ?? "");
    setCustomerResults([]);
    setEquipmentResults([]);
    setRentalOrderResults([]);
    setActiveSearch(null);
  }

  function updateValue(name: string, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
    if (name === "rental_order_number") {
      setRentalOrderNo(value);
    }
    setForceSend(false);
    setNotice("Unsaved changes", "warning");
  }

  function insertSigningLink() {
    const textarea = messageTextareaRef.current;
    if (!textarea) {
      setMessage((current) => `${current.trimEnd()}\n\n${signingLinkMarkdown}`);
      setNotice("Signing link inserted.", "success");
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
    setNotice("Signing link inserted.", "success");
  }

  function selectCustomer(customer: CustomerSearchResult) {
    setCustomerName(customer.name);
    setCustomerQuery(customer.name);
    setCustomerEmail(customer.contactInfo?.email ?? customerEmail);
    setValues((current) => applyCustomerToValues(current, customer));
    setActiveSearch(null);
    setCustomerResults([]);
    setCustomerSearchState("idle");
    setNotice(`Selected ${customer.name} (${customer.customerNumber}).`, "success");
  }

  function selectEquipment(equipment: EquipmentSearchResult) {
    setSelectedEquipment(equipment);
    setEquipmentQuery(equipment.assetNumber);
    setValues((current) => applyEquipmentToValues(current, equipment));
    setActiveSearch(null);
    setEquipmentResults([]);
    setEquipmentSearchState("idle");
    setNotice(`Selected ${equipment.assetNumber} from ${equipment.branch}.`, "success");
  }

  function selectRentalOrder(order: RentalOrderSearchResult) {
    setRentalOrderNo(order.rentalOrderNo);
    setRentalOrderQuery(order.rentalOrderNo);
    setValues((current) => ({
      ...current,
      rental_order_number: order.rentalOrderNo,
      order_number: order.rentalOrderNo,
      customer_number: current.customer_number || order.customerNumber,
      lessee_name: current.lessee_name || order.customerName,
      customer_name: current.customer_name || order.customerName,
      unit_number: current.unit_number || order.assetNumbers[0] || "",
    }));
    if (!customerName && order.customerName) {
      setCustomerName(order.customerName);
      setCustomerQuery(order.customerName);
    }
    if (!equipmentQuery && order.assetNumbers[0]) {
      setEquipmentQuery(order.assetNumbers[0]);
    }
    setActiveSearch(null);
    setRentalOrderResults([]);
    setRentalOrderSearchState("idle");
    setNotice(`Selected rental order ${order.rentalOrderNo}.`, "success");
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
    if (!capabilities.canEdit || currentDraft.status === "sent") {
      setNotice("This Business Central session cannot edit this E-Sign draft.", "error");
      return false;
    }

    setBusy("save");
    try {
      const result = await submitJson<EditorPayload>(
        `/api/esign/bc-editor/${encodeURIComponent(currentDraft.id)}`,
        {
          ...actionAuth,
          location: getEquipmentStoreKey(selectedEquipment) || currentDraft.location,
          customerName,
          customerEmail,
          subject,
          message,
          values: {
            ...values,
            rental_order_number: rentalOrderNo,
            order_number: values.order_number || rentalOrderNo,
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
      setNotice(result.message ?? "Saved.", "success");
      return true;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to save.", "error");
      return false;
    } finally {
      setBusy("");
    }
  }

  async function switchTemplate(templateKey: string) {
    if (
      templateKey === currentTemplate.key ||
      currentDraft.status === "sent" ||
      !capabilities.canEdit
    ) {
      return;
    }

    setBusy("template");
    try {
      const result = await submitJson<EditorPayload>(
        `/api/esign/bc-editor/${encodeURIComponent(currentDraft.id)}/template`,
        {
          ...actionAuth,
          templateKey,
          location: getEquipmentStoreKey(selectedEquipment) || currentDraft.location,
          values: {
            ...values,
            rental_order_number: rentalOrderNo,
            order_number: values.order_number || rentalOrderNo,
          },
        },
      );
      if (result.data) {
        loadPayload(result.data);
      }
      setValidationAttempted(false);
      setForceSend(false);
      setNotice(result.message ?? "Template changed.", "success");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to change template.", "error");
    } finally {
      setBusy("");
    }
  }

  async function runAction(action: "prepare" | "send" | "invalidate", forceOverride = false) {
    if (
      (action === "prepare" && !capabilities.canEdit) ||
      (action === "send" && !capabilities.canSend) ||
      (action === "invalidate" && !capabilities.canVoid)
    ) {
      setNotice("This Business Central session cannot perform that E-Sign action.", "error");
      return;
    }

    if (action === "send" && missingRequiredFields.length > 0 && !forceSend && !forceOverride) {
      setValidationAttempted(true);
      setNotice(
        `${missingRequiredFields.length} required field${missingRequiredFields.length === 1 ? " is" : "s are"} empty. Review the highlighted fields or use Send anyway to force continue.`,
        "error",
      );
      return;
    }

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
        { ...actionAuth, action },
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
      if (action === "send") {
        setValidationAttempted(false);
        setForceSend(false);
      }
      setNotice(
        action === "send"
          ? "E-Sign document sent."
          : action === "prepare"
            ? "Preview opened."
            : "Sent document invalidated.",
        "success",
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : `Unable to ${action}.`, "error");
    } finally {
      setBusy("");
    }
  }

  return (
    <main className="min-h-[calc(100vh-8px)] bg-slate-100 text-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-300 bg-white px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-[#002b5c]">
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
            <span className="rounded-sm border border-[#0071f4]/30 bg-[#0071f4]/10 px-2 py-1 text-[0.72rem] font-semibold text-[#002b5c]">
              BC: {actor.bcUserId || "Business Central"}
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
              disabled={Boolean(busy) || !capabilities.canEdit}
              className="h-8 rounded-sm border border-slate-300 bg-white px-3 text-[0.76rem] font-semibold text-slate-900 disabled:opacity-50"
            >
              Preview
            </button>
            {currentDraft.status === "sent" ? (
              <button
                type="button"
                onClick={() => runAction("invalidate")}
                disabled={Boolean(busy) || !capabilities.canVoid}
                className="h-8 rounded-sm border border-red-300 bg-red-50 px-3 text-[0.76rem] font-semibold text-red-700 disabled:opacity-50"
              >
                Void sent document
              </button>
            ) : (
              <button
                type="button"
                onClick={() => runAction("send")}
                disabled={Boolean(busy) || !capabilities.canSend}
                className="h-8 rounded-sm bg-[#002b5c] px-4 text-[0.76rem] font-semibold text-white disabled:bg-slate-400"
              >
                Send E-Sign Document
              </button>
            )}
          </div>
        </div>
        <div className={`mt-2 rounded-sm border px-3 py-2 text-[0.76rem] font-semibold ${noticeClass}`}>
          {busy ? "Working..." : feedback}
        </div>
        {validationAttempted && missingRequiredFields.length > 0 ? (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-sm border border-red-500 bg-red-50 px-3 py-2 text-[0.78rem] font-semibold text-red-800">
            <span>
              {missingRequiredFields.length} required field
              {missingRequiredFields.length === 1 ? " is" : "s are"} empty. Highlighted fields must be reviewed before sending.
            </span>
            <button
              type="button"
              onClick={() => {
                setForceSend(true);
                void runAction("send", true);
              }}
              disabled={Boolean(busy) || !capabilities.canSend}
              className="h-8 rounded-sm bg-red-700 px-3 text-[0.74rem] font-semibold text-white disabled:bg-red-300"
            >
              Send anyway
            </button>
          </div>
        ) : null}
      </header>

      <div className="mx-auto min-h-[calc(100vh-116px)] max-w-[1500px] border-x border-slate-300 bg-white">
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
              onFocus={() => setActiveSearch("customer")}
              onChange={(event) => {
                setActiveSearch("customer");
                setCustomerQuery(event.target.value);
                setCustomerName(event.target.value);
              }}
              className="h-9 rounded-sm border border-slate-300 bg-white px-2 text-[0.8rem] text-slate-950 outline-none focus:border-[#0071f4] focus:ring-1 focus:ring-[#0071f4]"
            />
            {activeSearch === "customer" && customerQuery.trim().length >= 2 ? (
              <div className="absolute left-0 right-0 top-full z-40 max-h-64 overflow-auto border border-slate-300 bg-white shadow-lg">
                {customerSearchState === "loading" ? (
                  <div className="px-2 py-2 text-[0.78rem] font-semibold text-[#002b5c]">
                    Searching customers...
                  </div>
                ) : customerSearchState === "error" ? (
                  <div className="px-2 py-2 text-[0.78rem] font-semibold text-red-700">
                    Customer search failed.
                  </div>
                ) : customerResults.length > 0 ? (
                  customerResults.map((customer) => (
                    <button
                      key={customer.id}
                      type="button"
                      onClick={() => selectCustomer(customer)}
                      className="block w-full border-b border-slate-100 px-2 py-2 text-left text-[0.78rem] hover:bg-[#0071f4]/10"
                    >
                      <span className="font-semibold">{customer.name}</span>
                      <span className="block text-slate-500">
                        {customer.customerNumber} {customer.billingCity ? `/ ${customer.billingCity}` : ""}
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="px-2 py-2 text-[0.78rem] text-slate-600">No customers found.</div>
                )}
              </div>
            ) : null}
          </label>

          <label className="relative grid gap-1">
            <span className="text-[0.72rem] font-semibold text-slate-600">Unit/Trailer</span>
            <input
              value={equipmentQuery}
              disabled={disabled}
              onFocus={() => setActiveSearch("equipment")}
              onChange={(event) => {
                setActiveSearch("equipment");
                setEquipmentQuery(event.target.value);
              }}
              className="h-9 rounded-sm border border-slate-300 bg-white px-2 text-[0.8rem] text-slate-950 outline-none focus:border-[#0071f4] focus:ring-1 focus:ring-[#0071f4]"
            />
            {activeSearch === "equipment" && equipmentQuery.trim().length >= 2 ? (
              <div className="absolute left-0 right-0 top-full z-40 max-h-72 overflow-auto border border-slate-300 bg-white shadow-lg">
                {equipmentSearchState === "loading" ? (
                  <div className="px-2 py-2 text-[0.78rem] font-semibold text-[#002b5c]">
                    Searching trailers...
                  </div>
                ) : equipmentSearchState === "error" ? (
                  <div className="px-2 py-2 text-[0.78rem] font-semibold text-red-700">
                    Trailer search failed.
                  </div>
                ) : equipmentResults.length > 0 ? (
                  equipmentResults.map((equipment) => (
                    <button
                      key={equipment.id}
                      type="button"
                      onClick={() => selectEquipment(equipment)}
                      className="block w-full border-b border-slate-100 px-2 py-2 text-left text-[0.78rem] hover:bg-[#0071f4]/10"
                    >
                      <span className="font-semibold">{equipment.assetNumber}</span>
                      <span className="block text-slate-500">
                        {getEquipmentType(equipment)} / {equipment.branch} / {equipment.status}
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="px-2 py-2 text-[0.78rem] text-slate-600">No rentable trailers found.</div>
                )}
              </div>
            ) : null}
          </label>

          <label className="relative grid gap-1">
            <span className="text-[0.72rem] font-semibold text-slate-600">Rental order no.</span>
            <input
              value={rentalOrderQuery}
              disabled={disabled}
              onFocus={() => setActiveSearch("rentalOrder")}
              onChange={(event) => {
                setActiveSearch("rentalOrder");
                setRentalOrderQuery(event.target.value);
                setRentalOrderNo(event.target.value);
                updateValue("rental_order_number", event.target.value);
              }}
              className="h-9 rounded-sm border border-slate-300 bg-white px-2 text-[0.8rem] text-slate-950 outline-none focus:border-[#0071f4] focus:ring-1 focus:ring-[#0071f4]"
            />
            {activeSearch === "rentalOrder" && (rentalOrderQuery.trim().length >= 2 || values.customer_number || values.unit_number) ? (
              <div className="absolute left-0 right-0 top-full z-40 max-h-72 overflow-auto border border-slate-300 bg-white shadow-lg">
                {rentalOrderSearchState === "loading" ? (
                  <div className="px-2 py-2 text-[0.78rem] font-semibold text-[#002b5c]">
                    Searching rental orders...
                  </div>
                ) : rentalOrderSearchState === "error" ? (
                  <div className="px-2 py-2 text-[0.78rem] font-semibold text-red-700">
                    Rental order search failed.
                  </div>
                ) : rentalOrderResults.length > 0 ? (
                  rentalOrderResults.map((order) => (
                    <button
                      key={order.rentalOrderNo}
                      type="button"
                      onClick={() => selectRentalOrder(order)}
                      className="block w-full border-b border-slate-100 px-2 py-2 text-left text-[0.78rem] hover:bg-[#0071f4]/10"
                    >
                      <span className="font-semibold">{order.rentalOrderNo}</span>
                      <span className="block text-slate-500">
                        {order.customerName || order.customerNumber || "No customer"} /{" "}
                        {order.assetNumbers.length ? order.assetNumbers.join(", ") : "No unit"}
                      </span>
                      <span className="block text-slate-500">
                        {order.branchCode ? `${order.branchCode} / ` : ""}
                        {order.shipDate ? `Ship ${formatShortDate(order.shipDate)} / ` : ""}
                        {order.equipmentCount} unit{order.equipmentCount === 1 ? "" : "s"}
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="px-2 py-2 text-[0.78rem] text-slate-600">No rental orders found.</div>
                )}
              </div>
            ) : null}
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
              onChange={(event) => {
                setCustomerEmail(event.target.value);
                setNotice("Unsaved email changes", "warning");
              }}
              className="h-9 rounded-sm border border-slate-300 bg-white px-2 text-[0.8rem] text-slate-950 outline-none focus:border-[#0071f4] focus:ring-1 focus:ring-[#0071f4]"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-[0.72rem] font-semibold text-slate-600">Subject</span>
            <input
              value={subject}
              disabled={disabled}
              onChange={(event) => {
                setSubject(event.target.value);
                setNotice("Unsaved email changes", "warning");
              }}
              className="h-9 rounded-sm border border-slate-300 bg-white px-2 text-[0.8rem] text-slate-950 outline-none focus:border-[#0071f4] focus:ring-1 focus:ring-[#0071f4]"
            />
          </label>
          <label className="grid gap-1">
            <span className="flex items-center justify-between text-[0.72rem] font-semibold text-slate-600">
              <span>Email message</span>
              <button
                type="button"
                onClick={insertSigningLink}
                disabled={disabled}
                className="rounded-sm border border-[#0071f4]/40 bg-white px-2 py-1 text-[0.68rem] font-semibold text-[#002b5c] disabled:opacity-50"
              >
                Insert signing link
              </button>
            </span>
            <EmailMessageEditor
              textareaRef={messageTextareaRef}
              value={message}
              disabled={disabled}
              onChange={(nextMessage) => {
                setMessage(nextMessage);
                setNotice("Unsaved email changes", "warning");
              }}
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
              missingFields={missingFields}
              onChange={updateValue}
            />
          ) : (
            <GenericSection
              key={section}
              disabled={disabled}
              section={section}
              fields={fields}
              values={values}
              missingFields={missingFields}
              onChange={updateValue}
            />
          ),
        )}
      </div>
    </main>
  );
}
