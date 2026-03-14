// Mic / Log a Meeting page — matches the Figma mic page design.
// ConversationInput handles the full flow: record → extract → preview → save.

import { Metadata } from "next";
import { ConversationInput } from "@/components/ConversationInput";

export const metadata: Metadata = {
  title: "Log a Meeting — RememberOne",
};

export default function MeetPage() {
  return (
    <div className="w-full max-w-lg mx-auto">
      <ConversationInput />
    </div>
  );
}
