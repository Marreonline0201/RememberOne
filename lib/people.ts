// Server-side helpers for reading and writing people + related data
// All functions assume a Supabase server client is passed in

import type { SupabaseClient } from "@supabase/supabase-js";
import type { PersonFull, FamilyMemberFull, AIExtractionResult, ExtractedPerson } from "@/types/app";
import type { Person, PersonAttribute, FamilyMember, FamilyMemberAttribute, Meeting } from "@/types/database";

// ============================================================
// Fetch a single person with all nested data
// ============================================================
export async function getPersonFull(
  supabase: SupabaseClient,
  personId: string
): Promise<PersonFull | null> {
  const { data: person, error } = await supabase
    .from("people")
    .select("*")
    .eq("id", personId)
    .single();

  if (error || !person) return null;

  const [attributesRes, familyRes, meetingsRes] = await Promise.all([
    supabase
      .from("person_attributes")
      .select("*")
      .eq("person_id", personId)
      .order("key"),
    supabase
      .from("family_members")
      .select("*")
      .eq("person_id", personId)
      .order("name"),
    supabase
      .from("meetings")
      .select("*")
      .eq("person_id", personId)
      .order("meeting_date", { ascending: false }),
  ]);

  const familyMembers: FamilyMemberFull[] = await Promise.all(
    (familyRes.data ?? []).map(async (fm: FamilyMember) => {
      const { data: fmAttrs } = await supabase
        .from("family_member_attributes")
        .select("*")
        .eq("family_member_id", fm.id)
        .order("key");
      return { ...fm, attributes: fmAttrs ?? [] };
    })
  );

  return {
    ...person,
    attributes: attributesRes.data ?? [],
    family_members: familyMembers,
    meetings: meetingsRes.data ?? [],
  };
}

// ============================================================
// Fetch all people for a user (summary — no deep relations)
// ============================================================
export async function getAllPeople(
  supabase: SupabaseClient,
  userId: string
): Promise<Person[]> {
  const { data, error } = await supabase
    .from("people")
    .select("*")
    .eq("user_id", userId)
    .order("name");

  if (error) throw new Error(error.message);
  return data ?? [];
}

// ============================================================
// Fetch all people with full nested data — efficient batch
// (5 queries total regardless of number of people)
// ============================================================
export async function getAllPeopleFull(
  supabase: SupabaseClient,
  userId: string
): Promise<PersonFull[]> {
  const { data: people, error } = await supabase
    .from("people")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);
  if (!people || people.length === 0) return [];

  const personIds = people.map((p: Person) => p.id);

  const [attributesRes, familyRes, meetingsRes] = await Promise.all([
    supabase
      .from("person_attributes")
      .select("*")
      .in("person_id", personIds)
      .order("key"),
    supabase
      .from("family_members")
      .select("*")
      .in("person_id", personIds)
      .order("name"),
    supabase
      .from("meetings")
      .select("*")
      .in("person_id", personIds)
      .order("meeting_date", { ascending: false }),
  ]);

  const attributes: PersonAttribute[] = attributesRes.data ?? [];
  const familyMembers: FamilyMember[] = familyRes.data ?? [];
  const meetings: Meeting[] = meetingsRes.data ?? [];

  let familyMemberAttributes: FamilyMemberAttribute[] = [];
  if (familyMembers.length > 0) {
    const fmIds = familyMembers.map((fm: FamilyMember) => fm.id);
    const { data } = await supabase
      .from("family_member_attributes")
      .select("*")
      .in("family_member_id", fmIds)
      .order("key");
    familyMemberAttributes = data ?? [];
  }

  return people.map((person: Person): PersonFull => ({
    ...person,
    attributes: attributes.filter((a: PersonAttribute) => a.person_id === person.id),
    family_members: familyMembers
      .filter((fm: FamilyMember) => fm.person_id === person.id)
      .map((fm: FamilyMember): FamilyMemberFull => ({
        ...fm,
        attributes: familyMemberAttributes.filter(
          (a: FamilyMemberAttribute) => a.family_member_id === fm.id
        ),
      })),
    meetings: meetings.filter((m: Meeting) => m.person_id === person.id),
  }));
}

// ============================================================
// Persist an AI extraction result to the database
// Returns the created person IDs
// ============================================================
export async function saveExtractionResult(
  supabase: SupabaseClient,
  userId: string,
  extraction: AIExtractionResult,
  rawInput: string
): Promise<string[]> {
  const personIds: string[] = [];

  for (const extracted of extraction.people) {
    // 1. Upsert the person (match on user_id + name)
    const { data: existing } = await supabase
      .from("people")
      .select("id")
      .eq("user_id", userId)
      .ilike("name", extracted.name)
      .maybeSingle();

    let personId: string;

    if (existing) {
      personId = existing.id;
      // Update notes with summary if this is newer
      await supabase
        .from("people")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", personId);
    } else {
      const { data: newPerson, error: insertError } = await supabase
        .from("people")
        .insert({ user_id: userId, name: extracted.name })
        .select("id")
        .single();

      if (insertError || !newPerson) {
        throw new Error(`Failed to insert person: ${insertError?.message}`);
      }
      personId = newPerson.id;
    }

    personIds.push(personId);

    // 2. Upsert person attributes
    for (const attr of extracted.attributes) {
      await supabase
        .from("person_attributes")
        .upsert(
          { person_id: personId, key: attr.key, value: attr.value },
          { onConflict: "person_id,key" }
        );
    }

    // 3. Upsert family members and their attributes
    for (const fm of extracted.family_members) {
      // Check if this family member already exists
      const { data: existingFm } = await supabase
        .from("family_members")
        .select("id")
        .eq("person_id", personId)
        .ilike("name", fm.name)
        .maybeSingle();

      let fmId: string;

      if (existingFm) {
        fmId = existingFm.id;
      } else {
        const { data: newFm, error: fmError } = await supabase
          .from("family_members")
          .insert({
            person_id: personId,
            name: fm.name,
            relation: fm.relation,
          })
          .select("id")
          .single();

        if (fmError || !newFm) {
          throw new Error(`Failed to insert family member: ${fmError?.message}`);
        }
        fmId = newFm.id;
      }

      // Upsert family member attributes
      for (const attr of fm.attributes) {
        await supabase
          .from("family_member_attributes")
          .upsert(
            { family_member_id: fmId, key: attr.key, value: attr.value },
            { onConflict: "family_member_id,key" }
          );
      }
    }

    // 4. Insert a meeting log
    await supabase.from("meetings").insert({
      user_id: userId,
      person_id: personId,
      raw_input: rawInput,
      meeting_date: extraction.meeting_date ?? new Date().toISOString().split("T")[0],
      location: extraction.location,
      summary: extracted.summary,
    });
  }

  return personIds;
}
