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
import { ArrowLeft, Calendar, MapPin, Mic } from "lucide-react";
import Link from "next/link";
import { formatDate, formatRelativeDate, getInitials } from "@/lib/utils";
import { DeletePersonButton } from "@/components/DeletePersonButton";
import { AddNotesInput } from "@/components/AddNotesInput";

const PROFILE_PALETTES = [
  { strip: "from-blue-400 to-blue-600",    avatar: "bg-blue-100 text-blue-700",    ring: "ring-blue-300" },
  { strip: "from-violet-400 to-purple-600",avatar: "bg-violet-100 text-violet-700",ring: "ring-violet-300" },
  { strip: "from-emerald-400 to-teal-500", avatar: "bg-emerald-100 text-emerald-700",ring: "ring-emerald-300" },
  { strip: "from-orange-400 to-amber-500", avatar: "bg-orange-100 text-orange-700",ring: "ring-orange-300" },
  { strip: "from-pink-400 to-rose-500",    avatar: "bg-pink-100 text-pink-700",    ring: "ring-pink-300" },
  { strip: "from-teal-400 to-cyan-500",    avatar: "bg-teal-100 text-teal-700",    ring: "ring-teal-300" },
  { strip: "from-indigo-400 to-blue-500",  avatar: "bg-indigo-100 text-indigo-700",ring: "ring-indigo-300" },
  { strip: "from-fuchsia-400 to-pink-500", avatar: "bg-fuchsia-100 text-fuchsia-700",ring: "ring-fuchsia-300" },
];
function getProfilePalette(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return PROFILE_PALETTES[Math.abs(hash) % PROFILE_PALETTES.length];
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

  const palette = getProfilePalette(person.name);

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
        <Avatar className={`w-20 h-20 md:w-24 md:h-24 shrink-0 ring-4 ring-offset-2 ${palette.ring}`}>
          <AvatarFallback className={`font-bold text-2xl md:text-3xl ${palette.avatar}`}>
            {getInitials(person.name)}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-extrabold text-gray-900 md:text-2xl leading-tight">
              {person.name}
            </h1>
            {person.meetings.length > 0 && (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-2.5 py-0.5">
                <Calendar className="w-3 h-3" />
                {person.meetings.length} {person.meetings.length === 1 ? "meeting" : "meetings"}
              </span>
            )}
          </div>
          {(() => {
            const jobAttr = person.attributes.find((a) =>
              ["job title", "company", "occupation", "role", "title"].includes(
                a.key.toLowerCase()
              )
            );
            const subtitle = jobAttr?.value ?? (person.meetings[0]?.summary || null);
            return subtitle ? (
              <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{subtitle}</p>
            ) : null;
          })()}
          <div className="flex flex-wrap gap-2 mt-2">
            {person.meetings.map((m) => (
              <Badge key={m.id} variant="secondary" className="text-xs gap-1 py-1">
                <Calendar className="w-3 h-3" />
                <span title={formatDate(m.meeting_date)}>{formatRelativeDate(m.meeting_date)}</span>
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

        <div className="shrink-0">
          <DeletePersonButton personId={person.id} personName={person.name} />
        </div>
      </div>

      {/* ── Log another meeting shortcut ──────────────────────────────── */}
      <Button asChild variant="outline" className="w-full h-11 gap-2 border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-800 font-semibold">
        <Link href={`/meet?person=${encodeURIComponent(person.name)}`}>
          <Mic className="w-4 h-4" />
          Log another meeting with {person.name.split(" ")[0]}
        </Link>
      </Button>

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
                    <span title={formatDate(m.meeting_date)}>{formatRelativeDate(m.meeting_date)}</span>
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
                    <summary className="cursor-pointer text-xs text-muted-foreground hover:text-gray-600 select-none list-none [&::-webkit-details-marker]:hidden no-underline decoration-transparent">
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
