"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type {
  DocusealTemplateCategory,
  DocusealTemplateDefinition,
} from "@/lib/docuseal/templates";

type ApiResult<T> = {
  data?: T;
  message?: string;
  error?: string;
};

type TemplateEditState = {
  name: string;
  category: DocusealTemplateCategory;
  folderName: string;
  location: string;
  submitterRole: string;
  active: boolean;
};

const templateCategoryLabels: Record<DocusealTemplateCategory, string> = {
  lease: "Lease",
  payment_authorization: "Payment authorization",
  credit_application: "Credit application",
  other: "Other",
};

function buildTemplateEditState(template: DocusealTemplateDefinition): TemplateEditState {
  return {
    name: template.name,
    category: template.category,
    folderName: template.folderName,
    location: template.location,
    submitterRole: template.submitterRole,
    active: template.active,
  };
}

export function DocusealTemplateLibrary({
  templates,
}: {
  templates: DocusealTemplateDefinition[];
}) {
  const router = useRouter();
  const uploadFileInputRef = useRef<HTMLInputElement | null>(null);
  const [pending, startTransition] = useTransition();
  const [templateList, setTemplateList] = useState(templates);
  const [templateEdits, setTemplateEdits] = useState<Record<string, TemplateEditState>>({});
  const [uploadName, setUploadName] = useState("");
  const [uploadCategory, setUploadCategory] =
    useState<DocusealTemplateCategory>("payment_authorization");
  const [uploadFolderName, setUploadFolderName] = useState("Authorizations");
  const [uploadLocation, setUploadLocation] = useState("Company");
  const [uploadSubmitterRole, setUploadSubmitterRole] = useState("First Party");
  const [feedback, setFeedback] = useState<string | null>(null);

  function getTemplateEdit(template: DocusealTemplateDefinition) {
    return templateEdits[template.key] ?? buildTemplateEditState(template);
  }

  function updateTemplateEdit(
    template: DocusealTemplateDefinition,
    updates: Partial<TemplateEditState>,
  ) {
    setTemplateEdits((current) => ({
      ...current,
      [template.key]: {
        ...getTemplateEdit(template),
        ...updates,
      },
    }));
  }

  function replaceTemplate(template: DocusealTemplateDefinition) {
    setTemplateList((current) => {
      const exists = current.some(
        (item) => item.docusealTemplateId === template.docusealTemplateId,
      );
      const next = exists
        ? current.map((item) =>
            item.docusealTemplateId === template.docusealTemplateId ? template : item,
          )
        : [...current, template];

      return next.sort((left, right) => left.docusealTemplateId - right.docusealTemplateId);
    });
    setTemplateEdits((current) => ({
      ...current,
      [template.key]: buildTemplateEditState(template),
    }));
  }

  async function detectTemplateFields(template: DocusealTemplateDefinition) {
    const result = await submitJson<{
      detectedFieldCount: number;
      template: DocusealTemplateDefinition;
    }>(
      `/api/docuseal/templates/${template.docusealTemplateId}/detect-fields`,
      "POST",
    );

    if (result?.data?.template) {
      replaceTemplate(result.data.template);
    }

    return result;
  }

  async function submitJson<T>(url: string, method: string, body?: unknown) {
    const response = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const result = (await response.json().catch(() => null)) as ApiResult<T> | null;
    if (!response.ok) {
      throw new Error(result?.error ?? "Request failed.");
    }
    return result;
  }

  function uploadTemplate() {
    const file = uploadFileInputRef.current?.files?.[0] ?? null;
    if (!file) {
      setFeedback("Choose a PDF template file to upload.");
      return;
    }

    startTransition(async () => {
      try {
        setFeedback(null);
        const formData = new FormData();
        formData.set("file", file);
        formData.set("name", uploadName.trim() || file.name.replace(/\.pdf$/i, ""));
        formData.set("category", uploadCategory);
        formData.set("folderName", uploadFolderName);
        formData.set("location", uploadLocation);
        formData.set("submitterRole", uploadSubmitterRole);
        formData.set("active", "true");

        const response = await fetch("/api/docuseal/templates", {
          method: "POST",
          body: formData,
        });
        const result = (await response.json().catch(() => null)) as ApiResult<{
          template: DocusealTemplateDefinition;
        }> | null;
        if (!response.ok) {
          throw new Error(result?.error ?? "Unable to upload E-Sign template.");
        }
        let detectedFieldCount: number | null = null;
        if (result?.data?.template) {
          replaceTemplate(result.data.template);
          const detectionResult = await detectTemplateFields(result.data.template);
          detectedFieldCount = detectionResult?.data?.detectedFieldCount ?? null;
        }
        setUploadName("");
        if (uploadFileInputRef.current) {
          uploadFileInputRef.current.value = "";
        }
        setFeedback(
          detectedFieldCount === null
            ? result?.message ?? "E-Sign template uploaded."
            : `E-Sign template uploaded and ${detectedFieldCount} fields were detected.`,
        );
        router.refresh();
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : "Unable to upload E-Sign template.");
      }
    });
  }

  function saveTemplateClassification(template: DocusealTemplateDefinition) {
    const edit = getTemplateEdit(template);

    startTransition(async () => {
      try {
        setFeedback(null);
        const result = await submitJson<{ template: DocusealTemplateDefinition }>(
          "/api/docuseal/templates",
          "PATCH",
          {
            docusealTemplateId: template.docusealTemplateId,
            ...edit,
          },
        );
        if (result?.data?.template) {
          replaceTemplate(result.data.template);
        }
        setFeedback(result?.message ?? "E-Sign template classification saved.");
        router.refresh();
      } catch (error) {
        setFeedback(
          error instanceof Error ? error.message : "Unable to save template classification.",
        );
      }
    });
  }

  function runFieldDetection(template: DocusealTemplateDefinition) {
    startTransition(async () => {
      try {
        setFeedback(null);
        const result = await detectTemplateFields(template);
        setFeedback(
          result?.message
            ? `${result.message} ${result.data?.detectedFieldCount ?? 0} fields are available.`
            : "E-Sign fields detected.",
        );
        router.refresh();
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : "Unable to detect E-Sign fields.");
      }
    });
  }

  return (
    <main className="space-y-2">
      <section className="panel overflow-hidden">
        <div className="border-b border-[var(--line)] px-3 py-2">
          <h3 className="text-[0.82rem] font-semibold text-slate-900">Upload template</h3>
          <p className="mt-0.5 text-[0.65rem] text-slate-500">
            Add a PDF to E-Sign, then classify it for Metro workflows.
          </p>
        </div>
        <div className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-6">
          <label className="space-y-1 text-[0.72rem] text-slate-600 xl:col-span-2">
            <span className="font-medium">PDF file</span>
            <input
              ref={uploadFileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              disabled={pending}
              className="workspace-input w-full"
            />
          </label>
          <label className="space-y-1 text-[0.72rem] text-slate-600 xl:col-span-2">
            <span className="font-medium">Template name</span>
            <input
              value={uploadName}
              onChange={(event) => setUploadName(event.target.value)}
              disabled={pending}
              placeholder="ACH Authorization Form"
              className="workspace-input w-full"
            />
          </label>
          <label className="space-y-1 text-[0.72rem] text-slate-600">
            <span className="font-medium">Type</span>
            <select
              value={uploadCategory}
              onChange={(event) =>
                setUploadCategory(event.target.value as DocusealTemplateCategory)
              }
              disabled={pending}
              className="workspace-input w-full"
            >
              {Object.entries(templateCategoryLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-[0.72rem] text-slate-600">
            <span className="font-medium">Folder</span>
            <input
              value={uploadFolderName}
              onChange={(event) => setUploadFolderName(event.target.value)}
              disabled={pending}
              className="workspace-input w-full"
            />
          </label>
          <label className="space-y-1 text-[0.72rem] text-slate-600">
            <span className="font-medium">Location</span>
            <input
              value={uploadLocation}
              onChange={(event) => setUploadLocation(event.target.value)}
              disabled={pending}
              className="workspace-input w-full"
            />
          </label>
          <label className="space-y-1 text-[0.72rem] text-slate-600">
            <span className="font-medium">Signer role</span>
            <input
              value={uploadSubmitterRole}
              onChange={(event) => setUploadSubmitterRole(event.target.value)}
              disabled={pending}
              className="workspace-input w-full"
            />
          </label>
          <div className="flex items-end">
            <button
              type="button"
              className="btn-primary h-9 w-full"
              disabled={pending}
              onClick={uploadTemplate}
            >
              Upload template
            </button>
          </div>
        </div>
        {feedback ? (
          <div className="border-t border-[var(--line)] px-3 py-2 text-[0.75rem] text-slate-600">
            {feedback}
          </div>
        ) : null}
      </section>

      <section className="panel overflow-hidden">
        <div className="border-b border-[var(--line)] px-3 py-2">
          <h3 className="text-[0.82rem] font-semibold text-slate-900">
            Template classifications
          </h3>
          <p className="mt-0.5 text-[0.65rem] text-slate-500">
            Control type, folder, location, signer role, and availability.
          </p>
        </div>
        <div className="overflow-auto">
          <table className="min-w-[980px] w-full border-collapse text-left text-[0.72rem]">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="border-b border-[var(--line)] px-2 py-1.5 font-medium">ID</th>
                <th className="border-b border-[var(--line)] px-2 py-1.5 font-medium">Name</th>
                <th className="border-b border-[var(--line)] px-2 py-1.5 font-medium">Type</th>
                <th className="border-b border-[var(--line)] px-2 py-1.5 font-medium">Folder</th>
                <th className="border-b border-[var(--line)] px-2 py-1.5 font-medium">Location</th>
                <th className="border-b border-[var(--line)] px-2 py-1.5 font-medium">Signer role</th>
                <th className="border-b border-[var(--line)] px-2 py-1.5 font-medium">Fields</th>
                <th className="border-b border-[var(--line)] px-2 py-1.5 font-medium">Active</th>
                <th className="border-b border-[var(--line)] px-2 py-1.5 font-medium">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {templateList.map((template) => {
                const edit = getTemplateEdit(template);

                return (
                  <tr
                    key={template.docusealTemplateId}
                    className="border-b border-[var(--line)] last:border-b-0"
                  >
                    <td className="px-2 py-1.5 text-slate-500">
                      #{template.docusealTemplateId}
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        value={edit.name}
                        onChange={(event) =>
                          updateTemplateEdit(template, { name: event.target.value })
                        }
                        disabled={pending}
                        className="workspace-input h-8 w-full"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <select
                        value={edit.category}
                        onChange={(event) =>
                          updateTemplateEdit(template, {
                            category: event.target.value as DocusealTemplateCategory,
                          })
                        }
                        disabled={pending}
                        className="workspace-input h-8 w-full"
                      >
                        {Object.entries(templateCategoryLabels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        value={edit.folderName}
                        onChange={(event) =>
                          updateTemplateEdit(template, { folderName: event.target.value })
                        }
                        disabled={pending}
                        className="workspace-input h-8 w-full"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        value={edit.location}
                        onChange={(event) =>
                          updateTemplateEdit(template, { location: event.target.value })
                        }
                        disabled={pending}
                        className="workspace-input h-8 w-full"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        value={edit.submitterRole}
                        onChange={(event) =>
                          updateTemplateEdit(template, { submitterRole: event.target.value })
                        }
                        disabled={pending}
                        className="workspace-input h-8 w-full"
                      />
                    </td>
                    <td className="px-2 py-1.5 text-slate-500">
                      {template.fields.length}
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="checkbox"
                        checked={edit.active}
                        onChange={(event) =>
                          updateTemplateEdit(template, { active: event.target.checked })
                        }
                        disabled={pending}
                        className="h-4 w-4"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <button
                        type="button"
                        className="btn-secondary h-8 px-2 text-[0.68rem]"
                        disabled={pending}
                        onClick={() => saveTemplateClassification(template)}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        className="btn-secondary ml-1 h-8 px-2 text-[0.68rem]"
                        disabled={pending}
                        onClick={() => runFieldDetection(template)}
                      >
                        Detect fields
                      </button>
                      <a
                        href={template.editorUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-secondary ml-1 inline-flex h-8 items-center px-2 text-[0.68rem]"
                      >
                        Open editor
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
