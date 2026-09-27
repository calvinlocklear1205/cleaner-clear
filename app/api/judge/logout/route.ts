import { NextResponse } from "next/server";
import { JUDGE_COOKIE } from "@/lib/judge-auth";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(JUDGE_COOKIE);
  return res;
}
