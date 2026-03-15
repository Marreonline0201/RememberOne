// POST /api/ai/extract
// Accepts raw user text, calls Claude to extract structured person data,
// persists it to Supabase, and returns the created person IDs + extracted data.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractPeopleFromText } from "@/lib/gemini";
import { saveExtractionResult, getAllPeople } from "@/lib/people";
import { todayISO } from "@/lib/utils";
import { z } from "zod";

const RequestSchema = z.object({
  text: z.string().min(3, "Please describe the person you met").max(4000),
});

export async function POST(request: Request) {
  try {
    // 1. Authenticate
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
    }

    // 2. Validate request body
    const body = await request.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const { text } = parsed.data;

    // 3. Get user language + existing people for better AI extraction
    const lang = (user.user_metadata?.language === "ko" ? "ko" : "en") as "en" | "ko";
    const existingPeople = await getAllPeople(supabase, user.id);
    const existingNames = existingPeople.map((p) => p.name);

    // 4. Call Gemini
    const extraction = await extractPeopleFromText(text, todayISO(), lang, existingNames);

    if (extraction.people.length === 0) {
      return NextResponse.json(
        {
          data: null,
          error:
            "No people were found in your description. Try being more specific about the person's name and details.",
        },
        { status: 422 }
      );
    }

    // 5. Persist to database
    const personIds = await saveExtractionResult(supabase, user.id, extraction, text);

    // 6. Return extraction result + created IDs
    return NextResponse.json({
      data: {
        extraction,
        personIds,
      },
      error: null,
    });
  } catch (err: unknown) {
    console.error("[/api/ai/extract]", err);
    return NextResponse.json(
      {
        data: null,
        error:
          err instanceof Error
            ? err.message
            : "An unexpected error occurred",
      },
      { status: 500 }
    );
  }
}
