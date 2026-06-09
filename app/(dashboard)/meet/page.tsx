// Mic / Log a Meeting page — a thin wrapper so it renders fully client-side and
// opens offline (the cached shell is data-free). ?personId=... is read on the
// client (MeetClient) and the name is resolved from the local store; the AI
// logging flow itself stays online-only (guarded inside ConversationInput).

import { Metadata } from "next";
import { Suspense } from "react";
import { MeetClient } from "@/components/MeetClient";

export const metadata: Metadata = {
  title: "Log a Meeting — RememberOne",
};

export default function MeetPage() {
  return (
    <div className="w-full max-w-lg mx-auto">
      <Suspense>
        <MeetClient />
      </Suspense>
    </div>
  );
}
