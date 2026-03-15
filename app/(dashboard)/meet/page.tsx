// Mic / Log a Meeting page — matches the Figma mic page design.
// When ?personId=... is in the URL, goes directly into "add details for this person" mode.

import { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { ConversationInput } from "@/components/ConversationInput";

export const metadata: Metadata = {
  title: "Log a Meeting — RememberOne",
};

interface Props {
  searchParams: { personId?: string };
}

export default async function MeetPage({ searchParams }: Props) {
  let targetPersonId: string | undefined;
  let targetPersonName: string | undefined;

  if (searchParams.personId) {
    const supabase = createClient();
    const { data } = await supabase
      .from("people")
      .select("id, name")
      .eq("id", searchParams.personId)
      .single();
    if (data) {
      targetPersonId = data.id;
      targetPersonName = data.name;
    }
  }

  return (
    <div className="w-full max-w-lg mx-auto">
      <ConversationInput
        personId={targetPersonId}
        personName={targetPersonName}
      />
    </div>
  );
}
