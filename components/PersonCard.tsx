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
  Pencil,
  ChevronDown,
} from "lucide-react";
import { getInitials, capitalize, formatDate } from "@/lib/utils";
import type { PersonFull } from "@/types/app";

interface Props {
  person: PersonFull;
}

const AVATAR_COLORS = [
  "bg-blue-100 text-blue-700",
  "bg-purple-100 text-purple-700",
  "bg-green-100 text-green-700",
  "bg-orange-100 text-orange-700",
  "bg-pink-100 text-pink-700",
  "bg-teal-100 text-teal-700",
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
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
  const color = getAvatarColor(person.name);
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
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="flex items-start gap-3 p-4 pb-3">
          <Avatar className="w-12 h-12 shrink-0 mt-0.5">
            {person.avatar_url && (
              <AvatarImage src={person.avatar_url} alt={person.name} />
            )}
            <AvatarFallback className={`font-semibold text-sm ${color}`}>
              {getInitials(person.name)}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 text-base leading-tight">
              {person.name}
            </p>
            {subtitle && (
              <p className="text-sm text-muted-foreground mt-0.5 truncate">
                {subtitle}
              </p>
            )}
            {lastMeeting && (
              <div className="flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground flex-wrap">
                <Calendar className="w-3 h-3 shrink-0" />
                <span>Last met {formatDate(lastMeeting.meeting_date)}</span>
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

          {/* Edit button — 44px touch target */}
          <Button
            asChild
            size="sm"
            variant="outline"
            className="shrink-0 gap-1.5 h-11 px-3"
          >
            <Link href={`/people/${person.id}`}>
              <Pencil className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Edit</span>
            </Link>
          </Button>
        </div>

        {/* ── Attributes ─────────────────────────────────────────────── */}
        {person.attributes.length > 0 && (
          <>
            <Separator />
            <div className="px-4 py-3">
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {person.attributes.map((attr) => (
                  <div
                    key={attr.id}
                    className="flex items-baseline gap-1.5 text-sm min-w-0"
                  >
                    <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                      {attr.key}
                    </span>
                    <span className="text-gray-800 font-medium truncate">
                      {attr.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── Family members ─────────────────────────────────────────── */}
        {person.family_members.length > 0 && (
          <>
            <Separator />
            <div className="px-4 py-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
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
                      <span className="text-sm font-medium text-gray-800">
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

        {/* ── Meeting history ─────────────────────────────────────────── */}
        {person.meetings.length > 0 && (
          <>
            <Separator />
            <div className="px-4 py-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Calendar className="w-3 h-3" />
                Meetings ({person.meetings.length})
              </p>
              <div className="space-y-2">
                {person.meetings.slice(0, 3).map((m) => (
                  <div key={m.id} className="text-sm space-y-0.5">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                      <span className="font-medium text-gray-700">
                        {formatDate(m.meeting_date)}
                      </span>
                      {m.location && (
                        <>
                          <span>·</span>
                          <span>{m.location}</span>
                        </>
                      )}
                    </div>
                    {m.summary && (
                      <p className="text-gray-600 text-xs leading-snug line-clamp-2">
                        {m.summary}
                      </p>
                    )}
                  </div>
                ))}
                {person.meetings.length > 3 && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <ChevronDown className="w-3 h-3" />
                    {person.meetings.length - 3} more meeting
                    {person.meetings.length - 3 > 1 ? "s" : ""} — open Edit to
                    see all
                  </p>
                )}
              </div>
            </div>
          </>
        )}

        {/* ── Notes ──────────────────────────────────────────────────── */}
        {person.notes && (
          <>
            <Separator />
            <div className="px-4 py-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                {person.notes}
              </p>
            </div>
          </>
        )}

        {/* ── Add notes ──────────────────────────────────────────────── */}
        <Separator />
        <div className="px-4 py-3">
          <AddNotesInput personId={person.id} personName={person.name} />
        </div>
      </CardContent>
    </Card>
  );
}
