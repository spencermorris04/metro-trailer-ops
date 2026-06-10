import { createHmac, timingSafeEqual } from "node:crypto";

import { z } from "zod";

import {
  getDocusealDraft,
  type DocusealDraft,
  listDocusealPrefillTemplates,
} from "@/lib/server/docuseal-prefill";
import {
  createDocusealDraft,
  invalidateDocusealDraft,
  prepareDocusealDraftPreview,
  sendDocusealDraft,
  switchDocusealDraftTemplate,
  updateDocusealDraft,
} from "@/lib/server/docuseal-prefill";
import { ApiError } from "@/lib/server/api";

const bcApiKeyHeader = "x-metro-sync-key";
const previewTokenMaxAgeMs = 30 * 60 * 1000;
const editorTokenMaxAgeMs = 4 * 60 * 60 * 1000;

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

function getConfiguredApiKeys() {
  return [
    process.env.METRO_BC_ESIGN_API_KEY,
    process.env.METRO_SYNC_API_KEY,
    process.env.SYNC_API_KEY,
    process.env.BC_ESIGN_API_KEY,
  ]
    .map((value) => value?.trim() ?? "")
    .filter((value, index, values) => value && values.indexOf(value) === index);
}

function getPreviewTokenPayload(draftId: string, expiresAt: number) {
  return `${draftId}.${expiresAt}`;
}

function signPreviewToken(draftId: string, expiresAt: number, secret: string) {
  return createHmac("sha256", secret)
    .update(getPreviewTokenPayload(draftId, expiresAt))
    .digest("base64url");
}

function isValidPreviewToken(draftId: string, expiresAt: number, token: string) {
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) {
    return false;
  }

  return getConfiguredApiKeys().some((secret) => {
    const expected = signPreviewToken(draftId, expiresAt, secret);
    return isEqualSecret(token, expected);
  });
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
  const expectedKeys = getConfiguredApiKeys();
  if (expectedKeys.length === 0) {
    throw new ApiError(500, "Business Central E-Sign API key is not configured.");
  }

  const received =
    request.headers.get(bcApiKeyHeader)?.trim() ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
    "";

  if (!received || !expectedKeys.some((expected) => isEqualSecret(received, expected))) {
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
    category: template.category,
    location: template.location,
    active: template.active,
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

export async function updateBusinessCentralESignDraft(
  draftId: string,
  input: BusinessCentralDraftInput,
) {
  const draft = await updateDocusealDraft(draftId, {
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

export async function createBusinessCentralESignPreviewUrl(
  draftId: string,
  baseUrl: string,
) {
  await getDocusealDraft(draftId);

  const expectedKeys = getConfiguredApiKeys();
  if (expectedKeys.length === 0) {
    throw new ApiError(500, "Business Central E-Sign API key is not configured.");
  }

  const expiresAt = Date.now() + previewTokenMaxAgeMs;
  const token = signPreviewToken(draftId, expiresAt, expectedKeys[0]);
  const url = new URL(`/esign/bc-preview/${encodeURIComponent(draftId)}`, baseUrl);
  url.searchParams.set("expires", String(expiresAt));
  url.searchParams.set("token", token);

  return {
    url: url.toString(),
    expiresAt,
  };
}

export async function createBusinessCentralESignEditorUrl(
  draftId: string,
  baseUrl: string,
) {
  await getDocusealDraft(draftId);

  const expectedKeys = getConfiguredApiKeys();
  if (expectedKeys.length === 0) {
    throw new ApiError(500, "Business Central E-Sign API key is not configured.");
  }

  const expiresAt = Date.now() + editorTokenMaxAgeMs;
  const token = signPreviewToken(draftId, expiresAt, expectedKeys[0]);
  const url = new URL(`/esign/bc-editor/${encodeURIComponent(draftId)}`, baseUrl);
  url.searchParams.set("expires", String(expiresAt));
  url.searchParams.set("token", token);

  return {
    url: url.toString(),
    expiresAt,
  };
}

export async function getBusinessCentralESignPreviewDraft(
  draftId: string,
  expires: string | string[] | undefined,
  token: string | string[] | undefined,
) {
  const expiresValue = Array.isArray(expires) ? expires[0] : expires;
  const tokenValue = Array.isArray(token) ? token[0] : token;
  const expiresAt = Number(expiresValue);

  if (!expiresValue || !tokenValue || !isValidPreviewToken(draftId, expiresAt, tokenValue)) {
    throw new ApiError(401, "This Metro E-Sign preview link is invalid or expired.");
  }

  const [draft, templates] = await Promise.all([
    getDocusealDraft(draftId),
    listDocusealPrefillTemplates(),
  ]);
  const template = templates.find((candidate) => candidate.key === draft.templateKey);

  if (!template) {
    throw new ApiError(404, "Metro E-Sign template was not found for this draft.");
  }

  return {
    draft,
    template,
    expiresAt,
  };
}

export const getBusinessCentralESignEditorDraft = getBusinessCentralESignPreviewDraft;

export async function updateBusinessCentralESignEditorDraft(
  draftId: string,
  expires: string | string[] | undefined,
  token: string | string[] | undefined,
  input: {
    location?: string;
    customerName?: string;
    customerEmail?: string;
    subject?: string;
    message?: string;
    values?: Record<string, unknown>;
  },
) {
  const { draft } = await getBusinessCentralESignEditorDraft(draftId, expires, token);
  const updatedDraft = await updateDocusealDraft(draft.id, input);
  const templates = await listDocusealPrefillTemplates();
  const template = templates.find((candidate) => candidate.key === updatedDraft.templateKey);

  if (!template) {
    throw new ApiError(404, "Metro E-Sign template was not found for this draft.");
  }

  return {
    draft: updatedDraft,
    template,
  };
}

export async function switchBusinessCentralESignEditorTemplate(
  draftId: string,
  expires: string | string[] | undefined,
  token: string | string[] | undefined,
  input: {
    templateKey: string;
    location?: string;
    values?: Record<string, unknown>;
  },
) {
  const { draft } = await getBusinessCentralESignEditorDraft(draftId, expires, token);
  const updatedDraft = await switchDocusealDraftTemplate(draft.id, input);
  const templates = await listDocusealPrefillTemplates();
  const template = templates.find((candidate) => candidate.key === updatedDraft.templateKey);

  if (!template) {
    throw new ApiError(404, "Metro E-Sign template was not found for this draft.");
  }

  return {
    draft: updatedDraft,
    template,
  };
}

export async function runBusinessCentralESignEditorAction(
  draftId: string,
  expires: string | string[] | undefined,
  token: string | string[] | undefined,
  action: "prepare" | "send" | "invalidate",
) {
  const { draft } = await getBusinessCentralESignEditorDraft(draftId, expires, token);
  const updatedDraft =
    action === "prepare"
      ? await prepareDocusealDraftPreview(draft.id)
      : action === "send"
        ? await sendDocusealDraft(draft.id)
        : await invalidateDocusealDraft(draft.id);
  const templates = await listDocusealPrefillTemplates();
  const template = templates.find((candidate) => candidate.key === updatedDraft.templateKey);

  if (!template) {
    throw new ApiError(404, "Metro E-Sign template was not found for this draft.");
  }

  return {
    draft: updatedDraft,
    template,
  };
}
