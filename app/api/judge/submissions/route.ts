import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { loadFeed } from "@/lib/judge-data";
import { currentJudge, unauthorized } from "@/lib/judge-server";

export async function GET() {
  const judge = await currentJudge();
  if (!judge) return unauthorized();
  try {
    const items = await loadFeed(judge);
    return NextResponse.json({ judge, items }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[judge/submissions] load failed", e);
    return jsonError(500, "Couldn't load submissions.");
  }
}
