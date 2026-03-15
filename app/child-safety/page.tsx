import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { translate, type LanguageCode } from "@/lib/i18n";

export const metadata = { title: "Child Safety Standards — RememberOne" };

export default async function ChildSafetyPage() {
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
    { titleKey: "child.commitment.title", bodyKey: "child.commitment.body" },
    { titleKey: "child.prohibited.title", bodyKey: "child.prohibited.body" },
    { titleKey: "child.reporting.title",  bodyKey: "child.reporting.body" },
    { titleKey: "child.compliance.title", bodyKey: "child.compliance.body" },
    { titleKey: "child.prevention.title", bodyKey: "child.prevention.body" },
    { titleKey: "child.contact.title",    bodyKey: "child.contact.body" },
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
            {t("child.title")}
          </h1>
          <p className="text-[13px] mt-1" style={{ color: "#5e7983" }}>
            {t("child.updated")}
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
