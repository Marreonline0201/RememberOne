// Write-a-Person page — the typed counterpart to /meet. A thin wrapper so it
// renders client-side and opens offline (the cached shell is data-free); the AI
// organize step itself stays online-only (guarded inside WritePersonForm).
// Suspense mirrors meet/page.tsx so the content area shows the loader rather than
// a blank flash while the client component hydrates.

import { Metadata } from "next";
import { Suspense } from "react";
import { WritePersonForm } from "@/components/WritePersonForm";
import RememberOneLoader from "@/components/RememberOneLoader";

export const metadata: Metadata = {
  title: "Write a Person — RememberOne",
};

export default function MeetWritePage() {
  return (
    <div className="w-full max-w-lg mx-auto">
      <Suspense fallback={<RememberOneLoader />}>
        <WritePersonForm />
      </Suspense>
    </div>
  );
}
