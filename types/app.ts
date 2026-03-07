// ============================================================
// Application-level types (assembled / enriched objects)
// ============================================================

import type {
  Person,
  PersonAttribute,
  FamilyMember,
  FamilyMemberAttribute,
  Meeting,
} from "./database";

// A fully-assembled person with nested relations
export interface PersonFull extends Person {
  attributes: PersonAttribute[];
  family_members: FamilyMemberFull[];
  meetings: Meeting[];
}

export interface FamilyMemberFull extends FamilyMember {
  attributes: FamilyMemberAttribute[];
}

// ============================================================
// Claude AI extraction output types
// ============================================================

export interface ExtractedAttribute {
  key: string;
  value: string;
}

export interface ExtractedFamilyMember {
  name: string;
  relation: string;
  attributes: ExtractedAttribute[];
}

export interface ExtractedPerson {
  name: string;
  summary: string;
  attributes: ExtractedAttribute[];
  family_members: ExtractedFamilyMember[];
}

// The full shape Claude returns
export interface AIExtractionResult {
  people: ExtractedPerson[];
  meeting_date: string | null;      // ISO date string "YYYY-MM-DD" or null
  location: string | null;
}

// ============================================================
// Google Calendar types
// ============================================================

export interface CalendarEvent {
  id: string;
  summary: string;                  // event title
  description: string | null;
  start: string;                    // ISO datetime
  end: string;
  attendees: CalendarAttendee[];
  htmlLink: string;
}

export interface CalendarAttendee {
  email: string;
  displayName: string | null;
  responseStatus: string;
}

export interface UpcomingMeetingAlert {
  event: CalendarEvent;
  matchedPeople: PersonFull[];
}

// ============================================================
// API response shapes
// ============================================================

export interface ApiSuccess<T> {
  data: T;
  error: null;
}

export interface ApiError {
  data: null;
  error: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;
