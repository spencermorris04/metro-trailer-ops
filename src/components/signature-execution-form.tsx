"use client";

import {
  type ChangeEvent,
  useEffect,
  useRef,
  useState,
  useTransition,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useRouter } from "next/navigation";

import type {
  SignatureAppearanceMode,
  SignatureFieldRecord,
} from "@/lib/platform-types";

const HANDWRITING_FONT_STACK =
  '"Brush Script MT", "Segoe Script", "Lucida Handwriting", cursive';
const CANVAS_WIDTH = 720;
const CANVAS_HEIGHT = 220;

function renderHandwritingSignatureDataUrl(signatureText: string) {
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const context = canvas.getContext("2d");

  if (!context) {
    return null;
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#0f172a";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = `italic 88px ${HANDWRITING_FONT_STACK}`;
  context.fillText(signatureText.trim(), canvas.width / 2, canvas.height / 2);

  return canvas.toDataURL("image/png");
}

function formatPreviewDate() {
  return new Date().toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

type SignatureExecutionFormProps = {
  signatureId: string;
  signerId: string;
  token: string;
  signerName: string;
  signerTitle: string | null;
  fields: SignatureFieldRecord[];
  canSign: boolean;
};

export function SignatureExecutionForm({
  signatureId,
  signerId,
  token,
  signerName,
  signerTitle,
  fields,
  canSign,
}: SignatureExecutionFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [signatureText, setSignatureText] = useState(signerName);
  const [title, setTitle] = useState(signerTitle ?? "");
  const [otpCode, setOtpCode] = useState("");
  const [intentAccepted, setIntentAccepted] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [certificationAccepted, setCertificationAccepted] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [signatureMode, setSignatureMode] =
    useState<SignatureAppearanceMode>("handwriting_font");
  const [drawnDataUrl, setDrawnDataUrl] = useState<string | null>(null);
  const [uploadedDataUrl, setUploadedDataUrl] = useState<string | null>(null);
  const [currentFieldId, setCurrentFieldId] = useState<string | null>(
    fields[0]?.id ?? null,
  );
  const drawingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fieldRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const drawingStateRef = useRef({
    active: false,
    lastX: 0,
    lastY: 0,
  });

  const orderedFields = [...fields].sort(
    (left, right) => left.navigationOrder - right.navigationOrder,
  );
  const signatureField =
    orderedFields.find((field) => field.kind === "signature") ?? null;
  const titleField = orderedFields.find((field) => field.kind === "title") ?? null;
  const dateField = orderedFields.find((field) => field.kind === "date") ?? null;

  const handwritingDataUrl =
    typeof document === "undefined" || !signatureText.trim()
      ? null
      : renderHandwritingSignatureDataUrl(signatureText);

  useEffect(() => {
    const canvas = drawingCanvasRef.current;
    if (!canvas) {
      return;
    }

    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = 3;
    context.strokeStyle = "#0f172a";
  }, []);

  useEffect(() => {
    if (!currentFieldId) {
      return;
    }

    fieldRefs.current[currentFieldId]?.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "nearest",
    });
  }, [currentFieldId]);

  function advanceToNextField(fromFieldId: string | null) {
    if (!fromFieldId) {
      return;
    }

    const currentIndex = orderedFields.findIndex((field) => field.id === fromFieldId);
    if (currentIndex === -1) {
      return;
    }

    const next = orderedFields[currentIndex + 1];
    if (next) {
      setCurrentFieldId(next.id);
    }
  }

  async function buildUploadedSignature(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!["image/png", "image/jpeg"].includes(file.type)) {
      setFeedback("Uploaded signatures must be PNG or JPEG files.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setFeedback("Uploaded signatures must be 2 MB or smaller.");
      return;
    }

    const imageUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error ?? new Error("Unable to read file."));
      reader.readAsDataURL(file);
    });

    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("Unable to load uploaded image."));
      element.src = imageUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    const context = canvas.getContext("2d");
    if (!context) {
      setFeedback("Unable to process uploaded signature.");
      return;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    const scale = Math.min(canvas.width / image.width, canvas.height / image.height);
    const width = image.width * scale;
    const height = image.height * scale;
    const x = (canvas.width - width) / 2;
    const y = (canvas.height - height) / 2;
    context.drawImage(image, x, y, width, height);

    setUploadedDataUrl(canvas.toDataURL("image/png"));
    setFeedback(null);
    advanceToNextField(signatureField?.id ?? null);
  }

  function getCanvasPoint(event: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = drawingCanvasRef.current;
    if (!canvas) {
      return null;
    }

    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function handleDrawStart(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!canSign || pending || signatureMode !== "drawn") {
      return;
    }

    const point = getCanvasPoint(event);
    const canvas = drawingCanvasRef.current;
    const context = canvas?.getContext("2d");
    if (!point || !canvas || !context) {
      return;
    }

    canvas.setPointerCapture(event.pointerId);
    drawingStateRef.current = {
      active: true,
      lastX: point.x,
      lastY: point.y,
    };

    context.beginPath();
    context.moveTo(point.x, point.y);
  }

  function handleDrawMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawingStateRef.current.active || signatureMode !== "drawn") {
      return;
    }

    const point = getCanvasPoint(event);
    const context = drawingCanvasRef.current?.getContext("2d");
    if (!point || !context) {
      return;
    }

    context.lineTo(point.x, point.y);
    context.stroke();
    drawingStateRef.current.lastX = point.x;
    drawingStateRef.current.lastY = point.y;
  }

  function handleDrawEnd() {
    if (!drawingStateRef.current.active || signatureMode !== "drawn") {
      return;
    }

    drawingStateRef.current.active = false;
    const canvas = drawingCanvasRef.current;
    if (!canvas) {
      return;
    }

    setDrawnDataUrl(canvas.toDataURL("image/png"));
    advanceToNextField(signatureField?.id ?? null);
  }

  function clearDrawnSignature() {
    const canvas = drawingCanvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) {
      return;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    setDrawnDataUrl(null);
    setCurrentFieldId(signatureField?.id ?? null);
  }

  function getResolvedSignatureAppearance() {
    if (signatureMode === "handwriting_font") {
      return handwritingDataUrl;
    }

    if (signatureMode === "drawn") {
      return drawnDataUrl;
    }

    return uploadedDataUrl;
  }

  const resolvedSignatureAppearance = getResolvedSignatureAppearance();

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,420px)]">
      <div className="soft-panel overflow-hidden p-0">
        <div className="border-b border-[var(--line)] bg-slate-50 px-5 py-4">
          <p className="mono text-[0.68rem] uppercase tracking-[0.12em] text-slate-500">
            Document preview
          </p>
          <h2 className="mt-2 text-lg font-semibold text-slate-900">
            Signature fields auto-focus as you complete them
          </h2>
        </div>

        <div className="max-h-[840px] overflow-auto bg-slate-200 p-5">
          <div
            className="relative mx-auto bg-white shadow-sm"
            style={{ width: "612px", minHeight: "792px" }}
          >
            <div className="border-b border-[var(--line)] px-10 py-8">
              <p className="mono text-[0.68rem] uppercase tracking-[0.12em] text-slate-500">
                Metro Trailer
              </p>
              <h3 className="mt-3 text-2xl font-semibold text-slate-900">
                Signature page
              </h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Review the agreement packet, complete the highlighted signature
                fields, and adopt your legal name electronically.
              </p>
              <p className="mt-2 text-sm font-medium text-slate-900">{signerName}</p>
            </div>

            {orderedFields.map((field) => {
              const isActive = currentFieldId === field.id;
              const isSignature = field.kind === "signature";
              const fieldValue =
                field.kind === "title"
                  ? title || "Title will appear here"
                  : field.kind === "date"
                    ? canSign
                      ? "Auto-filled when submitted"
                      : formatPreviewDate()
                    : null;

              return (
                <div
                  key={field.id}
                  ref={(element) => {
                    fieldRefs.current[field.id] = element;
                  }}
                  className={`absolute rounded-md border ${
                    isActive
                      ? "border-slate-900 ring-2 ring-slate-900/20"
                      : "border-slate-300"
                  } bg-white/90 p-2 shadow-sm`}
                  style={{
                    left: `${field.x}px`,
                    top: `${field.y}px`,
                    width: `${field.width}px`,
                    height: `${field.height}px`,
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="mono text-[0.62rem] uppercase tracking-[0.12em] text-slate-500">
                      {field.label}
                    </p>
                    <button
                      type="button"
                      className="text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-slate-700"
                      onClick={() => setCurrentFieldId(field.id)}
                    >
                      Focus
                    </button>
                  </div>

                  {isSignature ? (
                    <div className="mt-2 flex h-[calc(100%-1.2rem)] items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50">
                      {resolvedSignatureAppearance ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={resolvedSignatureAppearance}
                          alt="Signature preview"
                          className="max-h-full max-w-full object-contain"
                        />
                      ) : (
                        <p className="px-4 text-center text-xs text-slate-500">
                          Capture a signature below to populate this field.
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="mt-3 rounded-md border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-700">
                      {fieldValue}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="space-y-5">
        <div className="soft-panel p-5">
          <p className="mono text-[0.68rem] uppercase tracking-[0.12em] text-slate-500">
            Field navigator
          </p>
          <div className="mt-4 grid gap-3">
            {orderedFields.map((field) => (
              <button
                key={field.id}
                type="button"
                className={`rounded-md border px-3 py-3 text-left ${
                  currentFieldId === field.id
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-[var(--line)] bg-white text-slate-900"
                }`}
                onClick={() => setCurrentFieldId(field.id)}
              >
                <p className="text-xs font-semibold uppercase tracking-[0.08em]">
                  {field.label}
                </p>
                <p className="mt-1 text-xs opacity-80">Page {field.page}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="soft-panel p-5">
          <p className="mono text-[0.68rem] uppercase tracking-[0.12em] text-slate-500">
            Sign electronically
          </p>
          <h2 className="mt-2 text-lg font-semibold text-slate-900">
            Choose how the signature should appear in the final PDF
          </h2>

          <div className="mt-4 grid gap-3">
            {([
              ["handwriting_font", "Handwriting font"],
              ["drawn", "Draw with mouse or touch"],
              ["uploaded_image", "Upload signature image"],
            ] satisfies Array<[SignatureAppearanceMode, string]>).map(
              ([mode, label]) => (
                <label
                  key={mode}
                  className={`rounded-md border px-3 py-3 text-sm ${
                    signatureMode === mode
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-[var(--line)] bg-white text-slate-900"
                  }`}
                >
                  <input
                    type="radio"
                    name="signature-mode"
                    value={mode}
                    checked={signatureMode === mode}
                    onChange={() => {
                      setSignatureMode(mode);
                      setCurrentFieldId(signatureField?.id ?? null);
                    }}
                    className="sr-only"
                  />
                  {label}
                </label>
              ),
            )}
          </div>

          <div className="mt-5 grid gap-4">
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-medium">Signature adoption name</span>
              <input
                value={signatureText}
                onChange={(event) => setSignatureText(event.target.value)}
                disabled={!canSign || pending}
                className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2.5 text-sm text-slate-900 outline-none disabled:cursor-not-allowed disabled:opacity-60"
              />
              <span className="block text-xs text-slate-500">
                This must match the assigned signer name and is recorded in the
                certificate even when you draw or upload the visible signature.
              </span>
            </label>

            {signatureMode === "handwriting_font" ? (
              <div className="rounded-md border border-[var(--line)] bg-white p-4">
                <p className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
                  Handwriting preview
                </p>
                <div className="mt-3 flex min-h-28 items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50 px-4">
                  <span
                    className="text-center text-5xl text-slate-900"
                    style={{ fontFamily: HANDWRITING_FONT_STACK }}
                  >
                    {signatureText || signerName}
                  </span>
                </div>
              </div>
            ) : null}

            {signatureMode === "drawn" ? (
              <div className="rounded-md border border-[var(--line)] bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
                    Draw signature
                  </p>
                  <button
                    type="button"
                    className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-800"
                    onClick={clearDrawnSignature}
                  >
                    Clear
                  </button>
                </div>
                <canvas
                  ref={drawingCanvasRef}
                  className="mt-3 h-44 w-full rounded-md border border-dashed border-slate-300 bg-slate-50 touch-none"
                  onPointerDown={handleDrawStart}
                  onPointerMove={handleDrawMove}
                  onPointerUp={handleDrawEnd}
                  onPointerLeave={handleDrawEnd}
                />
              </div>
            ) : null}

            {signatureMode === "uploaded_image" ? (
              <label className="space-y-2 text-sm text-slate-700">
                <span className="font-medium">Upload signature image</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  disabled={!canSign || pending}
                  onChange={(event) => {
                    void buildUploadedSignature(event);
                  }}
                  className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2.5 text-sm text-slate-900 outline-none disabled:cursor-not-allowed disabled:opacity-60"
                />
                <span className="block text-xs text-slate-500">
                  PNG or JPEG only. The image is normalized to a signing-safe PNG
                  before it is embedded into the final agreement.
                </span>
              </label>
            ) : null}

            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-medium">Title</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                onFocus={() => setCurrentFieldId(titleField?.id ?? null)}
                onBlur={() => advanceToNextField(titleField?.id ?? null)}
                disabled={!canSign || pending}
                className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2.5 text-sm text-slate-900 outline-none disabled:cursor-not-allowed disabled:opacity-60"
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
                className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2.5 text-sm text-slate-900 outline-none disabled:cursor-not-allowed disabled:opacity-60"
              />
            </label>
          </div>
        </div>

        <div className="soft-panel p-5">
          <p className="rounded-md border border-[var(--line)] bg-white px-4 py-3 text-sm text-slate-600">
            Metro Trailer records OTP verification, consent, signer IP/user
            agent, signature appearance hash, and final document hash in the
            retained execution certificate.
          </p>
          <div className="mt-4 space-y-3 text-sm text-slate-700">
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
              <span>
                I consent to doing business electronically and receiving the
                signed record digitally.
              </span>
            </label>
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={certificationAccepted}
                onChange={(event) => setCertificationAccepted(event.target.checked)}
                disabled={!canSign || pending}
                className="mt-1 h-4 w-4 rounded border-slate-300"
              />
              <span>
                I certify that I have authority to sign and that the
                information I am submitting is accurate.
              </span>
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
                !certificationAccepted ||
                !resolvedSignatureAppearance
              }
              className="rounded-md border border-slate-900 bg-slate-900 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-white disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() =>
                startTransition(async () => {
                  setFeedback(null);

                  const signatureAppearanceDataUrl = getResolvedSignatureAppearance();
                  if (!signatureAppearanceDataUrl) {
                    setFeedback("Capture or upload a signature before submitting.");
                    return;
                  }

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
                      signatureMode,
                      signatureAppearanceDataUrl,
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
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
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
              {pending ? "Working..." : "Email verification code"}
            </button>
          </div>

          {feedback ? <p className="mt-3 text-sm text-slate-600">{feedback}</p> : null}
        </div>

        {dateField ? (
          <div className="soft-panel p-5 text-sm text-slate-600">
            <p className="font-medium text-slate-900">Signing date field</p>
            <p className="mt-2">
              The signing date is anchored to the document and is filled
              automatically when the signature is accepted.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
