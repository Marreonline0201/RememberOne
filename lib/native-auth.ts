"use client";

// Native-platform bridge for Supabase session persistence.
//
// Why: Capacitor's Android WebView doesn't reliably persist Supabase's auth
// cookies across app kills, so users get logged out every launch. We mirror
// the refresh token into Capacitor Preferences (SharedPreferences on Android,
// UserDefaults on iOS) and rehydrate on next launch.
//
// On the web this is a no-op — browser cookies handle persistence there.

import type { SupabaseClient, Session } from "@supabase/supabase-js";

const REFRESH_TOKEN_KEY = "ro.supabase.refresh_token";

async function isNative(): Promise<boolean> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export async function persistNativeSession(session: Session | null): Promise<void> {
  if (!(await isNative())) return;
  const { Preferences } = await import("@capacitor/preferences");
  if (session?.refresh_token) {
    await Preferences.set({ key: REFRESH_TOKEN_KEY, value: session.refresh_token });
  } else {
    await Preferences.remove({ key: REFRESH_TOKEN_KEY });
  }
}

export async function clearNativeSession(): Promise<void> {
  if (!(await isNative())) return;
  const { Preferences } = await import("@capacitor/preferences");
  await Preferences.remove({ key: REFRESH_TOKEN_KEY });
}

/**
 * If running on a native platform and the Supabase client has no live session,
 * try to rehydrate one using a refresh token we stored at previous login.
 * Returns true if a session was restored.
 */
export async function restoreNativeSession(
  supabase: SupabaseClient
): Promise<boolean> {
  if (!(await isNative())) return false;

  const { data: { session: existing } } = await supabase.auth.getSession();
  if (existing) return true;

  const { Preferences } = await import("@capacitor/preferences");
  const { value: refreshToken } = await Preferences.get({ key: REFRESH_TOKEN_KEY });
  if (!refreshToken) return false;

  const { data, error } = await supabase.auth.refreshSession({
    refresh_token: refreshToken,
  });

  if (error || !data.session) {
    // Refresh token was revoked or expired — drop it so we don't loop.
    await Preferences.remove({ key: REFRESH_TOKEN_KEY });
    return false;
  }

  // Persist the rotated refresh token so the next launch also works.
  await Preferences.set({
    key: REFRESH_TOKEN_KEY,
    value: data.session.refresh_token,
  });
  return true;
}
