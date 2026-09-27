import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/api";
import { deleteSubmissions, loadDetail } from "@/lib/judge-data";
import { currentJudge, unauthorized } from "@/lib/judge-server";
import { isUuid } from "@/lib/submission";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function GET(_request: Request, ctx: RouteContext<"/api/judge/submissions/[id]">) {
  const judge = await currentJudge();
  if (!judge) return unauthorized();
  const { id } = await ctx.params;
  if (!isUuid(id)) return jsonError(404, "Not found.");
  try {
    const detail = await loadDetail(id, judge);
    if (!detail) return jsonError(404, "Not found.");
    return NextResponse.json(detail, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[judge/submission] load failed", e);
    return jsonError(500, "Couldn't load this submission.");
  }
}

/** Body: { hidden?: boolean, winnerRank?: 1 | 2 | 3 | null } */
export async function PATCH(request: Request, ctx: RouteContext<"/api/judge/submissions/[id]">) {
  const judge = await currentJudge();
  if (!judge) return unauthorized();
  const { id } = await ctx.params;
  if (!isUuid(id)) return jsonError(404, "Not found.");

  const body = (await readJson(request)) as { hidden?: unknown; winnerRank?: unknown } | null;
  const patch: { hidden?: boolean; winner_rank?: number | null } = {};
  if (typeof body?.hidden === "boolean") patch.hidden = body.hidden;
  if (body && "winnerRank" in body) {
    const r = body.winnerRank;
    if (r !== null && r !== 1 && r !== 2 && r !== 3) return jsonError(400, "Invalid rank.");
    patch.winner_rank = r;
  }
  if (Object.keys(patch).length === 0) return jsonError(400, "Nothing to change.");

  const db = supabaseAdmin();
  const { data: row, error } = await db
    .from("submissions")
    .select("event_year, category_id")
    .eq("id", id)
    .maybeSingle();
  if (error) return fail("lookup", error);
  if (!row) return jsonError(404, "Not found.");

  // Each rank belongs to one entry per category: move it off whoever has it now.
  if (patch.winner_rank) {
    const { error: clearError } = await db
      .from("submissions")
      .update({ winner_rank: null })
      .eq("event_year", row.event_year)
      .eq("category_id", row.category_id)
      .eq("winner_rank", patch.winner_rank)
      .neq("id", id);
    if (clearError) return fail("clear-rank", clearError);
  }

  const { error: updateError } = await db.from("submissions").update(patch).eq("id", id);
  if (updateError) return fail("update", updateError);

  console.info(`[judge] ${judge} updated ${id}`, patch);
  return NextResponse.json({ ok: true });
}

/** Permanently deletes the entry and its photos (e.g. a test entry). */
export async function DELETE(_request: Request, ctx: RouteContext<"/api/judge/submissions/[id]">) {
  const judge = await currentJudge();
  if (!judge) return unauthorized();
  const { id } = await ctx.params;
  if (!isUuid(id)) return jsonError(404, "Not found.");
  try {
    const deleted = await deleteSubmissions([id]);
    if (!deleted) return jsonError(404, "Not found.");
    console.info(`[judge] ${judge} deleted ${id}`);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail("delete", e);
  }
}

function fail(step: string, error: unknown) {
  console.error(`[judge/submission] ${step} failed`, error);
  return jsonError(500, "Couldn't save that change.");
}
