import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { SignatureExecutionForm } from "@/components/signature-execution-form";
import { StatusPill } from "@/components/status-pill";
import { getSigningSession } from "@/lib/server/esign-service";

export const dynamic = "force-dynamic";

type SignaturePageProps = {
  params: Promise<{
    signatureId: string;
  }>;
  searchParams: Promise<{
    signer?: string;
    token?: string;
  }>;
};

async function loadSigningSession(options: {
  signatureId: string;
  signer: string;
  token: string;
}) {
  try {
    return {
      session: getSigningSession(options.signatureId, options.signer, options.token),
      error: null,
    };
  } catch (error) {
    return {
      session: null,
      error: error instanceof Error ? error.message : "Unable to open signing session.",
    };
  }
}

export default async function SignaturePage({
  params,
  searchParams,
}: SignaturePageProps) {
  const { signatureId } = await params;
  const { signer, token } = await searchParams;

  if (!signer || !token) {
    return (
      <>
        <PageHeader
          eyebrow="Internal E-Sign"
          title="Signing link is incomplete"
          description="This signing session is missing the signer identity or secure access token."
        />
      </>
    );
  }

  const result = await loadSigningSession({
    signatureId,
    signer,
    token,
  });

  if (!result.session) {
    return (
      <>
        <PageHeader
          eyebrow="Internal E-Sign"
          title="Signing session unavailable"
          description={result.error ?? "Unable to open signing session."}
        />
      </>
    );
  }

  const { session } = result;

  return (
    <>
      <PageHeader
        eyebrow="Internal E-Sign"
        title={session.request.title}
        description="This signing session is owned entirely by Metro Trailer. Signature intent, consent, certificate generation, and document retention are recorded inside the platform."
        actions={
          <Link
            href={`/api/documents/${session.packetDocument.id}/download`}
            className="rounded-full border border-[rgba(19,35,45,0.12)] bg-white px-4 py-2 text-sm font-semibold text-slate-800"
          >
            Download packet
          </Link>
        }
      />

      <SectionCard
        eyebrow="Request"
        title={session.request.contractNumber}
        description={session.request.message}
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="soft-panel p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Customer</p>
            <p className="mt-3 text-lg font-semibold text-slate-900">
              {session.request.customerName}
            </p>
          </div>
          <div className="soft-panel p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Signer</p>
            <p className="mt-3 text-lg font-semibold text-slate-900">
              {session.signer.name}
            </p>
          </div>
          <div className="soft-panel p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Routing order</p>
            <p className="mt-3 text-lg font-semibold text-slate-900">
              {session.signer.routingOrder}
            </p>
          </div>
          <div className="soft-panel p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Status</p>
            <div className="mt-3">
              <StatusPill label={session.request.status} />
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Certificate Controls"
        title="What gets recorded"
        description="Metro Trailer captures signer identity, typed signature adoption, timestamps, IP address when available, user agent, and document hashes for the final certificate."
      >
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="soft-panel p-5 text-sm leading-7 text-slate-600">
            <p>
              Consent version: <span className="font-medium text-slate-900">{session.request.consentTextVersion}</span>
            </p>
            <p className="mt-2">
              Certification: {session.request.certificationText}
            </p>
          </div>
          <div className="soft-panel p-5 text-sm leading-7 text-slate-600">
            <p>Current signer status: {session.signer.status}</p>
            <p className="mt-2">
              Packet hash: <span className="mono text-xs">{session.packetDocument.hash.slice(0, 24)}...</span>
            </p>
          </div>
        </div>
      </SectionCard>

      <SignatureExecutionForm
        signatureId={session.request.id}
        signerId={session.signer.id}
        token={token}
        signerName={session.signer.name}
        signerTitle={session.signer.title}
        canSign={session.canSign}
      />

      {session.request.finalDocument ? (
        <SectionCard
          eyebrow="Completed Record"
          title="Signed artifacts"
          description="Once execution is complete, Metro Trailer locks the final signed agreement and signature certificate as retained documents."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Link
              href={`/api/documents/${session.request.finalDocument.id}/download`}
              className="soft-panel block p-5 text-sm font-semibold text-slate-900"
            >
              Download signed agreement
            </Link>
            {session.request.certificateDocument ? (
              <Link
                href={`/api/documents/${session.request.certificateDocument.id}/download`}
                className="soft-panel block p-5 text-sm font-semibold text-slate-900"
              >
                Download signature certificate
              </Link>
            ) : null}
          </div>
        </SectionCard>
      ) : null}
    </>
  );
}
