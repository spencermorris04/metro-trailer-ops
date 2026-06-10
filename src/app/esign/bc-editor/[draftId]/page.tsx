import { ApiError } from "@/lib/server/api";
import {
  getBusinessCentralESignEditorDraft,
} from "@/lib/server/business-central-esign";
import { listDocusealPrefillTemplates } from "@/lib/server/docuseal-prefill";
import { BusinessCentralESignEditorClient } from "./bc-editor-client";

type EditorLoadResult = Awaited<ReturnType<typeof getBusinessCentralESignEditorDraft>>;

function EditorError({ message }: { message: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <section className="w-full max-w-md rounded-sm border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-slate-500">
          Metro E-Sign Editor
        </p>
        <h1 className="mt-2 text-lg font-semibold text-slate-950">Editor unavailable</h1>
        <p className="mt-2 text-sm text-slate-600">{message}</p>
      </section>
    </main>
  );
}

export default async function BusinessCentralESignEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ draftId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { draftId } = await params;
  const query = await searchParams;
  const editor: EditorLoadResult | Error = await getBusinessCentralESignEditorDraft(
    draftId,
    {
      expires: query.expires,
      session: query.session,
      token: query.token,
    },
  ).catch((error: unknown) =>
    error instanceof Error ? error : new Error("The editor could not be loaded."),
  );

  if (editor instanceof Error) {
    const message =
      editor instanceof ApiError
        ? editor.message
        : "The editor could not be loaded. Open the editor again from Business Central.";

    return <EditorError message={message} />;
  }

  const expiresValue = Array.isArray(query.expires) ? query.expires[0] : query.expires;
  const tokenValue = Array.isArray(query.token) ? query.token[0] : query.token;
  const sessionValue = Array.isArray(query.session) ? query.session[0] : query.session;

  const templates = await listDocusealPrefillTemplates();

  return (
    <BusinessCentralESignEditorClient
      draft={editor.draft}
      template={editor.template}
      templates={templates}
      expires={Number(expiresValue)}
      session={sessionValue ?? ""}
      token={tokenValue ?? ""}
      actor={{
        bcUserId: editor.session.bcUserId,
        bcUserSecurityId: editor.session.bcUserSecurityId,
        companyName: editor.session.companyName,
      }}
      capabilities={editor.session.capabilities}
    />
  );
}
