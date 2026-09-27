import "server-only";

/**
 * Server-only environment access. Throws a clear error at call time (not at
 * import time) so `next build` works without secrets present.
 */
function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}. See .env.example.`);
  }
  return value;
}

export const env = {
  get supabaseUrl() {
    return required("NEXT_PUBLIC_SUPABASE_URL");
  },
  get supabaseServiceRoleKey() {
    return required("SUPABASE_SERVICE_ROLE_KEY");
  },
  get judgePasscode() {
    return required("JUDGE_PASSCODE");
  },
  get safetyLeadPhone() {
    return required("SAFETY_LEAD_PHONE");
  },
};
