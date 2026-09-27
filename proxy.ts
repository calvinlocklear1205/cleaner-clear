import { NextResponse, type NextRequest } from "next/server";
import { JUDGE_COOKIE, readSessionToken } from "@/lib/judge-auth";

/**
 * Gate for /judge/* and /api/judge/*. Route handlers check the session again
 * (lib/judge-server.ts) — this is the first line, not the only one.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/judge/login" || pathname === "/api/judge/login") return NextResponse.next();

  const judge = await readSessionToken(request.cookies.get(JUDGE_COOKIE)?.value);
  if (judge) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Judges only." }, { status: 401 });
  }
  const login = new URL("/judge/login", request.url);
  if (pathname !== "/judge") login.searchParams.set("next", pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/judge", "/judge/:path*", "/api/judge/:path*"],
};
