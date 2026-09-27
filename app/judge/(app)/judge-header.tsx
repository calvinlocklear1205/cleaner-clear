"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { logout, lookupCode } from "@/lib/client/judge-api";

export function JudgeHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onLookup(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    setError("");
    try {
      const id = await lookupCode(code);
      setCode("");
      router.push(`/judge/s/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Not found.");
    } finally {
      setBusy(false);
    }
  }

  const tab = (href: string, label: string) => {
    const active = href === "/judge" ? pathname === "/judge" : pathname.startsWith(href);
    return (
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={`tap flex items-center rounded-xl px-4 font-display text-2xl tracking-wide ${
          active ? "bg-river-700 text-white" : "text-river-900"
        }`}
      >
        {label}
      </Link>
    );
  };

  return (
    <header className="sticky top-0 z-10 flex flex-col gap-2 border-b-3 border-ink bg-mint-200 px-3 pt-[calc(env(safe-area-inset-top)+0.5rem)] pb-2">
      <div className="flex items-center gap-1">
        {tab("/judge", "Feed")}
        {tab("/judge/leaderboard", "Leaderboard")}
        <button
          type="button"
          onClick={() => void logout()}
          className="tap ml-auto rounded-xl px-2 text-base font-semibold text-river-900 underline"
        >
          Sign out
        </button>
      </div>
      <form onSubmit={onLookup} className="flex gap-2" role="search">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Prize tent: enter code, e.g. B47"
          aria-label="Look up a code"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          className="tap min-w-0 flex-1 rounded-xl border-3 border-ink bg-white px-3 text-lg uppercase placeholder:normal-case"
        />
        <button
          type="submit"
          disabled={busy}
          className="outlined tap rounded-xl bg-fish-500 px-4 font-display text-2xl disabled:opacity-70"
        >
          {busy ? "…" : "Find"}
        </button>
      </form>
      {error && (
        <p role="alert" className="text-base font-semibold text-[#b3124e]">
          {error}
        </p>
      )}
    </header>
  );
}
