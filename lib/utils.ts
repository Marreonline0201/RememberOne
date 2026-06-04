// Shared utility functions

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, parseISO, isValid } from "date-fns";

// shadcn/ui className utility
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format a date string (ISO or YYYY-MM-DD) to a readable label, respecting locale
export function formatDate(dateStr: string | null | undefined, locale = "en-US"): string {
  if (!dateStr) return locale.startsWith("ko") ? "날짜 미상" : "Unknown date";
  try {
    const date = parseISO(dateStr);
    if (!isValid(date)) return dateStr;
    return new Intl.DateTimeFormat(locale, { year: "numeric", month: "long", day: "numeric" }).format(date);
  } catch {
    return dateStr;
  }
}

// Format a datetime string to a short time
export function formatTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  try {
    const date = parseISO(dateStr);
    if (!isValid(date)) return "";
    return format(date, "h:mm a");
  } catch {
    return "";
  }
}

// ── Timezone-aware helpers ──────────────────────────────────────────────────
// These render an absolute instant (ISO string) in an EXPLICIT IANA timezone,
// instead of the runtime/device zone. Used by the calendar so event times and
// day placement follow the user's chosen timezone, not the server's.

// Format a datetime as a short time (e.g. "2:30 PM" / "오후 2:30") in `timeZone`.
export function formatTimeInZone(
  dateStr: string | null | undefined,
  timeZone: string,
  locale = "en-US"
): string {
  if (!dateStr) return "";
  // All-day events arrive as a date-only string ("2026-06-05") with no clock
  // time — there's no meaningful time to show.
  if (!dateStr.includes("T")) return "";
  try {
    const date = parseISO(dateStr);
    if (!isValid(date)) return "";
    return new Intl.DateTimeFormat(locale, {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return "";
  }
}

// Return the YYYY-MM-DD calendar day that `dateStr` falls on IN `timeZone`.
// en-CA formats as "2026-06-01", which is exactly the key shape the calendar uses.
export function dateKeyInZone(
  dateStr: string | null | undefined,
  timeZone: string
): string {
  if (!dateStr) return "";
  // All-day events arrive as a date-only string ("2026-06-05") that is already
  // a calendar day and timezone-agnostic. Projecting it into a zone would parse
  // it as local midnight and wrongly shift the day, so return it verbatim.
  if (!dateStr.includes("T")) return dateStr.slice(0, 10);
  try {
    const date = parseISO(dateStr);
    if (!isValid(date)) return typeof dateStr === "string" ? dateStr.slice(0, 10) : "";
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  } catch {
    return typeof dateStr === "string" ? dateStr.slice(0, 10) : "";
  }
}

// Today's YYYY-MM-DD in `timeZone`.
export function todayKeyInZone(timeZone: string): string {
  return dateKeyInZone(new Date().toISOString(), timeZone);
}

// Get initials from a name for avatar fallback
export function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0].toUpperCase())
    .join("");
}

// Capitalize the first letter of a string
export function capitalize(str: string): string {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Today's date as YYYY-MM-DD
export function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

// Format a date as a human-friendly relative label, e.g. "3 days ago", "today", "2 months ago"
// Falls back to the full formatted date for dates older than ~1 year.
export function formatRelativeDate(dateStr: string | null | undefined, locale = "en-US"): string {
  if (!dateStr) return locale.startsWith("ko") ? "날짜 미상" : "Unknown date";
  try {
    const date = parseISO(dateStr);
    if (!isValid(date)) return dateStr;

    const ko = locale.startsWith("ko");
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return formatDate(dateStr, locale);
    if (diffDays === 0) return ko ? "오늘" : "today";
    if (diffDays === 1) return ko ? "어제" : "yesterday";
    if (diffDays < 7) return ko ? `${diffDays}일 전` : `${diffDays} days ago`;
    if (diffDays < 14) return ko ? "1주 전" : "1 week ago";
    if (diffDays < 30) return ko ? `${Math.floor(diffDays / 7)}주 전` : `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 60) return ko ? "1개월 전" : "1 month ago";
    if (diffDays < 365) return ko ? `${Math.floor(diffDays / 30)}개월 전` : `${Math.floor(diffDays / 30)} months ago`;
    if (diffDays < 548) return ko ? "1년 전" : "1 year ago";
    return formatDate(dateStr, locale);
  } catch {
    return dateStr;
  }
}

// Map of English attribute keys → Korean labels.
// Keys are lowercase for case-insensitive matching.
const KEY_KO: Record<string, string> = {
  // job / work
  "job": "직업", "job title": "직함", "title": "직함", "role": "역할",
  "occupation": "직업", "profession": "직업", "work": "직장",
  "company": "회사", "employer": "회사", "organization": "조직",
  "department": "부서", "industry": "업종",
  // education
  "university": "대학교", "college": "대학교", "school": "학교",
  "major": "전공", "degree": "학위", "grade": "학년",
  // personal
  "age": "나이", "birthday": "생일", "nationality": "국적",
  "city": "도시", "location": "위치", "country": "나라",
  "language": "언어", "languages": "언어",
  // interests
  "hobby": "취미", "hobbies": "취미", "interest": "관심사",
  "interests": "관심사", "sport": "스포츠", "sports": "스포츠",
  "passion": "열정",
  // contact
  "phone": "전화번호", "phone number": "전화번호", "mobile": "휴대폰",
  "email": "이메일", "website": "웹사이트",
  // social
  "linkedin": "링크드인", "instagram": "인스타그램",
  "twitter": "트위터", "facebook": "페이스북",
  // family relation chips
  "relation": "관계", "nickname": "별명", "note": "메모",
};

/**
 * Localise an attribute key for display.
 * If language is "ko" and a Korean translation exists, returns it.
 * Otherwise returns the key with the first letter capitalised.
 */
export function localizeKey(key: string, language: string): string {
  if (language === "ko") {
    const mapped = KEY_KO[key.toLowerCase().trim()];
    if (mapped) return mapped;
  }
  return capitalize(key);
}

// Map English relation values stored in DB → Korean display labels
const RELATION_KO: Record<string, string> = {
  son: "아들",
  daughter: "딸",
  spouse: "배우자",
  partner: "파트너",
  wife: "아내",
  husband: "남편",
  mother: "어머니",
  father: "아버지",
  sister: "여동생",
  brother: "남동생",
  friend: "친구",
  cousin: "사촌",
  grandmother: "할머니",
  grandfather: "할아버지",
  aunt: "이모/고모",
  uncle: "삼촌",
};

export function localizeRelation(relation: string, language: string): string {
  if (language === "ko") {
    const mapped = RELATION_KO[relation.trim().toLowerCase()];
    if (mapped) return mapped;
  }
  return capitalize(relation);
}

// Keys whose values change over time and warrant an "As of YYYY" qualifier.
const TIME_SENSITIVE_KEYS = [
  // Korean
  "나이", "학교", "학년", "학급", "직업", "직함", "직위", "역할", "회사", "대학교", "대학",
  // English — "title" removed (overbroad); covered by "job title"
  "age", "school", "grade", "class", "job", "job title", "role",
  "company", "employer", "university", "college", "occupation", "profession",
];

export function isTimeSensitive(key: string): boolean {
  const k = key.trim().toLowerCase();
  // Use word-boundary matching so "class" doesn't match "classified", etc.
  return TIME_SENSITIVE_KEYS.some((t) => {
    if (k === t) return true;
    const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|\\s)${escaped}(\\s|$)`).test(k);
  });
}

/** Returns "as of 2026" or "2026년 기준" if the key is time-sensitive, else "". */
export function asOfLabel(key: string, updatedAt: string, language: string): string {
  if (!isTimeSensitive(key)) return "";
  const year = new Date(updatedAt).getFullYear();
  if (isNaN(year)) return "";
  return language === "ko" ? `${year}년 기준` : `as of ${year}`;
}

// Detect if a family member name is a placeholder (named after their relation).
// Used to auto-merge placeholders like "Daughter" or "딸" when the real name is later provided.
const RELATION_KOREAN_PLACEHOLDERS: Record<string, string[]> = {
  daughter: ["딸"],
  son: ["아들"],
  spouse: ["배우자"],
  wife: ["아내"],
  husband: ["남편"],
  mother: ["어머니", "엄마"],
  father: ["아버지", "아빠"],
  sister: ["여동생", "언니", "누나"],
  brother: ["남동생", "형", "오빠"],
  friend: ["친구"],
};

export function isRelationPlaceholder(name: string, relation: string): boolean {
  const n = name.trim().toLowerCase();
  const r = relation.trim().toLowerCase();
  // Matches "son", "Son", "son 1", "son 2", etc.
  if (n === r || /^[a-z]+ \d+$/.test(n) && n.startsWith(r + " ")) return true;
  // Korean equivalents: "딸", "아들", "딸 1", etc.
  const korean = RELATION_KOREAN_PLACEHOLDERS[r] ?? [];
  return korean.some((k) => n === k || n === k + " 1" || /^\S+ \d+$/.test(n) && n.startsWith(k + " "));
}

// Check if a calendar event title or description mentions a person's name
export function eventMentionsPerson(
  eventSummary: string,
  eventDescription: string | null,
  personName: string
): boolean {
  const haystack =
    `${eventSummary} ${eventDescription ?? ""}`.toLowerCase();
  const needle = personName.toLowerCase();

  // Check for full name match
  if (haystack.includes(needle)) return true;

  // Check for first-name-only match (if person name has spaces)
  const firstName = personName.split(" ")[0].toLowerCase();
  if (firstName.length >= 3 && haystack.includes(firstName)) return true;

  return false;
}
