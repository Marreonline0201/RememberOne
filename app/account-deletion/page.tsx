// Public account-deletion policy page.
// Required by Google Play's Data Safety requirements for apps that collect
// user data: the URL must be active, not editable, reachable worldwide, and
// reachable without signing in.
//
// Do NOT gate this page behind auth. Middleware has /account-deletion in its
// public-paths allow-list.

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { LanguageCode } from "@/lib/i18n";

export const metadata = {
  title: "Delete your account — RememberOne",
  description:
    "How to delete your RememberOne account and all associated data.",
};

type Step = (string | { strong: string })[];

export default async function AccountDeletionPage() {
  // Best-effort locale: read from session if available, otherwise English.
  let lang: LanguageCode = "en";
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.user_metadata?.language === "ko") lang = "ko";
  } catch {
    // unauthenticated visitors land here too — stay on English
  }

  const content = getContent(lang);

  return (
    <main className="min-h-screen bg-background px-5 py-10 md:py-16">
      <div className="max-w-2xl mx-auto space-y-8">
        <header className="space-y-3">
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:underline"
          >
            ← RememberOne
          </Link>
          <h1 className="text-3xl font-semibold tracking-tight">
            {content.title}
          </h1>
          <p className="text-muted-foreground leading-relaxed">
            {content.intro}
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{content.inApp}</h2>
          <ol className="list-decimal pl-6 space-y-1 text-sm leading-relaxed">
            {content.inAppSteps.map((step, i) => (
              <li key={i}>{renderStep(step)}</li>
            ))}
          </ol>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{content.email}</h2>
          <p className="text-sm leading-relaxed">{content.emailBody}</p>
          <p className="text-sm">
            <a
              href="mailto:ddogroundonline@gmail.com?subject=RememberOne%20account%20deletion%20request"
              className="text-primary hover:underline font-medium"
            >
              ddogroundonline@gmail.com
            </a>
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{content.whatHappens}</h2>
          <ul className="list-disc pl-6 space-y-1 text-sm leading-relaxed">
            {content.whatHappensList.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{content.retention}</h2>
          <p className="text-sm leading-relaxed">{content.retentionBody}</p>
        </section>

        <footer className="pt-6 border-t text-xs text-muted-foreground">
          <Link href="/privacy" className="hover:underline">
            Privacy Policy
          </Link>
          <span className="mx-2">·</span>
          <Link href="/child-safety" className="hover:underline">
            Child Safety
          </Link>
        </footer>
      </div>
    </main>
  );
}

function renderStep(parts: Step) {
  return parts.map((part, i) =>
    typeof part === "string" ? (
      <span key={i}>{part}</span>
    ) : (
      <strong key={i}>{part.strong}</strong>
    )
  );
}

function getContent(lang: LanguageCode) {
  if (lang === "ko") {
    return {
      title: "계정 삭제 요청",
      intro:
        "RememberOne 계정과 이에 연결된 모든 데이터는 언제든지 삭제할 수 있습니다. 삭제는 영구적이며, 완료 후 30일 이내에 모든 백업에서 제거됩니다.",
      inApp: "앱에서 직접 삭제하기 (권장)",
      inAppSteps: [
        ["RememberOne 앱을 열고 로그인합니다."],
        ["오른쪽 하단의 ", { strong: "계정(Account)" }, " 탭으로 이동합니다."],
        [{ strong: "계정 삭제(Delete Account)" }, " 버튼을 누릅니다."],
        [
          "확인 대화상자에서 ",
          { strong: "삭제(Delete)" },
          "를 다시 눌러 확정합니다.",
        ],
      ] satisfies Step[],
      email: "이메일로 요청하기",
      emailBody:
        "앱에 접근할 수 없거나 다른 이유로 직접 삭제가 어려우시면, 가입 시 사용한 이메일 주소로 아래 주소에 메일을 보내 주세요:",
      whatHappens: "삭제되는 항목",
      whatHappensList: [
        "계정(이메일, 이름, 로그인 자격 증명)",
        "저장된 사람들의 프로필과 모든 속성",
        "가족 구성원 및 미팅 기록",
        "Google 캘린더 연결 토큰(즉시 폐기)",
      ],
      retention: "보관 기간",
      retentionBody:
        "삭제 요청 후 30일 동안 백업에서 데이터가 제거됩니다. 30일이 지나면 데이터는 완전히 복구 불가능합니다. 법적으로 보관이 요구되는 데이터는 이 정책의 적용을 받지 않습니다.",
    };
  }
  return {
    title: "Delete your account",
    intro:
      "You can permanently delete your RememberOne account and every piece of data associated with it at any time. Deletion is irreversible, and the data is purged from all backups within 30 days.",
    inApp: "Delete from inside the app (recommended)",
    inAppSteps: [
      ["Open the RememberOne app and sign in."],
      [
        "Go to the ",
        { strong: "Account" },
        " tab at the bottom-right.",
      ],
      ["Tap ", { strong: "Delete Account" }, "."],
      [
        "Confirm by tapping ",
        { strong: "Delete" },
        " again in the dialog.",
      ],
    ] satisfies Step[],
    email: "Request by email",
    emailBody:
      "If you cannot access the app, or you prefer to request deletion by email, send a message from the email address you used to sign up to:",
    whatHappens: "What gets deleted",
    whatHappensList: [
      "Your account (email, name, sign-in credentials)",
      "Every person profile you've saved and all of their attributes",
      "Family members and meeting history tied to those profiles",
      "Google Calendar connection tokens (revoked immediately)",
    ],
    retention: "Retention",
    retentionBody:
      "After a deletion request, your data is removed from backups within 30 days. After that window it is irrecoverable. Data we are legally required to retain (e.g., billing records if applicable) is not covered by this policy.",
  };
}
