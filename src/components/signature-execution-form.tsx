"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function SignatureExecutionForm({
  signatureId,
  signerId,
  token,
  signerName,
  signerTitle,
  canSign,
}: {
  signatureId: string;
  signerId: string;
  token: string;
  signerName: string;
  signerTitle: string | null;
  canSign: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [signatureText, setSignatureText] = useState(signerName);
  const [title, setTitle] = useState(signerTitle ?? "");
  const [otpCode, setOtpCode] = useState("");
  const [intentAccepted, setIntentAccepted] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [certificationAccepted, setCertificationAccepted] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  return (
    <div className="soft-panel p-5">
      <p className="mono text-xs uppercase tracking-[0.18em] text-slate-500">
        Sign electronically
      </p>
      <h2 className="mt-2 text-xl font-semibold text-slate-900">
        Adopt your typed name as your signature
      </h2>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm text-slate-700">
          <span className="font-medium">Typed signature</span>
          <input
            value={signatureText}
            onChange={(event) => setSignatureText(event.target.value)}
            disabled={!canSign || pending}
            className="w-full rounded-2xl border border-[rgba(19,35,45,0.12)] bg-white px-4 py-3 text-sm text-slate-900 outline-none disabled:cursor-not-allowed disabled:opacity-60"
          />
        </label>

        <label className="space-y-2 text-sm text-slate-700">
          <span className="font-medium">Title</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            disabled={!canSign || pending}
            className="w-full rounded-2xl border border-[rgba(19,35,45,0.12)] bg-white px-4 py-3 text-sm text-slate-900 outline-none disabled:cursor-not-allowed disabled:opacity-60"
          />
        </label>

        <label className="space-y-2 text-sm text-slate-700">
          <span className="font-medium">Email verification code</span>
          <input
            value={otpCode}
            onChange={(event) =>
              setOtpCode(event.target.value.replace(/\D/g, "").slice(0, 6))
            }
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="6-digit code"
            disabled={!canSign || pending}
            className="w-full rounded-2xl border border-[rgba(19,35,45,0.12)] bg-white px-4 py-3 text-sm text-slate-900 outline-none disabled:cursor-not-allowed disabled:opacity-60"
          />
        </label>
      </div>

      <div className="mt-5 space-y-3 text-sm text-slate-700">
        <p className="rounded-2xl border border-[rgba(19,35,45,0.08)] bg-[rgba(255,255,255,0.7)] px-4 py-3 text-slate-600">
          Metro Trailer emails a one-time verification code before the agreement
          can be completed.
        </p>
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={intentAccepted}
            onChange={(event) => setIntentAccepted(event.target.checked)}
            disabled={!canSign || pending}
            className="mt-1 h-4 w-4 rounded border-slate-300"
          />
          <span>I intend to sign this agreement electronically.</span>
        </label>
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={consentAccepted}
            onChange={(event) => setConsentAccepted(event.target.checked)}
            disabled={!canSign || pending}
            className="mt-1 h-4 w-4 rounded border-slate-300"
          />
          <span>I consent to doing business electronically and receiving the signed record digitally.</span>
        </label>
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={certificationAccepted}
            onChange={(event) => setCertificationAccepted(event.target.checked)}
            disabled={!canSign || pending}
            className="mt-1 h-4 w-4 rounded border-slate-300"
          />
          <span>I certify that I have authority to sign and that the information I am submitting is accurate.</span>
        </label>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={
            !canSign ||
            pending ||
            otpCode.length !== 6 ||
            !intentAccepted ||
            !consentAccepted ||
            !certificationAccepted
          }
          className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          onClick={() =>
            startTransition(async () => {
              setFeedback(null);
              const response = await fetch(`/api/signatures/${signatureId}/sign`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  signerId,
                  token,
                  otpCode,
                  signatureText,
                  signerTitle: title || undefined,
                  intentAccepted: true,
                  consentAccepted: true,
                  certificationAccepted: true,
                }),
              });

              const result = (await response.json().catch(() => null)) as
                | { message?: string; error?: string }
                | null;

              setFeedback(
                response.ok
                  ? (result?.message ?? "Signature recorded.")
                  : (result?.error ?? "Unable to record signature."),
              );

              if (response.ok) {
                router.refresh();
              }
            })
          }
        >
          {pending ? "Recording..." : "Sign agreement"}
        </button>
        <button
          type="button"
          disabled={!canSign || pending}
          className="rounded-full border border-[rgba(19,35,45,0.12)] bg-white px-4 py-2 text-sm font-semibold text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={() =>
            startTransition(async () => {
              setFeedback(null);
              const response = await fetch(`/api/signatures/${signatureId}/otp`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  signerId,
                  token,
                }),
              });

              const result = (await response.json().catch(() => null)) as
                | { message?: string; error?: string }
                | null;

              setFeedback(
                response.ok
                  ? (result?.message ?? "Verification code sent.")
                  : (result?.error ?? "Unable to send verification code."),
              );
            })
          }
        >
          {pending ? "Working..." : "Resend code"}
        </button>
      </div>

      {feedback ? <p className="mt-3 text-sm text-slate-600">{feedback}</p> : null}
    </div>
  );
}
