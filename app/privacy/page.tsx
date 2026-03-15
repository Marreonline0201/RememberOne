import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { translate, type LanguageCode } from "@/lib/i18n";

export const metadata = { title: "Privacy Policy — RememberOne" };

export default async function PrivacyPolicy() {
  // Read language from user metadata if logged in; fallback to English.
  let lang: LanguageCode = "en";
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.user_metadata?.language === "ko") lang = "ko";
  } catch {
    // not logged in or error — default English
  }

  const t = (key: string) => translate(key, lang);

  const sections = [
    { titleKey: "privacy.collect.title", bodyKey: "privacy.collect.body" },
    { titleKey: "privacy.use.title",     bodyKey: "privacy.use.body" },
    { titleKey: "privacy.ai.title",      bodyKey: "privacy.ai.body" },
    { titleKey: "privacy.calendar.title",bodyKey: "privacy.calendar.body" },
    { titleKey: "privacy.storage.title", bodyKey: "privacy.storage.body" },
    { titleKey: "privacy.deletion.title",bodyKey: "privacy.deletion.body" },
    { titleKey: "privacy.contact.title", bodyKey: "privacy.contact.body" },
  ];

  return (
    <div className="min-h-screen px-5 py-10" style={{ backgroundColor: "#fbf6ff" }}>
      <div className="max-w-lg mx-auto space-y-6">
        <Link
          href="/"
          className="block text-[13px] uppercase tracking-wide"
          style={{ color: "#665b7b", fontFamily: "'Hammersmith One', sans-serif" }}
        >
          ← RememberOne
        </Link>
        <div>
          <h1
            className="text-[28px] uppercase text-black"
            style={{ fontFamily: "'Hammersmith One', sans-serif" }}
          >
            {t("privacy.title")}
          </h1>
          <p className="text-[13px] mt-1" style={{ color: "#5e7983" }}>
            {t("privacy.updated")}
          </p>
        </div>

        {sections.map(({ titleKey, bodyKey }) => (
          <div
            key={titleKey}
            className="p-4 rounded-[10px_2px_10px_2px]"
            style={{
              background: "linear-gradient(to bottom, #ddf6ff, #faf5ff) padding-box, linear-gradient(to bottom, #5e7983, #c9a8e8) border-box",
              border: "1px solid transparent",
            }}
          >
            <p
              className="text-[13px] uppercase mb-2"
              style={{ color: "#665b7b", fontFamily: "'Hammersmith One', sans-serif" }}
            >
              {t(titleKey)}
            </p>
            <p className="text-[13px] leading-relaxed" style={{ color: "#5e7983" }}>
              {t(bodyKey)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
