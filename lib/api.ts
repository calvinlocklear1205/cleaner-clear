import "server-only";
import { NextResponse } from "next/server";
import type { ApiError } from "@/lib/submission";

export function jsonError(status: number, error: string, field?: ApiError["field"]) {
  return NextResponse.json<ApiError>(field ? { error, field } : { error }, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
