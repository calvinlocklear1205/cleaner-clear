import { NextResponse } from "next/server";
import { cleanTitle, getAlbum, saveAlbum, stopSharing } from "@/lib/album";
import { jsonError, readJson } from "@/lib/api";

/**
 * The volunteer's own album, keyed by their device id.
 * Body: { deviceId, action: "get" | "save" | "stop", title? }
 */
export async function POST(request: Request) {
  const b = (await readJson(request)) as { deviceId?: unknown; action?: unknown; title?: unknown } | null;
  const deviceId = typeof b?.deviceId === "string" ? b.deviceId : "";
  if (deviceId.length < 8 || deviceId.length > 64) return jsonError(400, "Invalid request.");

  try {
    if (b?.action === "get") return ok(await getAlbum(deviceId));
    if (b?.action === "save") {
      const title = cleanTitle(b.title);
      if (!title) return jsonError(400, "Give your album a name.", "title");
      return ok(await saveAlbum(deviceId, title));
    }
    if (b?.action === "stop") {
      await stopSharing(deviceId);
      return ok(await getAlbum(deviceId));
    }
    return jsonError(400, "Unknown action.");
  } catch (e) {
    console.error("[album] failed", e);
    return jsonError(500, "Something went wrong. Try again.");
  }
}

function ok(body: unknown) {
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}
