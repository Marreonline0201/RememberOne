// Single group: rename / edit description / delete.
// Deleting a group removes its memberships only (person_groups ON DELETE
// CASCADE) — the people themselves are untouched.

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const UpdateGroupSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(60).optional(),
  description: z.string().trim().max(300).optional().nullable(),
});

interface Params {
  params: Promise<{ id: string }>;
}

export async function PUT(request: Request, props: Params) {
  const params = await props.params;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = UpdateGroupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) updates.name = parsed.data.name;
    if (parsed.data.description !== undefined) {
      updates.description = parsed.data.description || null;
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ data: null, error: "Nothing to update" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("groups")
      .update(updates)
      .eq("id", params.id)
      .eq("user_id", user.id) // defense-in-depth on top of RLS
      .select("*")
      .maybeSingle();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { data: null, error: "duplicate_group_name" },
          { status: 409 }
        );
      }
      throw new Error(error.message);
    }
    if (!data) {
      return NextResponse.json({ data: null, error: "Group not found" }, { status: 404 });
    }

    return NextResponse.json({ data, error: null });
  } catch (err: unknown) {
    console.error("[PUT /api/groups/[id]]", err);
    return NextResponse.json({ data: null, error: "Failed to update group" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, props: Params) {
  const params = await props.params;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
    }

    const { error } = await supabase
      .from("groups")
      .delete()
      .eq("id", params.id)
      .eq("user_id", user.id);

    if (error) throw new Error(error.message);
    return NextResponse.json({ data: { deleted: true }, error: null });
  } catch (err: unknown) {
    console.error("[DELETE /api/groups/[id]]", err);
    return NextResponse.json({ data: null, error: "Failed to delete group" }, { status: 500 });
  }
}
