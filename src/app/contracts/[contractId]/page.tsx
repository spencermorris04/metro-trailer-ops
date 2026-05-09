import { redirect } from "next/navigation";

type ContractRedirectPageProps = {
  params: Promise<{
    contractId: string;
  }>;
};

export default async function ContractRedirectPage({
  params,
}: ContractRedirectPageProps) {
  const { contractId } = await params;
  redirect(`/leases/${contractId}`);
}
