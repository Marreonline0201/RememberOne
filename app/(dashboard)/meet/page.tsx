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
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Back navigation */}
      <Button variant="ghost" size="sm" asChild>
        <Link href="/">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to dashboard
        </Link>
      </Button>

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Log a meeting</h1>
        <p className="text-muted-foreground mt-1">
          Describe who you met in your own words. AI will extract their details
          and save them to your profile.
        </p>
      </div>

      {/* Example hints */}
      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-muted-foreground space-y-1">
        <p className="font-medium text-gray-700">Example:</p>
        <p>
          &quot;Today I met Eric at the conference. He&apos;s a software engineer at
          Google, went to Stony Brook University. He has a son named Mike who
          also attends Stony Brook, and a daughter named Sophia who&apos;s 8 years
          old. Eric loves golf and his wife is named Karen.&quot;
        </p>
      </div>

      {/* Main input component */}
      <ConversationInput />
    </div>
  );
}
