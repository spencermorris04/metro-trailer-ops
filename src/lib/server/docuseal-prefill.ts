import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import {
  getDocusealTemplateAlias,
  getDocusealTemplateAliasById,
  type DocusealFieldSection,
  type DocusealTemplateCategory,
  type DocusealTemplateDefinition,
} from "@/lib/docuseal/templates";
import { ApiError } from "@/lib/server/api";

export type DocusealDraftStatus = "draft" | "sent";
export type DocusealDefaultScope = "global" | "location" | "trailer_type";

export type DocusealDraft = {
  id: string;
  templateKey: string;
  templateName: string;
  docusealTemplateId: number;
  location: string;
  submitterRole: string;
  customerName: string;
  customerEmail: string;
  subject: string;
  message: string;
  values: Record<string, string>;
  status: DocusealDraftStatus;
  createdAt: string;
  updatedAt: string;
  sentAt: string | null;
  docusealSubmissionId: number | null;
  docusealSubmitterSlug: string | null;
  docusealSubmitterUrl: string | null;
};

export type DocusealPrefillDefault = {
  id: string;
  templateKey: string;
  scopeType: DocusealDefaultScope;
  scopeKey: string;
  values: Record<string, string>;
  createdAt: string;
  updatedAt: string;
};

export type DocusealTemplateClassification = {
  docusealTemplateId: number;
  templateKey: string;
  name: string;
  category: DocusealTemplateCategory;
  folderName: string;
  location: string;
  submitterRole: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

const docusealSigningLinkVariable = "{submitter.link}";
const docusealDefaultApiUrl = "https://esign.lumpkindevelopment.com";
const docusealDefaultSections = new Set<DocusealFieldSection>([
  "Rates and terms",
  "Execution",
  "Special instructions",
]);

type DocusealSubmitterPayload = {
  id?: number;
  slug?: string;
  submission_id?: number;
};

type DocusealSubmissionCreatePayload = {
  id?: number;
  submitters?: DocusealSubmitterPayload[];
};

type DocusealApiField = {
  name?: string | null;
  title?: string | null;
  uuid?: string | null;
  type?: string | null;
  areas?: unknown[] | null;
};

type DocusealApiSubmitter = {
  name?: string | null;
};

type DocusealApiTemplate = {
  id?: number;
  name?: string | null;
  folder_name?: string | null;
  archived_at?: string | null;
  submitters?: DocusealApiSubmitter[] | null;
  fields?: DocusealApiField[] | null;
};

type DocusealApiTemplateListPayload =
  | DocusealApiTemplate[]
  | {
      data?: DocusealApiTemplate[];
    };

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix: string) {
  return `${prefix}_${randomUUID().slice(0, 8)}`;
}

function getDocusealApiUrl() {
  const configuredUrl = process.env.DOCUSEAL_API_URL?.replace(/\/+$/, "");

  if (!configuredUrl) {
    return docusealDefaultApiUrl;
  }

  try {
    const url = new URL(configuredUrl);
    if (url.hostname.endsWith(".elb.amazonaws.com")) {
      return docusealDefaultApiUrl;
    }
  } catch {
    return configuredUrl;
  }

  return configuredUrl;
}

function getDocusealApiToken() {
  const token = process.env.DOCUSEAL_API_TOKEN?.trim();
  if (!token) {
    throw new ApiError(
      500,
      "DOCUSEAL_API_TOKEN is required before sending a DocuSeal prefill draft.",
    );
  }

  return token;
}

async function fetchDocuseal(path: string, init?: RequestInit) {
  const url = `${getDocusealApiUrl()}${path}`;

  try {
    return await fetch(url, {
      cache: "no-store",
      ...init,
    });
  } catch (error) {
    throw new ApiError(
      502,
      `Unable to reach DocuSeal at ${getDocusealApiUrl()}.`,
      error instanceof Error ? { message: error.message } : error,
    );
  }
}

function getDocusealAuthHeaders() {
  return {
    "X-Auth-Token": getDocusealApiToken(),
  };
}

function humanizeFieldName(name: string) {
  return name
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .replace(/\bPo\b/g, "PO")
    .replace(/\bVin\b/g, "VIN")
    .replace(/\bFhwa\b/g, "FHWA")
    .replace(/\bCpu\b/g, "CPU")
    .replace(/\bDln\b/g, "DLN")
    .replace(/\bLo\b/g, "L.O.")
    .replace(/\bLi\b/g, "L.I.")
    .replace(/\bRo\b/g, "R.O.")
    .replace(/\bRi\b/g, "R.I.");
}

function slugifyTemplateKey(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return slug || "docuseal-template";
}

function normalizeTemplateCategory(value: string | null | undefined): DocusealTemplateCategory {
  if (
    value === "lease" ||
    value === "payment_authorization" ||
    value === "credit_application" ||
    value === "other"
  ) {
    return value;
  }

  return "other";
}

function inferTemplateCategory(name: string): DocusealTemplateCategory {
  const normalized = name.toLowerCase();

  if (normalized.includes("credit application")) {
    return "credit_application";
  }

  if (
    normalized.includes("ach") ||
    normalized.includes("credit card") ||
    normalized.includes("authorization")
  ) {
    return "payment_authorization";
  }

  if (
    normalized.includes("lease") ||
    normalized.includes("contract") ||
    normalized.includes("trailer")
  ) {
    return "lease";
  }

  return "other";
}

function inferFieldSection(name: string): DocusealFieldSection {
  if (name.startsWith("tire_")) {
    return "Tire readings";
  }

  if (name.startsWith("inspection_out_")) {
    return "Inspection out";
  }

  if (name.startsWith("inspection_in_")) {
    return "Inspection in";
  }

  if (name.startsWith("special_instructions_")) {
    return "Special instructions";
  }

  if (
    name.startsWith("rental_rate_") ||
    name.startsWith("subject_to_") ||
    name === "minimum_lease_period"
  ) {
    return "Rates and terms";
  }

  if (
    name.startsWith("agreement_signed_") ||
    name.includes("authorized_agent") ||
    name === "lessee_company_name"
  ) {
    return "Execution";
  }

  if (
    name === "unit_number" ||
    name === "unit_type" ||
    name === "vin_number" ||
    name === "tag_number" ||
    name === "unit_description"
  ) {
    return "Equipment";
  }

  if (
    name === "received_by" ||
    name === "received_from" ||
    name === "print_name" ||
    name === "dun" ||
    name === "dln"
  ) {
    return "Receipt";
  }

  if (
    name.startsWith("customer_") ||
    name.startsWith("lessee_") ||
    name.startsWith("order_") ||
    name === "ordered_by" ||
    name === "purchase_order_number" ||
    name === "agreement_date" ||
    name === "rental_order_number"
  ) {
    return "Customer and order";
  }

  return "Other";
}

function mapDocusealApiField(
  field: DocusealApiField,
): DocusealTemplateDefinition["fields"][number] | null {
  const name = field.name?.trim();
  if (!name) {
    return null;
  }

  return {
    name,
    uuid: field.uuid?.trim() || name,
    label: field.title?.trim() || humanizeFieldName(name),
    section: inferFieldSection(name),
    multiline: field.type === "textarea" || (field.areas?.length ?? 0) > 1,
  };
}

function mapDocusealApiTemplate(
  apiTemplate: DocusealApiTemplate,
): DocusealTemplateDefinition | null {
  const docusealTemplateId = apiTemplate.id;
  if (!docusealTemplateId || apiTemplate.archived_at) {
    return null;
  }

  const alias = getDocusealTemplateAliasById(docusealTemplateId);
  const key = alias?.key ?? `docuseal-template-${docusealTemplateId}`;
  const name =
    apiTemplate.name?.trim() ||
    alias?.name ||
    `DocuSeal Template ${docusealTemplateId}`;
  const folderName = apiTemplate.folder_name?.trim() || alias?.folderName || "";

  return {
    key,
    docusealTemplateId,
    name,
    category: alias?.category ?? inferTemplateCategory(name),
    folderName,
    location: folderName || alias?.location || "",
    submitterRole:
      apiTemplate.submitters?.[0]?.name?.trim() ||
      alias?.submitterRole ||
      "First Party",
    active: alias?.active ?? true,
    editorUrl: `${getDocusealApiUrl()}/templates/${docusealTemplateId}/edit`,
    fields: (apiTemplate.fields ?? [])
      .map(mapDocusealApiField)
      .filter((field): field is DocusealTemplateDefinition["fields"][number] =>
        Boolean(field),
      ),
  };
}

async function fetchDocusealTemplatesFromApi() {
  const templates: DocusealTemplateDefinition[] = [];

  for (let page = 1; page <= 20; page += 1) {
    const response = await fetchDocuseal(`/api/templates?per_page=100&page=${page}`, {
      headers: getDocusealAuthHeaders(),
    });
    const payload = (await response.json().catch(() => null)) as
      | (DocusealApiTemplateListPayload & { error?: string })
      | null;

    if (!response.ok) {
      throw new ApiError(
        response.status,
        (!Array.isArray(payload) ? payload?.error : undefined) ??
          "DocuSeal rejected the template lookup.",
        payload,
      );
    }

    const data = Array.isArray(payload) ? payload : payload?.data ?? [];
    templates.push(
      ...data
        .map(mapDocusealApiTemplate)
        .filter((template): template is DocusealTemplateDefinition =>
          Boolean(template),
        ),
    );

    if (data.length < 100) {
      break;
    }
  }

  return templates.sort(
    (left, right) => left.docusealTemplateId - right.docusealTemplateId,
  );
}

function mapTemplateClassificationRow(
  row: typeof schema.docusealTemplateClassifications.$inferSelect,
): DocusealTemplateClassification {
  return {
    docusealTemplateId: row.docusealTemplateId,
    templateKey: row.templateKey,
    name: row.name,
    category: normalizeTemplateCategory(row.category),
    folderName: row.folderName,
    location: row.location,
    submitterRole: row.submitterRole,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mergeTemplateClassifications(
  templates: DocusealTemplateDefinition[],
  classifications: DocusealTemplateClassification[],
) {
  const byTemplateId = new Map(
    classifications.map((classification) => [
      classification.docusealTemplateId,
      classification,
    ]),
  );

  return templates.map((template) => {
    const classification = byTemplateId.get(template.docusealTemplateId);
    if (!classification) {
      return template;
    }

    return {
      ...template,
      key: classification.templateKey || template.key,
      name: classification.name || template.name,
      category: classification.category,
      folderName: classification.folderName,
      location: classification.location || classification.folderName,
      submitterRole: classification.submitterRole || template.submitterRole,
      active: classification.active,
    };
  });
}

export async function listDocusealTemplateClassifications() {
  const rows = await db
    .select()
    .from(schema.docusealTemplateClassifications)
    .orderBy(desc(schema.docusealTemplateClassifications.updatedAt));

  return rows.map(mapTemplateClassificationRow);
}

export async function upsertDocusealTemplateClassification(input: {
  docusealTemplateId: number;
  templateKey?: string;
  name: string;
  category: DocusealTemplateCategory;
  folderName?: string;
  location?: string;
  submitterRole?: string;
  active?: boolean;
}) {
  const existing = await db.query.docusealTemplateClassifications.findFirst({
    where: (table, operators) =>
      operators.eq(table.docusealTemplateId, input.docusealTemplateId),
  });
  const templateKey =
    input.templateKey?.trim() ||
    existing?.templateKey ||
    `${slugifyTemplateKey(input.name)}-${input.docusealTemplateId}`;
  const folderName = input.folderName?.trim() ?? existing?.folderName ?? "";
  const location = input.location?.trim() ?? existing?.location ?? folderName;
  const submitterRole = input.submitterRole?.trim() || existing?.submitterRole || "First Party";
  const values = {
    templateKey,
    name: input.name.trim(),
    category: input.category,
    folderName,
    location,
    submitterRole,
    active: input.active ?? existing?.active ?? true,
    updatedAt: new Date(),
  };

  if (existing) {
    const [updated] = await db
      .update(schema.docusealTemplateClassifications)
      .set(values)
      .where(eq(schema.docusealTemplateClassifications.docusealTemplateId, input.docusealTemplateId))
      .returning();

    return mapTemplateClassificationRow(updated);
  }

  const [created] = await db
    .insert(schema.docusealTemplateClassifications)
    .values({
      docusealTemplateId: input.docusealTemplateId,
      ...values,
    })
    .returning();

  return mapTemplateClassificationRow(created);
}

async function requireTemplate(templateKey: string) {
  const alias = getDocusealTemplateAlias(templateKey);
  const templates = await listDocusealPrefillTemplates();
  const template = alias
    ? templates.find(
        (candidate) => candidate.docusealTemplateId === alias.docusealTemplateId,
      )
    : templates.find((candidate) => candidate.key === templateKey.trim().toLowerCase());

  if (!template) {
    throw new ApiError(404, `DocuSeal template ${templateKey} was not found.`);
  }

  return template;
}

async function requireDraft(draftId: string) {
  const [draft] = await db
    .select()
    .from(schema.docusealPrefillDrafts)
    .where(eq(schema.docusealPrefillDrafts.id, draftId))
    .limit(1);

  if (!draft) {
    throw new ApiError(404, `DocuSeal draft ${draftId} was not found.`);
  }

  return mapDraftRow(draft);
}

function normalizeValues(
  template: DocusealTemplateDefinition,
  values: Record<string, unknown> | undefined,
) {
  const allowedNames = new Set(template.fields.map((field) => field.name));
  const normalized: Record<string, string> = {};

  for (const [key, value] of Object.entries(values ?? {})) {
    if (!allowedNames.has(key)) {
      continue;
    }

    normalized[key] = String(value ?? "").trim();
  }

  return normalized;
}

function normalizeDefaultValues(
  template: DocusealTemplateDefinition,
  values: Record<string, unknown> | undefined,
) {
  const allowedNames = new Set(
    template.fields
      .filter((field) => docusealDefaultSections.has(field.section))
      .map((field) => field.name),
  );
  const normalized: Record<string, string> = {};

  for (const [key, value] of Object.entries(values ?? {})) {
    if (!allowedNames.has(key)) {
      continue;
    }

    normalized[key] = String(value ?? "").trim();
  }

  return normalized;
}

function normalizeDefaultScope(scopeType: string, scopeKey?: string) {
  if (!["global", "location", "trailer_type"].includes(scopeType)) {
    throw new ApiError(400, "Default scope must be global, location, or trailer_type.");
  }

  const typedScope = scopeType as DocusealDefaultScope;
  const normalizedKey = typedScope === "global" ? "global" : scopeKey?.trim();

  if (!normalizedKey) {
    throw new ApiError(400, "Default scope key is required.");
  }

  return {
    scopeType: typedScope,
    scopeKey: normalizedKey,
  };
}

function buildReadonlyFields(values: Record<string, string>) {
  return Object.entries(values)
    .filter(([, value]) => value.trim().length > 0)
    .map(([name]) => name);
}

function buildDocusealSubmitterUrl(slug: string | null) {
  return slug ? `${getDocusealApiUrl()}/s/${slug}` : null;
}

function messageIncludesSigningLink(message: string) {
  return /\{+submitter\.link\}+/i.test(message);
}

function ensureSigningLinkInMessage(message: string) {
  const trimmedMessage = message.trim();

  if (messageIncludesSigningLink(trimmedMessage)) {
    return trimmedMessage;
  }

  return `${trimmedMessage}\n\n[Review and Submit](${docusealSigningLinkVariable})`;
}

function getFirstSubmitterPayload(
  payload:
    | DocusealSubmitterPayload
    | DocusealSubmitterPayload[]
    | DocusealSubmissionCreatePayload
    | null,
): DocusealSubmitterPayload | null {
  if (Array.isArray(payload)) {
    return payload[0] ?? null;
  }

  if (payload && "submitters" in payload) {
    return payload.submitters?.[0] ?? null;
  }

  return payload ?? null;
}

function getSubmissionIdFromPayload(
  payload:
    | DocusealSubmitterPayload
    | DocusealSubmitterPayload[]
    | DocusealSubmissionCreatePayload
    | null,
) {
  if (!payload) {
    return null;
  }

  if (!Array.isArray(payload) && "submitters" in payload) {
    return payload.id ?? payload.submitters?.[0]?.submission_id ?? null;
  }

  return getFirstSubmitterPayload(payload)?.submission_id ?? null;
}

async function deleteDocusealSubmission(submissionId: number) {
  const response = await fetchDocuseal(`/api/submissions/${submissionId}`, {
    method: "DELETE",
    headers: {
      "X-Auth-Token": getDocusealApiToken(),
    },
  });

  const payload = (await response.json().catch(() => null)) as { error?: string } | null;

  if (!response.ok && response.status !== 404) {
    throw new ApiError(
      response.status,
      payload?.error ?? "DocuSeal rejected the submission invalidation.",
      payload,
    );
  }
}

async function createDocusealSubmission(draft: DocusealDraft, sendEmail: boolean) {
  const readonlyFields = buildReadonlyFields(draft.values);
  const response = await fetchDocuseal("/api/submissions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Auth-Token": getDocusealApiToken(),
    },
    body: JSON.stringify({
      template_id: draft.docusealTemplateId,
      send_email: sendEmail,
      submitters: [
        {
          role: draft.submitterRole,
          name: draft.customerName,
          email: draft.customerEmail,
          values: draft.values,
          readonly_fields: readonlyFields,
          message: {
            subject: draft.subject,
            body: ensureSigningLinkInMessage(draft.message),
          },
        },
      ],
    }),
  });

  const payload = (await response.json().catch(() => null)) as
    | (DocusealSubmitterPayload & { error?: string })
    | DocusealSubmitterPayload[]
    | { id?: number; submitters?: DocusealSubmitterPayload[]; error?: string }
    | null;

  if (!response.ok) {
    throw new ApiError(
      response.status,
      (!Array.isArray(payload) ? payload?.error : undefined) ??
        "DocuSeal rejected the prefilled submission.",
      payload,
    );
  }

  return {
    payload,
    submitter: getFirstSubmitterPayload(payload),
    submissionId: getSubmissionIdFromPayload(payload),
  };
}

async function findSubmissionIdBySubmitterSlug(slug: string | null) {
  if (!slug) {
    return null;
  }

  const response = await fetchDocuseal(`/api/submitters?slug=${encodeURIComponent(slug)}`, {
    headers: {
      "X-Auth-Token": getDocusealApiToken(),
    },
  });

  const payload = (await response.json().catch(() => null)) as
    | { data?: DocusealSubmitterPayload[]; error?: string }
    | null;

  if (!response.ok) {
    throw new ApiError(
      response.status,
      payload?.error ?? "DocuSeal rejected the submitter lookup.",
      payload,
    );
  }

  return payload?.data?.[0]?.submission_id ?? null;
}

function mapDraftRow(row: typeof schema.docusealPrefillDrafts.$inferSelect): DocusealDraft {
  return {
    id: row.id,
    templateKey: row.templateKey,
    templateName: row.templateName,
    docusealTemplateId: row.docusealTemplateId,
    location: row.location,
    submitterRole: row.submitterRole,
    customerName: row.customerName,
    customerEmail: row.customerEmail,
    subject: row.subject,
    message: row.message,
    values: row.values ?? {},
    status: row.status === "sent" ? "sent" : "draft",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    sentAt: row.sentAt?.toISOString() ?? null,
    docusealSubmissionId: row.docusealSubmissionId,
    docusealSubmitterSlug: row.docusealSubmitterSlug,
    docusealSubmitterUrl: row.docusealSubmitterUrl,
  };
}

function mapDefaultRow(
  row: typeof schema.docusealPrefillDefaults.$inferSelect,
): DocusealPrefillDefault {
  return {
    id: row.id,
    templateKey: row.templateKey,
    scopeType: row.scopeType as DocusealDefaultScope,
    scopeKey: row.scopeKey,
    values: row.values ?? {},
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function listDocusealPrefillTemplates() {
  return Promise.all([
    fetchDocusealTemplatesFromApi(),
    listDocusealTemplateClassifications(),
  ]).then(([templates, classifications]) =>
    mergeTemplateClassifications(templates, classifications),
  );
}

export async function updateDocusealTemplateClassification(input: {
  docusealTemplateId: number;
  name: string;
  category: DocusealTemplateCategory;
  folderName?: string;
  location?: string;
  submitterRole?: string;
  active?: boolean;
}) {
  const folderName = input.folderName?.trim() ?? "";
  const response = await fetchDocuseal(`/api/templates/${input.docusealTemplateId}`, {
    method: "PUT",
    headers: {
      ...getDocusealAuthHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: input.name.trim(),
      folder_name: folderName,
    }),
  });
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;

  if (!response.ok) {
    throw new ApiError(
      response.status,
      payload?.error ?? "DocuSeal rejected the template update.",
      payload,
    );
  }

  const classification = await upsertDocusealTemplateClassification({
    ...input,
    folderName,
    location: input.location?.trim() || folderName,
  });
  const templates = await listDocusealPrefillTemplates();
  const template = templates.find(
    (candidate) => candidate.docusealTemplateId === input.docusealTemplateId,
  );

  if (!template) {
    throw new ApiError(404, "Updated DocuSeal template was not found.");
  }

  return { classification, template };
}

export async function createDocusealTemplateFromPdf(input: {
  fileName: string;
  fileBase64: string;
  name: string;
  category: DocusealTemplateCategory;
  folderName?: string;
  location?: string;
  submitterRole?: string;
  active?: boolean;
}) {
  const name = input.name.trim();
  const folderName = input.folderName?.trim() ?? "";
  const externalId = `metro-${slugifyTemplateKey(name)}`;
  const response = await fetchDocuseal("/api/templates/pdf", {
    method: "POST",
    headers: {
      ...getDocusealAuthHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      folder_name: folderName,
      external_id: externalId,
      shared_link: true,
      documents: [
        {
          name: input.fileName,
          file: input.fileBase64,
        },
      ],
    }),
  });
  const payload = (await response.json().catch(() => null)) as
    | (DocusealApiTemplate & { error?: string })
    | null;

  if (!response.ok || !payload?.id) {
    throw new ApiError(
      response.status,
      payload?.error ?? "DocuSeal rejected the PDF template upload.",
      payload,
    );
  }

  const classification = await upsertDocusealTemplateClassification({
    docusealTemplateId: payload.id,
    templateKey: `${slugifyTemplateKey(name)}-${payload.id}`,
    name,
    category: input.category,
    folderName,
    location: input.location?.trim() || folderName,
    submitterRole: input.submitterRole,
    active: input.active,
  });
  const templates = await listDocusealPrefillTemplates();
  const template = templates.find((candidate) => candidate.docusealTemplateId === payload.id);

  if (!template) {
    throw new ApiError(404, "Created DocuSeal template was not found.");
  }

  return { classification, template };
}

export async function detectDocusealTemplateFields(docusealTemplateId: number) {
  const response = await fetchDocuseal(
    `/api/templates/${docusealTemplateId}/detect_fields`,
    {
      method: "POST",
      headers: getDocusealAuthHeaders(),
    },
  );
  const payload = (await response.json().catch(() => null)) as
    | {
        fields_count?: number;
        error?: string;
        template?: DocusealApiTemplate;
      }
    | null;

  if (!response.ok) {
    throw new ApiError(
      response.status,
      payload?.error ?? "DocuSeal rejected field detection.",
      payload,
    );
  }

  const templates = await listDocusealPrefillTemplates();
  const template = templates.find(
    (candidate) => candidate.docusealTemplateId === docusealTemplateId,
  );

  if (!template) {
    throw new ApiError(404, "Detected DocuSeal template was not found.");
  }

  return {
    detectedFieldCount: payload?.fields_count ?? template.fields.length,
    template,
  };
}

export async function listDocusealDrafts() {
  const rows = await db
    .select()
    .from(schema.docusealPrefillDrafts)
    .orderBy(desc(schema.docusealPrefillDrafts.updatedAt));

  return rows.map(mapDraftRow);
}

export async function getDocusealDraft(draftId: string) {
  return requireDraft(draftId);
}

export async function listDocusealPrefillDefaults() {
  const rows = await db
    .select()
    .from(schema.docusealPrefillDefaults)
    .orderBy(desc(schema.docusealPrefillDefaults.updatedAt));

  return rows.map(mapDefaultRow);
}

export async function upsertDocusealPrefillDefault(input: {
  templateKey: string;
  scopeType: string;
  scopeKey?: string;
  values?: Record<string, unknown>;
  merge?: boolean;
}) {
  const template = await requireTemplate(input.templateKey);
  const { scopeType, scopeKey } = normalizeDefaultScope(input.scopeType, input.scopeKey);
  const values = normalizeDefaultValues(template, input.values);
  const existing = await db.query.docusealPrefillDefaults.findFirst({
    where: (table, operators) =>
      operators.and(
        operators.eq(table.templateKey, template.key),
        operators.eq(table.scopeType, scopeType),
        operators.eq(table.scopeKey, scopeKey),
      ),
  });

  if (existing) {
    const [updatedDefault] = await db
      .update(schema.docusealPrefillDefaults)
      .set({
        values: input.merge ? { ...existing.values, ...values } : values,
        updatedAt: new Date(),
      })
      .where(eq(schema.docusealPrefillDefaults.id, existing.id))
      .returning();

    return mapDefaultRow(updatedDefault);
  }

  const timestamp = nowIso();
  const [createdDefault] = await db
    .insert(schema.docusealPrefillDefaults)
    .values({
      id: createId("dsdefault"),
      templateKey: template.key,
      scopeType,
      scopeKey,
      values,
      createdAt: new Date(timestamp),
      updatedAt: new Date(timestamp),
    })
    .returning();

  return mapDefaultRow(createdDefault);
}

export async function createDocusealDraft(input: {
  templateKey: string;
  location?: string;
  customerName?: string;
  customerEmail?: string;
  subject?: string;
  message?: string;
  values?: Record<string, unknown>;
}) {
  const template = await requireTemplate(input.templateKey);
  const timestamp = nowIso();
  const draft: DocusealDraft = {
    id: createId("dsdraft"),
    templateKey: template.key,
    templateName: template.name,
    docusealTemplateId: template.docusealTemplateId,
    location: input.location?.trim() || template.location,
    submitterRole: template.submitterRole,
    customerName: input.customerName?.trim() ?? "",
    customerEmail: input.customerEmail?.trim() ?? "",
    subject: input.subject?.trim() || "Your signature is requested for a Metro Trailer Document",
    message:
      input.message?.trim() ||
      `Hello,

Metro Trailer has prepared an E-Sign document for your review.

Please click the Review and Submit link below to open the document and complete any remaining fields.

[Review and Submit](${docusealSigningLinkVariable})

If the button is missing, copy and paste this link into your browser:
${docusealSigningLinkVariable}

Thank you,
Metro Trailer`,
    values: normalizeValues(template, input.values),
    status: "draft",
    createdAt: timestamp,
    updatedAt: timestamp,
    sentAt: null,
    docusealSubmissionId: null,
    docusealSubmitterSlug: null,
    docusealSubmitterUrl: null,
  };

  const [createdDraft] = await db
    .insert(schema.docusealPrefillDrafts)
    .values({
      id: draft.id,
      templateKey: draft.templateKey,
      templateName: draft.templateName,
      docusealTemplateId: draft.docusealTemplateId,
      location: draft.location,
      submitterRole: draft.submitterRole,
      customerName: draft.customerName,
      customerEmail: draft.customerEmail,
      subject: draft.subject,
      message: draft.message,
      values: draft.values,
      status: draft.status,
      createdAt: new Date(draft.createdAt),
      updatedAt: new Date(draft.updatedAt),
    })
    .returning();

  return mapDraftRow(createdDraft);
}

export async function updateDocusealDraft(
  draftId: string,
  input: {
    location?: string;
    customerName?: string;
    customerEmail?: string;
    subject?: string;
    message?: string;
    values?: Record<string, unknown>;
  },
) {
  const draft = await requireDraft(draftId);
  if (draft.status === "sent") {
    throw new ApiError(409, "Sent DocuSeal drafts cannot be edited.");
  }

  const template = await requireTemplate(draft.templateKey);
  const updates: Partial<typeof schema.docusealPrefillDrafts.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (input.customerName !== undefined) {
    updates.customerName = input.customerName.trim();
  }
  if (input.location !== undefined) {
    updates.location = input.location.trim() || draft.location;
  }
  if (input.customerEmail !== undefined) {
    updates.customerEmail = input.customerEmail.trim();
  }
  if (input.subject !== undefined) {
    updates.subject = input.subject.trim();
  }
  if (input.message !== undefined) {
    updates.message = input.message.trim();
  }
  if (input.values !== undefined) {
    updates.values = normalizeValues(template, input.values);
  }

  if (draft.docusealSubmissionId || draft.docusealSubmitterSlug || draft.docusealSubmitterUrl) {
    const submissionId =
      draft.docusealSubmissionId ?? (await findSubmissionIdBySubmitterSlug(draft.docusealSubmitterSlug));

    if (submissionId) {
      await deleteDocusealSubmission(submissionId);
    }

    updates.docusealSubmissionId = null;
    updates.docusealSubmitterSlug = null;
    updates.docusealSubmitterUrl = null;
  }

  const [updatedDraft] = await db
    .update(schema.docusealPrefillDrafts)
    .set(updates)
    .where(eq(schema.docusealPrefillDrafts.id, draftId))
    .returning();

  return mapDraftRow(updatedDraft);
}

export async function switchDocusealDraftTemplate(
  draftId: string,
  input: {
    templateKey: string;
    location?: string;
    values?: Record<string, unknown>;
  },
) {
  const draft = await requireDraft(draftId);
  if (draft.status === "sent") {
    throw new ApiError(409, "Sent DocuSeal drafts cannot be changed.");
  }

  const template = await requireTemplate(input.templateKey);
  const values = normalizeValues(template, {
    ...draft.values,
    ...input.values,
  });
  const submissionId =
    draft.docusealSubmissionId ?? (await findSubmissionIdBySubmitterSlug(draft.docusealSubmitterSlug));

  if (submissionId) {
    await deleteDocusealSubmission(submissionId);
  }

  const [updatedDraft] = await db
    .update(schema.docusealPrefillDrafts)
    .set({
      templateKey: template.key,
      templateName: template.name,
      docusealTemplateId: template.docusealTemplateId,
      location: input.location?.trim() || draft.location || template.location,
      submitterRole: template.submitterRole,
      values,
      updatedAt: new Date(),
      docusealSubmissionId: null,
      docusealSubmitterSlug: null,
      docusealSubmitterUrl: null,
    })
    .where(eq(schema.docusealPrefillDrafts.id, draftId))
    .returning();

  return mapDraftRow(updatedDraft);
}

export async function sendDocusealDraft(draftId: string) {
  const draft = await requireDraft(draftId);
  if (draft.status === "sent") {
    return draft;
  }
  if (!draft.customerEmail) {
    throw new ApiError(400, "Customer email is required before sending.");
  }
  if (!draft.customerName) {
    throw new ApiError(400, "Customer name is required before sending.");
  }

  if (draft.docusealSubmissionId) {
    await deleteDocusealSubmission(draft.docusealSubmissionId);
  }

  const { submitter, submissionId } = await createDocusealSubmission(draft, true);
  const timestamp = nowIso();
  const docusealSubmitterSlug = submitter?.slug ?? null;
  const [updatedDraft] = await db
    .update(schema.docusealPrefillDrafts)
    .set({
      status: "sent",
      sentAt: new Date(timestamp),
      updatedAt: new Date(timestamp),
      docusealSubmissionId: submissionId,
      docusealSubmitterSlug,
      docusealSubmitterUrl: buildDocusealSubmitterUrl(docusealSubmitterSlug),
    })
    .where(eq(schema.docusealPrefillDrafts.id, draftId))
    .returning();

  return mapDraftRow(updatedDraft);
}

export async function prepareDocusealDraftPreview(draftId: string) {
  const draft = await requireDraft(draftId);
  if (draft.status === "sent") {
    return draft;
  }
  if (!draft.customerEmail) {
    throw new ApiError(400, "Customer email is required before previewing.");
  }
  if (!draft.customerName) {
    throw new ApiError(400, "Customer name is required before previewing.");
  }

  if (draft.docusealSubmissionId && draft.docusealSubmitterUrl) {
    return draft;
  }

  const { submitter, submissionId } = await createDocusealSubmission(draft, false);
  const timestamp = nowIso();
  const docusealSubmitterSlug = submitter?.slug ?? null;
  const [updatedDraft] = await db
    .update(schema.docusealPrefillDrafts)
    .set({
      updatedAt: new Date(timestamp),
      docusealSubmissionId: submissionId,
      docusealSubmitterSlug,
      docusealSubmitterUrl: buildDocusealSubmitterUrl(docusealSubmitterSlug),
    })
    .where(eq(schema.docusealPrefillDrafts.id, draftId))
    .returning();

  return mapDraftRow(updatedDraft);
}

export async function invalidateDocusealDraft(draftId: string) {
  const draft = await requireDraft(draftId);
  if (draft.status !== "sent") {
    return draft;
  }
  const submissionId =
    draft.docusealSubmissionId ??
    (await findSubmissionIdBySubmitterSlug(draft.docusealSubmitterSlug));

  if (submissionId) {
    await deleteDocusealSubmission(submissionId);
  }

  const timestamp = nowIso();
  const [updatedDraft] = await db
    .update(schema.docusealPrefillDrafts)
    .set({
      status: "draft",
      sentAt: null,
      updatedAt: new Date(timestamp),
      docusealSubmissionId: null,
      docusealSubmitterSlug: null,
      docusealSubmitterUrl: null,
    })
    .where(eq(schema.docusealPrefillDrafts.id, draftId))
    .returning();

  return mapDraftRow(updatedDraft);
}
