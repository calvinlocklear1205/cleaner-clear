import "server-only";
import { event } from "@/config/event";
import type { FeedItem, SubmissionDetail, WinnerRank } from "@/lib/judge-types";
import { thumbPath } from "@/lib/submission";
import { SUBMISSIONS_BUCKET, supabaseAdmin } from "@/lib/supabase/server";

/** Signed photo URLs last long enough that polling can keep reusing them. */
const URL_TTL_S = 6 * 60 * 60;

// Judges see who submitted each entry (name here; phone numbers in the detail
// view). None of this ever reaches the public pages or the wall.
const FEED_COLUMNS =
  "id, code, category_id, created_at, name, weight_lbs, team_name, hidden, winner_rank, photo_path, votes(judge_name, score)";

type Row = {
  id: string;
  code: string;
  category_id: string;
  created_at: string;
  name: string | null;
  weight_lbs: number | string | null;
  team_name: string | null;
  hidden: boolean;
  winner_rank: number | null;
  photo_path: string;
  votes: { judge_name: string; score: number }[];
};

function toItem(r: Row, judge: string, thumbUrl: string | null): FeedItem {
  const scores = r.votes.map((v) => v.score);
  const mine = r.votes.find((v) => v.judge_name === judge);
  return {
    id: r.id,
    code: r.code,
    categoryId: r.category_id,
    createdAt: r.created_at,
    name: r.name,
    weightLbs: r.weight_lbs === null ? null : Number(r.weight_lbs),
    teamName: r.team_name,
    hidden: r.hidden,
    winnerRank: (r.winner_rank as WinnerRank | null) ?? null,
    myScore: mine?.score ?? null,
    avgScore: scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100 : null,
    voteCount: scores.length,
    thumbUrl,
  };
}

/** Thumbnail URLs, falling back to the full photo where no thumbnail was uploaded. */
async function signThumbs(rows: Row[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (rows.length === 0) return out;
  const bucket = supabaseAdmin().storage.from(SUBMISSIONS_BUCKET);

  const { data: thumbs } = await bucket.createSignedUrls(
    rows.map((r) => thumbPath(r.id)),
    URL_TTL_S,
  );
  const missing: Row[] = [];
  rows.forEach((r, i) => {
    const t = thumbs?.[i];
    if (t && !t.error && t.signedUrl) out.set(r.id, t.signedUrl);
    else missing.push(r);
  });

  if (missing.length) {
    const { data: full } = await bucket.createSignedUrls(
      missing.map((r) => r.photo_path),
      URL_TTL_S,
    );
    missing.forEach((r, i) => {
      const f = full?.[i];
      if (f && !f.error && f.signedUrl) out.set(r.id, f.signedUrl);
    });
  }
  return out;
}

/** Every uploaded submission this year (hidden included; the client filters). */
export async function loadFeed(judge: string): Promise<FeedItem[]> {
  const { data, error } = await supabaseAdmin()
    .from("submissions")
    .select(FEED_COLUMNS)
    .eq("event_year", event.year)
    .not("uploaded_at", "is", null)
    .order("created_at", { ascending: false })
    .limit(2000);
  if (error) throw error;
  const rows = data as unknown as Row[];
  const urls = await signThumbs(rows);
  return rows.map((r) => toItem(r, judge, urls.get(r.id) ?? null));
}

export async function loadDetail(id: string, judge: string): Promise<SubmissionDetail | null> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("submissions")
    .select(`${FEED_COLUMNS}, note, zone, lat, lng, is_minor, photo_consent`)
    .eq("id", id)
    .eq("event_year", event.year)
    .not("uploaded_at", "is", null)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const r = data as unknown as Row & {
    note: string | null;
    zone: string | null;
    lat: number | null;
    lng: number | null;
    is_minor: boolean;
    photo_consent: boolean;
  };

  const [urls, photo] = await Promise.all([
    signThumbs([r]),
    db.storage.from(SUBMISSIONS_BUCKET).createSignedUrl(r.photo_path, URL_TTL_S),
  ]);

  const { data: c, error: cErr } = await db
    .from("submissions")
    .select("name, phone, guardian_name, guardian_phone")
    .eq("id", id)
    .single();
  if (cErr) throw cErr;
  const contact: SubmissionDetail["contact"] = {
    name: c.name,
    phone: c.phone,
    guardianName: c.guardian_name,
    guardianPhone: c.guardian_phone,
  };

  return {
    ...toItem(r, judge, urls.get(r.id) ?? null),
    photoUrl: photo.data?.signedUrl ?? null,
    note: r.note,
    zone: r.zone,
    lat: r.lat,
    lng: r.lng,
    isMinor: r.is_minor,
    photoConsent: r.photo_consent,
    contact,
  };
}

/** Code → id, for the prize-tent lookup. Tolerates "#b47", " B47 ", etc. */
export async function findByCode(raw: string): Promise<string | null> {
  const code = raw.trim().replace(/^#/, "").toUpperCase();
  if (!/^[A-Z0-9]{2,8}$/.test(code)) return null;
  const { data, error } = await supabaseAdmin()
    .from("submissions")
    .select("id")
    .eq("event_year", event.year)
    .eq("code", code)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

/**
 * Permanently deletes submissions (votes cascade) and their photo files.
 * `ids` = specific entries; omitted = every entry this year plus hazards
 * ("start fresh" after testing).
 */
export async function deleteSubmissions(ids?: string[]): Promise<number> {
  const db = supabaseAdmin();
  let query = db.from("submissions").select("id, photo_path").eq("event_year", event.year);
  if (ids) query = query.in("id", ids);
  const { data, error } = await query;
  if (error) throw error;

  const bucket = db.storage.from(SUBMISSIONS_BUCKET);
  const paths = data.flatMap((r) => [r.photo_path, thumbPath(r.id)]);
  if (!ids) {
    // Also sweep orphans (e.g. uploads whose entry never completed) and hazard photos.
    for (const prefix of [`${event.year}`, `${event.year}/hazards`]) {
      for (let offset = 0; ; offset += 1000) {
        const { data: files, error: listError } = await bucket.list(prefix, { limit: 1000, offset });
        if (listError) throw listError;
        paths.push(...files.filter((f) => f.id).map((f) => `${prefix}/${f.name}`));
        if (files.length < 1000) break;
      }
    }
  }
  const unique = [...new Set(paths)];
  for (let i = 0; i < unique.length; i += 100) {
    const { error: removeError } = await bucket.remove(unique.slice(i, i + 100));
    if (removeError) throw removeError;
  }

  if (data.length) {
    const { error: deleteError } = await db
      .from("submissions")
      .delete()
      .in(
        "id",
        data.map((r) => r.id),
      );
    if (deleteError) throw deleteError;
  }
  if (!ids) {
    const { error: hazardError } = await db.from("hazards").delete().eq("event_year", event.year);
    if (hazardError) throw hazardError;
    const { error: albumError } = await db.from("albums").delete().eq("event_year", event.year);
    if (albumError) throw albumError;
  }
  return data.length;
}
