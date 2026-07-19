"use client";

import { createContext, useContext, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { type LanguageCode, translate } from "@/lib/i18n";
import { LanguagePickerModal } from "@/components/LanguagePickerModal";

interface LanguageContextType {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => Promise<void>;
  t: (key: string) => string;
  /** True while the first-run language picker is on screen (tour waits on it). */
  pickerOpen: boolean;
}

const LanguageContext = createContext<LanguageContextType>({
  language: "en",
  setLanguage: async () => {},
  t: (key) => key,
  pickerOpen: false,
});

export function useLanguage() {
  return useContext(LanguageContext);
}

export function LanguageProvider({
  children,
  initialLanguage,
}: {
  children: React.ReactNode;
  initialLanguage: string | null;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [language, setLang] = useState<LanguageCode>(
    (initialLanguage as LanguageCode) ?? "en"
  );
  const [showPicker, setShowPicker] = useState(!initialLanguage);

  const setLanguage = useCallback(
    async (lang: LanguageCode) => {
      setLang(lang);
      setShowPicker(false);
      // Persist to the server only when online — offline this would hang/reject
      // and nothing queues it. The choice still applies locally for this session.
      if (typeof navigator !== "undefined" && navigator.onLine) {
        try {
          await supabase.auth.updateUser({ data: { language: lang } });
        } catch {
          /* transient — local state already updated */
        }
      }
    },
    [supabase]
  );

  const t = useCallback((key: string) => translate(key, language), [language]);

  // Memoize so consumers (the <T> component, CalendarView, …) don't re-render on
  // every unrelated parent render — only when language actually changes.
  const value = useMemo(
    () => ({ language, setLanguage, t, pickerOpen: showPicker }),
    [language, setLanguage, t, showPicker]
  );

  return (
    <LanguageContext.Provider value={value}>
      {showPicker && <LanguagePickerModal onSelect={setLanguage} />}
      {children}
    </LanguageContext.Provider>
  );
}
