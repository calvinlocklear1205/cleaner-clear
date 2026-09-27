import "server-only";
import { event } from "@/config/event";
import { SUBMISSIONS_BUCKET, supabaseAdmin } from "@/lib/supabase/server";

/** Public-safe slide data: photo, category and team name only. Never contact info. */
export type WallSlide = { id: string; photoUrl: string; categoryId: string; teamName: string | null };

export async function loadWall(limit = 40): Promise<WallSlide[]> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("submissions")
    .select("id, photo_path, category_id, team_name")
    .eq("event_year", event.year)
    .eq("hidden", false)
    .not("uploaded_at", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  if (!data.length) return [];

  const { data: signed } = await db.storage.from(SUBMISSIONS_BUCKET).createSignedUrls(
    data.map((r) => r.photo_path),
    2 * 60 * 60,
  );
  return data.flatMap((r, i) => {
    const url = signed?.[i]?.signedUrl;
    return url ? [{ id: r.id, photoUrl: url, categoryId: r.category_id, teamName: r.team_name }] : [];
  });
}
