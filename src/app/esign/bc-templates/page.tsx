import { DocusealTemplateLibrary } from "@/components/docuseal-template-library";
import { ApiError } from "@/lib/server/api";
import {
  validateBusinessCentralTemplateManagerAuth,
} from "@/lib/server/business-central-esign";
import { listDocusealPrefillTemplates } from "@/lib/server/docuseal-prefill";

function TemplateManagerError({ message }: { message: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <section className="w-full max-w-md rounded-sm border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-slate-500">
          Metro E-Sign Templates
        </p>
        <h1 className="mt-2 text-lg font-semibold text-slate-950">Template manager unavailable</h1>
        <p className="mt-2 text-sm text-slate-600">{message}</p>
      </section>
    </main>
  );
}

export default async function BusinessCentralTemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const query = await searchParams;
  const session = validateBusinessCentralTemplateManagerAuth({
    expires: query.expires,
    session: query.session,
    token: query.token,
  });

  if (!session.capabilities.canManageTemplates) {
    return <TemplateManagerError message="This Business Central session cannot manage templates." />;
  }

  const tokenValue = Array.isArray(query.token) ? query.token[0] : query.token;
  const sessionValue = Array.isArray(query.session) ? query.session[0] : query.session;
  const expiresValue = Array.isArray(query.expires) ? query.expires[0] : query.expires;
  const templates = await listDocusealPrefillTemplates().catch((error: unknown) => {
    if (error instanceof ApiError) {
      throw error;
    }

    throw new Error("The template manager could not load E-Sign templates.");
  });

  return (
    <DocusealTemplateLibrary
      templates={templates}
      embedMode="bc"
      apiAuthQuery={`expires=${encodeURIComponent(String(expiresValue ?? ""))}&session=${encodeURIComponent(
        sessionValue ?? "",
      )}&token=${encodeURIComponent(tokenValue ?? "")}`}
    />
  );
}
