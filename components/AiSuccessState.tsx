// Shared success checkmark animation. Used by both the voice flow
// (ConversationInput) and the typed flow (WritePersonForm). Lifted verbatim
// from ConversationInput's original inline success step.

import { CheckCircle2 } from "lucide-react";

export function AiSuccessState({ label }: { label: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center py-20 gap-4"
      aria-live="polite"
    >
      <div
        className="w-24 h-24 rounded-full flex items-center justify-center"
        style={{ background: "linear-gradient(135deg, #d0f2ff, #dccaff)" }}
      >
        <CheckCircle2 className="w-12 h-12" style={{ color: "#284e72" }} />
      </div>
      <p
        className="text-[20px] uppercase text-black"
        style={{ fontFamily: "'Hammersmith One', sans-serif" }}
      >
        {label}
      </p>
    </div>
  );
}
