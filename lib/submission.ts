import { event, getCategory, isValidZone, zonesEnabled } from "@/config/event";

/**
 * Validation shared by the submit form (client) and /api/submissions/init
 * (server), so both enforce exactly the same rules.
 */

export const NOTE_MAX = 140;
export const NAME_MAX = 100;
export const TEAM_MAX = 100;

/** Body of POST /api/submissions/init. */
export type SubmissionInput = {
  /** Client-generated UUID; makes retries idempotent. */
  id: string;
  deviceId: string;
  categoryId: string;
  name: string;
  phone: string;
  teamName?: string | null;
  note?: string | null;
  weightLbs?: number | null;
  lat?: number | null;
  lng?: number | null;
  zone?: string | null;
  isMinor: boolean;
  guardianName?: string | null;
  guardianPhone?: string | null;
  photoConsent: boolean;
};

export type InitResponse = {
  code: string;
  /** Null when the photo is already uploaded and completed (retry after success). */
  upload: { signedUrl: string; path: string; thumbSignedUrl: string | null } | null;
};

export type CompleteResponse = { code: string };

export type ApiError = { error: string; field?: keyof SubmissionInput };

export type FieldErrors = Partial<Record<keyof SubmissionInput, string>>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/** Keeps a leading "+" and digits only, e.g. "(303) 555-1234" → "3035551234". */
export function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");
  return trimmed.startsWith("+") ? `+${digits}` : digits;
}

export function isValidPhone(raw: string): boolean {
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
}

function clean(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim().replace(/\s+/g, " ");
  return t ? t.slice(0, max) : null;
}

function finiteOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Validates and normalizes untrusted input. Returns either the cleaned
 * submission or per-field error messages suitable for showing in the form.
 */
export function validateSubmission(
  raw: unknown,
): { ok: true; value: SubmissionInput } | { ok: false; errors: FieldErrors } {
  const b = (raw ?? {}) as Record<string, unknown>;
  const errors: FieldErrors = {};

  if (!isUuid(b.id)) errors.id = "Invalid submission id.";
  const deviceId = typeof b.deviceId === "string" ? b.deviceId : "";
  if (deviceId.length < 8 || deviceId.length > 64) errors.deviceId = "Invalid device id.";

  const categoryId = typeof b.categoryId === "string" ? b.categoryId : "";
  const category = getCategory(categoryId);
  if (!category) errors.categoryId = "Pick a category.";

  const name = clean(b.name, NAME_MAX);
  if (!name) errors.name = "Tell us your name.";

  const phoneRaw = typeof b.phone === "string" ? b.phone : "";
  if (!isValidPhone(phoneRaw)) errors.phone = "Enter a phone number we can reach you at.";

  let weightLbs = finiteOrNull(b.weightLbs);
  if (category?.requiresWeight) {
    if (weightLbs === null || weightLbs <= 0) errors.weightLbs = "Weigh it at a scale station and enter the pounds.";
    else if (weightLbs >= 5000) errors.weightLbs = "That's heavier than a car. Double-check the weight?";
  } else {
    weightLbs = null;
  }
  if (weightLbs !== null) weightLbs = Math.round(weightLbs * 100) / 100;

  let lat = finiteOrNull(b.lat);
  let lng = finiteOrNull(b.lng);
  if (lat === null || lng === null || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    lat = null;
    lng = null;
  }

  let zone = clean(b.zone, 10);
  if (zone && !(zonesEnabled && isValidZone(zone))) zone = null;

  const isMinor = b.isMinor === true;
  const guardianName = isMinor ? clean(b.guardianName, NAME_MAX) : null;
  const guardianPhoneRaw = isMinor && typeof b.guardianPhone === "string" ? b.guardianPhone : "";
  if (isMinor) {
    if (!guardianName) errors.guardianName = "A parent or guardian's name is required.";
    if (!isValidPhone(guardianPhoneRaw)) errors.guardianPhone = "A parent or guardian's phone is required.";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      id: (b.id as string).toLowerCase(),
      deviceId,
      categoryId,
      name: name!,
      phone: normalizePhone(phoneRaw),
      teamName: clean(b.teamName, TEAM_MAX),
      note: clean(b.note, NOTE_MAX),
      weightLbs,
      lat,
      lng,
      zone,
      isMinor,
      guardianName,
      guardianPhone: isMinor ? normalizePhone(guardianPhoneRaw) : null,
      photoConsent: b.photoConsent === true,
    },
  };
}

/** Storage object path for a submission photo. */
export function photoPath(id: string): string {
  return `${event.year}/${id}.jpg`;
}

/** Small copy for the judges' grid; optional (judges fall back to the full photo). */
export function thumbPath(id: string): string {
  return `${event.year}/${id}_thumb.jpg`;
}
