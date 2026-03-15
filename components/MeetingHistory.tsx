"use client";

import { Calendar, MapPin } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { getLanguage } from "@/lib/i18n";
import { formatDate, formatRelativeDate } from "@/lib/utils";
import type { Meeting } from "@/types/database";

interface Props {
  meetings: Meeting[];
}

export function MeetingHistory({ meetings }: Props) {
  const { language } = useLanguage();
  const locale = getLanguage(language).locale;
  const ko = language === "ko";

  if (meetings.length === 0) return null;

  return (
    <div
      className="p-4 rounded-[10px_2px_10px_2px]"
      style={{ backgroundColor: "#f5f0ff", border: "1px solid #dccaff" }}
    >
      <p
        className="text-[13px] uppercase mb-3"
        style={{ color: "#665b7b", fontFamily: "'Hammersmith One', sans-serif" }}
      >
        {ko ? `만남 (${meetings.length})` : `Meetings (${meetings.length})`}
      </p>
      <div className="space-y-3">
        {meetings.map((m) => (
          <div
            key={m.id}
            className="p-3 rounded-[8px_2px_8px_2px]"
            style={{ backgroundColor: "rgba(220, 202, 255, 0.4)" }}
          >
            <div className="flex items-center gap-2 flex-wrap">
              <Calendar className="w-3.5 h-3.5 shrink-0" style={{ color: "#5e7983" }} />
              <span
                className="text-[12px] font-medium"
                style={{ color: "#284e72" }}
                title={formatDate(m.meeting_date, locale)}
              >
                {formatRelativeDate(m.meeting_date, locale)}
              </span>
              {m.location && (
                <>
                  <MapPin className="w-3 h-3 shrink-0" style={{ color: "#5e7983" }} />
                  <span className="text-[11px]" style={{ color: "#5e7983" }}>
                    {m.location}
                  </span>
                </>
              )}
            </div>
            {m.summary && (
              <p className="text-[12px] mt-1.5 leading-relaxed" style={{ color: "#284e72" }}>
                {m.summary}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
