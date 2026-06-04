import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import {
  docusealTemplates,
  getDocusealTemplate,
  type DocusealFieldSection,
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
    return await fetch(url, init);
  } catch (error) {
    throw new ApiError(
      502,
      `Unable to reach DocuSeal at ${getDocusealApiUrl()}.`,
      error instanceof Error ? { message: error.message } : error,
    );
  }
}

function requireTemplate(templateKey: string) {
  const template = getDocusealTemplate(templateKey);
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
  return docusealTemplates;
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
  const template = requireTemplate(input.templateKey);
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
  const template = requireTemplate(input.templateKey);
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
      `Please review the prepared Metro Trailer document and complete any remaining fields.\n\n[Review and Submit](${docusealSigningLinkVariable})`,
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

  const template = requireTemplate(draft.templateKey);
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

  const [updatedDraft] = await db
    .update(schema.docusealPrefillDrafts)
    .set(updates)
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
