// GET    /api/people/[id]  — get full person with attributes + family members
// PUT    /api/people/[id]  — update person name / notes / attributes
// DELETE /api/people/[id]  — delete person and all related data

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPersonFull } from "@/lib/people";
import { z } from "zod";

const UpdatePersonSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  notes: z.string().max(2000).optional().nullable(),
  attributes: z
    .array(
      z.object({
        key: z.string().min(1).max(100),
        value: z.string().min(1).max(500),
      })
    )
    .optional(),
});

interface Params {
  params: { id: string };
}

export async function GET(_request: Request, { params }: Params) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
    }

    const person = await getPersonFull(supabase, params.id);
    if (!person) {
      return NextResponse.json({ data: null, error: "Not found" }, { status: 404 });
    }

    // RLS already enforces ownership, but double-check
    if (person.user_id !== user.id) {
      return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ data: person, error: null });
  } catch (err: unknown) {
    console.error("[GET /api/people/[id]]", err);
    return NextResponse.json({ data: null, error: "Failed to fetch person" }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: Params) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = UpdatePersonSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const { name, notes, attributes } = parsed.data;

    // Update person base fields
    if (name !== undefined || notes !== undefined) {
      const updates: Record<string, unknown> = {};
      if (name !== undefined) updates.name = name;
      if (notes !== undefined) updates.notes = notes;

      const { error } = await supabase
        .from("people")
        .update(updates)
        .eq("id", params.id)
        .eq("user_id", user.id);

      if (error) throw new Error(error.message);
    }

    // Replace attributes if provided
    if (attributes !== undefined) {
      // Delete existing attributes and re-insert
      await supabase.from("person_attributes").delete().eq("person_id", params.id);

      if (attributes.length > 0) {
        const { error } = await supabase.from("person_attributes").insert(
          attributes.map((a) => ({ person_id: params.id, key: a.key, value: a.value }))
        );
        if (error) throw new Error(error.message);
      }
    }

    const updatedPerson = await getPersonFull(supabase, params.id);
    return NextResponse.json({ data: updatedPerson, error: null });
  } catch (err: unknown) {
    console.error("[PUT /api/people/[id]]", err);
    return NextResponse.json({ data: null, error: "Failed to update person" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
    }

    const { error } = await supabase
      .from("people")
      .delete()
      .eq("id", params.id)
      .eq("user_id", user.id);

    if (error) throw new Error(error.message);

    return NextResponse.json({ data: { deleted: true }, error: null });
  } catch (err: unknown) {
    console.error("[DELETE /api/people/[id]]", err);
    return NextResponse.json({ data: null, error: "Failed to delete person" }, { status: 500 });
  }
}
