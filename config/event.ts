/**
 * Single source of truth for the event. Edit this file each year — there is
 * no admin UI by design (see SPEC.md "Non-goals").
 *
 * Notes:
 *   - opensAt / closesAt are Denver time. The site opened early so the team
 *     can try it for real (judges delete test entries from /judge); it closes
 *     a few hours after the official 9am–12pm.
 *   - zones: leave empty to skip zone entirely (GPS only). Add labels, e.g.
 *     ["A", "B", "C"], to show a manual zone picker when GPS is unavailable.
 *   - categories: ids are stored in the DB — don't rename an id once
 *     submissions exist.
 */

export type Category = {
  /** Stable id stored in submissions.category_id. Lowercase, no spaces. */
  id: string;
  label: string;
  emoji: string;
  blurb: string;
  /** If true, the submit form requires weight_lbs. */
  requiresWeight?: boolean;
};

export type EventConfig = {
  /** App name shown in the title bar and headers. */
  name: string;
  /** The cleanup this contest is part of. */
  cleanup: string;
  year: number;
  /** ISO 8601 with offset. Submissions open at this instant. */
  opensAt: string;
  /** ISO 8601 with offset. Submissions close at this instant. */
  closesAt: string;
  /**
   * Manual kill switch. `false` closes submissions regardless of the window
   * or the SUBMISSIONS_OPEN env var. Leave `true` to defer to the env var.
   */
  submissionsOpen: boolean;
  /**
   * Minutes after closesAt that the API still accepts entries, so photos
   * snapped before close but stuck in a bad-signal queue still make it in.
   * The form itself closes at closesAt.
   */
  uploadGraceMinutes: number;
  /** Optional manual location labels. Empty = no zone picker. */
  zones: readonly string[];
  categories: readonly Category[];
};

export const event: EventConfig = {
  name: "Cleaner Clear Photo Contest",
  cleanup: "7th Annual Clear Creek Cleanup",
  year: 2026,
  // Event: Sat Oct 3, 9am–12pm at Engineer Lake Parking Lot. Open early for team testing.
  opensAt: "2026-09-27T00:00:00-06:00",
  closesAt: "2026-10-03T15:00:00-06:00",
  submissionsOpen: true,
  uploadGraceMinutes: 120,
  zones: [],
  // Final 2026 categories. Prizes and runners-up are still TBD.
  categories: [
    { id: "reusable", label: "Totally Reusable", emoji: "♻️", blurb: "Still works, still good. Give it a second life." },
    { id: "outfit", label: "Full Outfit", emoji: "👕", blurb: "Enough found clothes to dress a whole person" },
    { id: "grossest", label: "Grossest Find", emoji: "🤢", blurb: "Hold your breath and snap it" },
    { id: "beauty", label: "Beauty Contest", emoji: "👑", blurb: "Wear what you found and strut it" },
    { id: "historic", label: "Time Capsule", emoji: "⏳", blurb: "The oldest, most historic thing you dug up" },
    { id: "before-after", label: "Before & After", emoji: "✨", blurb: "Show off a spot you beautified. Collages welcome!" },
    { id: "art", label: "Trash Art", emoji: "🎨", blurb: "Turn your haul into a masterpiece" },
  ],
};

export function getCategory(id: string): Category | undefined {
  return event.categories.find((c) => c.id === id);
}

export const zonesEnabled = event.zones.length > 0;

export function isValidZone(zone: string): boolean {
  return event.zones.includes(zone);
}

/**
 * Whether submissions are accepted right now. Closed if the config kill
 * switch is off, if SUBMISSIONS_OPEN=false (server-side env), or if `now` is
 * outside [opensAt, closesAt). SUBMISSIONS_OPEN=always ignores the window
 * (for testing).
 *
 * Call this on the server; the env var is not exposed to the browser.
 */
export function isSubmissionsOpen(now: Date = new Date()): boolean {
  return isWithinWindow(now, 0);
}

/**
 * Like isSubmissionsOpen, but keeps accepting for uploadGraceMinutes after
 * close so queued entries can drain. Used by the submission API routes.
 */
export function isAcceptingUploads(now: Date = new Date()): boolean {
  return isWithinWindow(now, event.uploadGraceMinutes);
}

/** True when SUBMISSIONS_OPEN=always — shows a TEST MODE banner so it's never left on by accident. */
export function isTestMode(): boolean {
  return process.env.SUBMISSIONS_OPEN?.trim().toLowerCase() === "always";
}

function isWithinWindow(now: Date, graceMinutes: number): boolean {
  if (!event.submissionsOpen) return false;
  const override = process.env.SUBMISSIONS_OPEN?.trim().toLowerCase();
  if (override === "false") return false;
  // For testing before event day. Never leave this on in production.
  if (override === "always") return true;
  const opens = Date.parse(event.opensAt);
  const closes = Date.parse(event.closesAt);
  if (Number.isNaN(opens) || Number.isNaN(closes)) {
    throw new Error("config/event.ts: opensAt/closesAt must be valid ISO 8601 dates");
  }
  const t = now.getTime();
  return t >= opens && t < closes + graceMinutes * 60_000;
}
