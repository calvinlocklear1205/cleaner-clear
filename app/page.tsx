import Image from "next/image";
import { event, isSubmissionsOpen } from "@/config/event";

export const dynamic = "force-dynamic";

// Phase 1 placeholder. The real submit flow lands in Phase 2.
export default function Home() {
  const open = isSubmissionsOpen();

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center gap-6 px-4 py-8 text-center">
      <Image
        src="/brand/badge-2026.webp"
        alt={`${event.cleanup} ${event.year} — ${event.name}`}
        width={320}
        height={320}
        priority
        className="h-auto w-72"
      />

      <h1 className="font-display text-5xl leading-none tracking-wide text-balance text-grape-700">
        Grab it. Snap it. Send it.
      </h1>

      {open ? (
        <p className="text-lg">Submissions are open. The camera button is coming soon.</p>
      ) : (
        <p className="outlined rounded-2xl bg-mint-100 px-5 py-4 text-lg font-semibold">
          Submissions are closed — thanks for hauling!
        </p>
      )}

      <ul className="grid w-full gap-3 text-left">
        {event.categories.map((c) => (
          <li key={c.id} className="outlined tap flex items-center gap-3 rounded-xl bg-white px-4 py-3">
            <span className="text-3xl" aria-hidden>
              {c.emoji}
            </span>
            <span>
              <span className="block font-display text-2xl leading-none tracking-wide text-balance text-grape-700">
                {c.label}
              </span>
              <span className="text-base text-river-900">{c.blurb}</span>
            </span>
          </li>
        ))}
      </ul>
    </main>
  );
}
