"use client";

// AiConsentProvider — the UX half of the Gemini consent gate (App Store
// Guideline 5.1.2(i)). `ensureConsent()` resolves true if the user has already
// consented, otherwise it shows a hard-block modal and resolves true/false on
// the user's choice. Consent is stored on the user's auth metadata
// (ai_consent_at) via supabase.auth.updateUser, which the server AI routes read
// live on their next getUser() — see lib/ai-consent.ts for the authoritative
// server-side enforcement. The server gate is what guarantees completeness; this
// is the visible prompt the reviewer (and user) sees before any AI send.

import {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useMemo,
} from "react";
import Link from "next/link";
import { Sparkles, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";

interface AiConsentValue {
  /**
   * Resolves true if consented (showing the modal first when needed). Pass
   * force=true to re-show the modal even if local state thinks we're consented
   * — used to recover from a stale 403 when consent was revoked elsewhere.
   */
  ensureConsent: (force?: boolean) => Promise<boolean>;
  consented: boolean;
  /** Withdraw consent (AccountPage). Blocks AI again until re-consented. Throws on failure. */
  revokeConsent: () => Promise<void>;
}

const AiConsentContext = createContext<AiConsentValue>({
  ensureConsent: async () => false,
  consented: false,
  revokeConsent: async () => {},
});

export function useAiConsent() {
  return useContext(AiConsentContext);
}

export function AiConsentProvider({
  initialConsented,
  children,
}: {
  initialConsented: boolean;
  children: React.ReactNode;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { t } = useLanguage();
  const [consented, setConsented] = useState(initialConsented);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const resolverRef = useRef<((v: boolean) => void) | null>(null);

  const settle = useCallback((v: boolean) => {
    setOpen(false);
    setBusy(false);
    const resolve = resolverRef.current;
    resolverRef.current = null;
    resolve?.(v);
  }, []);

  const ensureConsent = useCallback(
    async (force = false) => {
      if (!force && consented) return true;
      setOpen(true);
      return new Promise<boolean>((resolve) => {
        resolverRef.current = resolve;
      });
    },
    [consented]
  );

  const agree = useCallback(async () => {
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { ai_consent_at: new Date().toISOString() },
      });
      if (error) throw error;
      setConsented(true);
      settle(true);
    } catch {
      // Couldn't record consent (offline / transient). Resolve false so we don't
      // proceed to send data; the user can try again.
      settle(false);
    }
  }, [supabase, settle]);

  const revokeConsent = useCallback(async () => {
    // updateUser returns {error} rather than throwing — surface it so the caller
    // doesn't flip the UI to "withdrawn" while the server still holds consent.
    const { error } = await supabase.auth.updateUser({
      data: { ai_consent_at: null },
    });
    if (error) throw error;
    setConsented(false);
  }, [supabase]);

  const value = useMemo(
    () => ({ ensureConsent, consented, revokeConsent }),
    [ensureConsent, consented, revokeConsent]
  );

  return (
    <AiConsentContext.Provider value={value}>
      {children}
      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ai-consent-title"
        >
          {/* Backdrop — tapping it counts as "Not now" (declined). */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => !busy && settle(false)}
          />
          <div
            className="relative w-full max-w-sm bg-white p-5 shadow-xl"
            style={{ borderRadius: "10px 2px 10px 2px" }}
          >
            <div className="flex items-center gap-2 mb-2">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                style={{ background: "linear-gradient(135deg, #00d4f7, #c84b8a, #482d7c)" }}
              >
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <h2
                id="ai-consent-title"
                className="text-[17px] text-black"
                style={{ fontFamily: "'Hammersmith One', sans-serif" }}
              >
                {t("consent.title")}
              </h2>
            </div>
            <p className="text-sm leading-relaxed text-gray-700">
              {t("consent.body")}
            </p>
            <Link
              href="/privacy"
              className="inline-block mt-2 text-xs underline"
              style={{ color: "#284e72" }}
            >
              {t("consent.learn_more")}
            </Link>
            <div className="flex flex-col gap-2 mt-4">
              <button
                type="button"
                onClick={agree}
                disabled={busy}
                className="w-full h-11 rounded-[10px_2px_10px_2px] text-white flex items-center justify-center gap-2 transition-opacity active:opacity-80 disabled:opacity-60"
                style={{ background: "linear-gradient(to right, #284e72, #482d7c)" }}
              >
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                <span style={{ fontFamily: "'Hammersmith One', sans-serif" }}>
                  {t("consent.agree")}
                </span>
              </button>
              <button
                type="button"
                onClick={() => settle(false)}
                disabled={busy}
                className="w-full h-11 rounded-[10px_2px_10px_2px] text-[#284e72] font-medium border transition-opacity active:opacity-80 disabled:opacity-60"
                style={{ borderColor: "#dccaff", backgroundColor: "#fbf6ff" }}
              >
                {t("consent.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}
    </AiConsentContext.Provider>
  );
}
