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
