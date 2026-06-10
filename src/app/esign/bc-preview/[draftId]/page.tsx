import type { DocusealFieldDefinition } from "@/lib/docuseal/templates";
import { ApiError } from "@/lib/server/api";
import { getBusinessCentralESignPreviewDraft } from "@/lib/server/business-central-esign";

type PreviewLoadResult = Awaited<ReturnType<typeof getBusinessCentralESignPreviewDraft>>;

function groupFields(fields: DocusealFieldDefinition[]) {
  return fields.reduce<Record<string, DocusealFieldDefinition[]>>((acc, field) => {
    acc[field.section] ??= [];
    acc[field.section].push(field);
    return acc;
  }, {});
}

function isSignatureField(field: DocusealFieldDefinition) {
  const haystack = `${field.name} ${field.label}`.toLowerCase();
  return haystack.includes("signature") || haystack.includes("sign here");
}

function getFieldStatus(field: DocusealFieldDefinition, value: string) {
  if (isSignatureField(field)) {
    return "Signature required";
  }

  return value.trim() ? "Filled" : "Customer input";
}

function PreviewField({
  field,
  value,
}: {
  field: DocusealFieldDefinition;
  value: string;
}) {
  const signature = isSignatureField(field);
  const filled = value.trim().length > 0;

  return (
    <div
      className={`rounded border bg-white p-3 ${
        signature
          ? "border-amber-300 ring-2 ring-amber-100"
          : filled
            ? "border-slate-200"
            : "border-dashed border-slate-300"
      }`}
    >
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <label className="text-[0.74rem] font-semibold text-slate-700">
          {field.label}
        </label>
        <span
          className={`shrink-0 rounded-sm px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.08em] ${
            signature
              ? "bg-amber-100 text-amber-800"
              : filled
                ? "bg-emerald-50 text-emerald-700"
                : "bg-slate-100 text-slate-500"
          }`}
        >
          {getFieldStatus(field, value)}
        </span>
      </div>
      {signature ? (
        <div className="flex h-20 items-center justify-center rounded border border-amber-300 bg-amber-50 text-[0.84rem] font-semibold text-amber-900">
          Customer signs here in the live E-Sign document
        </div>
      ) : field.multiline ? (
        <textarea
          value={value}
          rows={3}
          disabled
          placeholder="Customer will complete this field"
          className="w-full resize-none rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-[0.78rem] text-slate-900 disabled:opacity-100"
        />
      ) : (
        <input
          value={value}
          disabled
          placeholder="Customer will complete this field"
          className="h-9 w-full rounded border border-slate-200 bg-slate-50 px-2 text-[0.78rem] text-slate-900 disabled:opacity-100"
        />
      )}
    </div>
  );
}

function PreviewError({ message }: { message: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <section className="w-full max-w-md rounded border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-slate-500">
          Metro E-Sign Preview
        </p>
        <h1 className="mt-2 text-lg font-semibold text-slate-950">Preview unavailable</h1>
        <p className="mt-2 text-sm text-slate-600">{message}</p>
      </section>
    </main>
  );
}

export default async function BusinessCentralESignPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ draftId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { draftId } = await params;
  const query = await searchParams;
  const preview: PreviewLoadResult | Error = await getBusinessCentralESignPreviewDraft(
    draftId,
    query.expires,
    query.token,
  ).catch((error: unknown) =>
    error instanceof Error ? error : new Error("The preview could not be loaded."),
  );

  if (preview instanceof Error) {
    const message =
      preview instanceof ApiError
        ? preview.message
        : "The preview could not be loaded. Refresh the preview from Business Central.";

    return <PreviewError message={message} />;
  }

  const { draft, template } = preview;
  const groupedFields = groupFields(template.fields);
  const filledCount = template.fields.filter((field) => draft.values[field.name]?.trim()).length;

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Metro Trailer E-Sign customer preview
            </p>
            <h1 className="mt-1 text-lg font-semibold leading-tight text-slate-950">
              {draft.templateName}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[0.72rem]">
            <span className="rounded-sm border border-slate-200 bg-slate-50 px-2 py-1 font-semibold text-slate-700">
              {draft.customerName || "No customer"}
            </span>
            <span className="rounded-sm border border-slate-200 bg-slate-50 px-2 py-1 font-semibold text-slate-700">
              {filledCount}/{template.fields.length} filled
            </span>
            <span className="rounded-sm border border-amber-200 bg-amber-50 px-2 py-1 font-semibold text-amber-800">
              Preview only
            </span>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-3 p-4">
        <div className="rounded border border-slate-200 bg-white p-3 text-sm text-slate-600">
          This is the customer-facing E-Sign view for review inside Business Central.
          Signing and document submission are disabled in this preview.
        </div>

        {Object.entries(groupedFields).map(([section, fields]) => (
          <section key={section} className="rounded border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-3 py-2">
              <h2 className="text-sm font-semibold text-slate-900">{section}</h2>
            </div>
            <div className="grid gap-3 bg-slate-50 p-3 md:grid-cols-2 xl:grid-cols-3">
              {fields.map((field) => (
                <PreviewField
                  key={field.name}
                  field={field}
                  value={draft.values[field.name] ?? ""}
                />
              ))}
            </div>
          </section>
        ))}
      </section>
    </main>
  );
}
