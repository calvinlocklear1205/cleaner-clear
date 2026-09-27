import "server-only";
import { headers } from "next/headers";
import { event, getCategory } from "@/config/event";
import type { PublicAlbum } from "@/lib/album";
import type { WinnerRank } from "@/lib/judge-types";

/*
 * Share images rendered with next/og (Satori): flexbox only, inline styles,
 * PNG/JPEG images only (hence the PNG badge), ttf/otf fonts only.
 */

const MINT = "#d4f7e4";
const GRAPE = "#5b2a86";
const RIVER = "#1e6b47";
const INK = "#111111";
const FISH = "#f28c1e";
// Medals are drawn, not emoji: emoji in Satori needs a runtime CDN fetch.
const MEDAL_COLOR: Record<WinnerRank, string> = { 1: "#f5c518", 2: "#c9d1d9", 3: "#d08a4a" };
const PLACE: Record<WinnerRank, string> = { 1: "Winner", 2: "2nd place", 3: "3rd place" };

function Medal({ rank, size }: { rank: WinnerRank; size: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: 999,
        background: MEDAL_COLOR[rank],
        border: `${Math.max(3, size / 12)}px solid ${INK}`,
        fontFamily: "Bebas",
        fontSize: size * 0.62,
        color: INK,
      }}
    >
      {rank}
    </div>
  );
}

let bebas: Promise<ArrayBuffer | null> | undefined;

/** Bebas Neue for headlines, fetched once per server instance; falls back to the default font. */
export function loadDisplayFont(): Promise<ArrayBuffer | null> {
  bebas ??= (async () => {
    try {
      // Without a browser user agent Google Fonts serves TrueType, which Satori needs.
      const css = await (await fetch("https://fonts.googleapis.com/css2?family=Bebas+Neue")).text();
      const url = css.match(/src:\s*url\(([^)]+)\)\s*format\('(?:truetype|opentype)'\)/)?.[1];
      return url ? await (await fetch(url)).arrayBuffer() : null;
    } catch {
      return null;
    }
  })();
  return bebas;
}

/** Options shared by both share images. */
export async function imageOptions() {
  return { fonts: await imageFonts() };
}

export async function imageFonts() {
  const data = await loadDisplayFont();
  return data ? [{ name: "Bebas", data, weight: 400 as const, style: "normal" as const }] : [];
}

export async function badgeUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "clearcreektrash.com";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}/brand/badge-2026-240.png`;
}

export function statLines(a: PublicAlbum): string[] {
  const lines = [`${a.stats.photos} ${a.stats.photos === 1 ? "find" : "finds"}`];
  if (a.stats.pounds > 0) lines.push(`${a.stats.pounds} lbs hauled`);
  if (a.stats.categories > 0)
    lines.push(`${a.stats.categories} ${a.stats.categories === 1 ? "category" : "categories"}`);
  return lines;
}

export function winLines(a: PublicAlbum): { rank: WinnerRank; text: string }[] {
  return a.photos
    .filter((p) => p.winnerRank)
    .sort((x, y) => x.winnerRank! - y.winnerRank!)
    .map((p) => ({
      rank: p.winnerRank!,
      text: `${PLACE[p.winnerRank!]} · ${getCategory(p.categoryId)?.label ?? p.categoryId}`,
    }));
}

/** Up to four photos, winners first. */
function pickPhotos(a: PublicAlbum, n: number) {
  return [...a.photos]
    .sort((x, y) => (x.winnerRank ?? 9) - (y.winnerRank ?? 9))
    .filter((p) => p.thumbUrl)
    .slice(0, n);
}

function Collage({ a, size, gap }: { a: PublicAlbum; size: number; gap: number }) {
  const photos = pickPhotos(a, 4);
  const cell = photos.length <= 1 ? size : (size - gap) / 2;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", width: size, height: size, gap }}>
      {photos.length === 0 ? (
        <div
          style={{
            display: "flex",
            width: size,
            height: size,
            alignItems: "center",
            justifyContent: "center",
            background: "#fff",
            borderRadius: 24,
            border: `6px solid ${INK}`,
            fontSize: 120,
          }}
        >
          🗑️
        </div>
      ) : (
        photos.map((p) => (
          <div key={p.id} style={{ display: "flex", position: "relative" }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- Satori */}
            <img
              src={p.thumbUrl!}
              alt=""
              width={cell}
              height={cell}
              style={{ objectFit: "cover", borderRadius: 20, border: `5px solid ${INK}` }}
            />
            {p.winnerRank && (
              <div style={{ display: "flex", position: "absolute", top: 14, left: 14 }}>
                <Medal rank={p.winnerRank} size={Math.round(cell / 5)} />
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

/** 1200×630 link preview (iMessage, Facebook, Slack…). */
export function OgCard({ a, badge }: { a: PublicAlbum; badge: string }) {
  const wins = winLines(a);
  return (
    <div style={{ display: "flex", width: 1200, height: 630, background: MINT, padding: 44, gap: 44, color: INK }}>
      <Collage a={a} size={542} gap={14} />
      <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- Satori */}
          <img src={badge} alt="" width={96} height={96} />
          <div style={{ display: "flex", fontSize: 26, color: RIVER, fontWeight: 700 }}>{event.cleanup}</div>
        </div>
        <div style={{ display: "flex", fontFamily: "Bebas", fontSize: 76, lineHeight: 1, color: GRAPE }}>{a.title}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 34, fontWeight: 700 }}>
          {wins.slice(0, 2).map((w) => (
            <div key={w.text} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Medal rank={w.rank} size={40} />
              {w.text}
            </div>
          ))}
          {statLines(a)
            .slice(0, 4 - Math.min(wins.length, 2))
            .map((l) => (
              <div key={l} style={{ display: "flex" }}>
                {l}
              </div>
            ))}
        </div>
        <div style={{ display: "flex", fontSize: 26, color: RIVER }}>clearcreektrash.com</div>
      </div>
    </div>
  );
}

/** 1080×1920 Instagram/Facebook story. */
export function StoryCard({ a, badge }: { a: PublicAlbum; badge: string }) {
  const wins = winLines(a);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width: 1080,
        height: 1920,
        background: MINT,
        padding: "110px 80px",
        color: INK,
        justifyContent: "space-between",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- Satori */}
        <img src={badge} alt="" width={220} height={220} />
        <div style={{ display: "flex", fontSize: 36, fontWeight: 700, color: RIVER }}>{event.cleanup}</div>
        <div
          style={{
            display: "flex",
            fontFamily: "Bebas",
            fontSize: 124,
            lineHeight: 1,
            color: GRAPE,
            textAlign: "center",
            justifyContent: "center",
          }}
        >
          {a.title}
        </div>
      </div>
      <Collage a={a} size={900} gap={20} />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
        {wins.length > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 20,
              background: FISH,
              border: `6px solid ${INK}`,
              borderRadius: 999,
              padding: "12px 40px",
              fontSize: 44,
              fontWeight: 700,
            }}
          >
            <Medal rank={wins[0].rank} size={60} />
            {wins[0].text}
          </div>
        )}
        <div style={{ display: "flex", fontSize: 50, fontWeight: 700 }}>{statLines(a).join(" · ")}</div>
        <div style={{ display: "flex", fontSize: 38, color: RIVER }}>clearcreektrash.com</div>
      </div>
    </div>
  );
}
