"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchFeed } from "@/lib/client/judge-api";
import type { FeedItem } from "@/lib/judge-types";

const POLL_MS = 15_000;

/** Judge feed with ~15s polling (paused while the tab is hidden). */
export function useJudgeFeed() {
  const [items, setItems] = useState<FeedItem[] | null>(null);
  const [judge, setJudge] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(
    () =>
      fetchFeed().then(
        (data) => {
          setItems(data.items);
          setJudge(data.judge);
          setError("");
        },
        (e: unknown) => setError(e instanceof Error ? e.message : "Couldn't load."),
      ),
    [],
  );

  useEffect(() => {
    const first = setTimeout(() => void refresh(), 0);
    const tick = () => document.visibilityState === "visible" && void refresh();
    const id = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearTimeout(first);
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [refresh]);

  return { items, judge, error, refresh };
}
