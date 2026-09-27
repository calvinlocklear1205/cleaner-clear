import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/api";
import { createSessionToken, JUDGE_COOKIE, passcodeMatches, SESSION_MAX_AGE_S } from "@/lib/judge-auth";

export async function POST(request: Request) {
  const body = (await readJson(request)) as { passcode?: unknown; name?: unknown } | null;
  const passcode = typeof body?.passcode === "string" ? body.passcode : "";
  const name = typeof body?.name === "string" ? body.name.trim().replace(/\s+/g, " ").slice(0, 60) : "";

  if (!passcode || !(await passcodeMatches(passcode))) {
    // Slow down guessing a little. Use a long passcode; this is not a lockout.
    await new Promise((r) => setTimeout(r, 750));
    return jsonError(401, "That passcode didn't work.", "passcode");
  }
  if (!name) return jsonError(400, "Tell us your name so votes are counted separately.", "name");

  const res = NextResponse.json({ ok: true, name });
  res.cookies.set(JUDGE_COOKIE, await createSessionToken(name), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_S,
  });
  return res;
}
