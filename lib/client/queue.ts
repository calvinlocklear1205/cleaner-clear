import { SubmitError, uploadSubmission } from "@/lib/client/upload";
import type { SubmissionInput } from "@/lib/submission";

/**
 * Offline-first upload queue.
 *
 * Every entry is written to IndexedDB *before* any network call, so a photo
 * survives dead signal, a locked phone, or a closed tab. The queue retries
 * with backoff, and immediately on `online`, page focus, and page load.
 * Because the entry id is generated on the device and every server step is
 * idempotent on it, retries never create duplicates.
 *
 * Uploads only run while a page of the app is open (iOS has no background
 * sync), but reopening the app later resumes them.
 */

export type EntryStatus = "queued" | "uploading" | "sent" | "failed";

export type QueueEntry = {
  id: string;
  input: SubmissionInput;
  status: EntryStatus;
  /** Short code, known once the server confirms. */
  code: string | null;
  /** Last error message, shown in the UI. */
  error: string | null;
  attempts: number;
  nextAttemptAt: number;
  createdAt: number;
  sentAt: number | null;
  /** Full photo; dropped once sent to free up storage. */
  photo: StoredBlob | null;
  thumb: StoredBlob | null;
};

/**
 * Blobs are stored as ArrayBuffers: older WebKit versions had bugs persisting
 * Blob objects in IndexedDB, while ArrayBuffers are safe everywhere.
 */
type StoredBlob = { data: ArrayBuffer; type: string };

const DB_NAME = "cleaner-clear";
const STORE = "entries";
const LOCK_NAME = "cleaner-clear-upload-queue";
const CHANNEL_NAME = "cleaner-clear-queue";
const MAX_BACKOFF_MS = 60_000;

// ---------------------------------------------------------------------------
// Storage: IndexedDB, falling back to memory (e.g. Firefox private mode) so
// the app still works — just without surviving a reload.
// ---------------------------------------------------------------------------

const memory = new Map<string, QueueEntry>();
let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  dbPromise ??= new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  if (!db) throw new Error("no-idb");
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function put(entry: QueueEntry): Promise<void> {
  try {
    await run("readwrite", (s) => s.put(entry));
  } catch {
    memory.set(entry.id, entry);
  }
}

async function get(id: string): Promise<QueueEntry | undefined> {
  try {
    return (await run<QueueEntry | undefined>("readonly", (s) => s.get(id))) ?? memory.get(id);
  } catch {
    return memory.get(id);
  }
}

async function all(): Promise<QueueEntry[]> {
  let entries: QueueEntry[] = [];
  try {
    entries = await run<QueueEntry[]>("readonly", (s) => s.getAll());
  } catch {
    // memory only
  }
  const ids = new Set(entries.map((e) => e.id));
  for (const e of memory.values()) if (!ids.has(e.id)) entries.push(e);
  return entries.sort((a, b) => b.createdAt - a.createdAt);
}

async function remove(id: string): Promise<void> {
  memory.delete(id);
  try {
    await run("readwrite", (s) => s.delete(id));
  } catch {
    // already gone
  }
}

async function update(id: string, patch: Partial<QueueEntry>): Promise<QueueEntry | undefined> {
  const entry = await get(id);
  if (!entry) return undefined;
  const next = { ...entry, ...patch };
  await put(next);
  notify();
  return next;
}

async function toStored(blob: Blob): Promise<StoredBlob> {
  return { data: await blob.arrayBuffer(), type: blob.type || "image/jpeg" };
}

export function toBlob(stored: StoredBlob): Blob {
  return new Blob([stored.data], { type: stored.type });
}

// ---------------------------------------------------------------------------
// Change notifications (this tab + other tabs of the app)
// ---------------------------------------------------------------------------

const listeners = new Set<() => void>();
let channel: BroadcastChannel | null = null;

function notify(fromOtherTab = false) {
  for (const l of listeners) l();
  if (!fromOtherTab) channel?.postMessage("changed");
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function enqueue(input: SubmissionInput, photo: Blob, thumb: Blob | null): Promise<void> {
  const now = Date.now();
  await put({
    id: input.id,
    input,
    status: "queued",
    code: null,
    error: null,
    attempts: 0,
    nextAttemptAt: now,
    createdAt: now,
    sentAt: null,
    photo: await toStored(photo),
    thumb: thumb ? await toStored(thumb) : null,
  });
  notify();
  void kick();
}

export const listEntries = all;
export const getEntry = get;

export async function retryNow(id: string): Promise<void> {
  const entry = await get(id);
  if (!entry || entry.status === "sent" || !entry.photo) return;
  await update(id, { status: "queued", nextAttemptAt: 0, error: null });
  void kick();
}

export async function removeEntry(id: string): Promise<void> {
  await remove(id);
  notify();
}

// ---------------------------------------------------------------------------
// Processing
// ---------------------------------------------------------------------------

let started = false;
let running = false;
let timer: ReturnType<typeof setTimeout> | undefined;

/** Idempotent. Call once per page load (see <QueueRunner />). */
export function startQueue(): void {
  if (started || typeof window === "undefined") return;
  started = true;

  if ("BroadcastChannel" in window) {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = () => notify(true);
  }

  // Ask the browser not to evict our storage under pressure (best effort).
  void navigator.storage?.persist?.().catch(() => {});

  const wake = () => void kick();
  window.addEventListener("online", wake);
  window.addEventListener("focus", wake);
  window.addEventListener("pageshow", wake);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") wake();
  });

  void (async () => {
    // An upload interrupted by a closed tab is left as "uploading"; requeue it.
    for (const e of await all()) {
      if (e.status === "uploading") await update(e.id, { status: "queued", nextAttemptAt: 0 });
    }
    void kick();
  })();
}

/** Process everything that's due. Safe to call any time; concurrent calls coalesce. */
export async function kick(): Promise<void> {
  if (running) return;
  running = true;
  clearTimeout(timer);
  try {
    // One tab at a time uploads; the others just watch via BroadcastChannel.
    if (navigator.locks) {
      await navigator.locks.request(LOCK_NAME, { ifAvailable: true }, async (lock) => {
        if (lock) await drain();
      });
    } else {
      await drain();
    }
  } finally {
    running = false;
  }
  await scheduleNext();
}

async function drain(): Promise<void> {
  // navigator.onLine === false is reliable (true is not): skip and wait for "online".
  while (navigator.onLine !== false) {
    const due = (await all())
      .filter((e) => e.status === "queued" && e.nextAttemptAt <= Date.now() && e.photo)
      .sort((a, b) => a.createdAt - b.createdAt)[0];
    if (!due) return;
    await attempt(due);
  }
}

async function attempt(entry: QueueEntry): Promise<void> {
  await update(entry.id, { status: "uploading", error: null });
  try {
    const { code } = await uploadSubmission(
      entry.input,
      toBlob(entry.photo!),
      entry.thumb ? toBlob(entry.thumb) : null,
    );
    // Confirmed by the server: drop the full photo, keep the thumbnail.
    await update(entry.id, { status: "sent", code, sentAt: Date.now(), photo: null, error: null });
  } catch (err) {
    const retryable = !(err instanceof SubmitError) || err.retryable;
    const message = err instanceof Error ? err.message : "Upload failed.";
    const attempts = entry.attempts + 1;
    if (retryable) {
      await update(entry.id, {
        status: "queued",
        attempts,
        error: message,
        nextAttemptAt: Date.now() + backoff(attempts),
      });
    } else {
      await update(entry.id, { status: "failed", attempts, error: message });
    }
  }
}

/** 2s, 4s, 8s … capped at 60s, with ±25% jitter so phones don't retry in lockstep. */
function backoff(attempts: number): number {
  const base = Math.min(MAX_BACKOFF_MS, 2000 * 2 ** (attempts - 1));
  return Math.round(base * (0.75 + Math.random() * 0.5));
}

async function scheduleNext(): Promise<void> {
  const pending = (await all()).filter((e) => e.status === "queued" && e.photo);
  if (pending.length === 0) return;
  const next = Math.min(...pending.map((e) => e.nextAttemptAt));
  clearTimeout(timer);
  timer = setTimeout(() => void kick(), Math.max(1000, next - Date.now()));
}
