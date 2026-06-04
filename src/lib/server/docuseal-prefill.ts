import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import {
  docusealTemplates,
  getDocusealTemplate,
  type DocusealTemplateDefinition,
} from "@/lib/docuseal/templates";
import { ApiError } from "@/lib/server/api";

export type DocusealDraftStatus = "draft" | "sent";

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

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix: string) {
  return `${prefix}_${randomUUID().slice(0, 8)}`;
}

function getDocusealApiUrl() {
  return (
    process.env.DOCUSEAL_API_URL?.replace(/\/+$/, "") ??
    "http://MetroT-LoadB-LalZP5zYG7S5-765696422.us-east-2.elb.amazonaws.com"
  );
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

function buildReadonlyFields(values: Record<string, string>) {
  return Object.entries(values)
    .filter(([, value]) => value.trim().length > 0)
    .map(([name]) => name);
}

function buildDocusealSubmitterUrl(slug: string | null) {
  return slug ? `${getDocusealApiUrl()}/s/${slug}` : null;
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

export async function createDocusealDraft(input: {
  templateKey: string;
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
    location: template.location,
    submitterRole: template.submitterRole,
    customerName: input.customerName?.trim() ?? "",
    customerEmail: input.customerEmail?.trim() ?? "",
    subject: input.subject?.trim() || "Your signature is requested for a Metro Trailer Document",
    message:
      input.message?.trim() ||
      "Please review the prepared Metro Trailer document and complete any remaining fields.",
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

  const readonlyFields = buildReadonlyFields(draft.values);
  const response = await fetch(`${getDocusealApiUrl()}/api/submissions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Auth-Token": getDocusealApiToken(),
    },
    body: JSON.stringify({
      template_id: draft.docusealTemplateId,
      send_email: true,
      submitters: [
        {
          role: draft.submitterRole,
          name: draft.customerName,
          email: draft.customerEmail,
          values: draft.values,
          readonly_fields: readonlyFields,
          message: {
            subject: draft.subject,
            body: draft.message,
          },
        },
      ],
    }),
  });

  const payload = (await response.json().catch(() => null)) as
    | {
        id?: number;
        submitters?: Array<{
          slug?: string;
          submission_id?: number;
        }>;
        error?: string;
      }
    | null;

  if (!response.ok) {
    throw new ApiError(
      response.status,
      payload?.error ?? "DocuSeal rejected the prefilled submission.",
      payload,
    );
  }

  const submitter = payload?.submitters?.[0];
  const timestamp = nowIso();
  const docusealSubmitterSlug = submitter?.slug ?? null;
  const [updatedDraft] = await db
    .update(schema.docusealPrefillDrafts)
    .set({
      status: "sent",
      sentAt: new Date(timestamp),
      updatedAt: new Date(timestamp),
      docusealSubmissionId: payload?.id ?? submitter?.submission_id ?? null,
      docusealSubmitterSlug,
      docusealSubmitterUrl: buildDocusealSubmitterUrl(docusealSubmitterSlug),
    })
    .where(eq(schema.docusealPrefillDrafts.id, draftId))
    .returning();

  return mapDraftRow(updatedDraft);
}
