import { ListPageSkeleton } from "@/components/workspace-skeletons";

export default function Loading() {
  return <ListPageSkeleton filters={4} columns={6} />;
}
