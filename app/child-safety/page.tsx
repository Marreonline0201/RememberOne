import Link from "next/link";

export const metadata = { title: "Child Safety Standards — RememberOne" };

export default function ChildSafetyPage() {
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
            Child Safety Standards
          </h1>
          <p className="text-[13px] mt-1" style={{ color: "#5e7983" }}>
            Last updated: March 2026
          </p>
        </div>

        {[
          {
            title: "Our Commitment",
            body: "RememberOne is committed to the safety and protection of children. We have zero tolerance for child sexual abuse material (CSAM) or any content that exploits or endangers minors.",
          },
          {
            title: "Prohibited Content",
            body: "Our platform strictly prohibits the creation, distribution, or storage of any content that sexually exploits or abuses minors. Any such content will be immediately removed, and the responsible accounts will be permanently banned.",
          },
          {
            title: "Reporting Mechanism",
            body: "Users can report child safety concerns directly in the app. If you encounter any content or behavior that may endanger a child, please contact us immediately at support@rememberone.app. All reports are reviewed promptly.",
          },
          {
            title: "Compliance",
            body: "RememberOne complies with all applicable child safety laws and regulations. We report confirmed CSAM to the National Center for Missing & Exploited Children (NCMEC) and cooperate fully with law enforcement agencies.",
          },
          {
            title: "Prevention Practices",
            body: "We employ technical measures and human review processes to detect and prevent child exploitation. Our moderation policies are regularly reviewed and updated to meet evolving safety standards.",
          },
          {
            title: "Contact",
            body: "For child safety concerns or questions about our standards, contact our designated safety officer at support@rememberone.app.",
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
