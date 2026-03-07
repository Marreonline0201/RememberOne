// DELETE /api/people/[id]/family/[fmId]
// Deletes a family member and all their attributes (cascade handled by DB).

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface Params {
  params: { id: string; fmId: string };
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

    // Verify the family member belongs to a person owned by this user
    const { data: fm, error: fetchError } = await supabase
      .from("family_members")
      .select("id, person_id, people!inner(user_id)")
      .eq("id", params.fmId)
      .eq("person_id", params.id)
      .single();

    if (fetchError || !fm) {
      return NextResponse.json({ data: null, error: "Not found" }, { status: 404 });
    }

    // @ts-expect-error — Supabase join typing
    if (fm.people.user_id !== user.id) {
      return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 });
    }

    const { error: deleteError } = await supabase
      .from("family_members")
      .delete()
      .eq("id", params.fmId);

    if (deleteError) throw new Error(deleteError.message);

    return NextResponse.json({ data: { deleted: true }, error: null });
  } catch (err: unknown) {
    console.error("[DELETE /api/people/[id]/family/[fmId]]", err);
    return NextResponse.json(
      { data: null, error: err instanceof Error ? err.message : "Failed to delete family member" },
      { status: 500 }
    );
  }
}
