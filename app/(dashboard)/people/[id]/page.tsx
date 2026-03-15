// Person profile page — full detail + editing for a saved person.
// Matches the RememberOne Figma design system.

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPersonFull } from "@/lib/people";
import { ProfileEditor } from "@/components/ProfileEditor";
import { EditableName } from "@/components/EditableName";
import { FamilyMemberCard } from "@/components/FamilyMemberCard";
import { AddFamilyMemberForm } from "@/components/AddFamilyMemberForm";
import { AddNotesInput } from "@/components/AddNotesInput";
import { DeletePersonButton } from "@/components/DeletePersonButton";
import { PersonLastMet } from "@/components/PersonLastMet";
import { MeetingHistory } from "@/components/MeetingHistory";
import { T } from "@/components/T";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import Link from "next/link";
import { ArrowLeft, Mic } from "lucide-react";
import { getInitials, capitalize } from "@/lib/utils";

const INTEREST_KEYS = ["interest", "hobby", "hobbies", "sport", "sports", "passion", "likes"];
function isInterest(key: string) {
  return INTEREST_KEYS.some((k) => key.toLowerCase().includes(k));
}

interface Props {
  params: { id: string };
}

export async function generateMetadata({ params }: Props) {
  const supabase = createClient();
  const { data } = await supabase
    .from("people")
    .select("name")
    .eq("id", params.id)
    .single();
  return {
    title: data ? `${data.name} — RememberOne` : "Person — RememberOne",
  };
}

export default async function PersonPage({ params }: Props) {
  const supabase = createClient();
  const person = await getPersonFull(supabase, params.id);
  if (!person) notFound();

  const mainInfo = person.attributes.filter((a) => !isInterest(a.key));
  const interests = person.attributes.filter((a) => isInterest(a.key));

  return (
    <div className="w-full max-w-lg mx-auto space-y-5">
      {/* Back — desktop only */}
      <Link
        href="/"
        className="hidden md:inline-flex items-center gap-1 text-sm transition-opacity hover:opacity-70"
        style={{ color: "#284e72" }}
      >
        <ArrowLeft className="w-4 h-4" />
        <T k="person.back" />
      </Link>

      {/* ── Person header ───────────────────────────────────────────────── */}
      <div
        className="p-5"
        style={{
          borderRadius: "10px 2px 10px 2px",
          background: "linear-gradient(52deg, #d0f2ff 0%, #dccaff 100%)",
        }}
      >
        <div className="flex items-start gap-4">
          <Avatar className="w-16 h-16 shrink-0">
            <AvatarFallback
              className="text-xl font-bold"
              style={{ backgroundColor: "#dccaff", color: "#284e72" }}
            >
              {getInitials(person.name)}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <EditableName personId={person.id} initialName={person.name} />

            {person.meetings.length > 0 && (
              <PersonLastMet
                lastMeetingDate={person.meetings[0].meeting_date}
                totalMeetings={person.meetings.length}
              />
            )}

            {/* Main info chips */}
            {mainInfo.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {mainInfo.map((attr) => (
                  <span
                    key={attr.id}
                    className="text-[10px] px-2 py-[3px] rounded-[5px] shadow-sm text-black"
                    style={{ backgroundColor: "rgba(220, 202, 255, 0.7)" }}
                  >
                    {capitalize(attr.key)}: {attr.value}
                  </span>
                ))}
              </div>
            )}
          </div>

          <DeletePersonButton personId={person.id} personName={person.name} />
        </div>

        {/* Interests */}
        {interests.length > 0 && (
          <div className="mt-4">
            <p
              className="text-[10px] uppercase tracking-wider mb-2"
              style={{ color: "#665b7b", fontFamily: "'Hammersmith One', sans-serif" }}
            >
              <T k="person.interest_section" />
            </p>
            <div className="flex flex-wrap gap-1.5">
              {interests.map((a) => (
                <span
                  key={a.id}
                  className="text-[10px] px-2 py-[3px] rounded-[5px] shadow-sm text-black"
                  style={{ backgroundColor: "rgba(220, 202, 255, 0.7)" }}
                >
                  {a.value}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Log another meeting shortcut ──────────────────────────────── */}
      <Link
        href={`/meet?personId=${person.id}`}
        className="flex items-center justify-center gap-2 w-full h-12 rounded-[10px_2px_10px_2px] text-white transition-opacity active:opacity-80"
        style={{ background: "linear-gradient(to right, #284e72, #482d7c)" }}
      >
        <Mic className="w-4 h-4" />
        <span style={{ fontFamily: "'Hammersmith One', sans-serif" }}>
          <T k="person.log_meeting_with" /> {person.name.split(" ")[0].toUpperCase()}
        </span>
      </Link>

      {/* ── Add notes / voice input ───────────────────────────────────── */}
      <div
        className="p-4 rounded-[10px_2px_10px_2px]"
        style={{ backgroundColor: "#f5f0ff", border: "1px solid #dccaff" }}
      >
        <AddNotesInput personId={person.id} personName={person.name} />
      </div>

      {/* ── Edit attributes ───────────────────────────────────────────── */}
      <div
        className="p-4 rounded-[10px_2px_10px_2px]"
        style={{ backgroundColor: "#f5f0ff", border: "1px solid #dccaff" }}
      >
        <p
          className="text-[13px] uppercase mb-3"
          style={{ color: "#665b7b", fontFamily: "'Hammersmith One', sans-serif" }}
        >
          <T k="person.edit_details" />
        </p>
        <ProfileEditor
          personId={person.id}
          initialAttributes={person.attributes}
          initialNotes={person.notes ?? ""}
        />
      </div>

      {/* ── Family members ────────────────────────────────────────────── */}
      <div
        className="p-4 rounded-[10px_2px_10px_2px]"
        style={{ backgroundColor: "#f5f0ff", border: "1px solid #dccaff" }}
      >
        <p
          className="text-[13px] uppercase mb-3"
          style={{ color: "#665b7b", fontFamily: "'Hammersmith One', sans-serif" }}
        >
          <T k="person.family_section" />
        </p>
        <div className="space-y-3">
          {person.family_members.map((fm) => (
            <FamilyMemberCard key={fm.id} familyMember={fm} personId={person.id} />
          ))}
          <AddFamilyMemberForm personId={person.id} />
        </div>
      </div>

      {/* ── Meeting history ───────────────────────────────────────────── */}
      <MeetingHistory meetings={person.meetings} />

      <div className="h-4" />
    </div>
  );
}
