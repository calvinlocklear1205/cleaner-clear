import "server-only";
import { NextResponse } from "next/server";

export function jsonError(status: number, error: string, field?: string) {
  return NextResponse.json(field ? { error, field } : { error }, {
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
