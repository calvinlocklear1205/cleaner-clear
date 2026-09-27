"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { event, getCategory } from "@/config/event";
import type { WallSlide } from "@/lib/wall";

const SLIDE_MS = 7_000;
const POLL_MS = 30_000;

export function Wall({ wallKey }: { wallKey: string }) {
  const [slides, setSlides] = useState<WallSlide[]>([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const load = () =>
      fetch(`/api/wall?key=${encodeURIComponent(wallKey)}`)
        .then((r) => (r.ok ? (r.json() as Promise<WallSlide[]>) : null))
        .then((data) => {
          if (!data) return;
          // Keep existing URLs for photos we already have so they don't re-download.
          setSlides((prev) => {
            const known = new Map(prev.map((s) => [s.id, s]));
            return data.map((s) => known.get(s.id) ?? s);
          });
        })
        .catch(() => {});
    const first = setTimeout(load, 0);
    const id = setInterval(load, POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [wallKey]);

  useEffect(() => {
    if (slides.length < 2) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % slides.length), SLIDE_MS);
    return () => clearInterval(id);
  }, [slides.length]);

  const slide = slides.length ? slides[index % slides.length] : null;
  const next = slides.length > 1 ? slides[(index + 1) % slides.length] : null;
  const category = slide ? getCategory(slide.categoryId) : null;

  return (
    <main
      className="fixed inset-0 flex cursor-pointer flex-col bg-river-950 text-white"
      onClick={() => void document.documentElement.requestFullscreen?.().catch(() => {})}
      title="Click for full screen"
    >
      <div className="relative flex-1">
        {slide ? (
          // key forces a fresh fade-in per slide
          // eslint-disable-next-line @next/next/no-img-element -- signed Supabase URL
          <img
            key={slide.id}
            src={slide.photoUrl}
            alt=""
            className="absolute inset-0 size-full animate-[fade_0.8s_ease-out] object-contain"
          />
        ) : (
          <div className="flex h-full items-center justify-center font-display text-6xl tracking-wide">
            Waiting for the first finds…
          </div>
        )}
        {/* Preload the next photo so the transition is instant. */}
        {next && <link rel="preload" as="image" href={next.photoUrl} />}
      </div>
      <footer className="flex items-center gap-6 bg-river-700 px-8 py-4">
        <Image src="/brand/badge-2026.webp" alt="" width={80} height={80} className="size-20" />
        <div className="min-w-0 flex-1">
          {slide && category && (
            <p className="truncate font-display text-6xl leading-none tracking-wide">
              {category.emoji} {category.label}
            </p>
          )}
          {slide?.teamName && <p className="truncate text-3xl">{slide.teamName}</p>}
        </div>
        <div className="text-right">
          <p className="font-display text-4xl leading-none tracking-wide">{event.name}</p>
          <p className="text-2xl opacity-80">{slides.length} finds and counting</p>
        </div>
      </footer>
    </main>
  );
}
