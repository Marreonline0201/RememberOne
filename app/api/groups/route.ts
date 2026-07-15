// Groups collection: list the user's groups / create a new one.
// Group management (create/rename/delete) is online-only by design — see
// lib/use-groups.ts. Membership assignment lives at /api/people/[id]/groups.

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const CreateGroupSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(60),
  description: z.string().trim().max(300).optional().nullable(),
});

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("groups")
      .select("*")
      .eq("user_id", user.id)
      .order("name");

    if (error) throw new Error(error.message);
    return NextResponse.json({ data: data ?? [], error: null });
  } catch (err: unknown) {
    console.error("[GET /api/groups]", err);
    return NextResponse.json({ data: null, error: "Failed to fetch groups" }, { status: 500 });
  }
}

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
    const parsed = CreateGroupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const { name, description } = parsed.data;
    const { data, error } = await supabase
      .from("groups")
      .insert({ user_id: user.id, name, description: description || null })
      .select("*")
      .single();

    if (error) {
      // Unique index (user_id, lower(name)) — surface duplicates as 409 so the
      // client can show a friendly "name already exists" message.
      if (error.code === "23505") {
        return NextResponse.json(
          { data: null, error: "duplicate_group_name" },
          { status: 409 }
        );
      }
      throw new Error(error.message);
    }

    return NextResponse.json({ data, error: null }, { status: 201 });
  } catch (err: unknown) {
    console.error("[POST /api/groups]", err);
    return NextResponse.json({ data: null, error: "Failed to create group" }, { status: 500 });
  }
}
