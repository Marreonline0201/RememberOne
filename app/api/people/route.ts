// GET  /api/people  — list all people for the authenticated user
// POST /api/people  — manually create a new person (name only; attributes added separately)

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAllPeople } from "@/lib/people";
import { z } from "zod";

const CreatePersonSchema = z.object({
  name: z.string().min(1).max(200),
  notes: z.string().max(2000).optional(),
});

export async function GET() {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
    }

    const people = await getAllPeople(supabase, user.id);
    return NextResponse.json({ data: people, error: null });
  } catch (err: unknown) {
    console.error("[GET /api/people]", err);
    return NextResponse.json(
      { data: null, error: "Failed to fetch people" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = CreatePersonSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const { data: person, error } = await supabase
      .from("people")
      .insert({ user_id: user.id, name: parsed.data.name, notes: parsed.data.notes ?? null })
      .select("*")
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({ data: person, error: null }, { status: 201 });
  } catch (err: unknown) {
    console.error("[POST /api/people]", err);
    return NextResponse.json(
      { data: null, error: "Failed to create person" },
      { status: 500 }
    );
  }
}
