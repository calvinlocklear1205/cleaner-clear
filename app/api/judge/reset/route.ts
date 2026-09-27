import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/api";
import { deleteSubmissions } from "@/lib/judge-data";
import { currentJudge, unauthorized } from "@/lib/judge-server";

/** "Start fresh": deletes every entry, vote, hazard and photo this year. Body: { confirm: "DELETE" } */
export async function POST(request: Request) {
  const judge = await currentJudge();
  if (!judge) return unauthorized();
  const body = (await readJson(request)) as { confirm?: unknown } | null;
  if (body?.confirm !== "DELETE") return jsonError(400, "Type DELETE to confirm.");
  try {
    const deleted = await deleteSubmissions();
    console.warn(`[judge] ${judge} deleted ALL ${deleted} entries (start fresh)`);
    return NextResponse.json({ ok: true, deleted });
  } catch (e) {
    console.error("[judge/reset] failed", e);
    return jsonError(500, "Couldn't delete everything. Try again.");
  }
}
