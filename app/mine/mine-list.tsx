"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getCategory } from "@/config/event";
import { removeEntry, retryNow, type EntryStatus, type QueueEntry } from "@/lib/client/queue";
import { getDeviceId } from "@/lib/client/storage";
import { thumbUrl, useQueueEntries } from "@/lib/client/use-queue";
import type { MineItem } from "@/app/api/submissions/mine/route";

type Row = {
  id: string;
  categoryId: string;
  createdAt: number;
  code: string | null;
  status: EntryStatus | "lost";
  error: string | null;
  entry: QueueEntry | null;
};

export function MineList() {
  const entries = useQueueEntries();
  const server = useServerItems();
  const online = useOnline();

  if (entries === null) return <p className="text-lg text-river-900">Loading…</p>;

  const rows = mergeRows(entries, server);
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <p className="text-6xl" aria-hidden>
          🎣
        </p>
        <p className="text-xl font-semibold">Nothing yet — go find some trash!</p>
        <Link href="/" className="outlined tap flex items-center rounded-2xl bg-fish-500 px-6 font-display text-3xl">
          📸 Snap your trash
        </Link>
      </div>
    );
  }

  const waiting = rows.filter((r) => r.status === "queued" || r.status === "uploading").length;

  return (
    <>
      {waiting > 0 && (
        <p className="rounded-xl bg-mint-100 px-4 py-3 text-base">
          {online
            ? `Sending ${waiting} ${waiting === 1 ? "entry" : "entries"}… Keep this page open if you can.`
            : `No signal. ${waiting} ${waiting === 1 ? "entry is" : "entries are"} saved and will send automatically.`}
        </p>
      )}
      <ul className="flex flex-col gap-3">
        {rows.map((row) => (
          <MineRow key={row.id} row={row} online={online} />
        ))}
      </ul>
    </>
  );
}

function MineRow({ row, online }: { row: Row; online: boolean }) {
  const category = getCategory(row.categoryId);
  const thumb = row.entry ? thumbUrl(row.entry) : null;

  return (
    <li className="outlined flex items-center gap-3 rounded-xl bg-white p-2">
      {thumb ? (
        // eslint-disable-next-line @next/next/no-img-element -- local blob thumbnail
        <img src={thumb} alt="" className="size-20 shrink-0 rounded-lg border-2 border-ink object-cover" />
      ) : (
        <div className="flex size-20 shrink-0 items-center justify-center rounded-lg border-2 border-ink bg-mint-200 text-4xl">
          {category?.emoji ?? "🗑️"}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-2xl leading-none tracking-wide text-grape-700">
          {category ? `${category.emoji} ${category.label}` : row.categoryId}
        </p>
        <p className="text-base text-river-900">
          {new Date(row.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
          {row.code && (
            <>
              {" · "}
              <strong className="text-ink">#{row.code}</strong>
            </>
          )}
        </p>
        <StatusPill row={row} online={online} />
      </div>
    </li>
  );
}

function StatusPill({ row, online }: { row: Row; online: boolean }) {
  switch (row.status) {
    case "sent":
      return <Pill className="bg-river-700 text-white">Sent ✓</Pill>;
    case "uploading":
      return <Pill className="bg-grabber-500 text-white">Uploading…</Pill>;
    case "queued":
      return (
        <Pill className="bg-mint-200 text-ink">
          {online && row.error ? "Retrying…" : online ? "Queued" : "Waiting for signal"}
        </Pill>
      );
    case "lost":
      return (
        <p className="mt-1 text-sm text-[#b3124e]">
          Didn&apos;t finish sending and the photo isn&apos;t on this phone anymore. Please snap it again.
        </p>
      );
    case "failed":
      return (
        <div className="mt-1 flex flex-col gap-1">
          <p className="text-sm font-semibold text-[#b3124e]">{row.error ?? "Didn't go through."}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void retryNow(row.id)}
              className="tap rounded-lg border-2 border-ink bg-white px-3 text-sm font-semibold"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirm("Remove this entry from your phone?")) void removeEntry(row.id);
              }}
              className="tap rounded-lg px-3 text-sm font-semibold text-river-900 underline"
            >
              Remove
            </button>
          </div>
        </div>
      );
  }
}

function Pill({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className={`mt-1 inline-block rounded-full border-2 border-ink px-3 py-0.5 text-sm font-bold ${className}`}>
      {children}
    </span>
  );
}

/** Local queue entries win; server rows fill in anything this phone forgot. */
function mergeRows(entries: QueueEntry[], server: MineItem[]): Row[] {
  const rows = new Map<string, Row>();
  for (const s of server) {
    rows.set(s.id, {
      id: s.id,
      categoryId: s.categoryId,
      createdAt: Date.parse(s.createdAt),
      code: s.uploaded ? s.code : null,
      status: s.uploaded ? "sent" : "lost",
      error: null,
      entry: null,
    });
  }
  for (const e of entries) {
    const fromServer = rows.get(e.id);
    rows.set(e.id, {
      id: e.id,
      categoryId: e.input.categoryId,
      createdAt: e.createdAt,
      // The server may have confirmed an entry this tab hasn't heard back about yet.
      code: e.code ?? fromServer?.code ?? null,
      status: e.status === "sent" || fromServer?.status === "sent" ? "sent" : e.status,
      error: e.error,
      entry: e,
    });
  }
  return [...rows.values()].sort((a, b) => b.createdAt - a.createdAt);
}

function useServerItems(): MineItem[] {
  const [items, setItems] = useState<MineItem[]>([]);
  useEffect(() => {
    const load = () =>
      fetch("/api/submissions/mine", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ deviceId: getDeviceId() }),
      })
        .then((r) => (r.ok ? (r.json() as Promise<MineItem[]>) : null))
        .then((data) => data && setItems(data))
        .catch(() => {}); // offline: local entries still show
    load();
    window.addEventListener("online", load);
    return () => window.removeEventListener("online", load);
  }, []);
  return items;
}

function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}
