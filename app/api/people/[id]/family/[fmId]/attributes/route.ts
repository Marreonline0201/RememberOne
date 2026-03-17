// POST   /api/people/[id]/family/[fmId]/attributes — upsert a family member attribute
// DELETE /api/people/[id]/family/[fmId]/attributes — delete a family member attribute by key

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const UpsertSchema = z.object({
  key: z.string().min(1).max(100),
  value: z.string().min(1).max(500),
});

const DeleteSchema = z.object({
  key: z.string().min(1).max(100),
});

interface Params {
  params: { id: string; fmId: string };
}

async function verifyOwnership(supabase: ReturnType<typeof createClient>, personId: string, fmId: string, userId: string) {
  const { data: fm } = await supabase
    .from("family_members")
    .select("id, person_id, people!inner(user_id)")
    .eq("id", fmId)
    .eq("person_id", personId)
    .single();

  if (!fm) return null;
  // @ts-expect-error — Supabase join typing
  if (fm.people.user_id !== userId) return null;
  return fm;
}

export async function POST(request: Request, { params }: Params) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });

    const fm = await verifyOwnership(supabase, params.id, params.fmId, user.id);
    if (!fm) return NextResponse.json({ data: null, error: "Not found" }, { status: 404 });

    const body = await request.json();
    const parsed = UpsertSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ data: null, error: parsed.error.errors[0].message }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("family_member_attributes")
      .upsert(
        { family_member_id: params.fmId, key: parsed.data.key, value: parsed.data.value },
        { onConflict: "family_member_id,key" }
      )
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ data, error: null }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json({ data: null, error: "Failed to save attribute" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });

    const fm = await verifyOwnership(supabase, params.id, params.fmId, user.id);
    if (!fm) return NextResponse.json({ data: null, error: "Not found" }, { status: 404 });

    const body = await request.json();
    const parsed = DeleteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ data: null, error: parsed.error.errors[0].message }, { status: 400 });
    }

    const { error } = await supabase
      .from("family_member_attributes")
      .delete()
      .eq("family_member_id", params.fmId)
      .eq("key", parsed.data.key);

    if (error) throw new Error(error.message);
    return NextResponse.json({ data: { deleted: true }, error: null });
  } catch (err: unknown) {
    return NextResponse.json({ data: null, error: "Failed to delete attribute" }, { status: 500 });
  }
}
