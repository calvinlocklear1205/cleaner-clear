import { NextResponse } from "next/server";
import { event } from "@/config/event";
import { jsonError, readJson } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/server";

export type MineItem = {
  id: string;
  code: string;
  categoryId: string;
  createdAt: string;
  uploaded: boolean;
};

/**
 * This device's submissions, for /mine. Lets a volunteer see entries even if
 * the phone's local queue was cleared. Returns no contact info or photos.
 * POST (not GET) so the device id stays out of URLs and access logs.
 */
export async function POST(request: Request) {
  const body = (await readJson(request)) as { deviceId?: unknown } | null;
  const deviceId = body?.deviceId;
  if (typeof deviceId !== "string" || deviceId.length < 8 || deviceId.length > 64) {
    return jsonError(400, "Invalid request.");
  }

  const { data, error } = await supabaseAdmin()
    .from("submissions")
    .select("id, code, category_id, created_at, uploaded_at")
    .eq("device_id", deviceId)
    .eq("event_year", event.year)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    console.error("[submissions/mine] lookup failed", error);
    return jsonError(500, "Couldn't load your submissions.");
  }

  const items: MineItem[] = data.map((r) => ({
    id: r.id,
    code: r.code,
    categoryId: r.category_id,
    createdAt: r.created_at,
    uploaded: r.uploaded_at !== null,
  }));
  return NextResponse.json(items, { headers: { "Cache-Control": "no-store" } });
}
