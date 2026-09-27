"use client";

import Link from "next/link";
import { useQueueEntries } from "@/lib/client/use-queue";

/** Header link to /mine with a badge counting entries not yet sent. */
export function MineLink() {
  const entries = useQueueEntries();
  const pending = entries?.filter((e) => e.status !== "sent").length ?? 0;
  return (
    <Link
      href="/mine"
      className="tap relative ml-auto flex shrink-0 flex-col items-center justify-center rounded-xl px-2 text-center text-sm leading-tight font-semibold text-river-900"
    >
      <span className="text-2xl" aria-hidden>
        🗂️
      </span>
      Mine
      {pending > 0 && (
        <span className="absolute -top-1 -right-1 flex size-6 items-center justify-center rounded-full border-2 border-ink bg-fish-500 text-xs font-bold text-ink">
          {pending}
        </span>
      )}
    </Link>
  );
}
