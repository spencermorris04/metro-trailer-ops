import Link from "next/link";

import { DocusealTemplateLibrary } from "@/components/docuseal-template-library";
import { PageHeader } from "@/components/page-header";
import { listDocusealPrefillTemplates } from "@/lib/server/docuseal-prefill";

export default async function DocusealTemplatesPage() {
  const templates = await listDocusealPrefillTemplates();

  return (
    <div className="space-y-2">
      <PageHeader
        eyebrow="E-Sign"
        title="Template management"
        description="Upload PDFs and classify Metro E-Sign templates."
        actions={
          <Link href="/docuseal" className="btn-secondary">
            Create draft
          </Link>
        }
      />

      <DocusealTemplateLibrary templates={templates} />
    </div>
  );
}
