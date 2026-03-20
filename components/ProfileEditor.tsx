"use client";

// ProfileEditor — editable list of key-value attributes for a person.
// Keyframe injected once; Tailwind doesn't ship slide+fade out of the box.
const injectKeyframe = (() => {
  if (typeof document === "undefined") return () => {};
  let injected = false;
  return () => {
    if (injected) return;
    injected = true;
    const style = document.createElement("style");
    style.textContent = `
      @keyframes slideInFade {
        from { opacity: 0; transform: translateY(-8px); }
        to   { opacity: 1; transform: translateY(0); }
      }
    `;
    document.head.appendChild(style);
  };
})();
// Mobile-first: stacked key/value rows (full width each), large tap targets.
// On md+ the key and value fields appear side-by-side.

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Plus, Trash2, Save, Loader2, Undo2 } from "lucide-react";
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
  markedForDelete: boolean;
}

export function ProfileEditor({
  personId,
  initialAttributes,
  initialNotes,
}: Props) {
  injectKeyframe();
  const { toast } = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const newRowRef = useRef<HTMLDivElement>(null);

  const [notes, setNotes] = useState(initialNotes);
  const [notesDirty, setNotesDirty] = useState(false);

  const [attributes, setAttributes] = useState<LocalAttribute[]>(
    initialAttributes.map((a) => ({
      id: a.id,
      key: a.key,
      value: a.value,
      dirty: false,
      markedForDelete: false,
    }))
  );

  const [justAdded, setJustAdded] = useState(false);

  function addAttribute() {
    setAttributes((prev) => [
      ...prev,
      { id: null, key: "", value: "", dirty: true, markedForDelete: false },
    ]);
    setJustAdded(true);
  }

  useEffect(() => {
    if (!justAdded || !newRowRef.current) return;
    setJustAdded(false);

    const el = newRowRef.current;
    const firstInput = el.querySelector("input") as HTMLInputElement | null;

    // Smooth scroll with easing via rAF
    const targetY =
      el.getBoundingClientRect().top + window.scrollY - window.innerHeight / 2 + el.offsetHeight / 2;
    const startY = window.scrollY;
    const distance = targetY - startY;
    const duration = 400; // ms
    let start: number | null = null;

    function easeInOut(t: number) {
      return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    }

    function step(timestamp: number) {
      if (start === null) start = timestamp;
      const elapsed = timestamp - start;
      const progress = Math.min(elapsed / duration, 1);
      window.scrollTo(0, startY + distance * easeInOut(progress));
      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        firstInput?.focus();
      }
    }

    requestAnimationFrame(step);
  }, [justAdded, attributes.length]);

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

  function toggleDelete(index: number) {
    setAttributes((prev) =>
      prev.map((a, i) => {
        if (i !== index) return a;
        // Newly added + not yet saved: remove immediately (nothing to undo)
        if (a.id === null) return null as unknown as LocalAttribute;
        return { ...a, markedForDelete: !a.markedForDelete };
      }).filter(Boolean) as LocalAttribute[]
    );
  }

  async function handleSave() {
    const invalid = attributes.some((a) => !a.markedForDelete && (!a.key.trim() || !a.value.trim()));
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
            attributes: attributes
              .filter((a) => !a.markedForDelete)
              .map((a) => ({
                key: a.key.trim(),
                value: a.value.trim(),
              })),
          }),
        });

        const json = await res.json();
        if (!res.ok || json.error) throw new Error(json.error);

        setAttributes((prev) =>
          prev
            .filter((a) => !a.markedForDelete)
            .map((a) => ({ ...a, dirty: false }))
        );
        setNotesDirty(false);

        toast({ title: "Saved", description: "Profile updated successfully." });
        router.refresh();
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
    attributes.some((a) => a.id === null) ||
    attributes.some((a) => a.markedForDelete);

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
              ref={idx === attributes.length - 1 ? newRowRef : undefined}
              className="flex flex-col gap-2 md:flex-row md:items-start transition-opacity duration-200"
              style={{
                opacity: attr.markedForDelete ? 0.45 : 1,
                ...(attr.id === null && idx === attributes.length - 1
                  ? { animation: "slideInFade 0.3s ease-out both" }
                  : {}),
              }}
            >
              <Input
                value={attr.key}
                onChange={(e) => updateAttribute(idx, "key", e.target.value)}
                placeholder="Label (e.g. Job Title)"
                disabled={attr.markedForDelete}
                className="h-11 text-base md:text-sm md:flex-[2]"
                style={attr.markedForDelete ? { textDecoration: "line-through" } : undefined}
              />
              <Input
                value={attr.value}
                onChange={(e) => updateAttribute(idx, "value", e.target.value)}
                placeholder="Value"
                disabled={attr.markedForDelete}
                className="h-11 text-base md:text-sm md:flex-[3]"
                style={attr.markedForDelete ? { textDecoration: "line-through" } : undefined}
              />
              {/* Delete / Undo — 44px tap target */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => toggleDelete(idx)}
                className={`h-11 w-11 shrink-0 self-end md:self-auto ${
                  attr.markedForDelete
                    ? "text-amber-500 hover:text-amber-600"
                    : "text-muted-foreground hover:text-destructive"
                }`}
                aria-label={attr.markedForDelete ? "Undo remove" : "Remove attribute"}
              >
                {attr.markedForDelete ? (
                  <Undo2 className="w-4 h-4" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
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
