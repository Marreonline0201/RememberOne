"use client";

import { createContext, useContext, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { type LanguageCode, translate } from "@/lib/i18n";
import { LanguagePickerModal } from "@/components/LanguagePickerModal";

interface LanguageContextType {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => Promise<void>;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: "en",
  setLanguage: async () => {},
  t: (key) => key,
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
  const supabase = createClient();
  const [language, setLang] = useState<LanguageCode>(
    (initialLanguage as LanguageCode) ?? "en"
  );
  const [showPicker, setShowPicker] = useState(!initialLanguage);

  async function setLanguage(lang: LanguageCode) {
    setLang(lang);
    setShowPicker(false);
    await supabase.auth.updateUser({ data: { language: lang } });
  }

  return (
    <LanguageContext.Provider
      value={{ language, setLanguage, t: (key) => translate(key, language) }}
    >
      {showPicker && <LanguagePickerModal onSelect={setLanguage} />}
      {children}
    </LanguageContext.Provider>
  );
}
