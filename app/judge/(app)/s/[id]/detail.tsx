"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { getCategory } from "@/config/event";
import { deleteEntry, fetchDetail, updateSubmission, vote } from "@/lib/client/judge-api";
import { formatPhone, RANK_LABEL, type SubmissionDetail, type WinnerRank } from "@/lib/judge-types";

export function Detail({ id }: { id: string }) {
  const router = useRouter();
  const [item, setItem] = useState<SubmissionDetail | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(
    () =>
      fetchDetail(id).then(
        (d) => {
          setItem(d);
          setError("");
        },
        (e: unknown) => setError(e instanceof Error ? e.message : "Couldn't load."),
      ),
    [id],
  );

  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  async function act(fn: () => Promise<unknown>, optimistic?: Partial<SubmissionDetail>) {
    if (!item) return;
    const before = item;
    if (optimistic) setItem({ ...item, ...optimistic });
    setSaving(true);
    try {
      await fn();
      await load(); // pick up the new average
    } catch (e) {
      setItem(before);
      setError(e instanceof Error ? e.message : "Couldn't save.");
    } finally {
      setSaving(false);
    }
  }

  const back = () => (history.length > 1 ? router.back() : router.push("/judge"));

  if (!item) {
    return (
      <>
        <BackButton onClick={back} />
        <p className="text-lg text-river-900">{error || "Loading…"}</p>
      </>
    );
  }

  const category = getCategory(item.categoryId);
  const mapHref = item.lat !== null && item.lng !== null ? `https://maps.google.com/?q=${item.lat},${item.lng}` : null;

  return (
    <>
      <div className="flex items-center justify-between">
        <BackButton onClick={back} />
        <span className="font-display text-4xl tracking-wide text-grape-700">#{item.code}</span>
      </div>

      {item.photoUrl && (
        <a href={item.photoUrl} target="_blank" rel="noreferrer" className="block">
          {/* eslint-disable-next-line @next/next/no-img-element -- signed Supabase URL */}
          <img
            src={item.photoUrl}
            alt={`Entry ${item.code}`}
            className="outlined max-h-[70vh] w-full rounded-2xl bg-white object-contain"
          />
          <span className="mt-1 block text-center text-sm text-river-900">Tap to open full size (pinch to zoom)</span>
        </a>
      )}

      {error && (
        <p role="alert" className="font-semibold text-[#b3124e]">
          {error}
        </p>
      )}

      {item.contact && <Contact detail={item} />}

      {/* Scoring */}
      <section className="outlined rounded-2xl bg-white p-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-2xl tracking-wide">Your score</h2>
          <span className="text-base text-river-900">
            {item.avgScore !== null
              ? `avg ${item.avgScore.toFixed(2)} · ${item.voteCount} ${item.voteCount === 1 ? "vote" : "votes"}`
              : "No votes yet"}
          </span>
        </div>
        <div className="mt-2 grid grid-cols-5 gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              disabled={saving}
              aria-pressed={item.myScore === n}
              onClick={() => item.myScore !== n && void act(() => vote(id, n), { myScore: n })}
              className={`h-14 rounded-xl border-3 border-ink font-display text-3xl ${
                item.myScore === n ? "bg-fish-500" : "bg-white"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </section>

      {/* Facts */}
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-lg">
        <Fact label="Category">{category ? `${category.emoji} ${category.label}` : item.categoryId}</Fact>
        {item.weightLbs !== null && <Fact label="Weight">{item.weightLbs} lbs</Fact>}
        {item.note && <Fact label="Note">{item.note}</Fact>}
        {!item.contact && item.teamName && <Fact label="Team">{item.teamName}</Fact>}
        {(mapHref || item.zone) && (
          <Fact label="Where">
            {item.zone && <>Zone {item.zone} </>}
            {mapHref && (
              <a href={mapHref} target="_blank" rel="noreferrer" className="font-semibold text-grape-700 underline">
                Open map
              </a>
            )}
          </Fact>
        )}
        <Fact label="Time">
          {new Date(item.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
        </Fact>
        <Fact label="Social OK">{item.photoConsent ? "Yes" : "No"}</Fact>
      </dl>

      {/* Awards */}
      <section className="flex flex-col gap-2">
        <h2 className="font-display text-2xl tracking-wide">Award</h2>
        <div className="grid grid-cols-3 gap-2">
          {([1, 2, 3] as WinnerRank[]).map((r) => (
            <button
              key={r}
              type="button"
              disabled={saving}
              aria-pressed={item.winnerRank === r}
              onClick={() =>
                item.winnerRank !== r &&
                confirm(`Mark #${item.code} as ${RANK_LABEL[r]} for ${category?.label ?? "this category"}?`) &&
                void act(() => updateSubmission(id, { winnerRank: r }))
              }
              className={`tap rounded-xl border-3 border-ink font-semibold ${
                item.winnerRank === r ? "bg-grape-700 text-white" : "bg-white"
              }`}
            >
              {RANK_LABEL[r]}
            </button>
          ))}
        </div>
        {item.winnerRank && (
          <button
            type="button"
            disabled={saving}
            onClick={() => void act(() => updateSubmission(id, { winnerRank: null }))}
            className="tap self-start px-1 font-semibold text-river-900 underline"
          >
            Remove award
          </button>
        )}
        <p className="text-sm text-river-900">Awarding a place takes it from whoever had it in this category.</p>
      </section>

      <button
        type="button"
        disabled={saving}
        onClick={() => void act(() => updateSubmission(id, { hidden: !item.hidden }), { hidden: !item.hidden })}
        className={`tap mt-2 rounded-xl border-3 border-ink font-semibold ${item.hidden ? "bg-mint-100" : "bg-white text-[#b3124e]"}`}
      >
        {item.hidden ? "Unhide (show in feed & leaderboard)" : "Hide (duplicate / inappropriate)"}
      </button>
      <button
        type="button"
        disabled={saving}
        onClick={async () => {
          if (!confirm(`Permanently delete #${item.code} and its photo? This can't be undone.`)) return;
          setSaving(true);
          try {
            await deleteEntry(id);
            router.replace("/judge");
          } catch (e) {
            setError(e instanceof Error ? e.message : "Couldn't delete.");
            setSaving(false);
          }
        }}
        className="tap self-center px-2 font-semibold text-[#b3124e] underline"
      >
        Delete entry
      </button>
    </>
  );
}

function Contact({ detail }: { detail: SubmissionDetail }) {
  const c = detail.contact!;
  const purged = !c.name && !c.phone;
  return (
    <section className="outlined rounded-2xl bg-white p-4">
      <h2 className="text-sm font-bold tracking-wide text-river-900 uppercase">Submitted by</h2>
      {purged ? (
        <p className="mt-1 text-base">Contact info has been purged.</p>
      ) : (
        <div className="mt-2 flex flex-col divide-y-2 divide-mint-200">
          <Person
            label={detail.isMinor ? "Under 18" : null}
            name={c.name}
            phone={c.phone}
            sub={detail.teamName ? `Team ${detail.teamName}` : null}
          />
          {detail.isMinor && (c.guardianName || c.guardianPhone) && (
            <Person label="Parent / guardian" name={c.guardianName} phone={c.guardianPhone} sub={null} />
          )}
        </div>
      )}
    </section>
  );
}

/** One person per row: details stacked on the left, round Call / Text buttons on the right. */
function Person({
  label,
  name,
  phone,
  sub,
}: {
  label: string | null;
  name: string | null;
  phone: string | null;
  sub: string | null;
}) {
  return (
    <div className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1">
        {label && (
          <span className="mb-1 inline-block rounded-full bg-fish-500 px-2 text-xs font-bold tracking-wide uppercase">
            {label}
          </span>
        )}
        <p className="truncate text-xl leading-tight font-bold">{name ?? "—"}</p>
        {phone && <p className="text-base whitespace-nowrap text-river-900">{formatPhone(phone)}</p>}
        {sub && <p className="truncate text-base text-river-900">{sub}</p>}
      </div>
      {phone && (
        <div className="flex shrink-0 gap-2">
          <a
            href={`tel:${phone}`}
            aria-label={`Call ${name ?? phone}`}
            className="flex size-12 items-center justify-center rounded-full border-3 border-ink bg-river-700 text-xl"
          >
            📞
          </a>
          <a
            href={`sms:${phone}`}
            aria-label={`Text ${name ?? phone}`}
            className="flex size-12 items-center justify-center rounded-full border-3 border-ink bg-white text-xl"
          >
            💬
          </a>
        </div>
      )}
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="font-semibold text-river-900">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="tap -ml-2 self-start rounded-xl px-2 text-lg font-semibold text-grape-700"
    >
      ← Back
    </button>
  );
}
