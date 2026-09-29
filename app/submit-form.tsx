"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { event, getCategory, zonesEnabled } from "@/config/event";
import { compressImage } from "@/lib/client/compress";
import { uuid } from "@/lib/client/ids";
import { EMPTY_PROFILE, getDeviceId, loadProfile, saveProfile, type Profile } from "@/lib/client/storage";
import { enqueue, retryNow } from "@/lib/client/queue";
import { useQueueEntry } from "@/lib/client/use-queue";
import { NOTE_MAX, validateSubmission, type FieldErrors, type SubmissionInput } from "@/lib/submission";

type Photo = { blob: Blob; thumb: Blob | null; url: string };
type Geo = { status: "pending" | "ok" | "unavailable"; lat?: number; lng?: number };
type Phase = { kind: "form" } | { kind: "saving" } | { kind: "done"; id: string };

export function SubmitForm() {
  // One id per entry; retries reuse it so the server never creates duplicates.
  const [submissionId, setSubmissionId] = useState(uuid);
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [processing, setProcessing] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [weight, setWeight] = useState("");
  const [note, setNote] = useState("");
  const [zone, setZone] = useState("");
  const [geo, setGeo] = useState<Geo>({ status: "pending" });
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [editingProfile, setEditingProfile] = useState(true);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "form" });
  const fileInput = useRef<HTMLInputElement>(null);

  // Restore saved contact info after hydration (localStorage is client-only).
  useEffect(() => {
    const saved = loadProfile();
    if (saved) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from localStorage
      setProfile(saved);
      setEditingProfile(false);
    }
  }, []);

  useEffect(() => locate(setGeo), []);

  // Release preview object URLs.
  useEffect(() => () => void (photo && URL.revokeObjectURL(photo.url)), [photo]);

  const category = getCategory(categoryId);
  const sending = phase.kind === "saving";

  async function onPhotoPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    setProcessing(true);
    setFormError("");
    try {
      const blob = await compressImage(file);
      // Small copy for "My submissions" and the judges' grid; not worth failing over.
      const thumb = await compressImage(blob, { maxEdge: 480, quality: 0.6, maxBytes: 60_000 }).catch(() => null);
      setPhoto({ blob, thumb, url: URL.createObjectURL(blob) });
      setErrors((prev) => ({ ...prev, id: undefined }));
      locate(setGeo); // refresh position for this find
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Couldn't read that photo.");
    } finally {
      setProcessing(false);
    }
  }

  function updateProfile(patch: Partial<Profile>) {
    setProfile((p) => ({ ...p, ...patch }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!photo) {
      setErrors({ id: "Snap a photo first." });
      scrollToError();
      return;
    }

    const draft: SubmissionInput = {
      id: submissionId,
      deviceId: getDeviceId(),
      categoryId,
      name: profile.name,
      phone: profile.phone,
      teamName: profile.teamName,
      note,
      weightLbs: weight.trim() === "" ? null : Number(weight),
      lat: geo.lat ?? null,
      lng: geo.lng ?? null,
      zone: zone || null,
      isMinor: profile.isMinor,
      guardianName: profile.guardianName,
      guardianPhone: profile.guardianPhone,
      photoConsent: profile.photoConsent,
    };
    const result = validateSubmission(draft);
    if (!result.ok) {
      setErrors(result.errors);
      if (Object.keys(result.errors).some((k) => PROFILE_FIELDS.has(k))) setEditingProfile(true);
      scrollToError();
      return;
    }
    setErrors({});
    saveProfile(profile);

    // Save on the phone first; the queue uploads it (now, or when signal returns).
    setPhase({ kind: "saving" });
    try {
      await enqueue(result.value, photo.blob, photo.thumb);
      setPhase({ kind: "done", id: result.value.id });
    } catch {
      setPhase({ kind: "form" });
      setFormError("Couldn't save your entry on this phone. Please try again.");
    }
  }

  function snapAnother() {
    setSubmissionId(uuid());
    setPhoto(null);
    setCategoryId("");
    setWeight("");
    setNote("");
    setErrors({});
    setFormError("");
    setEditingProfile(false);
    setPhase({ kind: "form" });
    window.scrollTo({ top: 0 });
    // Open the camera straight away: tap → snap → pick category → send.
    fileInput.current?.click();
  }

  return (
    <>
      {/* Outside the form so "Snap another" can open the camera from the confirmation screen. */}
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onPhotoPicked}
        className="sr-only"
        id="photo"
        disabled={sending}
        tabIndex={-1}
      />
      {phase.kind === "done" ? (
        <Confirmation id={phase.id} onSnapAnother={snapAnother} />
      ) : (
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
          {/* 1–2. Photo */}
          <section aria-label="Photo" data-error={errors.id ? "" : undefined}>
            {photo ? (
              <div className="flex flex-col gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
                <img
                  src={photo.url}
                  alt="Your find"
                  className="outlined max-h-[60vh] w-full rounded-2xl bg-white object-contain"
                />
                <label
                  htmlFor="photo"
                  className="tap self-center rounded-full px-5 py-3 font-semibold text-grape-700 underline underline-offset-4"
                >
                  ↺ Retake
                </label>
              </div>
            ) : (
              <label
                htmlFor="photo"
                className="outlined flex min-h-56 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-3xl bg-fish-500 px-6 py-10 text-center text-ink active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
              >
                <span className="text-6xl" aria-hidden>
                  {processing ? "⏳" : "📸"}
                </span>
                <span className="font-display text-5xl leading-none tracking-wide">
                  {processing ? "Squishing photo…" : "Snap your trash"}
                </span>
                {!processing && <span className="text-lg font-medium">Tap to open the camera</span>}
              </label>
            )}
            <FieldError message={errors.id} />
          </section>

          {/* 3. Category */}
          <fieldset data-error={errors.categoryId ? "" : undefined}>
            <legend className="mb-3 font-display text-3xl tracking-wide text-grape-700">Pick a category</legend>
            <div className="grid auto-rows-fr gap-3">
              {event.categories.map((c) => {
                const selected = c.id === categoryId;
                return (
                  <label
                    key={c.id}
                    className={`outlined tap flex cursor-pointer items-center gap-3 rounded-xl px-4 py-3 transition-colors ${
                      selected ? "bg-grabber-500 text-white" : "bg-white"
                    }`}
                  >
                    <input
                      type="radio"
                      name="category"
                      value={c.id}
                      checked={selected}
                      onChange={() => {
                        setCategoryId(c.id);
                        setErrors((prev) => ({ ...prev, categoryId: undefined }));
                      }}
                      className="sr-only"
                      disabled={sending}
                    />
                    <span className="text-3xl" aria-hidden>
                      {c.emoji}
                    </span>
                    <span className="flex-1">
                      <span className="block font-display text-2xl leading-none tracking-wide">{c.label}</span>
                      <span className={`text-base ${selected ? "text-white" : "text-river-900"}`}>{c.blurb}</span>
                    </span>
                    {selected && (
                      <span className="text-2xl" aria-hidden>
                        ✓
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
            <FieldError message={errors.categoryId} />
          </fieldset>

          {/* 4. Weight */}
          {category?.requiresWeight && (
            <Field label="Weight (lbs)" hint="Take it to a scale station." error={errors.weightLbs}>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.1"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className={inputClass}
                placeholder="e.g. 42"
                disabled={sending}
              />
            </Field>
          )}

          {/* 5. Location */}
          <LocationStatus geo={geo} zone={zone} onZone={setZone} disabled={sending} />

          {/* 6. Note */}
          <Field label="Trash talk (optional)" error={errors.note}>
            <input
              type="text"
              value={note}
              maxLength={NOTE_MAX}
              onChange={(e) => setNote(e.target.value)}
              className={inputClass}
              placeholder="Where'd you find it? Any story?"
              enterKeyHint="done"
              disabled={sending}
            />
          </Field>

          {/* 7. About you */}
          {editingProfile ? (
            <AboutYou profile={profile} errors={errors} onChange={updateProfile} disabled={sending} />
          ) : (
            <div className="flex items-center gap-3 rounded-xl bg-mint-100 py-2 pr-2 pl-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-river-900">Submitting as</p>
                <p className="truncate text-lg leading-tight font-bold">{profile.name}</p>
                {profile.teamName && <p className="truncate text-sm text-river-900">{profile.teamName}</p>}
              </div>
              <button
                type="button"
                onClick={() => setEditingProfile(true)}
                className="tap shrink-0 rounded-xl border-2 border-ink bg-white px-4 font-semibold text-grape-700"
              >
                Edit
              </button>
            </div>
          )}

          {formError && (
            <p role="alert" className="rounded-xl border-2 border-lip-400 bg-white px-4 py-3 text-lg font-medium">
              {formError}
            </p>
          )}

          {/* 8. Send */}
          <button
            type="submit"
            disabled={sending || processing}
            className="outlined tap sticky bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] rounded-2xl bg-river-700 px-6 py-4 font-display text-4xl tracking-wide text-white active:translate-x-[3px] active:translate-y-[3px] active:shadow-none disabled:opacity-80"
          >
            {sending ? "Bagging it…" : "Send it →"}
          </button>

          {editingProfile && <p className="-mt-3 text-center text-base text-river-900">We only contact winners.</p>}
        </form>
      )}
    </>
  );
}

const PROFILE_FIELDS = new Set<string>(["name", "phone", "teamName", "guardianName", "guardianPhone"]);

const inputClass =
  "tap w-full rounded-xl border-3 border-ink bg-white px-4 py-3 text-lg placeholder:text-river-900/50 focus:outline-none focus:ring-4 focus:ring-grabber-500/40";

function scrollToError() {
  requestAnimationFrame(() =>
    document.querySelector("[data-error]")?.scrollIntoView({ behavior: "smooth", block: "center" }),
  );
}

function locate(setGeo: (g: Geo) => void) {
  if (!("geolocation" in navigator)) {
    setGeo({ status: "unavailable" });
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => setGeo({ status: "ok", lat: pos.coords.latitude, lng: pos.coords.longitude }),
    () => setGeo({ status: "unavailable" }),
    { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5" data-error={error ? "" : undefined}>
      <span className="text-lg font-semibold">{label}</span>
      {children}
      {hint && !error && <span className="text-base text-river-900">{hint}</span>}
      <FieldError message={error} />
    </label>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <span role="alert" className="mt-1 block text-base font-semibold text-[#b3124e]">
      {message}
    </span>
  );
}

function LocationStatus({
  geo,
  zone,
  onZone,
  disabled,
}: {
  geo: Geo;
  zone: string;
  onZone: (z: string) => void;
  disabled: boolean;
}) {
  if (geo.status === "ok") {
    return <p className="text-base text-river-900">📍 Location captured</p>;
  }
  if (geo.status === "pending") {
    return <p className="text-base text-river-900">📍 Finding your location…</p>;
  }
  if (!zonesEnabled) {
    return <p className="text-base text-river-900">📍 Location off — that&apos;s okay.</p>;
  }
  return (
    <fieldset>
      <legend className="mb-2 text-lg font-semibold">Which zone are you in? (optional)</legend>
      <div className="flex flex-wrap gap-2">
        {event.zones.map((z) => (
          <button
            key={z}
            type="button"
            disabled={disabled}
            onClick={() => onZone(zone === z ? "" : z)}
            aria-pressed={zone === z}
            className={`outlined tap rounded-xl px-4 font-display text-2xl ${zone === z ? "bg-grabber-500 text-white" : "bg-white"}`}
          >
            {z}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function AboutYou({
  profile,
  errors,
  onChange,
  disabled,
}: {
  profile: Profile;
  errors: FieldErrors;
  onChange: (patch: Partial<Profile>) => void;
  disabled: boolean;
}) {
  return (
    <fieldset className="flex flex-col gap-4 rounded-2xl border-3 border-dashed border-river-700 p-4">
      <legend className="px-2 font-display text-3xl tracking-wide text-grape-700">About you</legend>
      <p className="-mt-2 text-base text-river-900">Just once — we&apos;ll remember you on this phone.</p>

      <Field label="Name" error={errors.name}>
        <input
          type="text"
          autoComplete="name"
          value={profile.name}
          onChange={(e) => onChange({ name: e.target.value })}
          className={inputClass}
          disabled={disabled}
        />
      </Field>
      <Field label="Phone" error={errors.phone}>
        <input
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          value={profile.phone}
          onChange={(e) => onChange({ phone: e.target.value })}
          className={inputClass}
          disabled={disabled}
        />
      </Field>
      <Field label="Team name (optional)" hint="Family, group or company" error={errors.teamName}>
        <input
          type="text"
          autoComplete="organization"
          value={profile.teamName}
          onChange={(e) => onChange({ teamName: e.target.value })}
          className={inputClass}
          disabled={disabled}
        />
      </Field>

      <Toggle
        checked={profile.isMinor}
        onChange={(isMinor) => onChange({ isMinor })}
        label="Under 18?"
        disabled={disabled}
      />
      {profile.isMinor && (
        <div className="flex flex-col gap-4 rounded-xl bg-mint-100 p-3">
          <Field label="Parent/guardian name" error={errors.guardianName}>
            <input
              type="text"
              value={profile.guardianName}
              onChange={(e) => onChange({ guardianName: e.target.value })}
              className={inputClass}
              disabled={disabled}
            />
          </Field>
          <Field label="Parent/guardian phone" error={errors.guardianPhone}>
            <input
              type="tel"
              inputMode="tel"
              value={profile.guardianPhone}
              onChange={(e) => onChange({ guardianPhone: e.target.value })}
              className={inputClass}
              disabled={disabled}
            />
          </Field>
        </div>
      )}

      <label className="tap flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={profile.photoConsent}
          onChange={(e) => onChange({ photoConsent: e.target.checked })}
          className="mt-1 size-7 shrink-0 accent-river-700"
          disabled={disabled}
        />
        <span className="text-lg">OK to share my photo on social media</span>
      </label>
    </fieldset>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className="tap flex items-center justify-between gap-3 text-left text-lg font-semibold"
    >
      {label}
      <span
        className={`relative h-9 w-16 shrink-0 rounded-full border-3 border-ink transition-colors ${checked ? "bg-river-700" : "bg-white"}`}
      >
        <span
          className={`absolute top-0.5 size-6 rounded-full border-2 border-ink bg-fish-500 transition-all ${checked ? "left-8" : "left-0.5"}`}
        />
      </span>
    </button>
  );
}

function Confirmation({ id, onSnapAnother }: { id: string; onSnapAnother: () => void }) {
  const entry = useQueueEntry(id);
  const status = entry?.status ?? "queued";

  return (
    <section className="flex flex-col items-center gap-6 py-6 text-center" aria-live="polite">
      {status === "sent" && entry?.code ? (
        <>
          <p className="font-display text-4xl tracking-wide text-river-700">Sent ✓</p>
          <div className="outlined w-full rounded-3xl bg-white px-6 py-8">
            <p className="text-lg font-semibold text-river-900">Your code</p>
            <p className="font-display text-8xl leading-none tracking-wider text-grape-700">#{entry.code}</p>
          </div>
          <p className="text-xl font-semibold">Show this at the prize tent if you win.</p>
          <Link href="/mine#share" className="tap flex items-center font-semibold text-grape-700 underline">
            📤 Share your trash album
          </Link>
        </>
      ) : status === "failed" ? (
        <div className="outlined w-full rounded-3xl bg-white px-6 py-8">
          <p className="font-display text-4xl tracking-wide text-[#b3124e]">Didn&apos;t go through</p>
          <p className="mt-2 text-lg">{entry?.error}</p>
          <button
            type="button"
            onClick={() => void retryNow(id)}
            className="outlined tap mt-4 rounded-xl bg-white px-5 font-semibold"
          >
            Try again
          </button>
        </div>
      ) : (
        <div className="outlined w-full rounded-3xl bg-white px-6 py-8">
          <p className="font-display text-4xl tracking-wide text-grabber-700">
            {status === "uploading" ? "Uploading…" : "Saved — sending soon"}
          </p>
          <p className="mt-2 text-lg">
            {status === "uploading"
              ? "Hang tight, this usually takes a few seconds."
              : "It's safe on your phone and will send by itself when you have signal."}
          </p>
          <p className="mt-2 text-base text-river-900">Your prize code shows up here once it&apos;s sent.</p>
        </div>
      )}

      <button
        type="button"
        onClick={onSnapAnother}
        className="outlined tap w-full rounded-2xl bg-fish-500 px-6 py-4 font-display text-4xl tracking-wide active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
      >
        📸 Snap another
      </button>
      <Link href="/mine" className="tap flex items-center font-semibold text-grape-700 underline underline-offset-4">
        See all my submissions
      </Link>
    </section>
  );
}
