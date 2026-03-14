"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";
import { Pencil, Check, X, Loader2 } from "lucide-react";

interface Props {
  personId: string;
  initialName: string;
}

export function EditableName({ personId, initialName }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim() || name.trim() === initialName) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/people/${personId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? "Update failed");
      setEditing(false);
      router.refresh();
    } catch (err: unknown) {
      toast({
        title: "Failed to update name",
        description: err instanceof Error ? err.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setName(initialName);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") handleCancel();
          }}
          autoFocus
          className="text-[28px] leading-tight text-black bg-transparent border-b-2 border-black/30 focus:border-black outline-none w-full"
          style={{ fontFamily: "'Hammersmith One', sans-serif" }}
        />
        <button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="shrink-0 p-1"
          aria-label="Save name"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" style={{ color: "#284e72" }} />
          ) : (
            <Check className="w-4 h-4" style={{ color: "#284e72" }} />
          )}
        </button>
        <button
          onClick={handleCancel}
          disabled={saving}
          className="shrink-0 p-1"
          aria-label="Cancel"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 group">
      <h1
        className="text-[28px] leading-tight text-black"
        style={{ fontFamily: "'Hammersmith One', sans-serif" }}
      >
        {initialName}
      </h1>
      <button
        onClick={() => setEditing(true)}
        className="shrink-0 p-1 opacity-50 group-hover:opacity-100 transition-opacity"
        aria-label="Edit name"
      >
        <Pencil className="w-3.5 h-3.5" style={{ color: "#284e72" }} />
      </button>
    </div>
  );
}
