"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Icon } from "@/components/icons";
import { DocusealModeTabs } from "@/components/docuseal-mode-tabs";
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
  customerEditableFields: string[];
  customerRequiredFields: string[];
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
    submitterRole: "First Party",
    customerEditableFields: template.fields
      .filter((field) => field.customerEditable)
      .map((field) => field.name),
    customerRequiredFields: template.fields
      .filter((field) => field.customerEditable && field.customerRequired)
      .map((field) => field.name),
    active: true,
  };
}

function formatCategory(category: DocusealTemplateCategory) {
  return templateCategoryLabels[category] ?? category;
}

export function DocusealTemplateLibrary({
  templates,
  embedMode = "app",
  apiAuthQuery = "",
}: {
  templates: DocusealTemplateDefinition[];
  embedMode?: "app" | "bc";
  apiAuthQuery?: string;
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
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(
    templates[0]?.docusealTemplateId ?? null,
  );
  const [templateQuery, setTemplateQuery] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [customFolderTemplates, setCustomFolderTemplates] = useState<Record<string, boolean>>(
    {},
  );
  const [customLocationTemplates, setCustomLocationTemplates] = useState<Record<string, boolean>>(
    {},
  );

  const filteredTemplates = useMemo(() => {
    const query = templateQuery.trim().toLowerCase();
    if (!query) {
      return templateList;
    }

    return templateList.filter((template) => {
      const searchable = [
        template.name,
        template.key,
        template.folderName,
        template.location,
        formatCategory(template.category),
        String(template.docusealTemplateId),
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [templateList, templateQuery]);

  const selectedTemplate =
    templateList.find((template) => template.docusealTemplateId === selectedTemplateId) ??
    templateList[0] ??
    null;
  const selectedEdit = selectedTemplate ? getTemplateEdit(selectedTemplate) : null;
  const folderOptions = useMemo(
    () =>
      Array.from(
        new Set(templateList.map((template) => template.folderName.trim()).filter(Boolean)),
      ).sort((left, right) => left.localeCompare(right)),
    [templateList],
  );
  const locationOptions = useMemo(
    () =>
      Array.from(
        new Set(templateList.map((template) => template.location.trim()).filter(Boolean)),
      ).sort((left, right) => left.localeCompare(right)),
    [templateList],
  );

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

  function buildApiUrl(path: string) {
    if (!apiAuthQuery) {
      return path;
    }

    return `${path}${path.includes("?") ? "&" : "?"}${apiAuthQuery}`;
  }

  function setCustomerFieldPolicy(
    template: DocusealTemplateDefinition,
    fieldName: string,
    policy: "locked" | "optional" | "required",
  ) {
    const edit = getTemplateEdit(template);
    const withoutEditableField = edit.customerEditableFields.filter(
      (name) => name !== fieldName,
    );
    const withoutRequiredField = edit.customerRequiredFields.filter(
      (name) => name !== fieldName,
    );
    const customerEditableFields =
      policy === "locked" ? withoutEditableField : [...withoutEditableField, fieldName];
    const customerRequiredFields =
      policy === "required" ? [...withoutRequiredField, fieldName] : withoutRequiredField;

    updateTemplateEdit(template, { customerEditableFields, customerRequiredFields });
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
    setSelectedTemplateId(template.docusealTemplateId);
  }

  async function detectTemplateFields(template: DocusealTemplateDefinition) {
    const result = await submitJson<{
      detectedFieldCount: number;
      template: DocusealTemplateDefinition;
    }>(
      buildApiUrl(`/api/docuseal/templates/${template.docusealTemplateId}/detect-fields`),
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

        const response = await fetch(buildApiUrl("/api/docuseal/templates"), {
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
        setShowUpload(false);
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
    const edit = {
      ...getTemplateEdit(template),
      submitterRole: "First Party",
      active: true,
    };

    startTransition(async () => {
      try {
        setFeedback(null);
        const result = await submitJson<{ template: DocusealTemplateDefinition }>(
          buildApiUrl("/api/docuseal/templates"),
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
    <div
      className={`flex min-h-0 flex-col gap-2 ${
        embedMode === "bc" ? "h-screen overflow-hidden" : "h-full"
      }`}
    >
      <div className="panel flex flex-wrap items-center justify-between gap-2 px-2 py-1.5">
        <div className="flex min-w-0 items-center gap-2.5">
          {embedMode === "app" ? <DocusealModeTabs active="manage" /> : null}
          {embedMode === "app" ? (
            <span className="hidden h-7 w-px bg-[var(--line)] xl:block" />
          ) : null}
          <div className="hidden min-w-0 leading-tight xl:block">
            <p className="eyebrow">Template</p>
            <p
              className="truncate text-[0.78rem] font-semibold text-slate-900"
              title={selectedTemplate ? selectedTemplate.name : undefined}
            >
              {selectedTemplate ? selectedTemplate.name : "No template selected"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            className="btn-secondary inline-flex h-8 items-center gap-1.5 px-2.5 text-[0.7rem]"
            disabled={pending || !selectedTemplate}
            onClick={() => selectedTemplate && saveTemplateClassification(selectedTemplate)}
          >
            <Icon name="clipboard" size={14} />
            Save details
          </button>
          {selectedTemplate ? (
            <a
              href={selectedTemplate.editorUrl}
              target="_blank"
              rel="noreferrer"
              className="btn-secondary inline-flex h-8 items-center gap-1.5 px-2.5 text-[0.7rem]"
            >
              <Icon name="globe" size={14} />
              Open full editor
            </a>
          ) : null}
          <button
            type="button"
            className="btn-primary inline-flex h-8 items-center gap-1.5 px-2.5 text-[0.7rem]"
            disabled={pending || !selectedTemplate}
            onClick={() => selectedTemplate && runFieldDetection(selectedTemplate)}
          >
            <Icon name="search" size={14} />
            Detect fields
          </button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 overflow-hidden gap-2 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="panel flex min-h-0 flex-col overflow-hidden bg-[var(--surface-soft)]">
          <div className="border-b border-[var(--line)] px-2.5 py-2">
            <button
              type="button"
              className={`btn-secondary mb-2 inline-flex h-8 w-full items-center justify-center gap-1.5 px-2.5 text-[0.7rem] ${
                showUpload ? "border-slate-400 bg-slate-100" : ""
              }`}
              onClick={() => setShowUpload((current) => !current)}
            >
              <Icon name="folder" size={14} />
              New template
            </button>
            <div className="flex items-center justify-between gap-2">
            <label className="flex-1">
              <span className="sr-only">Find template</span>
              <input
                value={templateQuery}
                onChange={(event) => setTemplateQuery(event.target.value)}
                placeholder="Search name, folder, location..."
                className="workspace-input h-8 w-full bg-white"
              />
            </label>
            <span className="workspace-chip shrink-0">{filteredTemplates.length}</span>
            </div>
          </div>
          <div className="min-h-0 flex-1 space-y-2 overflow-auto p-2">

            {showUpload ? (
              <section className="border border-[var(--line)] bg-white">
                <div className="border-b border-[var(--line)] px-3 py-2">
                  <h3 className="text-[0.78rem] font-semibold text-slate-900">
                    Upload template
                  </h3>
                  <p className="mt-0.5 text-[0.65rem] text-slate-500">
                    Add a PDF, classify it, then field detection runs automatically.
                  </p>
                </div>
                <div className="space-y-2 p-3">
                  <label className="block space-y-1 text-[0.68rem] text-slate-600">
                    <span className="font-medium">PDF file</span>
                    <input
                      ref={uploadFileInputRef}
                      type="file"
                      accept="application/pdf,.pdf"
                      disabled={pending}
                      className="workspace-input w-full bg-white"
                    />
                  </label>
                  <label className="block space-y-1 text-[0.68rem] text-slate-600">
                    <span className="font-medium">Template name</span>
                    <input
                      value={uploadName}
                      onChange={(event) => setUploadName(event.target.value)}
                      disabled={pending}
                      placeholder="ACH Authorization Form"
                      className="workspace-input h-8 w-full bg-white"
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block space-y-1 text-[0.68rem] text-slate-600">
                      <span className="font-medium">Type</span>
                      <select
                        value={uploadCategory}
                        onChange={(event) =>
                          setUploadCategory(event.target.value as DocusealTemplateCategory)
                        }
                        disabled={pending}
                        className="workspace-input h-8 w-full bg-white"
                      >
                        {Object.entries(templateCategoryLabels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block space-y-1 text-[0.68rem] text-slate-600">
                      <span className="font-medium">Folder</span>
                      <input
                        value={uploadFolderName}
                        onChange={(event) => setUploadFolderName(event.target.value)}
                        disabled={pending}
                        className="workspace-input h-8 w-full bg-white"
                      />
                    </label>
                    <label className="block space-y-1 text-[0.68rem] text-slate-600">
                      <span className="font-medium">Location</span>
                      <input
                        value={uploadLocation}
                        onChange={(event) => setUploadLocation(event.target.value)}
                        disabled={pending}
                        className="workspace-input h-8 w-full bg-white"
                      />
                    </label>
                    <label className="block space-y-1 text-[0.68rem] text-slate-600">
                      <span className="font-medium">Signer role</span>
                      <input
                        value={uploadSubmitterRole}
                        onChange={(event) => setUploadSubmitterRole(event.target.value)}
                        disabled={pending}
                        className="workspace-input h-8 w-full bg-white"
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    className="btn-primary h-8 w-full text-[0.7rem]"
                    disabled={pending}
                    onClick={uploadTemplate}
                  >
                    Upload and detect fields
                  </button>
                </div>
              </section>
            ) : null}

            <div className="border border-[var(--line)] bg-white">
              {filteredTemplates.length ? (
                filteredTemplates.map((template) => {
                  const selected =
                    selectedTemplate?.docusealTemplateId === template.docusealTemplateId;

                  return (
                    <button
                      key={template.docusealTemplateId}
                      type="button"
                      title={template.name}
                      className={`block w-full border-b border-[var(--line)] px-3 py-2 text-left last:border-b-0 transition hover:bg-slate-50 ${
                        selected ? "bg-slate-100" : "bg-white"
                      }`}
                      onClick={() => setSelectedTemplateId(template.docusealTemplateId)}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span
                          className="min-w-0 truncate text-[0.75rem] font-semibold text-slate-900"
                          title={template.name}
                        >
                          {template.name}
                        </span>
                        <span className="shrink-0 text-[0.62rem] font-medium text-slate-500">
                          #{template.docusealTemplateId}
                        </span>
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[0.62rem] text-slate-500">
                        <span>{formatCategory(template.category)}</span>
                        <span>/</span>
                        <span>{template.folderName || "No folder"}</span>
                        <span>/</span>
                        <span>{template.fields.length} fields</span>
                        {!template.active ? (
                          <>
                            <span>/</span>
                            <span className="font-semibold text-red-600">Inactive</span>
                          </>
                        ) : null}
                      </span>
                    </button>
                  );
                })
              ) : (
                <div className="px-3 py-8 text-center text-[0.72rem] text-slate-500">
                  No templates match that search.
                </div>
              )}
            </div>
          </div>
        </aside>

        <section className="panel flex min-h-0 min-w-0 flex-col overflow-hidden bg-white">
          {selectedTemplate && selectedEdit ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="border-b border-[var(--line)] bg-slate-50 px-3 py-2">
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[minmax(220px,1.4fr)_180px_180px_180px]">
                  <label className="space-y-1 text-[0.68rem] font-medium text-slate-600">
                    <span>Name</span>
                    <input
                      value={selectedEdit.name}
                      onChange={(event) =>
                        updateTemplateEdit(selectedTemplate, { name: event.target.value })
                      }
                      disabled={pending}
                      className="workspace-input h-8 w-full bg-white"
                    />
                  </label>
                  <label className="space-y-1 text-[0.68rem] font-medium text-slate-600">
                    <span>Type</span>
                    <select
                      value={selectedEdit.category}
                      onChange={(event) =>
                        updateTemplateEdit(selectedTemplate, {
                          category: event.target.value as DocusealTemplateCategory,
                        })
                      }
                      disabled={pending}
                      className="workspace-input h-8 w-full bg-white"
                    >
                      {Object.entries(templateCategoryLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1 text-[0.68rem] font-medium text-slate-600">
                    <span>Folder</span>
                    {customFolderTemplates[selectedTemplate.key] ? (
                      <input
                        value={selectedEdit.folderName}
                        onChange={(event) =>
                          updateTemplateEdit(selectedTemplate, { folderName: event.target.value })
                        }
                        disabled={pending}
                        placeholder="New folder"
                        className="workspace-input h-8 w-full bg-white"
                      />
                    ) : (
                      <select
                        value={
                          folderOptions.includes(selectedEdit.folderName)
                            ? selectedEdit.folderName
                            : ""
                        }
                        onChange={(event) => {
                          if (event.target.value === "__new__") {
                            setCustomFolderTemplates((current) => ({
                              ...current,
                              [selectedTemplate.key]: true,
                            }));
                            updateTemplateEdit(selectedTemplate, { folderName: "" });
                          } else {
                            updateTemplateEdit(selectedTemplate, {
                              folderName: event.target.value,
                            });
                          }
                        }}
                        disabled={pending}
                        className="workspace-input h-8 w-full bg-white"
                      >
                        <option value="" disabled>
                          Select folder
                        </option>
                        {folderOptions.map((folder) => (
                          <option key={folder} value={folder}>
                            {folder}
                          </option>
                        ))}
                        <option value="__new__">Create new folder...</option>
                      </select>
                    )}
                  </label>
                  <label className="space-y-1 text-[0.68rem] font-medium text-slate-600">
                    <span>Location</span>
                    {customLocationTemplates[selectedTemplate.key] ? (
                      <input
                        value={selectedEdit.location}
                        onChange={(event) =>
                          updateTemplateEdit(selectedTemplate, { location: event.target.value })
                        }
                        disabled={pending}
                        placeholder="New location"
                        className="workspace-input h-8 w-full bg-white"
                      />
                    ) : (
                      <select
                        value={
                          locationOptions.includes(selectedEdit.location)
                            ? selectedEdit.location
                            : ""
                        }
                        onChange={(event) => {
                          if (event.target.value === "__new__") {
                            setCustomLocationTemplates((current) => ({
                              ...current,
                              [selectedTemplate.key]: true,
                            }));
                            updateTemplateEdit(selectedTemplate, { location: "" });
                          } else {
                            updateTemplateEdit(selectedTemplate, {
                              location: event.target.value,
                            });
                          }
                        }}
                        disabled={pending}
                        className="workspace-input h-8 w-full bg-white"
                      >
                        <option value="" disabled>
                          Select location
                        </option>
                        {locationOptions.map((location) => (
                          <option key={location} value={location}>
                            {location}
                          </option>
                        ))}
                        <option value="__new__">Create new location...</option>
                      </select>
                    )}
                  </label>
                </div>

                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[0.68rem] text-slate-500">
                  <div className="flex flex-wrap items-center gap-2">
                    <span>Template #{selectedTemplate.docusealTemplateId}</span>
                    <span>/</span>
                    <span>{selectedTemplate.fields.length} fields</span>
                    <span>/</span>
                    <span>Role: {selectedTemplate.submitterRole || "First Party"}</span>
                  </div>
                  <div className="min-h-4 text-slate-600">
                    {pending ? "Working..." : feedback}
                  </div>
                </div>
              </div>

              <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(380px,30vw)]">
                <iframe
                  key={selectedTemplate.editorUrl}
                  title={`${selectedTemplate.name} E-Sign editor`}
                  src={selectedTemplate.editorUrl}
                  className="h-full min-h-[720px] w-full border-0 bg-white xl:min-h-0"
                />
                <aside className="min-h-0 overflow-auto border-t border-[var(--line)] bg-white xl:border-l xl:border-t-0">
                  <div className="sticky top-0 z-10 border-b border-[var(--line)] bg-white px-3 py-2">
                    <p className="eyebrow">Customer fields</p>
                    <h3 className="text-[0.82rem] font-semibold text-slate-950">
                      Completion rules
                    </h3>
                    <p className="mt-1 text-[0.66rem] leading-4 text-slate-500">
                      Locked fields are read-only. Optional and required fields can be completed by
                      the customer.
                    </p>
                  </div>
                  <div className="grid gap-x-3 gap-y-1 p-2 [grid-template-columns:repeat(auto-fit,minmax(160px,1fr))]">
                    {selectedTemplate.fields.map((field) => {
                      const policy = selectedEdit.customerRequiredFields.includes(field.name)
                        ? "required"
                        : selectedEdit.customerEditableFields.includes(field.name)
                          ? "optional"
                          : "locked";

                      return (
                        <div
                          key={field.name}
                          title={`${field.label} (${field.name})`}
                          className="grid min-w-0 grid-cols-[minmax(0,1fr)_92px] items-center gap-2 border-b border-[var(--line)] px-1 py-1.5 hover:bg-slate-50"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-[0.68rem] font-semibold text-slate-900">
                              {field.label}
                            </span>
                            <span className="mt-0.5 block truncate text-[0.58rem] text-slate-500">
                              {field.name}
                            </span>
                          </span>
                          <select
                            value={policy}
                            disabled={pending}
                            onChange={(event) =>
                              setCustomerFieldPolicy(
                                selectedTemplate,
                                field.name,
                                event.target.value as "locked" | "optional" | "required",
                              )
                            }
                            className="workspace-input h-7 w-full bg-white px-1 text-[0.62rem]"
                            aria-label={`${field.label} customer completion rule`}
                          >
                            <option value="locked">Locked</option>
                            <option value="optional">Optional</option>
                            <option value="required">Required</option>
                          </select>
                        </div>
                      );
                    })}
                  </div>
                </aside>
              </div>
            </div>
          ) : (
            <div className="flex min-h-[420px] items-center justify-center text-[0.78rem] text-slate-500">
              Select or upload a template to edit.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
