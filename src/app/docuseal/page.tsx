import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { DocusealPrefillWorkspace } from "@/components/docuseal-prefill-workspace";
import {
  listDocusealDrafts,
  listDocusealPrefillDefaults,
  listDocusealPrefillTemplates,
} from "@/lib/server/docuseal-prefill";

export default async function DocusealPrefillPage() {
  const templates = await listDocusealPrefillTemplates();
  const drafts = await listDocusealDrafts();
  const defaults = await listDocusealPrefillDefaults();

  return (
    <div className="space-y-2">
      <PageHeader
        eyebrow="E-Sign"
        title="Create E-Sign draft"
        description="Prefill and send Metro Trailer E-Sign documents."
        actions={
          <Link href="/docuseal/templates" className="btn-secondary">
            Manage templates
          </Link>
        }
      />

      <DocusealPrefillWorkspace templates={templates} drafts={drafts} defaults={defaults} />
    </div>
  );
}
