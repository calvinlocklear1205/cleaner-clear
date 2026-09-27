import { ImageResponse } from "next/og";
import { loadPublicAlbum } from "@/lib/album";
import { badgeUrl, imageOptions, StoryCard } from "@/lib/share-card";

/** 1080×1920 story image for Instagram / Facebook stories. */
export async function GET(_request: Request, ctx: RouteContext<"/a/[slug]/story">) {
  const { slug } = await ctx.params;
  const album = await loadPublicAlbum(slug);
  if (!album) return new Response("Not found", { status: 404 });
  return new ImageResponse(<StoryCard a={album} badge={await badgeUrl()} />, {
    width: 1080,
    height: 1920,
    ...(await imageOptions()),
    headers: {
      "Content-Disposition": `inline; filename="clear-creek-trash-${slug}.png"`,
      "Cache-Control": "no-store",
    },
  });
}
