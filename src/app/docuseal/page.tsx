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
    <DocusealPrefillWorkspace templates={templates} drafts={drafts} defaults={defaults} />
  );
}
