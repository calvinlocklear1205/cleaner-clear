/**
 * Judge sessions: a signed, httpOnly cookie holding the judge's name.
 *
 * The HMAC key is derived from JUDGE_PASSCODE, so changing the passcode logs
 * every judge out. Uses Web Crypto only, so it runs in proxy.ts and in route
 * handlers alike. (No `server-only` import: proxy.ts uses this file.)
 */

export const JUDGE_COOKIE = "cc_judge";
export const SESSION_MAX_AGE_S = 60 * 60 * 24 * 3; // 3 days — covers event day with slack

type Session = { name: string; iat: number };

const enc = new TextEncoder();

function passcode(): string {
  const p = process.env.JUDGE_PASSCODE;
  if (!p) throw new Error("Missing required environment variable: JUDGE_PASSCODE");
  return p;
}

async function hmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    enc.encode(`cc-judge-session:${passcode()}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function createSessionToken(name: string): Promise<string> {
  const payload = b64url(enc.encode(JSON.stringify({ name, iat: Date.now() } satisfies Session)));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(), enc.encode(payload)));
  return `${payload}.${b64url(sig)}`;
}

/** Returns the judge's name if the token is authentic and unexpired. */
export async function readSessionToken(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  try {
    // subtle.verify is constant-time.
    const ok = await crypto.subtle.verify("HMAC", await hmacKey(), fromB64url(sig), enc.encode(payload));
    if (!ok) return null;
    const session = JSON.parse(new TextDecoder().decode(fromB64url(payload))) as Session;
    if (typeof session.name !== "string" || typeof session.iat !== "number") return null;
    if (Date.now() - session.iat > SESSION_MAX_AGE_S * 1000) return null;
    return session.name;
  } catch {
    return null;
  }
}

/** Constant-time passcode comparison (compares SHA-256 digests). */
export async function passcodeMatches(input: string): Promise<boolean> {
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(input)),
    crypto.subtle.digest("SHA-256", enc.encode(passcode())),
  ]);
  const x = new Uint8Array(a);
  const y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}
