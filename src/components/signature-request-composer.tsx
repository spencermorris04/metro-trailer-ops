"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type ContractOption = {
  contractNumber: string;
  customerName: string;
};

type SignerDraft = {
  name: string;
  email: string;
  title: string;
};

const emptySigner = (): SignerDraft => ({
  name: "",
  email: "",
  title: "",
});

export function SignatureRequestComposer({
  contracts,
}: {
  contracts: ContractOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [contractNumber, setContractNumber] = useState(contracts[0]?.contractNumber ?? "");
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [expiresInDays, setExpiresInDays] = useState(14);
  const [signers, setSigners] = useState<SignerDraft[]>([emptySigner()]);
  const [feedback, setFeedback] = useState<string | null>(null);

  function updateSigner(index: number, key: keyof SignerDraft, value: string) {
    setSigners((current) =>
      current.map((signer, signerIndex) =>
        signerIndex === index ? { ...signer, [key]: value } : signer,
      ),
    );
  }

  return (
    <div className="soft-panel p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="mono text-[0.68rem] uppercase tracking-[0.12em] text-slate-500">
            New request
          </p>
          <h3 className="mt-2 text-lg font-semibold text-slate-900">
            Launch an internal signature workflow
          </h3>
        </div>
        <span className="rounded-md border border-[var(--line)] bg-white px-2 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-slate-700">
          Bespoke e-sign
        </span>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm text-slate-700">
          <span className="font-medium">Contract</span>
          <select
            value={contractNumber}
            onChange={(event) => setContractNumber(event.target.value)}
            className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2.5 text-sm text-slate-900 outline-none"
          >
            {contracts.map((contract) => (
              <option key={contract.contractNumber} value={contract.contractNumber}>
                {contract.contractNumber} - {contract.customerName}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2 text-sm text-slate-700">
          <span className="font-medium">Expiration (days)</span>
          <input
            type="number"
            min={1}
            max={90}
            value={expiresInDays}
            onChange={(event) => setExpiresInDays(Number(event.target.value))}
            className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2.5 text-sm text-slate-900 outline-none"
          />
        </label>

        <label className="space-y-2 text-sm text-slate-700">
          <span className="font-medium">Request title</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Master rental agreement"
            className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2.5 text-sm text-slate-900 outline-none"
          />
        </label>

        <label className="space-y-2 text-sm text-slate-700">
          <span className="font-medium">Subject line</span>
          <input
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            placeholder="Please review and sign"
            className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2.5 text-sm text-slate-900 outline-none"
          />
        </label>
      </div>

      <label className="mt-4 block space-y-2 text-sm text-slate-700">
        <span className="font-medium">Message</span>
        <textarea
          rows={3}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Explain what the signer is approving and any timing expectations."
          className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2.5 text-sm text-slate-900 outline-none"
        />
      </label>

      <div className="mt-5 space-y-4">
        {signers.map((signer, index) => (
          <div
            key={`signer-${index}`}
            className="rounded-md border border-[var(--line)] bg-white p-4"
          >
            <div className="grid gap-4 md:grid-cols-3">
              <label className="space-y-2 text-sm text-slate-700">
                <span className="font-medium">Signer name</span>
                <input
                  value={signer.name}
                  onChange={(event) => updateSigner(index, "name", event.target.value)}
                  className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2.5 text-sm text-slate-900 outline-none"
                />
              </label>
              <label className="space-y-2 text-sm text-slate-700">
                <span className="font-medium">Email</span>
                <input
                  type="email"
                  value={signer.email}
                  onChange={(event) => updateSigner(index, "email", event.target.value)}
                  className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2.5 text-sm text-slate-900 outline-none"
                />
              </label>
              <label className="space-y-2 text-sm text-slate-700">
                <span className="font-medium">Title</span>
                <input
                  value={signer.title}
                  onChange={(event) => updateSigner(index, "title", event.target.value)}
                  className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2.5 text-sm text-slate-900 outline-none"
                />
              </label>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-800"
          onClick={() => setSigners((current) => [...current, emptySigner()])}
        >
          Add signer
        </button>
        {signers.length > 1 ? (
          <button
            type="button"
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-800"
            onClick={() => setSigners((current) => current.slice(0, -1))}
          >
            Remove last signer
          </button>
        ) : null}
        <button
          type="button"
          disabled={pending || !contractNumber}
          className="rounded-md border border-slate-900 bg-slate-900 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-white disabled:cursor-not-allowed disabled:opacity-60"
          onClick={() =>
            startTransition(async () => {
              setFeedback(null);
              const response = await fetch("/api/signatures", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  contractNumber,
                  title: title || undefined,
                  subject: subject || undefined,
                  message: message || undefined,
                  expiresInDays,
                  signers: signers.map((signer, index) => ({
                    name: signer.name,
                    email: signer.email,
                    title: signer.title || undefined,
                    routingOrder: index + 1,
                  })),
                }),
              });

              const result = (await response.json().catch(() => null)) as
                | { message?: string; error?: string }
                | null;

              if (response.ok) {
                setFeedback(result?.message ?? "Signature request created.");
                setTitle("");
                setSubject("");
                setMessage("");
                setExpiresInDays(14);
                setSigners([emptySigner()]);
                router.refresh();
                return;
              }

              setFeedback(result?.error ?? "Unable to create signature request.");
            })
          }
        >
          {pending ? "Creating..." : "Create signature request"}
        </button>
      </div>

      {feedback ? <p className="mt-3 text-sm text-slate-600">{feedback}</p> : null}
    </div>
  );
}
