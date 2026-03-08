// Person profile page — shows all saved info about a single person

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPersonFull } from "@/lib/people";
import { ProfileEditor } from "@/components/ProfileEditor";
import { FamilyMemberCard } from "@/components/FamilyMemberCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Calendar, MapPin } from "lucide-react";
import Link from "next/link";
import { formatDate, getInitials } from "@/lib/utils";
import { DeletePersonButton } from "@/components/DeletePersonButton";
import { AddNotesInput } from "@/components/AddNotesInput";

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

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* Back navigation — desktop only; bottom tab bar serves mobile */}
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

      {/* ── Person header ─────────────────────────────────────────────── */}
      <div className="flex items-start gap-4">
        <Avatar className="w-14 h-14 md:w-16 md:h-16 text-lg shrink-0">
          <AvatarFallback className="bg-blue-100 text-blue-700 font-semibold text-lg">
            {getInitials(person.name)}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-gray-900 md:text-2xl leading-tight">
            {person.name}
          </h1>
          {person.meetings.length > 0 && (
            <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
              {person.meetings[0].summary}
            </p>
          )}
          {/* Meeting badges — wrap naturally, no overflow */}
          <div className="flex flex-wrap gap-2 mt-2">
            {person.meetings.map((m) => (
              <Badge
                key={m.id}
                variant="secondary"
                className="text-xs gap-1 py-1"
              >
                <Calendar className="w-3 h-3" />
                {formatDate(m.meeting_date)}
                {m.location && (
                  <>
                    <MapPin className="w-3 h-3 ml-0.5" />
                    {m.location}
                  </>
                )}
              </Badge>
            ))}
          </div>
        </div>

        {/* Delete — always visible but small */}
        <div className="shrink-0">
          <DeletePersonButton personId={person.id} personName={person.name} />
        </div>
      </div>

      <Separator />

      {/* ── Add notes / voice input ───────────────────────────────────── */}
      <AddNotesInput personId={person.id} personName={person.name} />

      <Separator />

      {/* ── Editable attributes ───────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900">Details</h2>
        <ProfileEditor
          personId={person.id}
          initialAttributes={person.attributes}
          initialNotes={person.notes ?? ""}
        />
      </section>

      {/* ── Family members ────────────────────────────────────────────── */}
      {person.family_members.length > 0 && (
        <>
          <Separator />
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-gray-900">
              Family members
            </h2>
            {/*
              Single column on mobile (cards are tall enough to need full width).
              Two columns on sm+ where width allows.
            */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {person.family_members.map((fm) => (
                <FamilyMemberCard
                  key={fm.id}
                  familyMember={fm}
                  personId={person.id}
                />
              ))}
            </div>
          </section>
        </>
      )}

      {/* ── Meeting history ───────────────────────────────────────────── */}
      {person.meetings.length > 0 && (
        <>
          <Separator />
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-gray-900">
              Meeting history
            </h2>
            <div className="space-y-3">
              {person.meetings.map((m) => (
                <div
                  key={m.id}
                  className="rounded-xl border bg-card p-4 text-sm space-y-2"
                >
                  <div className="flex items-center gap-2 text-muted-foreground flex-wrap">
                    <Calendar className="w-3.5 h-3.5 shrink-0" />
                    <span>{formatDate(m.meeting_date)}</span>
                    {m.location && (
                      <>
                        <MapPin className="w-3.5 h-3.5 shrink-0 ml-1" />
                        <span>{m.location}</span>
                      </>
                    )}
                  </div>
                  {m.summary && (
                    <p className="text-gray-700 leading-relaxed">{m.summary}</p>
                  )}
                  <details className="mt-1">
                    <summary className="cursor-pointer text-xs text-muted-foreground hover:text-gray-600 select-none">
                      View original notes
                    </summary>
                    <p className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
                      {m.raw_input}
                    </p>
                  </details>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {/* Bottom spacer so content clears the mobile tab bar */}
      <div className="h-4 md:h-0" />
    </div>
  );
}
