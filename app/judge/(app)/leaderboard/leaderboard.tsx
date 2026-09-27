"use client";

import Link from "next/link";
import { event } from "@/config/event";
import { useJudgeFeed } from "@/lib/client/use-judge-feed";
import { compareByScore, RANK_LABEL, type FeedItem } from "@/lib/judge-types";

const SHOW_TOP = 10;

export function Leaderboard() {
  const { items, error } = useJudgeFeed();
  if (!items) return <p className="text-lg text-river-900">{error || "Loading…"}</p>;

  const eligible = items.filter((i) => !i.hidden);
  const totalLbs = eligible.reduce((sum, i) => sum + (i.weightLbs ?? 0), 0);

  return (
    <>
      <section className="outlined flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl bg-white p-3 text-lg">
        <span>
          <strong>{eligible.length}</strong> entries
        </span>
        <span>
          <strong>{Math.round(totalLbs * 10) / 10}</strong> lbs weighed
        </span>
        <a
          href="/api/judge/export.csv"
          className="tap ml-auto flex items-center rounded-xl border-3 border-ink bg-mint-100 px-3 font-semibold"
        >
          ⬇ Download CSV
        </a>
      </section>
      <p className="text-base text-river-900">
        Ranked by average score, then number of votes. Hidden entries are excluded.
      </p>
      {event.categories.map((c) => {
        const ranked = eligible.filter((i) => i.categoryId === c.id).sort(compareByScore);
        return (
          <section key={c.id} className="flex flex-col gap-2">
            <h2 className="font-display text-3xl tracking-wide text-grape-700">
              {c.emoji} {c.label} <span className="text-xl text-river-900">({ranked.length})</span>
            </h2>
            {ranked.length === 0 ? (
              <p className="text-base text-river-900">No entries yet.</p>
            ) : (
              <ol className="flex flex-col gap-2">
                {ranked.slice(0, SHOW_TOP).map((item, i) => (
                  <Row key={item.id} item={item} place={i + 1} />
                ))}
              </ol>
            )}
            {ranked.length > SHOW_TOP && (
              <Link
                href={`/judge?c=${c.id}&sort=score`}
                className="tap flex items-center font-semibold text-grape-700 underline"
              >
                See all {ranked.length} in {c.label}
              </Link>
            )}
          </section>
        );
      })}
    </>
  );
}

function Row({ item, place }: { item: FeedItem; place: number }) {
  return (
    <li>
      <Link href={`/judge/s/${item.id}`} className="outlined flex items-center gap-3 rounded-xl bg-white p-2">
        <span className="w-8 text-center font-display text-3xl">{place}</span>
        {item.thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- signed Supabase URL
          <img
            src={item.thumbUrl}
            alt=""
            loading="lazy"
            className="size-14 shrink-0 rounded-lg border-2 border-ink object-cover"
          />
        ) : (
          <div className="size-14 shrink-0 rounded-lg border-2 border-ink bg-mint-100" />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-display text-2xl leading-none">
            #{item.code}
            {item.weightLbs !== null && <span className="ml-2 font-sans text-base">{item.weightLbs} lbs</span>}
          </p>
          <p className="text-base text-river-900">
            {item.avgScore !== null ? `★ ${item.avgScore.toFixed(2)} · ${item.voteCount} votes` : "No votes yet"}
          </p>
        </div>
        {item.winnerRank && <span className="shrink-0 font-semibold">{RANK_LABEL[item.winnerRank]}</span>}
      </Link>
    </li>
  );
}
