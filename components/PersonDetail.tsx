"use client";

// Client-rendered person detail. Loads from the local store (instant + offline)
// and refreshes from /api/people/[id] when online (skipping the refresh while
// writes are pending so it can't clobber un-synced edits). Editing works
// OFFLINE via the write queue; only the AI flows (Log meeting, AI quick-note,
// voice transcription) stay online-only.

import { useEffect, useState } from "react";
import Link from "next/link";
import { Mic } from "lucide-react";
import { BackButton } from "@/components/BackButton";
import type { PersonFull } from "@/types/app";
import {
  getCachedPerson,
  cachePerson,
  subscribeOffline,
  outboxCount,
} from "@/lib/offline-cache";
import { whenOwnerSettled } from "@/lib/offline-owner";
import { useOnline } from "@/lib/use-online";
import { useLanguage } from "@/contexts/LanguageContext";
import { getInitials } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { EditableName } from "@/components/EditableName";
import { ProfileEditor } from "@/components/ProfileEditor";
import { AddNotesInput } from "@/components/AddNotesInput";
import { AddFamilyMemberForm } from "@/components/AddFamilyMemberForm";
import { FamilyMemberCard } from "@/components/FamilyMemberCard";
import { DeletePersonButton } from "@/components/DeletePersonButton";
import { PersonLastMet } from "@/components/PersonLastMet";
import { MeetingHistory } from "@/components/MeetingHistory";
import { AttrChip } from "@/components/AttrChip";
import { RecapLine } from "@/components/RecapLine";
import { T } from "@/components/T";

const INTEREST_KEYS = ["interest", "hobby", "hobbies", "sport", "sports", "passion", "likes"];
function isInterest(key: string) {
  return INTEREST_KEYS.some((k) => key.toLowerCase().includes(k));
}

export function PersonDetail({ id }: { id: string }) {
  const online = useOnline();
  const { language } = useLanguage();
  const ko = language === "ko";

  const [person, setPerson] = useState<PersonFull | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing">("loading");

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");

    const loadFromCache = async () => {
      const cached = await getCachedPerson(id);
      if (cancelled) return;
      if (cached) {
        setPerson(cached);
        setStatus("ready");
      }
    };

    (async () => {
      // If an account-switch wipe is in flight, read after it — never show a
      // previous account's cached person.
      await whenOwnerSettled();
      await loadFromCache();
      // Refresh from the server only when online AND nothing is queued (so we
      // never overwrite optimistic offline edits that haven't synced yet).
      let fetchedOk = false;
      if (typeof navigator !== "undefined" && navigator.onLine && (await outboxCount()) === 0) {
        try {
          const res = await fetch(`/api/people/${id}`);
          if (res.ok) {
            const { data } = await res.json();
            if (data && !cancelled) {
              setPerson(data);
              setStatus("ready");
              fetchedOk = true;
              void cachePerson(data);
            }
          }
        } catch {
          /* offline / network error — rely on cache */
        }
      }
      if (!cancelled) {
        const stillCached = await getCachedPerson(id);
        if (!stillCached && !fetchedOk) setStatus("missing");
      }
    })();

    // Re-render whenever the local store changes (optimistic edits, sync).
    const unsub = subscribeOffline(() => {
      void loadFromCache();
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [id]);

  if (status === "loading") return null;

  if (status === "missing" || !person) {
    return (
      <div className="w-full max-w-lg mx-auto flex flex-col items-center justify-center py-20 text-center gap-4">
        <p
          className="text-[18px] uppercase text-black"
          style={{ fontFamily: "'Hammersmith One', sans-serif" }}
        >
          {online ? (ko ? "찾을 수 없어요" : "Person not found") : (ko ? "오프라인 상태예요" : "Not saved offline")}
        </p>
        <p className="text-[13px] max-w-xs" style={{ color: "#5e7983" }}>
          {online
            ? ko ? "이 사람을 찾을 수 없습니다." : "We couldn't find this person."
            : ko
            ? "이 사람은 아직 저장되지 않았어요. 온라인일 때 목록을 한 번 열면 저장돼요."
            : "This person isn't saved for offline yet. Open your list online once to save them."}
        </p>
        <Link href="/" className="text-sm underline" style={{ color: "#482d7c" }}>
          {ko ? "← 목록으로" : "← Back to people"}
        </Link>
      </div>
    );
  }

  const mainInfo = person.attributes.filter((a) => !isInterest(a.key));
  const interests = person.attributes.filter((a) => isInterest(a.key));

  return (
    <div className="w-full max-w-lg mx-auto space-y-5">
      {/* Back — visible on every viewport (mobile previously relied on the
          system/gesture back button). Returns to wherever the user came from. */}
      <BackButton fallbackHref="/" />

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

            {mainInfo.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {mainInfo.map((attr) => (
                  <AttrChip
                    key={attr.id}
                    attrKey={attr.key}
                    value={attr.value}
                    updatedAt={attr.updated_at}
                    className="text-[10px] px-2 py-[3px] rounded-[5px] shadow-sm text-black"
                    style={{ backgroundColor: "rgba(220, 202, 255, 0.7)" }}
                  />
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

        {/* Recap */}
        {person.meetings.length > 0 && person.meetings[0].summary && (
          <RecapLine
            summary={person.meetings[0].summary}
            className="mt-4 text-[12px] leading-snug italic"
            style={{ color: "#5e7983" }}
          />
        )}
      </div>

      {/* ── AI flows — online only (Log meeting + AI quick-note) ───────────── */}
      {online && (
        <>
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

          <div
            className="p-4 rounded-[10px_2px_10px_2px]"
            style={{ backgroundColor: "#f5f0ff", border: "1px solid #dccaff" }}
          >
            <AddNotesInput personId={person.id} personName={person.name} />
          </div>
        </>
      )}

      {/* ── Edit attributes + notes (works offline) ───────────────────────── */}
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

      {/* ── Family members (works offline) ────────────────────────────────── */}
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

      {/* ── Meeting history (read-only) ───────────────────────────────────── */}
      <MeetingHistory meetings={person.meetings} />

      <div className="h-4" />
    </div>
  );
}
