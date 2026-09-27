"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { event, getCategory } from "@/config/event";
import { useJudgeFeed } from "@/lib/client/use-judge-feed";
import { compareByScore, RANK_LABEL, type FeedItem } from "@/lib/judge-types";

export function Feed() {
  const { items, error, refresh } = useJudgeFeed();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Filters live in the URL so "back" from a detail view keeps them.
  const tab = params.get("c") ?? "all";
  const sort = params.get("sort") === "score" ? "score" : "newest";
  const showHidden = params.get("hidden") === "1";
  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value === null) next.delete(key);
    else next.set(key, value);
    router.replace(`${pathname}?${next}`, { scroll: false });
  };

  if (!items) return <p className="text-lg text-river-900">{error || "Loading…"}</p>;

  const visible = items.filter((i) => showHidden || !i.hidden);
  const counts = new Map<string, number>();
  for (const i of visible) counts.set(i.categoryId, (counts.get(i.categoryId) ?? 0) + 1);

  const shown = visible.filter((i) => tab === "all" || i.categoryId === tab);
  if (sort === "score") shown.sort(compareByScore);
  const unscored = shown.filter((i) => i.myScore === null && !i.hidden).length;

  return (
    <>
      <nav className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1" aria-label="Categories">
        <Chip active={tab === "all"} onClick={() => setParam("c", null)}>
          All <Count n={visible.length} />
        </Chip>
        {event.categories.map((c) => (
          <Chip key={c.id} active={tab === c.id} onClick={() => setParam("c", c.id)}>
            {c.emoji} {c.label} <Count n={counts.get(c.id) ?? 0} />
          </Chip>
        ))}
      </nav>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl border-3 border-ink bg-white p-0.5" role="group" aria-label="Sort">
          {(["newest", "score"] as const).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={sort === s}
              onClick={() => setParam("sort", s === "newest" ? null : "score")}
              className={`min-h-11 rounded-lg px-3 font-semibold ${sort === s ? "bg-grape-700 text-white" : ""}`}
            >
              {s === "newest" ? "Newest" : "Top scored"}
            </button>
          ))}
        </div>
        <label className="tap flex items-center gap-2 px-1 font-semibold">
          <input
            type="checkbox"
            checked={showHidden}
            onChange={(e) => setParam("hidden", e.target.checked ? "1" : null)}
            className="size-6 accent-grape-700"
          />
          Show hidden
        </label>
        <button
          type="button"
          onClick={() => void refresh()}
          className="tap ml-auto rounded-xl px-2 font-semibold text-grape-700 underline"
        >
          Refresh
        </button>
      </div>

      {error && <p className="text-base font-semibold text-[#b3124e]">{error} (showing last loaded)</p>}
      <p className="text-base text-river-900">
        {shown.length} {shown.length === 1 ? "entry" : "entries"}
        {unscored > 0 && ` · ${unscored} you haven't scored`}
      </p>

      {shown.length === 0 ? (
        <p className="py-10 text-center text-xl">No entries here yet.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3">
          {shown.map((item) => (
            <Tile key={item.id} item={item} showCategory={tab === "all"} />
          ))}
        </ul>
      )}
    </>
  );
}

function Tile({ item, showCategory }: { item: FeedItem; showCategory: boolean }) {
  const category = getCategory(item.categoryId);
  return (
    <li className={item.hidden ? "opacity-50" : undefined}>
      <Link href={`/judge/s/${item.id}`} className="outlined relative block overflow-hidden rounded-xl bg-white">
        {item.thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- signed Supabase URL
          <img
            src={item.thumbUrl}
            alt={`Entry ${item.code}`}
            loading="lazy"
            className="aspect-square w-full object-cover"
          />
        ) : (
          <div className="flex aspect-square items-center justify-center bg-mint-100 text-4xl">
            {category?.emoji ?? "🗑️"}
          </div>
        )}
        <span className="absolute top-1.5 left-1.5 rounded-lg border-2 border-ink bg-white px-2 font-display text-xl leading-7">
          #{item.code}
        </span>
        <span
          className={`absolute top-1.5 right-1.5 rounded-lg border-2 border-ink px-2 text-base leading-7 font-bold ${
            item.myScore ? "bg-fish-500" : "bg-white/90 text-river-900"
          }`}
          aria-label={item.myScore ? `Your score ${item.myScore}` : "Not scored by you"}
        >
          {item.myScore ? `★${item.myScore}` : "—"}
        </span>
        <div className="flex flex-wrap items-center gap-x-2 px-2 py-1.5 text-sm font-semibold">
          {showCategory && <span aria-label={category?.label}>{category?.emoji}</span>}
          {item.weightLbs !== null && <span>{item.weightLbs} lbs</span>}
          {item.avgScore !== null && (
            <span className="text-river-900">
              avg {item.avgScore.toFixed(1)} ({item.voteCount})
            </span>
          )}
          {item.winnerRank && <span>{RANK_LABEL[item.winnerRank]}</span>}
          {item.hidden && <span className="text-[#b3124e]">Hidden</span>}
        </div>
      </Link>
    </li>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`tap shrink-0 rounded-full border-3 border-ink px-4 font-semibold whitespace-nowrap ${
        active ? "bg-grabber-500 text-white" : "bg-white"
      }`}
    >
      {children}
    </button>
  );
}

function Count({ n }: { n: number }) {
  return <span className="ml-1 opacity-75">{n}</span>;
}
