"use client";

import { useEffect } from "react";
import { startQueue } from "@/lib/client/queue";

/** Mounted in the root layout so queued uploads drain on every page. */
export function QueueRunner() {
  useEffect(() => startQueue(), []);
  return null;
}
