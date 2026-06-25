// Shared "AI is working" animation — the pinging gradient circle + sparkle.
// Used by both the voice flow (ConversationInput) and the typed flow
// (WritePersonForm) so the two paths look identical. Lifted verbatim from
// ConversationInput's original inline loading step.

import { Sparkles } from "lucide-react";

export function AiLoadingState({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center py-20 gap-6"
      aria-live="polite"
    >
      <div className="relative flex items-center justify-center">
        <span
          className="absolute w-28 h-28 rounded-full opacity-20 animate-ping"
          style={{ backgroundColor: "#dccaff" }}
        />
        <span
          className="absolute w-20 h-20 rounded-full opacity-20 animate-ping"
          style={{ backgroundColor: "#d0f2ff", animationDelay: "150ms" }}
        />
        <div
          className="relative w-24 h-24 rounded-full flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, #00d4f7, #c84b8a, #482d7c)" }}
        >
          <Sparkles className="w-10 h-10 text-white" />
        </div>
      </div>
      <p
        className="text-[18px] uppercase text-black text-center"
        style={{ fontFamily: "'Hammersmith One', sans-serif" }}
      >
        {title}
      </p>
      {subtitle && (
        <p className="text-[13px] text-center" style={{ color: "#5e7983" }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}
