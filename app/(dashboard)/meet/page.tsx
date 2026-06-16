// Mic / Log a Meeting page — a thin wrapper so it renders fully client-side and
// opens offline (the cached shell is data-free). ?personId=... is read on the
// client (MeetClient) and the name is resolved from the local store; the AI
// logging flow itself stays online-only (guarded inside ConversationInput).

import { Metadata } from "next";
import { Suspense } from "react";
import { MeetClient } from "@/components/MeetClient";
import RememberOneLoader from "@/components/RememberOneLoader";

export const metadata: Metadata = {
  title: "Log a Meeting — RememberOne",
};

export default function MeetPage() {
  return (
    <div className="w-full max-w-lg mx-auto">
      {/* MeetClient reads ?personId via useSearchParams, which suspends. Without a
          fallback the content area renders null (blank) until it resolves — give
          it the same loader the dashboard uses so the screen is never empty. */}
      <Suspense fallback={<RememberOneLoader />}>
        <MeetClient />
      </Suspense>
    </div>
  );
}
