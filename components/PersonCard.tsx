// PersonCard — full-detail dashboard card for a saved person.
// Mobile-first: comfortable touch targets, no horizontal scroll on 375px.

import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { AddNotesInput } from "@/components/AddNotesInput";
import {
  Calendar,
  MapPin,
  Users,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { getInitials, capitalize, formatDate, formatRelativeDate } from "@/lib/utils";
import type { PersonFull } from "@/types/app";

interface Props {
  person: PersonFull;
}

// [gradient strip (Figma blue→purple palette), avatar bg+text, ring color]
const PALETTES = [
  ["from-[#d0f2ff] to-[#dccaff]", "bg-[#d0f2ff] text-[#482d7c]",  "ring-[#dccaff]"],
  ["from-[#284e72] to-[#482d7c]", "bg-[#dccaff] text-[#482d7c]",  "ring-[#482d7c]"],
  ["from-[#ddf6ff] to-[#d0f2ff]", "bg-[#ddf6ff] text-[#284e72]",  "ring-[#d0f2ff]"],
  ["from-[#482d7c] to-[#284e72]", "bg-[#dccaff] text-[#284e72]",  "ring-[#284e72]"],
  ["from-[#d0f2ff] to-[#dccaff]", "bg-[#fbf6ff] text-[#482d7c]",  "ring-[#dccaff]"],
  ["from-[#284e72] to-[#482d7c]", "bg-[#ddf6ff] text-[#284e72]",  "ring-[#284e72]"],
  ["from-[#dccaff] to-[#d0f2ff]", "bg-[#dccaff] text-[#482d7c]",  "ring-[#dccaff]"],
  ["from-[#482d7c] to-[#284e72]", "bg-[#d0f2ff] text-[#284e72]",  "ring-[#482d7c]"],
] as const;

function getNameIndex(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % PALETTES.length;
}

const RELATION_COLORS: Record<string, string> = {
  son: "bg-sky-100 text-sky-700",
  daughter: "bg-rose-100 text-rose-700",
  spouse: "bg-purple-100 text-purple-700",
  partner: "bg-purple-100 text-purple-700",
  wife: "bg-pink-100 text-pink-700",
  husband: "bg-indigo-100 text-indigo-700",
  mother: "bg-amber-100 text-amber-700",
  father: "bg-orange-100 text-orange-700",
  sister: "bg-fuchsia-100 text-fuchsia-700",
  brother: "bg-cyan-100 text-cyan-700",
  default: "bg-gray-100 text-gray-700",
};

function getRelationColor(relation: string): string {
  return RELATION_COLORS[relation.toLowerCase()] ?? RELATION_COLORS.default;
}

export function PersonCard({ person }: Props) {
  const idx = getNameIndex(person.name);
  const [gradient, avatarColor, ringColor] = PALETTES[idx];
  const lastMeeting = person.meetings[0] ?? null;

  const subtitle =
    person.attributes.find((a) =>
      ["job title", "company", "occupation", "role", "title"].includes(
        a.key.toLowerCase()
      )
    )?.value ??
    person.attributes.find((a) =>
      ["city", "location", "country"].includes(a.key.toLowerCase())
    )?.value ??
    null;

  return (
    <div className="group transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg" style={{ borderRadius: "10px 2px 10px 2px" }}>
      <Card className="overflow-hidden border-0 shadow-sm" style={{ borderRadius: "10px 2px 10px 2px", backgroundImage: "linear-gradient(52deg, #d0f2ff 0%, #dccaff 100%)" }}>

        <CardContent className="p-0">
          {/* ── Header ───────────────────────────────────────────────── */}
          <div className="flex items-start gap-3 p-4 pb-3">
            <Avatar className={`w-12 h-12 shrink-0 mt-0.5 ring-2 ring-offset-1 ring-white/60`}>
              {person.avatar_url && (
                <AvatarImage src={person.avatar_url} alt={person.name} />
              )}
              <AvatarFallback className="font-bold text-sm bg-white/70 text-[#284e72]">
                {getInitials(person.name)}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-[#1a2a3a] text-base leading-tight">
                  {person.name}
                </p>
                {/* Meeting count badge */}
                {person.meetings.length > 0 && (
                  <span className="shrink-0 text-xs font-semibold rounded-full px-2 py-0.5 whitespace-nowrap bg-white/60 text-[#482d7c]">
                    {person.meetings.length} {person.meetings.length === 1 ? "meet" : "meets"}
                  </span>
                )}
              </div>
              {subtitle && (
                <p className="text-sm mt-0.5 truncate text-[#284e72]/80">
                  {subtitle}
                </p>
              )}
              {lastMeeting && (
                <div className="flex items-center gap-1.5 mt-1.5 text-xs text-[#284e72]/70 flex-wrap">
                  <Calendar className="w-3 h-3 shrink-0" />
                  <span>Last met {formatRelativeDate(lastMeeting.meeting_date)}</span>
                  {lastMeeting.location && (
                    <>
                      <span>·</span>
                      <MapPin className="w-3 h-3 shrink-0" />
                      <span className="truncate max-w-[120px]">
                        {lastMeeting.location}
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* View profile button */}
            <Button
              asChild
              size="sm"
              variant="ghost"
              className="shrink-0 h-9 w-9 p-0 text-[#284e72]/60 hover:text-[#284e72] hover:bg-white/30"
            >
              <Link href={`/people/${person.id}`}>
                <ChevronRight className="w-4 h-4" />
              </Link>
            </Button>
          </div>

          {/* ── Attributes as chips ───────────────────────────────────── */}
          {person.attributes.length > 0 && (
            <>
              <div className="h-px mx-4 bg-white/40" />
              <div className="px-4 py-3">
                <div className="flex flex-wrap gap-1.5">
                  {person.attributes.map((attr) => (
                    <span
                      key={attr.id}
                      className="inline-flex items-baseline gap-1 rounded-full px-2.5 py-1 text-xs bg-white/50 text-[#284e72]"
                    >
                      <span className="opacity-70">{attr.key}</span>
                      <span className="font-medium">{attr.value}</span>
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── Family members ────────────────────────────────────────── */}
          {person.family_members.length > 0 && (
            <>
              <div className="h-px mx-4 bg-white/40" />
              <div className="px-4 py-3 space-y-2">
                <p className="text-xs font-medium text-[#284e72]/70 uppercase tracking-wide flex items-center gap-1.5">
                  <Users className="w-3 h-3" />
                  Family
                </p>
                <div className="space-y-2">
                  {person.family_members.map((fm) => (
                    <div key={fm.id} className="flex items-start gap-2">
                      <Badge
                        variant="outline"
                        className={`text-xs shrink-0 mt-0.5 border-0 py-0.5 ${getRelationColor(fm.relation)}`}
                      >
                        {capitalize(fm.relation)}
                      </Badge>
                      <div className="min-w-0">
                        <span className="text-sm font-medium text-[#1a2a3a]">
                          {fm.name}
                        </span>
                        {fm.attributes.length > 0 && (
                          <span className="text-xs text-muted-foreground ml-2 line-clamp-1">
                            {fm.attributes.map((a) => `${a.key}: ${a.value}`).join(" · ")}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── Meeting history ───────────────────────────────────────── */}
          {person.meetings.length > 0 && (
            <>
              <div className="h-px mx-4 bg-white/40" />
              <div className="px-4 py-3 space-y-2">
                <p className="text-xs font-medium text-[#284e72]/70 uppercase tracking-wide flex items-center gap-1.5">
                  <Calendar className="w-3 h-3" />
                  Meetings ({person.meetings.length})
                </p>
                <div className="space-y-2">
                  {person.meetings.slice(0, 3).map((m) => (
                    <div key={m.id} className="text-sm space-y-0.5">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                        <span className="font-medium text-[#284e72]" title={formatDate(m.meeting_date)}>
                          {formatRelativeDate(m.meeting_date)}
                        </span>
                        {m.location && (
                          <>
                            <span>·</span>
                            <span>{m.location}</span>
                          </>
                        )}
                      </div>
                      {m.summary && (
                        <p className="text-[#284e72]/70 text-xs leading-snug line-clamp-2">
                          {m.summary}
                        </p>
                      )}
                    </div>
                  ))}
                  {person.meetings.length > 3 && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <ChevronDown className="w-3 h-3" />
                      {person.meetings.length - 3} more meeting
                      {person.meetings.length - 3 > 1 ? "s" : ""} — view profile to see all
                    </p>
                  )}
                </div>
              </div>
            </>
          )}

          {/* ── Notes ────────────────────────────────────────────────── */}
          {person.notes && (
            <>
              <div className="h-px mx-4 bg-white/40" />
              <div className="px-4 py-3">
                <p className="text-xs text-[#284e72]/70 leading-relaxed">
                  {person.notes}
                </p>
              </div>
            </>
          )}

          {/* ── Add notes ────────────────────────────────────────────── */}
          <Separator />
          <div className="px-4 py-3">
            <AddNotesInput personId={person.id} personName={person.name} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
