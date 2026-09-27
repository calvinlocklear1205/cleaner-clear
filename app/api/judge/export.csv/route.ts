import { event } from "@/config/event";
import { jsonError } from "@/lib/api";
import { currentJudge, unauthorized } from "@/lib/judge-server";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * All of this year's submissions for the sponsor/city report. Deliberately
 * excludes names and phone numbers.
 */
export async function GET() {
  if (!(await currentJudge())) return unauthorized();

  const { data, error } = await supabaseAdmin()
    .from("submissions")
    .select(
      "code, category_id, created_at, uploaded_at, weight_lbs, zone, lat, lng, team_name, note, photo_consent, is_minor, hidden, winner_rank, photo_path, votes(score)",
    )
    .eq("event_year", event.year)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[export] failed", error);
    return jsonError(500, "Export failed.");
  }

  const header = [
    "code",
    "category",
    "submitted_at_denver",
    "uploaded",
    "weight_lbs",
    "zone",
    "lat",
    "lng",
    "team_name",
    "note",
    "photo_consent",
    "is_minor",
    "hidden",
    "winner_rank",
    "avg_score",
    "votes",
    "photo_path",
  ];
  const rows = data.map((r) => {
    const scores = (r.votes as { score: number }[]).map((v) => v.score);
    const avg = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2) : "";
    return [
      r.code,
      r.category_id,
      new Date(r.created_at).toLocaleString("sv-SE", { timeZone: "America/Denver" }),
      r.uploaded_at ? "yes" : "no",
      r.weight_lbs,
      r.zone,
      r.lat,
      r.lng,
      r.team_name,
      r.note,
      r.photo_consent ? "yes" : "no",
      r.is_minor ? "yes" : "no",
      r.hidden ? "yes" : "no",
      r.winner_rank,
      avg,
      scores.length,
      r.photo_path,
    ];
  });

  const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
  return new Response("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cleaner-clear-${event.year}-submissions.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s = String(value);
  // Neutralize spreadsheet formula injection in user-entered text (not numbers like -104.98).
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
