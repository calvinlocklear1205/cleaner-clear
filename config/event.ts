/**
 * Single source of truth for the event. Edit this file each year — there is
 * no admin UI by design (see SPEC.md "Non-goals").
 *
 * TODO before the event:
 *   - opensAt / closesAt: set to the real event date and hours (Denver time).
 *   - zones: match the physical flags/signs on site.
 *   - categories: finalize with organizers (ids are stored in the DB, so
 *     don't rename an id once submissions exist).
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
  name: string;
  tagline: string;
  edition: string;
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
  zones: readonly string[];
  categories: readonly Category[];
};

export const event: EventConfig = {
  name: "A Cleaner Clear",
  tagline: "River Cleanup",
  edition: "7th Annual",
  year: 2026,
  // PLACEHOLDER dates — replace with the real event day.
  opensAt: "2026-10-17T08:00:00-06:00",
  closesAt: "2026-10-17T13:00:00-06:00",
  submissionsOpen: true,
  zones: ["A", "B", "C", "D", "E", "F"],
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

export function isValidZone(zone: string): boolean {
  return event.zones.includes(zone);
}

/**
 * Whether submissions are accepted right now. Closed if the config kill
 * switch is off, if SUBMISSIONS_OPEN=false (server-side env), or if `now` is
 * outside [opensAt, closesAt).
 *
 * Call this on the server; the env var is not exposed to the browser.
 */
export function isSubmissionsOpen(now: Date = new Date()): boolean {
  if (!event.submissionsOpen) return false;
  if (process.env.SUBMISSIONS_OPEN?.trim().toLowerCase() === "false") return false;
  const opens = Date.parse(event.opensAt);
  const closes = Date.parse(event.closesAt);
  if (Number.isNaN(opens) || Number.isNaN(closes)) {
    throw new Error("config/event.ts: opensAt/closesAt must be valid ISO 8601 dates");
  }
  const t = now.getTime();
  return t >= opens && t < closes;
}
