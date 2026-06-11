"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type {
  DocusealFieldDefinition,
  DocusealTemplateDefinition,
} from "@/lib/docuseal/templates";
import type {
  DocusealDefaultScope,
  DocusealDraft,
  DocusealPrefillDefault,
} from "@/lib/server/docuseal-prefill";
import { formatDate } from "@/lib/format";
import { DocusealModeTabs } from "@/components/docuseal-mode-tabs";
import { Icon } from "@/components/icons";

type ApiResult<T> = {
  data?: T;
  message?: string;
  error?: string;
};

type EquipmentSearchResult = {
  id: string;
  assetNumber: string;
  type: string;
  subtype: string | null;
  branch: string;
  branchCode: string | null;
  serialNumber: string | null;
  registrationNumber: string | null;
  bcLocationCode: string | null;
};

type CustomerSearchResult = {
  id: string;
  customerNumber: string;
  name: string;
  customerType: string;
  billingCity: string;
  branchCoverage: string[];
  locations: Array<{
    id: string;
    name: string;
    address?: string;
    contactPerson?: string;
  }>;
};

const signingLinkVariable = "{submitter.link}";
const signingLinkMarkdown = `[Review and Submit](${signingLinkVariable})`;
const defaultSections = new Set([
  "Rates and terms",
  "Execution",
  "Special instructions",
]);
const defaultScopeLabels: Record<DocusealDefaultScope, string> = {
  global: "Company",
  location: "Store",
  trailer_type: "Trailer type",
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

function includesSigningLink(value: string) {
  return /\{+submitter\.link\}+/i.test(value);
}

function getSectionDefaultFieldNames(
  template: DocusealTemplateDefinition,
  section: string,
) {
  if (!defaultSections.has(section)) {
    return new Set<string>();
  }

  return new Set(
    template.fields.filter((field) => field.section === section).map((field) => field.name),
  );
}

function extractDefaultValuesForSection(
  template: DocusealTemplateDefinition,
  values: Record<string, string>,
  section: string,
) {
  const defaultFieldNames = getSectionDefaultFieldNames(template, section);

  return Object.fromEntries(
    Object.entries(values).filter(([name]) => defaultFieldNames.has(name)),
  );
}

function countDefaultValuesForSection(
  template: DocusealTemplateDefinition,
  defaultValue: DocusealPrefillDefault | null | undefined,
  section: string,
) {
  if (!defaultValue) {
    return 0;
  }

  return Object.keys(
    extractDefaultValuesForSection(template, defaultValue.values, section),
  ).length;
}

function findDefault(
  defaults: DocusealPrefillDefault[],
  template: DocusealTemplateDefinition,
  scopeType: DocusealDefaultScope,
  scopeKey: string,
) {
  return defaults.find(
    (item) =>
      item.templateKey === template.key &&
      item.scopeType === scopeType &&
      item.scopeKey.toLowerCase() === scopeKey.toLowerCase(),
  );
}

function resolveDefaultValues(
  defaults: DocusealPrefillDefault[],
  template: DocusealTemplateDefinition,
  values: Record<string, string>,
  storeKey?: string,
) {
  const trailerType = values.unit_type?.trim();
  const locationKey = storeKey?.trim();

  return [
    findDefault(defaults, template, "global", "global"),
    locationKey ? findDefault(defaults, template, "location", locationKey) : null,
    trailerType ? findDefault(defaults, template, "trailer_type", trailerType) : null,
  ].reduce<Record<string, string>>(
    (merged, item) => (item ? { ...merged, ...item.values } : merged),
    {},
  );
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

function getEquipmentLabel(equipment: EquipmentSearchResult) {
  const details = [
    getEquipmentType(equipment),
    equipment.branch,
    equipment.serialNumber ? `VIN ${equipment.serialNumber}` : null,
    equipment.registrationNumber ? `Tag ${equipment.registrationNumber}` : null,
  ].filter(Boolean);

  return `${equipment.assetNumber} - ${details.join(" / ")}`;
}

function applyEquipmentToValues(
  current: Record<string, string>,
  equipment: EquipmentSearchResult,
) {
  return {
    ...current,
    unit_number: equipment.assetNumber,
    unit_type: getEquipmentType(equipment),
    vin_number: equipment.serialNumber ?? "",
    tag_number: equipment.registrationNumber ?? "",
  };
}

function getPrimaryCustomerLocation(customer: CustomerSearchResult) {
  return customer.locations[0] ?? null;
}

function getCustomerLocationText(customer: CustomerSearchResult) {
  const location = getPrimaryCustomerLocation(customer);

  return location?.address?.trim() || location?.name?.trim() || customer.billingCity || "";
}

function getCustomerLabel(customer: CustomerSearchResult) {
  const details = [
    customer.customerNumber,
    customer.billingCity || null,
    customer.locations.length > 0 ? `${customer.locations.length} site${customer.locations.length === 1 ? "" : "s"}` : null,
  ].filter(Boolean);

  return `${customer.name} - ${details.join(" / ")}`;
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

function fillBlankDefaults(
  defaults: Record<string, string>,
  values: Record<string, string>,
) {
  return Object.entries(defaults).reduce<Record<string, string>>(
    (merged, [name, value]) => ({
      ...merged,
      [name]: merged[name]?.trim() ? merged[name] : value,
    }),
    { ...values },
  );
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
    message: `Please review the prepared Metro Trailer document for ${unitNumber} and complete the requested signer fields.`,
    subject: "Your signature is requested for a Metro Trailer Document",
    values: fieldValues,
  };
}

export function DocusealPrefillWorkspace({
  templates,
  drafts: initialDrafts,
  defaults: initialDefaults,
}: {
  templates: DocusealTemplateDefinition[];
  drafts: DocusealDraft[];
  defaults: DocusealPrefillDefault[];
}) {
  const router = useRouter();
  const messageTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [pending, startTransition] = useTransition();
  const [drafts, setDrafts] = useState(initialDrafts);
  const [defaults, setDefaults] = useState(initialDefaults);
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
      `Please review the prepared Metro Trailer document and complete the requested signer fields.\n\n${signingLinkMarkdown}`,
  );
  const [, setSelectedCustomer] = useState<CustomerSearchResult | null>(null);
  const [customerQuery, setCustomerQuery] = useState(selectedDraft?.customerName ?? "");
  const [customerResults, setCustomerResults] = useState<CustomerSearchResult[]>([]);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentSearchResult | null>(null);
  const [equipmentQuery, setEquipmentQuery] = useState(selectedDraft?.values.unit_number ?? "");
  const [equipmentResults, setEquipmentResults] = useState<EquipmentSearchResult[]>([]);
  const [equipmentLoading, setEquipmentLoading] = useState(false);
  const [values, setValues] = useState<Record<string, string>>(
    selectedDraft?.values ?? {
      ...emptyValues(selectedTemplate),
      ...resolveDefaultValues(initialDefaults, selectedTemplate, {}, selectedDraft?.location),
    },
  );
  const [feedback, setFeedback] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string>("");
  const groupedFields = useMemo(() => sectionFields(selectedTemplate), [selectedTemplate]);
  const sectionNames = useMemo(() => Object.keys(groupedFields), [groupedFields]);
  const currentSection = sectionNames.includes(activeSection)
    ? activeSection
    : sectionNames[0] ?? "";
  const filledCount = getFilledCount(selectedTemplate, values);
  const messageHasSigningLink = includesSigningLink(message);
  const selectedDraftIsSent = selectedDraft?.status === "sent";
  const selectedStoreKey =
    getEquipmentStoreKey(selectedEquipment) || selectedDraft?.location?.trim() || "";

  useEffect(() => {
    if (selectedDraftIsSent) {
      return;
    }

    const query = customerQuery.trim();
    if (query.length < 2) {
      setCustomerResults([]);
      setCustomerLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setCustomerLoading(true);
      try {
        const params = new URLSearchParams({ q: query, pageSize: "8" });
        const response = await fetch(`/api/docuseal/customers?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          setCustomerResults([]);
          return;
        }
        const payload = (await response.json()) as { data?: CustomerSearchResult[] };
        setCustomerResults(payload.data ?? []);
      } catch {
        if (!controller.signal.aborted) {
          setCustomerResults([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setCustomerLoading(false);
        }
      }
    }, 180);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [customerQuery, selectedDraftIsSent]);

  useEffect(() => {
    if (selectedDraftIsSent) {
      return;
    }

    const query = equipmentQuery.trim();
    if (query.length < 2) {
      setEquipmentResults([]);
      setEquipmentLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setEquipmentLoading(true);
      try {
        const params = new URLSearchParams({ q: query, pageSize: "8" });
        const response = await fetch(`/api/docuseal/equipment?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          setEquipmentResults([]);
          return;
        }
        const payload = (await response.json()) as { data?: EquipmentSearchResult[] };
        setEquipmentResults(payload.data ?? []);
      } catch {
        if (!controller.signal.aborted) {
          setEquipmentResults([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setEquipmentLoading(false);
        }
      }
    }, 180);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [equipmentQuery, selectedDraftIsSent]);

  function getDefaultScopeKey(scopeType: DocusealDefaultScope) {
    if (scopeType === "global") {
      return "global";
    }
    if (scopeType === "location") {
      return selectedStoreKey;
    }

    return values.unit_type?.trim();
  }

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
    setCustomerQuery(draft.customerName);
    setSelectedCustomer(null);
    setEquipmentQuery(draft.values.unit_number ?? "");
    setSelectedEquipment(null);
    setFeedback(null);
  }

  function updateValue(name: string, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  function insertSigningLink() {
    const textarea = messageTextareaRef.current;
    const insertion = signingLinkMarkdown;

    if (!textarea) {
      setMessage((current) => `${current.trimEnd()}\n\n${insertion}`);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const prefix = message.slice(0, start);
    const suffix = message.slice(end);
    const paddedInsertion =
      (prefix && !prefix.endsWith("\n") ? "\n\n" : "") +
      insertion +
      (suffix && !suffix.startsWith("\n") ? "\n\n" : "");
    const nextMessage = `${prefix}${paddedInsertion}${suffix}`;
    const nextCursorPosition = prefix.length + paddedInsertion.length;

    setMessage(nextMessage);
    window.setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(nextCursorPosition, nextCursorPosition);
    }, 0);
  }

  function fillRandomTestData() {
    const testData = buildRandomTestData(selectedTemplate);

    setCustomerName(testData.customerName);
    setCustomerEmail(testData.customerEmail);
    setSubject(testData.subject);
    setMessage(`${testData.message}\n\n${signingLinkMarkdown}`);
    setValues({ ...emptyValues(selectedTemplate), ...testData.values });
    setCustomerQuery(testData.customerName);
    setSelectedCustomer(null);
    setEquipmentQuery(testData.values.unit_number ?? "");
    setSelectedEquipment(null);
    setFeedback("Random test data filled. Select real customer and unit records before sending.");
  }

  function applyDefaults() {
    if (selectedDraftIsSent) {
      setFeedback("Invalidate this sent draft before applying defaults.");
      return;
    }

    const defaultValues = resolveDefaultValues(defaults, selectedTemplate, values, selectedStoreKey);
    if (Object.keys(defaultValues).length === 0) {
      setFeedback("No saved defaults match this template, store, or trailer type.");
      return;
    }

    setValues((current) => ({ ...current, ...defaultValues }));
    setFeedback("Saved defaults applied.");
  }

  function selectCustomer(customer: CustomerSearchResult) {
    setSelectedCustomer(customer);
    setCustomerQuery(customer.name);
    setCustomerName(customer.name);
    setCustomerResults([]);
    setValues((current) => applyCustomerToValues(current, customer));
    setFeedback(`Selected ${customer.name} (${customer.customerNumber}).`);
  }

  function selectEquipment(equipment: EquipmentSearchResult) {
    const equipmentValues = applyEquipmentToValues(values, equipment);
    const nextValues = fillBlankDefaults(
      resolveDefaultValues(
        defaults,
        selectedTemplate,
        equipmentValues,
        getEquipmentStoreKey(equipment),
      ),
      equipmentValues,
    );

    setSelectedEquipment(equipment);
    setEquipmentQuery(equipment.assetNumber);
    setEquipmentResults([]);
    setValues(nextValues);
    setFeedback(`Selected ${equipment.assetNumber} from ${equipment.branch}.`);
  }

  function hasRequiredEquipment() {
    if (
      selectedTemplate.fields.some((field) => field.name === "unit_number") &&
      !values.unit_number?.trim()
    ) {
      setFeedback("Select a trailer unit before saving or sending this document.");
      return false;
    }

    return true;
  }

  function hasRequiredCustomer() {
    if (
      selectedTemplate.fields.some((field) => field.name === "customer_number") &&
      !values.customer_number?.trim()
    ) {
      setFeedback("Select a customer before saving or sending this document.");
      return false;
    }

    return true;
  }

  function hasActiveTemplate() {
    if (!selectedTemplate.active) {
      setFeedback("Activate this E-Sign template before creating or sending drafts.");
      return false;
    }

    return true;
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
    if (!hasActiveTemplate()) {
      return;
    }

    if (!hasRequiredCustomer()) {
      return;
    }

    if (!hasRequiredEquipment()) {
      return;
    }

    startTransition(async () => {
      try {
        setFeedback(null);
        const valuesWithDefaults = fillBlankDefaults(
          resolveDefaultValues(defaults, selectedTemplate, values, selectedStoreKey),
          values,
        );
        const result = await submitJson<DocusealDraft>("/api/docuseal/drafts", "POST", {
          templateKey: selectedTemplateKey,
          location: selectedStoreKey || "Unassigned",
          customerName,
          customerEmail,
          subject,
          message,
          values: valuesWithDefaults,
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

  function saveSectionDefaults(section: string, scopeType: DocusealDefaultScope) {
    const scopeKey = getDefaultScopeKey(scopeType);

    if (!scopeKey) {
      setFeedback(
        scopeType === "location"
          ? "Select a unit before saving store defaults."
          : "Enter a trailer type before saving trailer type defaults.",
      );
      return;
    }

    startTransition(async () => {
      try {
        setFeedback(null);
        const result = await submitJson<DocusealPrefillDefault>(
          "/api/docuseal/defaults",
          "POST",
          {
            templateKey: selectedTemplate.key,
            scopeType,
            scopeKey,
            values: extractDefaultValuesForSection(selectedTemplate, values, section),
            merge: true,
          },
        );
        if (result?.data) {
          setDefaults((current) => [
            result.data!,
            ...current.filter((item) => item.id !== result.data!.id),
          ]);
        }
        setFeedback(
          result?.message ??
            `${section} defaults saved for ${defaultScopeLabels[scopeType].toLowerCase()}.`,
        );
        router.refresh();
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : "Unable to save defaults.");
      }
    });
  }

  function saveDraft() {
    if (!hasActiveTemplate()) {
      return;
    }

    if (!hasRequiredCustomer()) {
      return;
    }

    if (!hasRequiredEquipment()) {
      return;
    }

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
            location: selectedStoreKey || selectedDraft.location,
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
    if (!hasActiveTemplate()) {
      return;
    }

    if (!hasRequiredCustomer()) {
      return;
    }

    if (!hasRequiredEquipment()) {
      return;
    }

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

  function invalidateDraft() {
    if (!selectedDraft) {
      setFeedback("Select a sent draft to invalidate.");
      return;
    }

    const confirmed = window.confirm(
      "Invalidate the previously sent E-Sign document? The customer link in the old email will stop working, and this draft will reopen for edits.",
    );
    if (!confirmed) {
      return;
    }

    startTransition(async () => {
      try {
        setFeedback(null);
        const result = await submitJson<DocusealDraft>(
          `/api/docuseal/drafts/${selectedDraft.id}/invalidate`,
          "POST",
        );
        if (result?.data) {
          setDrafts((current) =>
            current.map((draft) => (draft.id === result.data!.id ? result.data! : draft)),
          );
          loadDraft(result.data);
        }
        setFeedback(result?.message ?? "Previous E-Sign submission invalidated.");
        router.refresh();
      } catch (error) {
        setFeedback(
          error instanceof Error ? error.message : "Unable to invalidate sent document.",
        );
      }
    });
  }

  const sectionFieldList = groupedFields[currentSection] ?? [];
  const sectionSupportsDefaults = defaultSections.has(currentSection);
  const companyDefault = findDefault(defaults, selectedTemplate, "global", "global");
  const storeDefault = selectedStoreKey
    ? findDefault(defaults, selectedTemplate, "location", selectedStoreKey)
    : null;
  const trailerTypeKey = values.unit_type?.trim();
  const trailerTypeDefault = trailerTypeKey
    ? findDefault(defaults, selectedTemplate, "trailer_type", trailerTypeKey)
    : null;

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="panel flex flex-wrap items-center justify-between gap-2 px-2 py-1.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <DocusealModeTabs active="create" />
          <span className="hidden h-7 w-px bg-[var(--line)] xl:block" />
          <div className="hidden min-w-0 leading-tight xl:block">
            <p className="eyebrow">E-Sign draft</p>
            <p className="truncate text-[0.78rem] font-semibold text-slate-900">
              {selectedDraft?.customerName?.trim() || customerName.trim() || "New document"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            className="btn-secondary h-8 text-[0.7rem]"
            disabled={pending || selectedDraftIsSent}
            onClick={fillRandomTestData}
          >
            Fill test data
          </button>
          <button
            type="button"
            className="btn-secondary h-8 text-[0.7rem]"
            disabled={pending || selectedDraftIsSent}
            onClick={applyDefaults}
          >
            Apply defaults
          </button>
          <span className="mx-0.5 hidden h-6 w-px bg-[var(--line)] sm:block" />
          <button
            type="button"
            className="btn-secondary h-8 text-[0.7rem]"
            disabled={pending}
            onClick={createDraft}
          >
            New
          </button>
          <button
            type="button"
            className="btn-secondary h-8 text-[0.7rem]"
            disabled={pending || selectedDraftIsSent}
            onClick={saveDraft}
          >
            Save
          </button>
          {selectedDraftIsSent ? (
            <button
              type="button"
              className="btn-secondary h-8 border-red-200 text-[0.7rem] text-red-700 hover:border-red-300 hover:bg-red-50"
              disabled={pending}
              onClick={invalidateDraft}
            >
              Invalidate &amp; edit
            </button>
          ) : null}
          <button
            type="button"
            className="btn-primary h-8 text-[0.7rem]"
            disabled={pending || selectedDraftIsSent}
            onClick={sendDraft}
          >
            <Icon name="file-text" size={14} />
            Send E-Sign
          </button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-2 lg:grid-cols-[248px_minmax(0,1fr)]">
        <aside className="panel hidden min-h-0 flex-col overflow-hidden lg:flex">
          <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] px-3 py-2">
            <div className="leading-tight">
              <p className="eyebrow">Prep queue</p>
              <h2 className="text-[0.8rem] font-semibold text-slate-900">Drafts</h2>
            </div>
            <span className="workspace-chip">{drafts.length}</span>
          </div>
          <div className="min-h-0 flex-1 divide-y divide-[var(--line)] overflow-auto">
            {drafts.length === 0 ? (
              <div className="px-3 py-4 text-[0.75rem] text-slate-500">
                No prefill drafts yet. Use &ldquo;New&rdquo; to start one.
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
                    {draft.values.unit_number?.trim() || "No unit selected"} - {draft.templateName}
                  </p>
                  <p className="mt-1 truncate text-[0.65rem] text-slate-400">
                    Store {draft.location || "Unassigned"}
                  </p>
                  <p className="mt-1 text-[0.65rem] text-slate-400">
                    Updated {formatDate(draft.updatedAt)}
                  </p>
                </button>
              ))
            )}
          </div>
        </aside>

        <main className="panel flex min-h-0 flex-col overflow-hidden">
          <div className="border-b border-[var(--line)] bg-[var(--surface-raised)]">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-[var(--line)] px-3 py-1.5">
              <span className="flex items-center gap-1.5">
                <span className="workspace-metric-label">Fields</span>
                <span className="text-[0.78rem] font-semibold text-slate-900">
                  {filledCount}/{selectedTemplate.fields.length}
                </span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="workspace-metric-label">Template</span>
                <span className="mono text-[0.74rem] font-semibold text-slate-900">
                  #{selectedTemplate.docusealTemplateId}
                </span>
              </span>
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="workspace-metric-label">Status</span>
                {selectedDraft?.docusealSubmitterUrl ? (
                  <a
                    href={selectedDraft.docusealSubmitterUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate text-[0.74rem] font-semibold text-[var(--brand)]"
                  >
                    Open E-Sign document
                  </a>
                ) : (
                  <span className="text-[0.74rem] font-semibold text-slate-900">
                    {selectedDraft ? selectedDraft.status : "Not sent"}
                  </span>
                )}
              </span>
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
                    setValues({
                      ...emptyValues(nextTemplate),
                      ...resolveDefaultValues(defaults, nextTemplate, {}, selectedStoreKey),
                    });
                    setCustomerName("");
                    setCustomerQuery("");
                    setCustomerResults([]);
                    setSelectedCustomer(null);
                    setEquipmentQuery("");
                    setEquipmentResults([]);
                    setSelectedEquipment(null);
                  }
                }}
                className="workspace-input w-full"
              >
                {templates.map((template) => (
                  <option key={template.key} value={template.key}>
                    {template.name}
                    {template.active ? "" : " (inactive)"}
                  </option>
                ))}
              </select>
            </label>
            <div className="relative space-y-1 text-[0.75rem] text-slate-600">
              <span className="font-medium">Customer</span>
              <input
                value={customerQuery}
                onChange={(event) => {
                  setCustomerQuery(event.target.value);
                  setSelectedCustomer(null);
                  setCustomerName("");
                  setValues((current) => ({
                    ...current,
                    customer_number: "",
                    ordered_by: "",
                    lessee_name: "",
                    lessee_company_name: "",
                    lessee_location: "",
                  }));
                }}
                disabled={selectedDraftIsSent}
                placeholder="Search customer, number, city, or site"
                className="workspace-input w-full"
              />
              <span className="block text-[0.65rem] text-slate-500">
                {values.customer_number
                  ? `Selected ${customerName || customerQuery} / ${values.customer_number}`
                  : "Select a customer from the search results."}
              </span>
              {customerResults.length > 0 || customerLoading ? (
                <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto border border-[var(--line)] bg-white shadow-lg">
                  {customerLoading ? (
                    <div className="px-3 py-2 text-[0.72rem] text-slate-500">
                      Searching...
                    </div>
                  ) : null}
                  {customerResults.map((customer) => (
                    <button
                      key={customer.id}
                      type="button"
                      className="block w-full border-b border-[var(--line)] px-3 py-2 text-left last:border-b-0 hover:bg-slate-50"
                      onClick={() => selectCustomer(customer)}
                    >
                      <span className="block truncate text-[0.75rem] font-semibold text-slate-900">
                        {customer.name}
                      </span>
                      <span className="block truncate text-[0.65rem] text-slate-500">
                        {getCustomerLabel(customer)}
                      </span>
                      <span className="block truncate text-[0.62rem] text-slate-400">
                        {getCustomerLocationText(customer) ||
                          customer.branchCoverage.join(", ") ||
                          "No location data"}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <label className="space-y-1 text-[0.75rem] text-slate-600">
              <span className="font-medium">Customer email</span>
              <input
                type="email"
                value={customerEmail}
                onChange={(event) => setCustomerEmail(event.target.value)}
                disabled={selectedDraftIsSent}
                className="workspace-input w-full"
              />
            </label>
            <label className="space-y-1 text-[0.75rem] text-slate-600">
              <span className="font-medium">Subject</span>
              <input
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                disabled={selectedDraftIsSent}
                className="workspace-input w-full"
              />
            </label>
            <label className="space-y-1 text-[0.75rem] text-slate-600 md:col-span-2 xl:col-span-4">
              <span className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">Email message</span>
                <button
                  type="button"
                  className="btn-secondary px-2 py-1 text-[0.68rem]"
                  disabled={selectedDraftIsSent}
                  onClick={insertSigningLink}
                >
                  Insert signing link
                </button>
              </span>
              <textarea
                ref={messageTextareaRef}
                rows={2}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                disabled={selectedDraftIsSent}
                className="workspace-input w-full resize-y"
              />
              <span
                className={`block text-[0.68rem] ${
                  messageHasSigningLink ? "text-emerald-700" : "text-amber-700"
                }`}
              >
                {messageHasSigningLink
                  ? "The E-Sign signing link will appear where the placeholder is placed."
                  : "Place the signing link where it should appear in the email."}
              </span>
            </label>
          </div>

          </div>

          <div className="grid min-h-0 flex-1 lg:grid-cols-[196px_minmax(0,1fr)]">
            <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-[var(--line)] bg-[var(--surface-soft)] p-2 lg:flex-col lg:overflow-x-visible lg:overflow-y-auto lg:border-b-0 lg:border-r">
              {sectionNames.map((section) => {
                const secFields = groupedFields[section] ?? [];
                const filled = secFields.filter((field) => values[field.name]?.trim()).length;
                const isActive = section === currentSection;
                return (
                  <button
                    key={section}
                    type="button"
                    onClick={() => setActiveSection(section)}
                    className={`flex shrink-0 items-center justify-between gap-2 rounded-[3px] px-2.5 py-1.5 text-left text-[0.72rem] font-medium transition ${
                      isActive
                        ? "bg-slate-900 text-white"
                        : "text-slate-600 hover:bg-white"
                    }`}
                  >
                    <span className="truncate">{section}</span>
                    <span
                      className={`shrink-0 text-[0.62rem] tabular-nums ${
                        isActive ? "text-slate-300" : "text-slate-400"
                      }`}
                    >
                      {filled}/{secFields.length}
                    </span>
                  </button>
                );
              })}
            </nav>

            <div className="flex min-h-0 flex-col">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-3 py-2">
                <div className="leading-tight">
                  <h3 className="text-[0.82rem] font-semibold text-slate-900">{currentSection}</h3>
                  {sectionSupportsDefaults ? (
                    <p className="mt-0.5 text-[0.64rem] text-slate-500">
                      Saved defaults — Company{" "}
                      {countDefaultValuesForSection(selectedTemplate, companyDefault, currentSection)} /
                      Store {countDefaultValuesForSection(selectedTemplate, storeDefault, currentSection)} /
                      Trailer type{" "}
                      {countDefaultValuesForSection(selectedTemplate, trailerTypeDefault, currentSection)}
                    </p>
                  ) : (
                    <p className="mt-0.5 text-[0.64rem] text-slate-500">
                      {sectionFieldList.length} field{sectionFieldList.length === 1 ? "" : "s"} in this section
                    </p>
                  )}
                </div>
                {sectionSupportsDefaults ? (
                  <details className="relative">
                    <summary
                      className={`btn-secondary h-8 cursor-pointer list-none px-2.5 text-[0.68rem] ${
                        pending || selectedDraftIsSent ? "pointer-events-none opacity-50" : ""
                      }`}
                    >
                      Save defaults
                    </summary>
                    <div className="absolute right-0 z-20 mt-1 min-w-52 overflow-hidden border border-[var(--line)] bg-white text-[0.72rem] shadow-lg">
                      <button
                        type="button"
                        className="block w-full px-3 py-2 text-left hover:bg-slate-50"
                        disabled={pending || selectedDraftIsSent}
                        onClick={() => saveSectionDefaults(currentSection, "global")}
                      >
                        Save to company
                      </button>
                      <button
                        type="button"
                        className="block w-full px-3 py-2 text-left hover:bg-slate-50 disabled:text-slate-400"
                        disabled={pending || selectedDraftIsSent || !selectedStoreKey}
                        onClick={() => saveSectionDefaults(currentSection, "location")}
                      >
                        Save to store{selectedStoreKey ? `: ${selectedStoreKey}` : ""}
                      </button>
                      <button
                        type="button"
                        className="block w-full px-3 py-2 text-left hover:bg-slate-50 disabled:text-slate-400"
                        disabled={pending || selectedDraftIsSent || !trailerTypeKey}
                        onClick={() => saveSectionDefaults(currentSection, "trailer_type")}
                      >
                        Save to trailer type{trailerTypeKey ? `: ${trailerTypeKey}` : ""}
                      </button>
                    </div>
                  </details>
                ) : null}
              </div>

              <div className="min-h-0 flex-1 overflow-auto p-3">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {sectionFieldList.map((field) => {
                    if (field.name === "unit_number") {
                  return (
                    <div
                      key={field.name}
                      className="relative space-y-1 text-[0.75rem] text-slate-600"
                    >
                      <span className="flex items-center justify-between gap-2 font-medium">
                        <span>{field.label}</span>
                        <span className="mono text-[0.6rem] font-normal text-slate-400">
                          {field.name}
                        </span>
                      </span>
                      <input
                        value={equipmentQuery}
                        onChange={(event) => {
                          setEquipmentQuery(event.target.value);
                          setSelectedEquipment(null);
                          setValues((current) => ({
                            ...current,
                            unit_number: "",
                            unit_type: "",
                            vin_number: "",
                            tag_number: "",
                          }));
                        }}
                        disabled={selectedDraftIsSent}
                        placeholder="Search unit, VIN, tag, or store"
                        className="workspace-input w-full"
                      />
                      <span className="block text-[0.65rem] text-slate-500">
                        {values.unit_number
                          ? `Selected ${values.unit_number}${selectedStoreKey ? ` / Store ${selectedStoreKey}` : ""}`
                          : "Select a trailer from the search results."}
                      </span>
                      {equipmentResults.length > 0 || equipmentLoading ? (
                        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto border border-[var(--line)] bg-white shadow-lg">
                          {equipmentLoading ? (
                            <div className="px-3 py-2 text-[0.72rem] text-slate-500">
                              Searching...
                            </div>
                          ) : null}
                          {equipmentResults.map((equipment) => (
                            <button
                              key={equipment.id}
                              type="button"
                              className="block w-full border-b border-[var(--line)] px-3 py-2 text-left last:border-b-0 hover:bg-slate-50"
                              onClick={() => selectEquipment(equipment)}
                            >
                              <span className="block truncate text-[0.75rem] font-semibold text-slate-900">
                                {equipment.assetNumber}
                              </span>
                              <span className="block truncate text-[0.65rem] text-slate-500">
                                {getEquipmentLabel(equipment)}
                              </span>
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                }

                const equipmentManagedField = ["unit_type", "vin_number", "tag_number"].includes(
                  field.name,
                );

                return (
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
                        disabled={selectedDraftIsSent}
                        className="workspace-input w-full resize-y"
                      />
                    ) : (
                      <input
                        value={values[field.name] ?? ""}
                        onChange={(event) => updateValue(field.name, event.target.value)}
                        disabled={selectedDraftIsSent || equipmentManagedField}
                        className={`workspace-input w-full ${
                          equipmentManagedField ? "bg-slate-50 text-slate-500" : ""
                        }`}
                      />
                    )}
                  </label>
                );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 border-t border-[var(--line)] bg-[var(--surface-soft)] px-3 py-2">
            <p className="text-[0.72rem] text-slate-600">
              {selectedDraftIsSent
                ? "Sent and locked — invalidate to stop the old customer link and reopen this draft for edits."
                : feedback ??
                  "Only fields marked customer-fillable in the template manager stay editable on the customer signing link."}
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
