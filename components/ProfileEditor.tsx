"use client";

// ProfileEditor — editable list of key-value attributes for a person.
// Mobile-first: stacked key/value rows (full width each), large tap targets.
// On md+ the key and value fields appear side-by-side.

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Plus, Trash2, Save, Loader2 } from "lucide-react";
import type { PersonAttribute } from "@/types/database";

interface Props {
  personId: string;
  initialAttributes: PersonAttribute[];
  initialNotes: string;
}

interface LocalAttribute {
  id: string | null; // null = newly added, not yet saved
  key: string;
  value: string;
  dirty: boolean;
}

export function ProfileEditor({
  personId,
  initialAttributes,
  initialNotes,
}: Props) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [notes, setNotes] = useState(initialNotes);
  const [notesDirty, setNotesDirty] = useState(false);

  const [attributes, setAttributes] = useState<LocalAttribute[]>(
    initialAttributes.map((a) => ({
      id: a.id,
      key: a.key,
      value: a.value,
      dirty: false,
    }))
  );

  function addAttribute() {
    setAttributes((prev) => [
      ...prev,
      { id: null, key: "", value: "", dirty: true },
    ]);
  }

  function updateAttribute(
    index: number,
    field: "key" | "value",
    val: string
  ) {
    setAttributes((prev) =>
      prev.map((a, i) =>
        i === index ? { ...a, [field]: val, dirty: true } : a
      )
    );
  }

  function removeAttribute(index: number) {
    setAttributes((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    const invalid = attributes.some((a) => !a.key.trim() || !a.value.trim());
    if (invalid) {
      toast({
        title: "Please fill in all fields",
        description: "Each attribute needs both a label and a value.",
        variant: "destructive",
      });
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch(`/api/people/${personId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            notes: notes || null,
            attributes: attributes.map((a) => ({
              key: a.key.trim(),
              value: a.value.trim(),
            })),
          }),
        });

        const json = await res.json();
        if (!res.ok || json.error) throw new Error(json.error);

        setAttributes((prev) => prev.map((a) => ({ ...a, dirty: false })));
        setNotesDirty(false);

        toast({ title: "Saved", description: "Profile updated successfully." });
      } catch (err: unknown) {
        toast({
          title: "Save failed",
          description:
            err instanceof Error ? err.message : "Unknown error",
          variant: "destructive",
        });
      }
    });
  }

  const hasPendingChanges =
    notesDirty ||
    attributes.some((a) => a.dirty) ||
    attributes.some((a) => a.id === null);

  return (
    <div className="space-y-6">
      {/* Notes */}
      <div className="space-y-1.5">
        <Label htmlFor="notes" className="text-sm font-medium">
          Notes
        </Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value);
            setNotesDirty(true);
          }}
          placeholder="Add any free-form notes about this person..."
          /*
            min-h-[100px] gives enough space on mobile.
            text-base prevents iOS auto-zoom on focus.
          */
          className="min-h-[100px] text-base md:text-sm resize-none"
        />
      </div>

      {/* Attributes */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Attributes</Label>
          {/* "Add field" — 44px touch target */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addAttribute}
            className="gap-1.5 h-9 px-3"
          >
            <Plus className="w-3.5 h-3.5" />
            Add field
          </Button>
        </div>

        <div className="space-y-3">
          {attributes.length === 0 && (
            <p className="text-sm text-muted-foreground py-2">
              No attributes yet. Tap &quot;Add field&quot; to add details like job,
              company, university, hobby, etc.
            </p>
          )}

          {attributes.map((attr, idx) => (
            /*
              Mobile: stacked vertically — label input on top, value below.
              md+: side-by-side row.
              Delete button is always at the end with a 44px touch target.
            */
            <div
              key={idx}
              className="flex flex-col gap-2 md:flex-row md:items-start"
            >
              <Input
                value={attr.key}
                onChange={(e) => updateAttribute(idx, "key", e.target.value)}
                placeholder="Label (e.g. Job Title)"
                /*
                  h-11 = 44px touch target.
                  text-base prevents iOS zoom.
                  md:flex-[2] gives the key field proportional width on desktop.
                */
                className="h-11 text-base md:text-sm md:flex-[2]"
              />
              <Input
                value={attr.value}
                onChange={(e) => updateAttribute(idx, "value", e.target.value)}
                placeholder="Value"
                className="h-11 text-base md:text-sm md:flex-[3]"
              />
              {/* Delete — 44px tap target */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeAttribute(idx)}
                className="h-11 w-11 text-muted-foreground hover:text-destructive shrink-0 self-end md:self-auto"
                aria-label="Remove attribute"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Save button — full width on mobile, right-aligned on desktop */}
      <div className="flex md:justify-end pt-1">
        <Button
          onClick={handleSave}
          disabled={!hasPendingChanges || isPending}
          className="w-full md:w-auto h-11 gap-2"
        >
          {isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {isPending ? "Saving..." : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
