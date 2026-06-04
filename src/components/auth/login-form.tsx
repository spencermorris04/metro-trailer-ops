"use client";

import type { FormEvent } from "react";
import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type AuthErrorPayload = {
  message?: string;
  error?: string;
};

function getCallbackUrl(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  return value;
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("spencer@metrotrl.com");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const callbackUrl = getCallbackUrl(searchParams.get("callbackUrl"));

  function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      setError(null);
      const response = await fetch("/api/auth/sign-in/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
          rememberMe: true,
          callbackURL: callbackUrl,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as AuthErrorPayload | null;
        setError(payload?.message ?? payload?.error ?? "Unable to sign in.");
        return;
      }

      router.replace(callbackUrl);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submitLogin} className="panel mx-auto w-full max-w-md overflow-hidden">
      <div className="border-b border-[var(--line)] px-4 py-3">
        <p className="eyebrow">Metro Trailer</p>
        <h1 className="mt-1 text-[1rem] font-semibold text-slate-900">Sign in</h1>
      </div>
      <div className="space-y-3 p-4">
        <label className="space-y-1 text-[0.75rem] text-slate-600">
          <span className="font-medium">Email</span>
          <input
            type="email"
            value={email}
            autoComplete="email"
            onChange={(event) => setEmail(event.target.value)}
            className="workspace-input w-full"
            required
          />
        </label>
        <label className="space-y-1 text-[0.75rem] text-slate-600">
          <span className="font-medium">Password</span>
          <input
            type="password"
            value={password}
            autoComplete="current-password"
            onChange={(event) => setPassword(event.target.value)}
            className="workspace-input w-full"
            required
          />
        </label>
        {error ? (
          <div className="border border-red-200 bg-red-50 px-3 py-2 text-[0.75rem] text-red-700">
            {error}
          </div>
        ) : null}
        <button type="submit" className="btn-primary w-full justify-center" disabled={pending}>
          {pending ? "Signing in..." : "Sign in"}
        </button>
      </div>
    </form>
  );
}
