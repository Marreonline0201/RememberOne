// Meet page — user describes who they just met; AI extracts info

import { Metadata } from "next";
import { ConversationInput } from "@/components/ConversationInput";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Log a Meeting — RememberOne",
};

export default function MeetPage() {
  return (
    /*
      Mobile: full-screen feel — no extra max-width constraint, generous padding.
      Desktop: centered, comfortable reading width.
    */
    <div className="w-full max-w-2xl mx-auto space-y-5">
      {/* Back navigation — visible on desktop; on mobile, the bottom tab serves as nav */}
      <Button
        variant="ghost"
        size="sm"
        asChild
        className="hidden md:inline-flex -ml-2"
      >
        <Link href="/">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to dashboard
        </Link>
      </Button>

      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 md:text-2xl">
          Log a meeting
        </h1>
        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
          Describe who you met in your own words. AI will extract their details
          and save them to your contacts.
        </p>
      </div>

      {/* Example hint — collapsible feel via details on mobile */}
      <details className="group rounded-xl border border-dashed border-gray-300 bg-gray-50 overflow-hidden">
        <summary className="flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 cursor-pointer select-none list-none">
          <span>See an example</span>
          <svg
            className="w-4 h-4 text-muted-foreground transition-transform group-open:rotate-180"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </summary>
        <div className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed">
          &quot;Today I met Eric at the conference. He&apos;s a software engineer at
          Google, went to Stony Brook University. He has a son named Mike who
          also attends Stony Brook, and a daughter named Sophia who&apos;s 8 years
          old. Eric loves golf and his wife is named Karen.&quot;
        </div>
      </details>

      {/* Main input component */}
      <ConversationInput />
    </div>
  );
}
