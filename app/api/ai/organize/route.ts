// POST /api/ai/organize
// Dry-run step of the typed "write a person" flow. Takes the user-typed name +
// free-form notes and organizes the notes into structured attributes / family /
// summary using Gemini — but writes NOTHING to the database. The user reviews
// (and may edit) the result, then commits via POST /api/people/from-organized.
//
// Why a separate route from /api/ai/extract: that route uses the multi-person
// discoverer (AI-guesses names) AND persists immediately. Here the name is typed
// by the user, so we use extractAdditionalInfo (organizes notes for a KNOWN
// name) and skip persistence entirely so "nothing is saved until Save" holds.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractAdditionalInfo } from "@/lib/gemini";
import { consumeAIRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { hasAiConsent, consentRequiredResponse } from "@/lib/ai-consent";
import { todayISO } from "@/lib/utils";
import { z } from "zod";

const RequestSchema = z.object({
  name: z.string().min(1, "Please enter a name").max(200),
  info: z.string().max(4000).optional().default(""),
});

const EMPTY_ORGANIZED = {
  attributes: [],
  family_members: [],
  meeting_date: null,
  location: null,
  summary: "",
};

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
    }

    // AI consent gate (5.1.2(i)) — block before notes are sent to Gemini.
    if (!hasAiConsent(user)) return consentRequiredResponse();

    // Validate BEFORE consuming a rate-limit token. This diverges from
    // /api/ai/extract (which rate-limits first) on purpose: an empty-info
    // request is a legitimate no-op here and shouldn't spend the AI budget.
    const body = await request.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const name = parsed.data.name.trim();
    const info = parsed.data.info.trim();
    if (!name) {
      return NextResponse.json(
        { data: null, error: "Please enter a name" },
        { status: 400 }
      );
    }

    // No notes to organize → return an empty structure without calling Gemini
    // and without spending an AI token. The user adds details by hand on review.
    if (info.length < 3) {
      return NextResponse.json({
        data: { name, organized: EMPTY_ORGANIZED },
        error: null,
      });
    }

    // Spend one AI token (shared 30-per-10-min budget with the other AI routes).
    const rl = await consumeAIRateLimit(supabase);
    if (!rl.allowed) {
      return NextResponse.json(
        { data: null, error: "Too many requests. Please wait a moment and try again." },
        { status: 429, headers: rateLimitHeaders(rl) }
      );
    }

    const lang = (user.user_metadata?.language === "ko" ? "ko" : "en") as "en" | "ko";

    // extractAdditionalInfo organizes notes for a KNOWN person name, so the typed
    // name is honored verbatim (the AI won't re-derive it or split into multiple
    // people). existingFamilyMembers is [] — this is a brand-new person.
    const organized = await extractAdditionalInfo(info, name, todayISO(), [], lang);

    return NextResponse.json({
      data: { name, organized },
      error: null,
    });
  } catch (err: unknown) {
    console.error("[/api/ai/organize]", err);
    return NextResponse.json(
      { data: null, error: "Failed to organize" },
      { status: 500 }
    );
  }
}
