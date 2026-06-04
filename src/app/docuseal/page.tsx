import { PageHeader } from "@/components/page-header";
import { DocusealPrefillWorkspace } from "@/components/docuseal-prefill-workspace";
import {
  listDocusealDrafts,
  listDocusealPrefillDefaults,
  listDocusealPrefillTemplates,
} from "@/lib/server/docuseal-prefill";

export default async function DocusealPrefillPage() {
  const templates = listDocusealPrefillTemplates();
  const drafts = await listDocusealDrafts();
  const defaults = await listDocusealPrefillDefaults();

  return (
    <div className="space-y-2">
      <PageHeader
        eyebrow="E-Sign"
        title="DocuSeal prefill"
        description="Prepare Metro Trailer lease documents before sending the customer into DocuSeal."
      />

      <DocusealPrefillWorkspace templates={templates} drafts={drafts} defaults={defaults} />
    </div>
  );
}
