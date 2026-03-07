"use client";

// ProfileEditor — editable list of key-value attributes for a person.
// Each row can be edited inline. Users can add new attributes and delete existing ones.

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
  id: string | null;     // null = newly added (not yet saved)
  key: string;
  value: string;
  dirty: boolean;
}

export function ProfileEditor({ personId, initialAttributes, initialNotes }: Props) {
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

  function updateAttribute(index: number, field: "key" | "value", val: string) {
    setAttributes((prev) =>
      prev.map((a, i) => (i === index ? { ...a, [field]: val, dirty: true } : a))
    );
  }

  function removeAttribute(index: number) {
    setAttributes((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    // Validate: all attribute rows must have both key and value
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

        // Refresh local state to mark all as clean
        setAttributes((prev) => prev.map((a) => ({ ...a, dirty: false })));
        setNotesDirty(false);

        toast({ title: "Saved", description: "Profile updated successfully." });
      } catch (err: unknown) {
        toast({
          title: "Save failed",
          description: err instanceof Error ? err.message : "Unknown error",
          variant: "destructive",
        });
      }
    });
  }

  const hasPendingChanges =
    notesDirty || attributes.some((a) => a.dirty) || attributes.some((a) => a.id === null);

  return (
    <div className="space-y-5">
      {/* Notes */}
      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value);
            setNotesDirty(true);
          }}
          placeholder="Add any free-form notes about this person..."
          className="min-h-[80px] text-sm resize-none"
        />
      </div>

      {/* Attributes */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Attributes</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addAttribute}
            className="gap-1.5 text-xs h-7"
          >
            <Plus className="w-3 h-3" />
            Add field
          </Button>
        </div>

        <div className="space-y-2">
          {attributes.length === 0 && (
            <p className="text-sm text-muted-foreground py-2">
              No attributes yet. Click &quot;Add field&quot; to add details like job,
              company, university, hobby, etc.
            </p>
          )}

          {attributes.map((attr, idx) => (
            <div key={idx} className="flex gap-2 items-start">
              <Input
                value={attr.key}
                onChange={(e) => updateAttribute(idx, "key", e.target.value)}
                placeholder="Label (e.g. Job Title)"
                className="flex-[2] h-9 text-sm"
              />
              <Input
                value={attr.value}
                onChange={(e) => updateAttribute(idx, "value", e.target.value)}
                placeholder="Value"
                className="flex-[3] h-9 text-sm"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeAttribute(idx)}
                className="h-9 w-9 text-muted-foreground hover:text-destructive shrink-0"
                aria-label="Remove attribute"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Save button */}
      <div className="flex justify-end pt-1">
        <Button
          onClick={handleSave}
          disabled={!hasPendingChanges || isPending}
          size="sm"
          className="gap-2"
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
