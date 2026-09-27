import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api";
import { findByCode } from "@/lib/judge-data";
import { currentJudge, unauthorized } from "@/lib/judge-server";

/** Prize-tent lookup: GET ?code=B47 → { id } */
export async function GET(request: NextRequest) {
  if (!(await currentJudge())) return unauthorized();
  const code = request.nextUrl.searchParams.get("code") ?? "";
  try {
    const id = await findByCode(code);
    if (!id) return jsonError(404, `No entry with code ${code.trim().toUpperCase() || "—"}.`);
    return NextResponse.json({ id }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[judge/lookup] failed", e);
    return jsonError(500, "Lookup failed.");
  }
}
