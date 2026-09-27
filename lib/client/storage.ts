import { uuid } from "@/lib/client/ids";

/** What we remember about the volunteer between submissions (localStorage). */
export type Profile = {
  name: string;
  phone: string;
  teamName: string;
  isMinor: boolean;
  guardianName: string;
  guardianPhone: string;
  photoConsent: boolean;
};

export const EMPTY_PROFILE: Profile = {
  name: "",
  phone: "",
  teamName: "",
  isMinor: false,
  guardianName: "",
  guardianPhone: "",
  photoConsent: false,
};

const DEVICE_KEY = "cc.deviceId";
const PROFILE_KEY = "cc.profile";

// localStorage can throw (Safari private mode, storage disabled), so every
// access is guarded and failures degrade to "not remembered".

export function getDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = uuid();
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return uuid();
  }
}

export function loadProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    const p = { ...EMPTY_PROFILE, ...(JSON.parse(raw) as Partial<Profile>) };
    return p.name && p.phone ? p : null;
  } catch {
    return null;
  }
}

export function saveProfile(profile: Profile): void {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // Not fatal: they'll just re-enter details next time.
  }
}
