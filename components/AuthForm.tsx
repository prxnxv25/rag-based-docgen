"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));

    try {
      if (mode === "register") {
        const res = await fetch("/api/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: form.get("name"), email, password }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "Could not create the account.");
      }
      const result = await signIn("credentials", { email, password, redirect: false });
      if (!result || result.error) throw new Error("Incorrect email or password.");
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto mt-16 w-full max-w-sm px-4">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-lg bg-accent text-sm font-bold text-white">
          BD
        </div>
        <h1 className="text-xl font-semibold text-slate-900">
          {mode === "login" ? "Sign in" : "Create your account"}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          BRD in, FSD, TSD and Solution Proposal out.
        </p>
      </div>
      <form onSubmit={onSubmit} className="card space-y-4 p-5">
        {mode === "register" && (
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Name</span>
            <input name="name" required maxLength={80} className="input" autoComplete="name" />
          </label>
        )}
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Email</span>
          <input
            name="email"
            type="email"
            required
            className="input"
            autoComplete="email"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Password</span>
          <input
            name="password"
            type="password"
            required
            minLength={mode === "register" ? 8 : undefined}
            className="input"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />
          {mode === "register" && (
            <span className="mt-1 block text-xs text-slate-500">At least 8 characters.</span>
          )}
        </label>
        {error && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <button className="btn btn-primary w-full" disabled={busy} type="submit">
          {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-600">
        {mode === "login" ? (
          <>
            New here?{" "}
            <Link href="/register" className="font-medium text-accent hover:underline">
              Create an account
            </Link>
          </>
        ) : (
          <>
            Already registered?{" "}
            <Link href="/login" className="font-medium text-accent hover:underline">
              Sign in
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
