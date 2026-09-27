import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api";
import { passcodeMatches } from "@/lib/judge-auth";
import { loadWall } from "@/lib/wall";

/** GET ?key=<JUDGE_PASSCODE> → recent non-hidden slides for /wall. */
export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key") ?? "";
  if (!key || !(await passcodeMatches(key))) return jsonError(401, "Bad key.");
  try {
    return NextResponse.json(await loadWall(), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[wall] load failed", e);
    return jsonError(500, "Couldn't load.");
  }
}
