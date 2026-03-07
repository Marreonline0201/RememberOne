// Shared utility functions

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, parseISO, isValid } from "date-fns";

// shadcn/ui className utility
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format a date string (ISO or YYYY-MM-DD) to a readable label
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "Unknown date";
  try {
    const date = parseISO(dateStr);
    if (!isValid(date)) return dateStr;
    return format(date, "MMMM d, yyyy");
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
