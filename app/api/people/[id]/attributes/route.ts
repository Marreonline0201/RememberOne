// POST   /api/people/[id]/attributes  — add a single attribute
// DELETE /api/people/[id]/attributes  — delete an attribute by key

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const AddAttributeSchema = z.object({
  key: z.string().min(1).max(100),
  value: z.string().min(1).max(500),
});

const DeleteAttributeSchema = z.object({
  key: z.string().min(1).max(100),
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
    if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });

    // Verify ownership
    const { data: person } = await supabase
      .from("people")
      .select("id")
      .eq("id", params.id)
      .eq("user_id", user.id)
      .single();
    if (!person) return NextResponse.json({ data: null, error: "Not found" }, { status: 404 });

    const body = await request.json();
    const parsed = AddAttributeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ data: null, error: parsed.error.errors[0].message }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("person_attributes")
      .upsert({ person_id: params.id, key: parsed.data.key, value: parsed.data.value }, { onConflict: "person_id,key" })
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ data, error: null }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json({ data: null, error: "Failed to add attribute" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const parsed = DeleteAttributeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ data: null, error: parsed.error.errors[0].message }, { status: 400 });
    }

    const { error } = await supabase
      .from("person_attributes")
      .delete()
      .eq("person_id", params.id)
      .eq("key", parsed.data.key);

    if (error) throw new Error(error.message);
    return NextResponse.json({ data: { deleted: true }, error: null });
  } catch (err: unknown) {
    return NextResponse.json({ data: null, error: "Failed to delete attribute" }, { status: 500 });
  }
}
