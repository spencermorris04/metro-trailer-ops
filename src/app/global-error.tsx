"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error?: Error & { digest?: string };
  reset?: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-100 text-slate-950">
        <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-12">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Metro Trailer
          </p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">
            An unexpected application error occurred.
          </h1>
          <p className="mt-4 text-sm leading-7 text-slate-600">
            The request did not complete successfully. Retry the action, and if
            the problem persists, capture the diagnostic digest for support.
          </p>
          {error?.digest ? (
            <p className="mt-4 text-xs text-slate-500">
              Diagnostic digest: {error.digest}
            </p>
          ) : null}
          <div className="mt-8">
            <button
              type="button"
              onClick={() => reset?.()}
              className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
            >
              Retry
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
