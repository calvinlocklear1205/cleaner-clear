"use client";

import { useState } from "react";

export function LoginForm({ next }: { next: string }) {
  const [passcode, setPasscode] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/judge/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ passcode, name }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Couldn't sign in.");
      // Full navigation so the new cookie is sent with the next request.
      window.location.assign(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't sign in.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-lg font-semibold">Passcode</span>
        <input
          type="password"
          autoComplete="current-password"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          className="tap w-full rounded-xl border-3 border-ink bg-white px-4 py-3 text-lg"
          required
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-lg font-semibold">Your name</span>
        <input
          type="text"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="tap w-full rounded-xl border-3 border-ink bg-white px-4 py-3 text-lg"
          required
          maxLength={60}
        />
        <span className="text-base text-river-900">Each judge&apos;s scores are counted separately.</span>
      </label>
      {error && (
        <p role="alert" className="text-base font-semibold text-[#b3124e]">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="outlined tap rounded-2xl bg-river-700 px-6 py-3 font-display text-3xl tracking-wide text-white disabled:opacity-70"
      >
        {busy ? "Checking…" : "Let me in"}
      </button>
    </form>
  );
}
