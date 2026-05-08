import { ListPageSkeleton } from "@/components/workspace-skeletons";

export default function Loading() {
  return <ListPageSkeleton filters={5} metrics={4} columns={6} />;
}
