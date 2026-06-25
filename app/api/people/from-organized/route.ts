// POST /api/people/from-organized
// Commit step of the typed "write a person" flow. Takes the user-typed name + the
// REVIEWED organized result (attributes / family / summary) and persists the
// person. Makes NO AI call, so it never spends the AI rate-limit budget — Gemini
// ran earlier in POST /api/ai/organize and the user has since reviewed/edited.
//
// Persistence reuses saveExtractionResult, which matches an existing person by
// case-insensitive name and MERGES into it if one exists (same dedup as the
// voice path) — otherwise it creates a new person. So a same-named save folds
// into the existing record rather than duplicating it.
//
// The whole organized payload is re-validated server-side (never trust the
// client), and the person's name is the trimmed typed value — not anything the
// client could have smuggled into the organized blob. user.id is server-derived.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { saveExtractionResult, getPersonFull } from "@/lib/people";
import type { AIExtractionResult } from "@/types/app";
import { z } from "zod";

const AttributeSchema = z.object({
  key: z.string().min(1).max(200),
  value: z.string().min(1).max(1000),
});

const FamilyMemberSchema = z.object({
  name: z.string().min(1).max(200),
  relation: z.string().min(1).max(100),
  attributes: z.array(AttributeSchema).max(50).default([]),
});

const RequestSchema = z.object({
  name: z.string().min(1, "Please enter a name").max(200),
  rawInput: z.string().max(4000).optional().default(""),
  organized: z.object({
    attributes: z.array(AttributeSchema).max(100).default([]),
    family_members: z.array(FamilyMemberSchema).max(50).default([]),
    // Lenient: the AI's date is sanitized below rather than rejected, so a stray
    // format can't 400 the whole save (or reach the DATE column malformed).
    meeting_date: z.string().max(40).nullable().optional().default(null),
    location: z.string().max(500).nullable().optional().default(null),
    summary: z.string().max(2000).optional().default(""),
  }),
});

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const name = parsed.data.name.trim();
    if (!name) {
      return NextResponse.json(
        { data: null, error: "Please enter a name" },
        { status: 400 }
      );
    }

    const { rawInput, organized } = parsed.data;

    // Coerce a non-ISO date to null so saveExtractionResult falls back to today
    // instead of writing a malformed value to the DATE column.
    const meetingDate =
      organized.meeting_date && ISO_DATE.test(organized.meeting_date)
        ? organized.meeting_date
        : null;
    const location = organized.location?.trim() ? organized.location.trim() : null;

    // Build a single-person extraction from the REVIEWED data.
    const extraction: AIExtractionResult = {
      people: [
        {
          name,
          summary: organized.summary,
          attributes: organized.attributes,
          family_members: organized.family_members,
        },
      ],
      meeting_date: meetingDate,
      location,
    };

    // Only log a meeting when there's something to record. A pure name-only save
    // (no notes, no summary, no attributes/family) shouldn't create an empty
    // ghost meeting in the person's history.
    const logMeeting = Boolean(
      rawInput.trim() ||
        organized.summary.trim() ||
        organized.attributes.length ||
        organized.family_members.length
    );

    const personIds = await saveExtractionResult(
      supabase,
      user.id,
      extraction,
      rawInput,
      logMeeting
    );
    const personId = personIds[0] ?? null;
    const person = personId ? await getPersonFull(supabase, personId, user.id) : null;

    return NextResponse.json(
      { data: { person, personId }, error: null },
      { status: 201 }
    );
  } catch (err: unknown) {
    console.error("[/api/people/from-organized]", err);
    return NextResponse.json(
      { data: null, error: "Failed to save person" },
      { status: 500 }
    );
  }
}
