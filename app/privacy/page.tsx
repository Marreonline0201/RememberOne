import Link from "next/link";

export const metadata = { title: "Privacy Policy — RememberOne" };

export default function PrivacyPolicy() {
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
            Privacy Policy
          </h1>
          <p className="text-[13px] mt-1" style={{ color: "#5e7983" }}>
            Last updated: March 2026
          </p>
        </div>

        {[
          {
            title: "What we collect",
            body: "We collect your email address and name when you create an account. We also store the information you choose to log about people you meet — including their names, attributes, family members, and meeting notes.",
          },
          {
            title: "How we use your data",
            body: "Your data is used solely to provide the RememberOne service — storing your contacts and generating AI-powered summaries from your meeting notes. We do not sell or share your data with third parties.",
          },
          {
            title: "AI processing",
            body: "When you log a meeting, the text you provide is sent to an AI service (Anthropic Claude) to extract structured information. This text is processed to provide the service and is not used to train AI models.",
          },
          {
            title: "Google Calendar",
            body: "If you connect Google Calendar, we access your calendar events only to show upcoming meeting reminders within the app. We do not store or share your calendar data.",
          },
          {
            title: "Data storage",
            body: "Your data is stored securely using Supabase. We use industry-standard encryption in transit and at rest.",
          },
          {
            title: "Account deletion",
            body: "You can request deletion of your account and all associated data at any time by visiting your Account page in the app and following the deletion instructions. All data is permanently removed within 30 days.",
          },
          {
            title: "Contact",
            body: "For any privacy-related questions or requests, contact us at comgamemarre@gmail.com.",
          },
        ].map(({ title, body }) => (
          <div
            key={title}
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
              {title}
            </p>
            <p className="text-[13px] leading-relaxed" style={{ color: "#5e7983" }}>
              {body}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
