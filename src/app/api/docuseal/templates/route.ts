import { z } from "zod";

import { created, errorResponse, ok, readJson } from "@/lib/server/api";
import { requireStaffApiPermission } from "@/lib/server/authorization";
import { validateBusinessCentralTemplateManagerAuth } from "@/lib/server/business-central-esign";
import {
  createDocusealTemplateFromPdf,
  listDocusealPrefillTemplates,
  updateDocusealTemplateClassification,
} from "@/lib/server/docuseal-prefill";

const templateCategorySchema = z.enum([
  "lease",
  "payment_authorization",
  "credit_application",
  "other",
]);
const updateTemplateSchema = z.object({
  docusealTemplateId: z.number().int().positive(),
  name: z.string().trim().min(1),
  category: templateCategorySchema,
  folderName: z.string().optional(),
  location: z.string().optional(),
  submitterRole: z.string().optional(),
  customerEditableFields: z.array(z.string()).optional(),
  active: z.boolean().optional(),
});

const maxTemplateUploadBytes = 25 * 1024 * 1024;

async function requireTemplatePermission(request: Request, permission: "documents.view" | "documents.manage") {
  const searchParams = new URL(request.url).searchParams;
  const session = searchParams.get("session");
  const token = searchParams.get("token");

  if (session && token) {
    validateBusinessCentralTemplateManagerAuth({
      expires: searchParams.get("expires") ?? undefined,
      session,
      token,
    });
    return;
  }

  await requireStaffApiPermission(request, permission);
}

export async function GET(request: Request) {
  await requireTemplatePermission(request, "documents.view");

  return ok({
    data: await listDocusealPrefillTemplates(),
  });
}

export async function POST(request: Request) {
  try {
    await requireTemplatePermission(request, "documents.manage");

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new Error("Choose a PDF file to upload.");
    }

    if (file.size <= 0) {
      throw new Error("The selected PDF file is empty.");
    }

    if (file.size > maxTemplateUploadBytes) {
      throw new Error("PDF uploads are limited to 25 MB.");
    }

    const fileName = file.name.trim() || "template.pdf";
    if (!fileName.toLowerCase().endsWith(".pdf")) {
      throw new Error("Only PDF template uploads are supported.");
    }

    const name = String(formData.get("name") ?? "").trim();
    const category = templateCategorySchema.parse(formData.get("category"));
    const folderName = String(formData.get("folderName") ?? "").trim();
    const location = String(formData.get("location") ?? "").trim();
    const submitterRole = String(formData.get("submitterRole") ?? "").trim();
    const active = formData.get("active") !== "false";
    const fileBase64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    const data = await createDocusealTemplateFromPdf({
      fileName,
      fileBase64,
      name: name || fileName.replace(/\.pdf$/i, ""),
      category,
      folderName,
      location,
      submitterRole,
      active,
    });

    return created({ message: "E-Sign template uploaded.", data }, request);
  } catch (error) {
    return errorResponse(error, request);
  }
}

export async function PATCH(request: Request) {
  try {
    await requireTemplatePermission(request, "documents.manage");

    const payload = updateTemplateSchema.parse(await readJson(request));
    const data = await updateDocusealTemplateClassification(payload);

    return ok({ message: "E-Sign template classification saved.", data }, undefined, request);
  } catch (error) {
    return errorResponse(error, request);
  }
}
