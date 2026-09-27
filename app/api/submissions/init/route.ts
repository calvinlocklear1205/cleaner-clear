import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { event, isAcceptingUploads } from "@/config/event";
import { jsonError, readJson } from "@/lib/api";
import { generateCode } from "@/lib/codes";
import { photoPath, thumbPath, validateSubmission, type InitResponse, type SubmissionInput } from "@/lib/submission";
import { SUBMISSIONS_BUCKET, supabaseAdmin } from "@/lib/supabase/server";

/** Max new submissions per device per minute. Generous: it only stops runaway loops. */
const RATE_LIMIT_PER_MINUTE = 10;

/**
 * Step 1 of 2. Records the submission (idempotent on the client-generated id)
 * and returns its short code plus a signed URL the browser PUTs the photo to.
 * The row stays invisible to judges until /complete confirms the upload.
 */
export async function POST(request: Request) {
  if (!isAcceptingUploads()) {
    return jsonError(403, "Submissions are closed — thanks for hauling!");
  }

  const parsed = validateSubmission(await readJson(request));
  if (!parsed.ok) {
    const [field, message] = Object.entries(parsed.errors)[0] as [keyof SubmissionInput, string];
    return jsonError(400, message, field);
  }
  const input = parsed.value;
  const db = supabaseAdmin();

  const { data: existing, error: lookupError } = await db
    .from("submissions")
    .select("code, device_id, uploaded_at")
    .eq("id", input.id)
    .maybeSingle();
  if (lookupError) return serverError("lookup", lookupError);

  let code: string;
  if (existing) {
    // A retry of a submission we've already seen.
    if (existing.device_id !== input.deviceId) return jsonError(409, "Submission id conflict. Please try again.");
    if (existing.uploaded_at) return ok({ code: existing.code, upload: null });
    code = existing.code;
  } else {
    const since = new Date(Date.now() - 60_000).toISOString();
    const { count, error: countError } = await db
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .eq("device_id", input.deviceId)
      .gte("created_at", since);
    if (countError) return serverError("rate-limit", countError);
    if ((count ?? 0) >= RATE_LIMIT_PER_MINUTE) {
      return jsonError(429, "Whoa, speedy! Give it a few seconds and try again.");
    }

    const inserted = await insertWithUniqueCode(db, input);
    if ("error" in inserted) return inserted.error;
    code = inserted.code;
  }

  const path = photoPath(input.id);
  const bucket = db.storage.from(SUBMISSIONS_BUCKET);
  const [photo, thumb] = await Promise.all([
    bucket.createSignedUploadUrl(path, { upsert: true }),
    bucket.createSignedUploadUrl(thumbPath(input.id), { upsert: true }),
  ]);
  if (photo.error || !photo.data) return serverError("sign-upload", photo.error);

  return ok({
    code,
    upload: { signedUrl: photo.data.signedUrl, path, thumbSignedUrl: thumb.data?.signedUrl ?? null },
  });
}

async function insertWithUniqueCode(
  db: SupabaseClient,
  input: SubmissionInput,
): Promise<{ code: string } | { error: NextResponse }> {
  for (let attempt = 0; attempt < 12; attempt++) {
    const code = generateCode(attempt < 6 ? 2 : 3);
    const { error } = await db.from("submissions").insert({
      id: input.id,
      code,
      event_year: event.year,
      category_id: input.categoryId,
      photo_path: photoPath(input.id),
      name: input.name,
      phone: input.phone,
      team_name: input.teamName,
      note: input.note,
      weight_lbs: input.weightLbs,
      lat: input.lat,
      lng: input.lng,
      zone: input.zone,
      is_minor: input.isMinor,
      guardian_name: input.guardianName,
      guardian_phone: input.guardianPhone,
      photo_consent: input.photoConsent,
      device_id: input.deviceId,
    });
    if (!error) return { code };
    if (error.code !== "23505") return { error: serverError("insert", error) };
    if (error.message.includes("submissions_year_code_key")) continue; // code taken, roll again

    // Primary-key collision: a concurrent retry of this same submission won the race.
    const { data } = await db.from("submissions").select("code, device_id").eq("id", input.id).maybeSingle();
    if (data && data.device_id === input.deviceId) return { code: data.code };
    return { error: jsonError(409, "Submission id conflict. Please try again.") };
  }
  return { error: serverError("code-exhausted", null) };
}

function ok(body: InitResponse) {
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}

function serverError(step: string, error: unknown) {
  console.error(`[submissions/init] ${step} failed`, error);
  return jsonError(500, "Something went wrong on our end. We'll keep trying.");
}
