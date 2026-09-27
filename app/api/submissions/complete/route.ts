import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/api";
import { isUuid, type CompleteResponse } from "@/lib/submission";
import { SUBMISSIONS_BUCKET, supabaseAdmin } from "@/lib/supabase/server";

/**
 * Step 2 of 2. Called after the browser has PUT the photo to Storage. Checks
 * the object really exists, then marks the submission uploaded so judges can
 * see it. Idempotent: calling it again returns the same code.
 *
 * Not gated on the event window: if /init was accepted, finishing is allowed.
 */
export async function POST(request: Request) {
  const body = (await readJson(request)) as { id?: unknown; deviceId?: unknown } | null;
  if (!body || !isUuid(body.id) || typeof body.deviceId !== "string") {
    return jsonError(400, "Invalid request.");
  }
  const id = body.id.toLowerCase();
  const db = supabaseAdmin();

  const { data: row, error } = await db
    .from("submissions")
    .select("code, device_id, photo_path, uploaded_at")
    .eq("id", id)
    .maybeSingle();
  if (error) return serverError("lookup", error);
  // Same response for "missing" and "someone else's" so ids can't be probed.
  if (!row || row.device_id !== body.deviceId) return jsonError(404, "Submission not found.");
  if (row.uploaded_at) return ok({ code: row.code });

  // exists() resolves false on 400/404 and throws on anything else.
  let exists: boolean;
  try {
    ({ data: exists } = await db.storage.from(SUBMISSIONS_BUCKET).exists(row.photo_path));
  } catch (e) {
    return serverError("exists", e);
  }
  if (!exists) return jsonError(409, "The photo hasn't finished uploading yet.");

  const { error: updateError } = await db
    .from("submissions")
    .update({ uploaded_at: new Date().toISOString() })
    .eq("id", id)
    .is("uploaded_at", null);
  if (updateError) return serverError("update", updateError);

  return ok({ code: row.code });
}

function ok(body: CompleteResponse) {
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}

function serverError(step: string, error: unknown) {
  console.error(`[submissions/complete] ${step} failed`, error);
  return jsonError(500, "Something went wrong on our end. We'll keep trying.");
}
