"use client";

import type { FeedItem, SubmissionDetail, WinnerRank } from "@/lib/judge-types";

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "content-type": "application/json", ...init?.headers } });
  if (res.status === 401) {
    // Session expired or passcode changed. Full navigation so the proxy runs.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(`/judge/login?next=${encodeURIComponent(location.pathname)}`);
    throw new Error("Signed out.");
  }
  const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok || !data) throw new Error(data?.error ?? `Request failed (${res.status}).`);
  return data;
}

// Signed URLs change on every fetch; keep the first one per id so polling
// doesn't make every image re-download. They're valid for 6 hours.
const thumbCache = new Map<string, string>();
function stableThumbs<T extends FeedItem>(item: T): T {
  if (!item.thumbUrl) return item;
  const cached = thumbCache.get(item.id);
  if (cached) return { ...item, thumbUrl: cached };
  thumbCache.set(item.id, item.thumbUrl);
  return item;
}

export async function fetchFeed(): Promise<{ judge: string; items: FeedItem[] }> {
  const data = await call<{ judge: string; items: FeedItem[] }>("/api/judge/submissions");
  return { judge: data.judge, items: data.items.map(stableThumbs) };
}

export async function fetchDetail(id: string): Promise<SubmissionDetail> {
  return stableThumbs(await call<SubmissionDetail>(`/api/judge/submissions/${id}`));
}

export function vote(id: string, score: number | null) {
  return call(`/api/judge/submissions/${id}/vote`, { method: "PUT", body: JSON.stringify({ score }) });
}

export function updateSubmission(id: string, patch: { hidden?: boolean; winnerRank?: WinnerRank | null }) {
  return call(`/api/judge/submissions/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
}

export function deleteEntry(id: string) {
  return call(`/api/judge/submissions/${id}`, { method: "DELETE" });
}

export function deleteEverything() {
  return call<{ deleted: number }>("/api/judge/reset", { method: "POST", body: JSON.stringify({ confirm: "DELETE" }) });
}

export async function lookupCode(code: string): Promise<string> {
  const { id } = await call<{ id: string }>(`/api/judge/lookup?code=${encodeURIComponent(code)}`);
  return id;
}

export function logout() {
  return fetch("/api/judge/logout", { method: "POST" }).then(() =>
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- drop all client state
    window.location.assign("/judge/login"),
  );
}
