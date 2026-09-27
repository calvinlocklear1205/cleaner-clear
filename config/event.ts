/**
 * Single source of truth for the event. Edit this file each year — there is
 * no admin UI by design (see SPEC.md "Non-goals").
 *
 * Notes:
 *   - opensAt / closesAt are Denver time. The window is padded on both sides
 *     of the official 9am–12pm so early birds and stragglers can still submit.
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
  // Official hours: Sat Oct 3, 9am–12pm at Engineer Lake Parking Lot.
  opensAt: "2026-10-03T07:00:00-06:00",
  closesAt: "2026-10-03T15:00:00-06:00",
  submissionsOpen: true,
  uploadGraceMinutes: 120,
  zones: [],
  // TODO: prizes and runners-up per category are still TBD.
  categories: [
    { id: "weirdest", label: "Weirdest Find", emoji: "🤯", blurb: "The 'how did THIS get here?' award" },
    { id: "heaviest", label: "Heaviest Haul", emoji: "🏋️", blurb: "Weigh it at a scale station", requiresWeight: true },
    { id: "treasure", label: "Trash to Treasure", emoji: "♻️", blurb: "Something that deserves a second life" },
    { id: "vintage", label: "Time Capsule", emoji: "⏳", blurb: "Oldest-looking item" },
    { id: "tiniest", label: "Tiniest Trash", emoji: "🔍", blurb: "Smallest recognizable object" },
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
