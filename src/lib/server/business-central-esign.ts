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

const editorCapabilitiesSchema = z.object({
  canEdit: z.boolean().default(true),
  canSend: z.boolean().default(true),
  canVoid: z.boolean().default(true),
  canManageTemplates: z.boolean().default(false),
});

const editorSessionSchema = z.object({
  draftId: z.string().min(1),
  expiresAt: z.number().finite(),
  bcUserId: z.string().optional().default("Business Central"),
  bcUserSecurityId: z.string().optional().default(""),
  companyName: z.string().optional().default(""),
  capabilities: editorCapabilitiesSchema.default({
    canEdit: true,
    canSend: true,
    canVoid: true,
    canManageTemplates: false,
  }),
});

const templateManagerSessionSchema = z.object({
  expiresAt: z.number().finite(),
  bcUserId: z.string().optional().default("Business Central"),
  bcUserSecurityId: z.string().optional().default(""),
  companyName: z.string().optional().default(""),
  capabilities: editorCapabilitiesSchema.default({
    canEdit: false,
    canSend: false,
    canVoid: false,
    canManageTemplates: true,
  }),
});

const editorSessionRequestSchema = z.object({
  bcUserId: z.string().optional().default("Business Central"),
  bcUserSecurityId: z.string().optional().default(""),
  companyName: z.string().optional().default(""),
  canEdit: z.boolean().optional().default(true),
  canSend: z.boolean().optional().default(true),
  canVoid: z.boolean().optional().default(true),
  canManageTemplates: z.boolean().optional().default(false),
});

export type BusinessCentralEditorSession = z.infer<typeof editorSessionSchema>;
export type BusinessCentralTemplateManagerSession = z.infer<
  typeof templateManagerSessionSchema
>;
export type BusinessCentralEditorSessionRequest = z.infer<
  typeof editorSessionRequestSchema
>;

export type BusinessCentralEditorAuthInput = {
  expires?: string | string[] | number | undefined;
  session?: string | string[] | undefined;
  token?: string | string[] | undefined;
};

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

function encodeEditorSession(session: BusinessCentralEditorSession) {
  return Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
}

function encodeTemplateManagerSession(session: BusinessCentralTemplateManagerSession) {
  return Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
}

function signEditorSession(session: string, secret: string) {
  return createHmac("sha256", secret).update(session).digest("base64url");
}

function decodeEditorSession(value: string) {
  try {
    return editorSessionSchema.parse(
      JSON.parse(Buffer.from(value, "base64url").toString("utf8")),
    );
  } catch {
    throw new ApiError(401, "This Metro E-Sign editor session is invalid.");
  }
}

function decodeTemplateManagerSession(value: string) {
  try {
    return templateManagerSessionSchema.parse(
      JSON.parse(Buffer.from(value, "base64url").toString("utf8")),
    );
  } catch {
    throw new ApiError(401, "This Metro E-Sign template manager session is invalid.");
  }
}

function isValidEditorSession(session: string, token: string) {
  return getConfiguredApiKeys().some((secret) => {
    const expected = signEditorSession(session, secret);
    return isEqualSecret(token, expected);
  });
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

function getFirstString(value: string | string[] | number | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value === undefined ? undefined : String(value);
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

export function parseBusinessCentralEditorSessionRequest(value: unknown) {
  return editorSessionRequestSchema.parse(value ?? {});
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
      type: field.type ?? "",
      customerEditable: Boolean(field.customerEditable),
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
  input: BusinessCentralEditorSessionRequest = parseBusinessCentralEditorSessionRequest({}),
) {
  await getDocusealDraft(draftId);

  const expectedKeys = getConfiguredApiKeys();
  if (expectedKeys.length === 0) {
    throw new ApiError(500, "Business Central E-Sign API key is not configured.");
  }

  const expiresAt = Date.now() + editorTokenMaxAgeMs;
  const session = encodeEditorSession({
    draftId,
    expiresAt,
    bcUserId: input.bcUserId,
    bcUserSecurityId: input.bcUserSecurityId,
    companyName: input.companyName,
    capabilities: {
      canEdit: input.canEdit,
      canSend: input.canSend,
      canVoid: input.canVoid,
      canManageTemplates: input.canManageTemplates,
    },
  });
  const token = signEditorSession(session, expectedKeys[0]);
  const url = new URL(`/esign/bc-editor/${encodeURIComponent(draftId)}`, baseUrl);
  url.searchParams.set("expires", String(expiresAt));
  url.searchParams.set("session", session);
  url.searchParams.set("token", token);

  return {
    url: url.toString(),
    expiresAt,
  };
}

export async function createBusinessCentralESignTemplateManagerUrl(
  baseUrl: string,
  input: BusinessCentralEditorSessionRequest = parseBusinessCentralEditorSessionRequest({
    canManageTemplates: true,
  }),
) {
  const expectedKeys = getConfiguredApiKeys();
  if (expectedKeys.length === 0) {
    throw new ApiError(500, "Business Central E-Sign API key is not configured.");
  }

  const expiresAt = Date.now() + editorTokenMaxAgeMs;
  const session = encodeTemplateManagerSession({
    expiresAt,
    bcUserId: input.bcUserId,
    bcUserSecurityId: input.bcUserSecurityId,
    companyName: input.companyName,
    capabilities: {
      canEdit: false,
      canSend: false,
      canVoid: false,
      canManageTemplates: true,
    },
  });
  const token = signEditorSession(session, expectedKeys[0]);
  const url = new URL("/esign/bc-templates", baseUrl);
  url.searchParams.set("expires", String(expiresAt));
  url.searchParams.set("session", session);
  url.searchParams.set("token", token);

  return {
    url: url.toString(),
    expiresAt,
  };
}

function getLegacyEditorSession(
  draftId: string,
  expires: string | string[] | number | undefined,
  token: string | string[] | undefined,
) {
  const expiresValue = getFirstString(expires);
  const tokenValue = getFirstString(token);
  const expiresAt = Number(expiresValue);

  if (!expiresValue || !tokenValue || !isValidPreviewToken(draftId, expiresAt, tokenValue)) {
    return null;
  }

  return {
    draftId,
    expiresAt,
    bcUserId: "Business Central",
    bcUserSecurityId: "",
    companyName: "",
    capabilities: {
      canEdit: true,
      canSend: true,
      canVoid: true,
      canManageTemplates: false,
    },
  } satisfies BusinessCentralEditorSession;
}

function validateBusinessCentralEditorAuth(
  draftId: string,
  auth: BusinessCentralEditorAuthInput,
) {
  const sessionValue = getFirstString(auth.session);
  const tokenValue = getFirstString(auth.token);

  if (sessionValue && tokenValue) {
    if (!isValidEditorSession(sessionValue, tokenValue)) {
      throw new ApiError(401, "This Metro E-Sign editor session is invalid.");
    }

    const session = decodeEditorSession(sessionValue);
    if (session.draftId !== draftId || session.expiresAt < Date.now()) {
      throw new ApiError(401, "This Metro E-Sign editor session is expired.");
    }

    return session;
  }

  const legacySession = getLegacyEditorSession(draftId, auth.expires, auth.token);
  if (!legacySession) {
    throw new ApiError(401, "This Metro E-Sign editor link is invalid or expired.");
  }

  return legacySession;
}

export function validateBusinessCentralTemplateManagerAuth(
  auth: BusinessCentralEditorAuthInput,
) {
  const sessionValue = getFirstString(auth.session);
  const tokenValue = getFirstString(auth.token);

  if (!sessionValue || !tokenValue || !isValidEditorSession(sessionValue, tokenValue)) {
    throw new ApiError(401, "This Metro E-Sign template manager link is invalid.");
  }

  const session = decodeTemplateManagerSession(sessionValue);
  if (session.expiresAt < Date.now()) {
    throw new ApiError(401, "This Metro E-Sign template manager session is expired.");
  }

  if (!session.capabilities.canManageTemplates) {
    throw new ApiError(403, "This Business Central session cannot manage E-Sign templates.");
  }

  return session;
}

function requireEditorCapability(
  session: BusinessCentralEditorSession,
  capability: keyof BusinessCentralEditorSession["capabilities"],
  message: string,
) {
  if (!session.capabilities[capability]) {
    throw new ApiError(403, message);
  }
}

function recordBusinessCentralESignActivity(
  session: BusinessCentralEditorSession,
  action: string,
  metadata: Record<string, unknown> = {},
) {
  console.info(
    JSON.stringify({
      event: "bc_esign_activity",
      draftId: session.draftId,
      action,
      bcUserId: session.bcUserId,
      bcUserSecurityId: session.bcUserSecurityId,
      companyName: session.companyName,
      metadata,
      occurredAt: new Date().toISOString(),
    }),
  );
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

export async function getBusinessCentralESignEditorDraft(
  draftId: string,
  auth: BusinessCentralEditorAuthInput,
) {
  const session = validateBusinessCentralEditorAuth(draftId, auth);

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
    expiresAt: session.expiresAt,
    session,
  };
}

export async function updateBusinessCentralESignEditorDraft(
  draftId: string,
  auth: BusinessCentralEditorAuthInput,
  input: {
    location?: string;
    customerName?: string;
    customerEmail?: string;
    subject?: string;
    message?: string;
    values?: Record<string, unknown>;
  },
) {
  const { draft, session } = await getBusinessCentralESignEditorDraft(draftId, auth);
  requireEditorCapability(session, "canEdit", "This Business Central session cannot edit this E-Sign draft.");
  const updatedDraft = await updateDocusealDraft(draft.id, input);
  recordBusinessCentralESignActivity(session, "save", {
    templateKey: updatedDraft.templateKey,
    fields: Object.keys(input.values ?? {}),
  });
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
  auth: BusinessCentralEditorAuthInput,
  input: {
    templateKey: string;
    location?: string;
    values?: Record<string, unknown>;
  },
) {
  const { draft, session } = await getBusinessCentralESignEditorDraft(draftId, auth);
  requireEditorCapability(session, "canEdit", "This Business Central session cannot change this E-Sign template.");
  const updatedDraft = await switchDocusealDraftTemplate(draft.id, input);
  recordBusinessCentralESignActivity(session, "template.change", {
    templateKey: input.templateKey,
  });
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
  auth: BusinessCentralEditorAuthInput,
  action: "prepare" | "send" | "invalidate",
) {
  const { draft, session } = await getBusinessCentralESignEditorDraft(draftId, auth);
  if (action === "prepare") {
    requireEditorCapability(session, "canEdit", "This Business Central session cannot prepare this E-Sign draft.");
  } else if (action === "send") {
    requireEditorCapability(session, "canSend", "This Business Central session cannot send E-Sign documents.");
  } else {
    requireEditorCapability(session, "canVoid", "This Business Central session cannot void E-Sign documents.");
  }

  const updatedDraft =
    action === "prepare"
      ? await prepareDocusealDraftPreview(draft.id)
      : action === "send"
        ? await sendDocusealDraft(draft.id)
        : await invalidateDocusealDraft(draft.id);
  recordBusinessCentralESignActivity(session, action, {
    status: updatedDraft.status,
    docusealSubmissionId: updatedDraft.docusealSubmissionId,
  });
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
