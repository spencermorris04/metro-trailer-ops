import { requireStaffApiPermission } from "@/lib/server/authorization";
import { validateBusinessCentralTemplateManagerAuth } from "@/lib/server/business-central-esign";

type TemplatePermission = "documents.view" | "documents.manage";

export async function requireDocusealTemplatePermission(
  request: Request,
  permission: TemplatePermission,
) {
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

export function parseDocusealTemplateId(templateId: string) {
  const docusealTemplateId = Number(templateId);

  if (!Number.isInteger(docusealTemplateId) || docusealTemplateId <= 0) {
    throw new Error("A valid E-Sign template ID is required.");
  }

  return docusealTemplateId;
}
