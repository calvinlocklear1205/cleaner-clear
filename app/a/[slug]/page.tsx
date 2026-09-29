import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { event, getCategory } from "@/config/event";
import { loadPublicAlbum, type PublicAlbum } from "@/lib/album";
import { RANK_LABEL } from "@/lib/judge-types";
import { statLines } from "@/lib/share-card";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/a/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const album = await loadPublicAlbum(slug);
  if (!album) return { title: "Album not found", robots: { index: false } };
  const description = `${statLines(album).join(" · ")} at the ${event.cleanup}.`;
  return {
    title: album.title,
    description,
    robots: { index: false, follow: false },
    openGraph: { title: album.title, description, type: "website" },
    twitter: { card: "summary_large_image", title: album.title, description },
  };
}

export default async function AlbumPage({ params }: PageProps<"/a/[slug]">) {
  const { slug } = await params;
  const album = await loadPublicAlbum(slug);
  if (!album) notFound();

  const wins = album.photos.filter((p) => p.winnerRank).sort((a, b) => a.winnerRank! - b.winnerRank!);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 pt-6 pb-10">
      <header className="flex flex-col items-center gap-2 text-center">
        <Image src="/brand/badge-2026.webp" alt="" width={112} height={112} priority className="size-28" />
        <p className="text-sm font-bold tracking-wide text-river-900 uppercase">{event.cleanup}</p>
        <h1 className="font-display text-5xl leading-none tracking-wide text-grape-700">{album.title}</h1>
        {album.teamName && <p className="text-lg text-river-900">Team {album.teamName}</p>}
      </header>

      <Stats album={album} />

      {wins.length > 0 && (
        <section className="outlined flex flex-col gap-2 rounded-2xl bg-fish-500 p-4">
          <h2 className="font-display text-3xl tracking-wide">Winner!</h2>
          {wins.map((p) => (
            <p key={p.id} className="text-xl font-bold">
              {RANK_LABEL[p.winnerRank!]} · {getCategory(p.categoryId)?.label ?? p.categoryId}
            </p>
          ))}
        </section>
      )}

      {album.photos.length === 0 ? (
        <p className="py-8 text-center text-xl">Photos are on their way. Check back soon!</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3">
          {album.photos.map((p) => {
            const category = getCategory(p.categoryId);
            return (
              <li key={p.id} className="outlined flex flex-col overflow-hidden rounded-xl bg-white">
                <a href={p.photoUrl ?? undefined} target="_blank" rel="noreferrer" className="relative block">
                  {/* eslint-disable-next-line @next/next/no-img-element -- signed Supabase URL */}
                  <img
                    src={p.thumbUrl ?? ""}
                    alt={category?.label ?? "Trash find"}
                    loading="lazy"
                    className="aspect-square w-full object-cover"
                  />
                  {p.winnerRank && (
                    <span className="absolute top-1.5 left-1.5 rounded-lg border-2 border-ink bg-white px-2 text-sm font-bold">
                      {RANK_LABEL[p.winnerRank]}
                    </span>
                  )}
                </a>
                <div className="flex flex-col px-2 py-1.5">
                  <p className="truncate text-sm font-bold">
                    {category?.emoji} {category?.label ?? p.categoryId}
                  </p>
                  {p.weightLbs !== null && <p className="text-sm">{p.weightLbs} lbs</p>}
                  {p.note && <p className="text-sm text-river-900">“{p.note}”</p>}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {album.event.volunteers > 1 && (
        <p className="rounded-2xl bg-mint-100 px-4 py-3 text-center text-lg">
          One of <strong>{album.event.volunteers}</strong> volunteers who logged <strong>{album.event.entries}</strong>{" "}
          finds
          {album.event.pounds > 0 && (
            <>
              {" "}
              and <strong>{album.event.pounds.toLocaleString()} lbs</strong> of trash
            </>
          )}{" "}
          from Clear Creek.
        </p>
      )}

      <Link
        href="/"
        className="outlined tap flex items-center justify-center rounded-2xl bg-river-700 px-6 py-3 text-center font-display text-3xl tracking-wide text-white"
      >
        Join the next cleanup
      </Link>
    </main>
  );
}

function Stats({ album }: { album: PublicAlbum }) {
  const { photos, pounds, categories, minutes } = album.stats;
  const wins = album.photos.filter((p) => p.winnerRank !== null).length;
  const tiles: [string, string, string][] = [
    ["📸", String(photos), photos === 1 ? "find" : "finds"],
    pounds > 0 ? ["🏋️", String(pounds), "lbs weighed"] : ["🏅", String(wins), wins === 1 ? "award" : "awards"],
    ["🗂️", String(categories), categories === 1 ? "category" : "categories"],
    ["⏱️", minutes === null ? "—" : formatDuration(minutes), "on the river"],
  ];
  return (
    <dl className="grid grid-cols-2 gap-3">
      {tiles.map(([emoji, value, label]) => (
        <div key={label} className="outlined flex flex-col items-center rounded-xl bg-white px-2 py-3 text-center">
          <span className="text-2xl" aria-hidden>
            {emoji}
          </span>
          <dd className="font-display text-4xl leading-none tracking-wide text-grape-700">{value}</dd>
          <dt className="text-sm font-semibold text-river-900">{label}</dt>
        </div>
      ))}
    </dl>
  );
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
