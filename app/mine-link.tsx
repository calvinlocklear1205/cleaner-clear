"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getDeviceId } from "@/lib/client/storage";
import { useQueueEntries } from "@/lib/client/use-queue";

/**
 * Header link to /mine. The badge always shows how many entries this phone
 * has made: orange while any are still sending, green once all are sent.
 */
export function MineLink() {
  const entries = useQueueEntries();
  const serverIds = useServerIds();

  const ids = new Set([...serverIds, ...(entries ?? []).map((e) => e.id)]);
  const total = ids.size;
  const pending = entries?.filter((e) => e.status !== "sent").length ?? 0;

  return (
    <Link
      href="/mine"
      aria-label={total ? `My submissions: ${total}${pending ? `, ${pending} sending` : ""}` : "My submissions"}
      className="tap relative ml-auto flex shrink-0 flex-col items-center justify-center rounded-xl px-2 text-center text-sm leading-tight font-semibold text-river-900"
    >
      <span className="text-2xl" aria-hidden>
        🗂️
      </span>
      Mine
      {total > 0 && (
        <span
          className={`absolute -top-1 -right-1 flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-ink px-1 text-xs font-bold ${
            pending ? "bg-fish-500 text-ink" : "bg-river-700 text-white"
          }`}
        >
          {total}
        </span>
      )}
    </Link>
  );
}

/** Ids the server has for this device, so the count survives cleared phone storage. */
function useServerIds(): string[] {
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    fetch("/api/submissions/mine", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ deviceId: getDeviceId() }),
    })
      .then((r) => (r.ok ? (r.json() as Promise<{ id: string }[]>) : []))
      .then((items) => setIds(items.map((i) => i.id)))
      .catch(() => {});
  }, []);
  return ids;
}
