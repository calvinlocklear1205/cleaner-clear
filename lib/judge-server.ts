import "server-only";
import { cookies } from "next/headers";
import { JUDGE_COOKIE, readSessionToken } from "@/lib/judge-auth";
import { jsonError } from "@/lib/api";

/** The signed-in judge's name, or null. Call in every judge route handler. */
export async function currentJudge(): Promise<string | null> {
  const jar = await cookies();
  return readSessionToken(jar.get(JUDGE_COOKIE)?.value);
}

export function unauthorized() {
  return jsonError(401, "Judges only.");
}
