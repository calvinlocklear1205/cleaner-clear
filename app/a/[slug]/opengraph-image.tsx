import { ImageResponse } from "next/og";
import { loadPublicAlbum } from "@/lib/album";
import { badgeUrl, imageOptions, OgCard } from "@/lib/share-card";

export const alt = "A trash album from the Clear Creek Cleanup";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const album = await loadPublicAlbum(slug);
  if (!album) return new Response("Not found", { status: 404 });
  return new ImageResponse(<OgCard a={album} badge={await badgeUrl()} />, { ...size, ...(await imageOptions()) });
}
