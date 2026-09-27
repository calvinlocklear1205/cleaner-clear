import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/api";
import { currentJudge, unauthorized } from "@/lib/judge-server";
import { isUuid } from "@/lib/submission";
import { supabaseAdmin } from "@/lib/supabase/server";

/** Body: { score: 1–5 } or { score: null } to clear. Re-voting replaces the score. */
export async function PUT(request: Request, ctx: RouteContext<"/api/judge/submissions/[id]/vote">) {
  const judge = await currentJudge();
  if (!judge) return unauthorized();
  const { id } = await ctx.params;
  if (!isUuid(id)) return jsonError(404, "Not found.");

  const body = (await readJson(request)) as { score?: unknown } | null;
  const score = body?.score;
  const db = supabaseAdmin();

  if (score === null) {
    const { error } = await db.from("votes").delete().eq("submission_id", id).eq("judge_name", judge);
    if (error) return fail(error);
    return NextResponse.json({ ok: true });
  }
  if (typeof score !== "number" || !Number.isInteger(score) || score < 1 || score > 5) {
    return jsonError(400, "Score must be 1–5.");
  }

  const { error } = await db
    .from("votes")
    .upsert({ submission_id: id, judge_name: judge, score }, { onConflict: "submission_id,judge_name" });
  if (error) {
    if (error.code === "23503") return jsonError(404, "Not found."); // FK: no such submission
    return fail(error);
  }
  return NextResponse.json({ ok: true });
}

function fail(error: unknown) {
  console.error("[judge/vote] failed", error);
  return jsonError(500, "Couldn't save your score.");
}
