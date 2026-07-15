// Replace a person's group memberships (replace-all, like the attributes
// convention in PUT /api/people/[id]). Returns the full person so the offline
// queue's reconcileFromResponse caches the authoritative copy.

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getPersonFull } from "@/lib/people";

const SetPersonGroupsSchema = z.object({
  group_ids: z.array(z.string().uuid()).max(200),
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
    const parsed = SetPersonGroupsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    // Person must belong to the caller.
    const { data: person } = await supabase
      .from("people")
      .select("id")
      .eq("id", params.id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!person) {
      return NextResponse.json({ data: null, error: "Person not found" }, { status: 404 });
    }

    // INTERSECT with the user's own groups instead of rejecting unknown ids:
    // an offline outbox replay can race a group deletion, and flushOutbox drops
    // 4xx writes permanently — a 400 here would silently lose the user's whole
    // membership set. Dropping the dead id and saving the rest is what they meant.
    let validIds: string[] = [];
    if (parsed.data.group_ids.length > 0) {
      const { data: owned, error: ownedErr } = await supabase
        .from("groups")
        .select("id")
        .eq("user_id", user.id)
        .in("id", parsed.data.group_ids);
      if (ownedErr) throw new Error(ownedErr.message);
      validIds = (owned ?? []).map((g: { id: string }) => g.id);
    }

    // Replace-all: delete then insert.
    const { error: delErr } = await supabase
      .from("person_groups")
      .delete()
      .eq("person_id", params.id);
    if (delErr) throw new Error(delErr.message);

    if (validIds.length > 0) {
      const { error: insErr } = await supabase
        .from("person_groups")
        .insert(validIds.map((gid) => ({ person_id: params.id, group_id: gid })));
      if (insErr) throw new Error(insErr.message);
    }

    const updated = await getPersonFull(supabase, params.id, user.id);
    return NextResponse.json({ data: updated, error: null });
  } catch (err: unknown) {
    console.error("[PUT /api/people/[id]/groups]", err);
    return NextResponse.json(
      { data: null, error: "Failed to update groups" },
      { status: 500 }
    );
  }
}
