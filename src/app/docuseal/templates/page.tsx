import { DocusealTemplateLibrary } from "@/components/docuseal-template-library";
import { listDocusealPrefillTemplates } from "@/lib/server/docuseal-prefill";

export default async function DocusealTemplatesPage() {
  const templates = await listDocusealPrefillTemplates();

  return <DocusealTemplateLibrary templates={templates} />;
}
