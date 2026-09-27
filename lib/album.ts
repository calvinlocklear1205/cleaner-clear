import "server-only";
import { randomInt } from "node:crypto";
import { event } from "@/config/event";
import type { WinnerRank } from "@/lib/judge-types";
import { thumbPath } from "@/lib/submission";
import { SUBMISSIONS_BUCKET, supabaseAdmin } from "@/lib/supabase/server";

export const TITLE_MAX = 60;

export type AlbumInfo = { slug: string; title: string; shared: boolean };

export type AlbumPhoto = {
  id: string;
  categoryId: string;
  note: string | null;
  weightLbs: number | null;
  winnerRank: WinnerRank | null;
  createdAt: string;
  photoUrl: string | null;
  thumbUrl: string | null;
};

export type PublicAlbum = {
  slug: string;
  title: string;
  teamName: string | null;
  photos: AlbumPhoto[];
  stats: { photos: number; pounds: number; categories: number; minutes: number | null };
  event: { entries: number; volunteers: number; pounds: number };
};

const SLUG_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

function makeSlug(): string {
  let s = "";
  for (let i = 0; i < 12; i++) s += SLUG_ALPHABET[randomInt(SLUG_ALPHABET.length)];
  return s;
}

export function cleanTitle(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim().replace(/\s+/g, " ").slice(0, TITLE_MAX);
  return t || null;
}

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]{12}$/.test(slug);
}

export async function getAlbum(deviceId: string): Promise<AlbumInfo | null> {
  const { data, error } = await supabaseAdmin()
    .from("albums")
    .select("slug, title, revoked_at")
    .eq("event_year", event.year)
    .eq("device_id", deviceId)
    .maybeSingle();
  if (error) throw error;
  return data ? { slug: data.slug, title: data.title, shared: data.revoked_at === null } : null;
}

/** Creates the device's album, or renames it and turns sharing back on. */
export async function saveAlbum(deviceId: string, title: string): Promise<AlbumInfo> {
  const db = supabaseAdmin();
  const existing = await getAlbum(deviceId);
  if (existing) {
    const { error } = await db
      .from("albums")
      .update({ title, revoked_at: null })
      .eq("event_year", event.year)
      .eq("device_id", deviceId);
    if (error) throw error;
    return { slug: existing.slug, title, shared: true };
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = makeSlug();
    const { error } = await db.from("albums").insert({ slug, event_year: event.year, device_id: deviceId, title });
    if (!error) return { slug, title, shared: true };
    if (error.code !== "23505") throw error;
    // Same device raced another request: return what won.
    const raced = await getAlbum(deviceId);
    if (raced) return saveAlbum(deviceId, title);
  }
  throw new Error("Couldn't allocate an album link");
}

export async function stopSharing(deviceId: string): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("albums")
    .update({ revoked_at: new Date().toISOString() })
    .eq("event_year", event.year)
    .eq("device_id", deviceId);
  if (error) throw error;
}

const URL_TTL_S = 6 * 60 * 60;

/**
 * Everything the public album page shows. Deliberately excludes names,
 * phone numbers, prize codes, judge scores and hidden entries.
 */
export async function loadPublicAlbum(slug: string): Promise<PublicAlbum | null> {
  if (!isValidSlug(slug)) return null;
  const db = supabaseAdmin();
  const { data: album, error } = await db
    .from("albums")
    .select("slug, title, device_id, event_year, revoked_at")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!album || album.revoked_at) return null;

  const [{ data: rows, error: rowsError }, { data: all, error: allError }] = await Promise.all([
    db
      .from("submissions")
      .select("id, category_id, note, weight_lbs, winner_rank, created_at, photo_path, team_name")
      .eq("event_year", album.event_year)
      .eq("device_id", album.device_id)
      .eq("hidden", false)
      .not("uploaded_at", "is", null)
      .order("created_at", { ascending: true }),
    db
      .from("submissions")
      .select("device_id, weight_lbs")
      .eq("event_year", album.event_year)
      .eq("hidden", false)
      .not("uploaded_at", "is", null)
      .limit(5000),
  ]);
  if (rowsError) throw rowsError;
  if (allError) throw allError;

  const bucket = db.storage.from(SUBMISSIONS_BUCKET);
  const [full, thumbs] = await Promise.all([
    rows.length
      ? bucket.createSignedUrls(
          rows.map((r) => r.photo_path),
          URL_TTL_S,
        )
      : { data: [] },
    rows.length
      ? bucket.createSignedUrls(
          rows.map((r) => thumbPath(r.id)),
          URL_TTL_S,
        )
      : { data: [] },
  ]);

  const photos: AlbumPhoto[] = rows.map((r, i) => {
    const photoUrl = full.data?.[i]?.signedUrl ?? null;
    const t = thumbs.data?.[i];
    return {
      id: r.id,
      categoryId: r.category_id,
      note: r.note,
      weightLbs: r.weight_lbs === null ? null : Number(r.weight_lbs),
      winnerRank: (r.winner_rank as WinnerRank | null) ?? null,
      createdAt: r.created_at,
      photoUrl,
      thumbUrl: t && !t.error && t.signedUrl ? t.signedUrl : photoUrl,
    };
  });

  const sumLbs = (xs: { weight_lbs: number | string | null }[]) =>
    Math.round(xs.reduce((s, x) => s + (x.weight_lbs === null ? 0 : Number(x.weight_lbs)), 0) * 10) / 10;
  const first = rows[0] ? Date.parse(rows[0].created_at) : 0;
  const last = rows.length ? Date.parse(rows[rows.length - 1].created_at) : 0;

  return {
    slug: album.slug,
    title: album.title,
    teamName: [...rows].reverse().find((r) => r.team_name)?.team_name ?? null,
    photos,
    stats: {
      photos: rows.length,
      pounds: sumLbs(rows),
      categories: new Set(rows.map((r) => r.category_id)).size,
      minutes: rows.length > 1 ? Math.round((last - first) / 60_000) : null,
    },
    event: {
      entries: all.length,
      volunteers: new Set(all.map((r) => r.device_id)).size,
      pounds: sumLbs(all),
    },
  };
}
