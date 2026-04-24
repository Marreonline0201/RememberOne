// POST /api/people/[id]/notes
// Takes raw text (typed or voice-transcribed), calls Gemini to extract
// additional info about the named person, and merges it into their profile.
// Existing attributes are kept; new ones are upserted. A meeting log is added.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPersonFull } from "@/lib/people";
import { extractAdditionalInfo } from "@/lib/gemini";
import { consumeAIRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { todayISO, isRelationPlaceholder } from "@/lib/utils";
import { z } from "zod";

const RequestSchema = z.object({
  text: z.string().min(3, "Notes must be at least 3 characters").max(4000),
  logMeeting: z.boolean().optional().default(true),
});

interface Params {
  params: { id: string };
}

export async function POST(request: Request, { params }: Params) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
    }

    // Rate limit AI calls per-user (shared budget with /api/ai/extract)
    const rl = await consumeAIRateLimit(supabase);
    if (!rl.allowed) {
      return NextResponse.json(
        {
          data: null,
          error: "Too many requests. Please wait a moment and try again.",
        },
        { status: 429, headers: rateLimitHeaders(rl) }
      );
    }

    // Verify person exists and belongs to this user
    const person = await getPersonFull(supabase, params.id, user.id);
    if (!person) {
      return NextResponse.json({ data: null, error: "Person not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const { text, logMeeting } = parsed.data;

    const lang = (user.user_metadata?.language === "ko" ? "ko" : "en") as "en" | "ko";

    // Extract additional info, passing existing family members so Gemini
    // can correctly update their attributes instead of creating wrong new entries
    const extraction = await extractAdditionalInfo(
      text,
      person.name,
      todayISO(),
      person.family_members.map((fm) => ({ name: fm.name, relation: fm.relation })),
      lang
    );

    // Upsert new attributes (keeps existing ones that aren't overwritten)
    for (const attr of extraction.attributes) {
      await supabase
        .from("person_attributes")
        .upsert(
          { person_id: params.id, key: attr.key, value: attr.value },
          { onConflict: "person_id,key" }
        );
    }

    // Upsert new family members and their attributes
    for (const fm of extraction.family_members) {
      // 1. Try exact name match
      let { data: existingFm } = await supabase
        .from("family_members")
        .select("id")
        .eq("person_id", params.id)
        .ilike("name", fm.name)
        .maybeSingle();

      // 2. If no match, look for a placeholder with the same relation to merge into.
      //    Only attempt this when the incoming name is a real name (not itself a placeholder),
      //    otherwise numbered placeholders ("Son 1", "Son 2") would overwrite each other.
      if (!existingFm && !isRelationPlaceholder(fm.name, fm.relation)) {
        const { data: sameRelation } = await supabase
          .from("family_members")
          .select("id, name")
          .eq("person_id", params.id)
          .ilike("relation", fm.relation);

        const placeholders = (sameRelation ?? []).filter((p) =>
          isRelationPlaceholder(p.name, fm.relation)
        );

        if (placeholders.length === 1) {
          // Promote the placeholder to the real name
          await supabase
            .from("family_members")
            .update({ name: fm.name })
            .eq("id", placeholders[0].id);
          existingFm = { id: placeholders[0].id };
        }
      }

      let fmId: string;

      if (existingFm) {
        fmId = existingFm.id;
      } else {
        const { data: newFm, error: fmError } = await supabase
          .from("family_members")
          .insert({ person_id: params.id, name: fm.name, relation: fm.relation })
          .select("id")
          .single();

        if (fmError || !newFm) {
          throw new Error(`Failed to insert family member: ${fmError?.message}`);
        }
        fmId = newFm.id;
      }

      for (const attr of fm.attributes) {
        await supabase
          .from("family_member_attributes")
          .upsert(
            { family_member_id: fmId, key: attr.key, value: attr.value },
            { onConflict: "family_member_id,key" }
          );
      }
    }

    // Add meeting log entry only when the user actually met this person
    if (logMeeting) {
      await supabase.from("meetings").insert({
        user_id: user.id,
        person_id: params.id,
        raw_input: text,
        meeting_date: extraction.meeting_date ?? todayISO(),
        location: extraction.location,
        summary: extraction.summary,
      });
    }

    // Touch the person's updated_at
    await supabase
      .from("people")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", params.id);

    // Return the fully updated person
    const updated = await getPersonFull(supabase, params.id, user.id);
    return NextResponse.json({
      data: {
        person: updated,
        added: {
          attributes: extraction.attributes.length,
          family_members: extraction.family_members.length,
          summary: extraction.summary,
        },
      },
      error: null,
    });
  } catch (err: unknown) {
    console.error("[POST /api/people/[id]/notes]", err);
    return NextResponse.json(
      { data: null, error: "Failed to update notes" },
      { status: 500 }
    );
  }
}
