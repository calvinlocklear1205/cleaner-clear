import { NextResponse } from "next/server";
import { event } from "@/config/event";
import { jsonError, readJson } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * Logs a hazard report alongside the sms: link. Not gated on the event
 * window — safety reports are always accepted.
 */
export async function POST(request: Request) {
  const b = (await readJson(request)) as Record<string, unknown> | null;
  if (!b) return jsonError(400, "Invalid request.");

  const num = (v: unknown, max: number) =>
    typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= max ? v : null;
  let lat = num(b.lat, 90);
  let lng = num(b.lng, 180);
  if (lat === null || lng === null) lat = lng = null;
  const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
  const deviceId = str(b.deviceId, 64);

  const db = supabaseAdmin();
  if (deviceId && deviceId.length >= 8) {
    const since = new Date(Date.now() - 60_000).toISOString();
    const { count } = await db
      .from("hazards")
      .select("id", { count: "exact", head: true })
      .eq("device_id", deviceId)
      .gte("created_at", since);
    if ((count ?? 0) >= 5) return jsonError(429, "Already logged — thanks!");
  }

  const { error } = await db.from("hazards").insert({
    event_year: event.year,
    lat,
    lng,
    zone: str(b.zone, 10),
    note: str(b.note, 280),
    device_id: deviceId && deviceId.length >= 8 ? deviceId : null,
  });
  if (error) {
    console.error("[hazards] insert failed", error);
    return jsonError(500, "Couldn't log the hazard.");
  }
  return NextResponse.json({ ok: true });
}
