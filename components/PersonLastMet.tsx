"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import { getLanguage } from "@/lib/i18n";
import { formatRelativeDate } from "@/lib/utils";

interface Props {
  lastMeetingDate: string;
  totalMeetings: number;
}

export function PersonLastMet({ lastMeetingDate, totalMeetings }: Props) {
  const { language } = useLanguage();
  const locale = getLanguage(language).locale;
  const ko = language === "ko";

  return (
    <p className="text-[11px] mt-1" style={{ color: "#5e7983" }}>
      {ko ? "마지막 만남" : "Last met"} {formatRelativeDate(lastMeetingDate, locale)}
      {totalMeetings > 1 && ` · ${totalMeetings} ${ko ? "회 만남" : "meetings total"}`}
    </p>
  );
}
