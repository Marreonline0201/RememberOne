// ============================================================
// Auto-typed database rows matching the Supabase schema
// ============================================================

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Person {
  id: string;
  user_id: string;
  name: string;
  notes: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Meeting {
  id: string;
  user_id: string;
  person_id: string;
  raw_input: string;
  meeting_date: string;
  location: string | null;
  summary: string | null;
  created_at: string;
  updated_at: string;
}

export interface PersonAttribute {
  id: string;
  person_id: string;
  key: string;
  value: string;
  created_at: string;
  updated_at: string;
}

export interface FamilyMember {
  id: string;
  person_id: string;
  name: string;
  relation: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface FamilyMemberAttribute {
  id: string;
  family_member_id: string;
  key: string;
  value: string;
  created_at: string;
  updated_at: string;
}

export interface CalendarConnection {
  id: string;
  user_id: string;
  provider: string;
  access_token: string;
  refresh_token: string | null;
  token_expiry: string | null;
  scope: string | null;
  calendar_id: string;
  connected_at: string;
  updated_at: string;
}
