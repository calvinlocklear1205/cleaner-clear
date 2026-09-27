"use client";

import { useEffect, useState } from "react";
import { getEntry, listEntries, subscribe, toBlob, type QueueEntry } from "@/lib/client/queue";

/** All entries on this device, newest first. `null` while loading. */
export function useQueueEntries(): QueueEntry[] | null {
  const [entries, setEntries] = useState<QueueEntry[] | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () => void listEntries().then((e) => alive && setEntries(e));
    load();
    const unsubscribe = subscribe(load);
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);
  return entries;
}

/** One entry, kept live. `undefined` while loading, `null` if missing. */
export function useQueueEntry(id: string): QueueEntry | null | undefined {
  const [entry, setEntry] = useState<QueueEntry | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    const load = () => void getEntry(id).then((e) => alive && setEntry(e ?? null));
    load();
    const unsubscribe = subscribe(load);
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [id]);
  return entry;
}

const thumbUrls = new Map<string, string>();

/**
 * Object URL for an entry's thumbnail. Cached per entry id because every
 * IndexedDB read returns a fresh copy; thumbnails are tiny, so the cache
 * lives for the page's lifetime.
 */
export function thumbUrl(entry: QueueEntry): string | null {
  if (!entry.thumb) return null;
  let url = thumbUrls.get(entry.id);
  if (!url) {
    url = URL.createObjectURL(toBlob(entry.thumb));
    thumbUrls.set(entry.id, url);
  }
  return url;
}
