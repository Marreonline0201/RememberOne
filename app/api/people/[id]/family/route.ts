// POST /api/people/[id]/family — add a new family member

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

    // Verify the person belongs to this user
    const { data: person, error: personError } = await supabase
      .from("people")
      .select("id")
      .eq("id", params.id)
      .eq("user_id", user.id)
      .single();

    if (personError || !person) {
      return NextResponse.json({ data: null, error: "Not found" }, { status: 404 });
    }

    const body = await request.json();
    const { name, relation, notes } = body;

    if (!name?.trim() || !relation?.trim()) {
      return NextResponse.json(
        { data: null, error: "Name and relation are required" },
        { status: 400 }
      );
    }

    const { data: fm, error: insertError } = await supabase
      .from("family_members")
      .insert({
        person_id: params.id,
        name: name.trim(),
        relation: relation.trim(),
        notes: notes?.trim() || null,
      })
      .select()
      .single();

    if (insertError) throw new Error(insertError.message);

    return NextResponse.json({ data: fm, error: null }, { status: 201 });
  } catch (err: unknown) {
    console.error("[POST /api/people/[id]/family]", err);
    return NextResponse.json(
      { data: null, error: err instanceof Error ? err.message : "Failed to add family member" },
      { status: 500 }
    );
  }
}
