import { timingSafeEqual } from "node:crypto";

import { z } from "zod";

import { type DocusealDraft, listDocusealPrefillTemplates } from "@/lib/server/docuseal-prefill";
import {
  createDocusealDraft,
  invalidateDocusealDraft,
  prepareDocusealDraftPreview,
  sendDocusealDraft,
} from "@/lib/server/docuseal-prefill";
import { ApiError } from "@/lib/server/api";

const bcApiKeyHeader = "x-metro-sync-key";

const bcDraftSchema = z.object({
  templateKey: z.string().min(1),
  location: z.string().optional(),
  customerNo: z.string().optional(),
  customerName: z.string().optional(),
  customerEmail: z.string().email().or(z.literal("")).optional(),
  fixedAssetNo: z.string().optional(),
  fixedAssetDescription: z.string().optional(),
  rentalOrderNo: z.string().optional(),
  subject: z.string().optional(),
  message: z.string().optional(),
  values: z.record(z.string(), z.unknown()).optional(),
});

export type BusinessCentralDraftInput = z.infer<typeof bcDraftSchema>;

function getConfiguredApiKey() {
  return (
    process.env.METRO_BC_ESIGN_API_KEY?.trim() ||
    process.env.METRO_SYNC_API_KEY?.trim() ||
    process.env.SYNC_API_KEY?.trim() ||
    process.env.BC_ESIGN_API_KEY?.trim() ||
    ""
  );
}

function isEqualSecret(received: string, expected: string) {
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);

  return (
    receivedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(receivedBuffer, expectedBuffer)
  );
}

export function requireBusinessCentralESignKey(request: Request) {
  const expected = getConfiguredApiKey();
  if (!expected) {
    throw new ApiError(500, "Business Central E-Sign API key is not configured.");
  }

  const received =
    request.headers.get(bcApiKeyHeader)?.trim() ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
    "";

  if (!received || !isEqualSecret(received, expected)) {
    throw new ApiError(401, "Invalid Business Central E-Sign API key.");
  }
}

function mergeCommonValues(input: BusinessCentralDraftInput) {
  return {
    customer_number: input.customerNo ?? "",
    customer_name: input.customerName ?? "",
    unit_number: input.fixedAssetNo ?? "",
    unit_description: input.fixedAssetDescription ?? "",
    rental_order_number: input.rentalOrderNo ?? "",
    ...input.values,
  };
}

export function parseBusinessCentralDraftInput(value: unknown) {
  return bcDraftSchema.parse(value);
}

export async function listBusinessCentralESignTemplates() {
  const templates = await listDocusealPrefillTemplates();

  return templates.map((template) => ({
    code: template.key.toUpperCase().replace(/[^A-Z0-9]+/g, "_").slice(0, 30),
    name: template.name,
    templateKey: template.key,
    docusealTemplateId: template.docusealTemplateId,
    active: true,
    fields: template.fields.map((field) => ({
      name: field.name,
      label: field.label,
      section: field.section,
    })),
  }));
}

function mapBusinessCentralDraft(draft: DocusealDraft) {
  return {
    id: draft.id,
    templateKey: draft.templateKey,
    templateName: draft.templateName,
    status: draft.status,
    sentAt: draft.sentAt ?? "",
    updatedAt: draft.updatedAt,
    docusealSubmissionId: draft.docusealSubmissionId ?? 0,
    signingUrl: draft.docusealSubmitterUrl ?? "",
  };
}

export async function createBusinessCentralESignDraft(input: BusinessCentralDraftInput) {
  const draft = await createDocusealDraft({
    templateKey: input.templateKey,
    location: input.location,
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    subject: input.subject,
    message: input.message,
    values: mergeCommonValues(input),
  });

  return mapBusinessCentralDraft(draft);
}

export async function sendBusinessCentralESignDraft(draftId: string) {
  return mapBusinessCentralDraft(await sendDocusealDraft(draftId));
}

export async function prepareBusinessCentralESignDraftPreview(draftId: string) {
  return mapBusinessCentralDraft(await prepareDocusealDraftPreview(draftId));
}

export async function invalidateBusinessCentralESignDraft(draftId: string) {
  return mapBusinessCentralDraft(await invalidateDocusealDraft(draftId));
}
