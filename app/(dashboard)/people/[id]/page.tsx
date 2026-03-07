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
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Back navigation */}
      <Button variant="ghost" size="sm" asChild>
        <Link href="/">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to dashboard
        </Link>
      </Button>

      {/* Person header */}
      <div className="flex items-start gap-4">
        <Avatar className="w-16 h-16 text-lg">
          <AvatarFallback className="bg-blue-100 text-blue-700 font-semibold">
            {getInitials(person.name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900">{person.name}</h1>
          {person.meetings.length > 0 && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {person.meetings[0].summary}
            </p>
          )}
          <div className="flex flex-wrap gap-2 mt-2">
            {person.meetings.map((m) => (
              <Badge key={m.id} variant="secondary" className="text-xs gap-1">
                <Calendar className="w-3 h-3" />
                {formatDate(m.meeting_date)}
                {m.location && (
                  <>
                    <MapPin className="w-3 h-3 ml-1" />
                    {m.location}
                  </>
                )}
              </Badge>
            ))}
          </div>
        </div>
        <DeletePersonButton personId={person.id} personName={person.name} />
      </div>

      <Separator />

      {/* Add notes / voice input */}
      <AddNotesInput personId={person.id} personName={person.name} />

      <Separator />

      {/* Editable attributes */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900">Details</h2>
        <ProfileEditor
          personId={person.id}
          initialAttributes={person.attributes}
          initialNotes={person.notes ?? ""}
        />
      </section>

      {/* Family members */}
      {person.family_members.length > 0 && (
        <>
          <Separator />
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-gray-900">
              Family members
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {person.family_members.map((fm) => (
                <FamilyMemberCard key={fm.id} familyMember={fm} personId={person.id} />
              ))}
            </div>
          </section>
        </>
      )}

      {/* Meeting history */}
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
                  className="rounded-lg border bg-card p-4 text-sm space-y-1"
                >
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{formatDate(m.meeting_date)}</span>
                    {m.location && (
                      <>
                        <MapPin className="w-3.5 h-3.5 ml-1" />
                        <span>{m.location}</span>
                      </>
                    )}
                  </div>
                  {m.summary && (
                    <p className="text-gray-700">{m.summary}</p>
                  )}
                  <details className="mt-1">
                    <summary className="cursor-pointer text-xs text-muted-foreground hover:text-gray-600">
                      View original notes
                    </summary>
                    <p className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap">
                      {m.raw_input}
                    </p>
                  </details>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
