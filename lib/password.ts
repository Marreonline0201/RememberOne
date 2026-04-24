// Password policy — the server side of this is configured in the Supabase
// dashboard (Authentication → Policies → Password requirements). This module
// mirrors the same rules client-side so the user gets a clear rejection
// message before we bother Supabase with a guaranteed-to-fail signup.
//
// Keep the two in sync. If you change `PASSWORD_POLICY`, update the Supabase
// dashboard to match (and vice-versa). See security/P3-04-*.md for the
// documented server-side policy.

export const PASSWORD_POLICY = {
  minLength: 10,
  requireLetter: true,
  requireNumber: true,
} as const;

export type PasswordValidationResult =
  | { ok: true }
  | { ok: false; reason: string };

export function validatePassword(password: string): PasswordValidationResult {
  if (password.length < PASSWORD_POLICY.minLength) {
    return {
      ok: false,
      reason: `Password must be at least ${PASSWORD_POLICY.minLength} characters.`,
    };
  }
  if (PASSWORD_POLICY.requireLetter && !/[a-zA-Z]/.test(password)) {
    return { ok: false, reason: "Password must contain at least one letter." };
  }
  if (PASSWORD_POLICY.requireNumber && !/\d/.test(password)) {
    return { ok: false, reason: "Password must contain at least one number." };
  }
  return { ok: true };
}
