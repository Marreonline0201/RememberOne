"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Plus, Loader2, Check, X } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface Props {
  personId: string;
}

export function AddFamilyMemberForm({ personId }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const { language } = useLanguage();
  const isKo = language === "ko";
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [relation, setRelation] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    if (!name.trim() || !relation.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/people/${personId}/family`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), relation: relation.trim(), notes: notes.trim() || null }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? "Failed to add");
      toast({ title: isKo ? `${name} 추가됨` : `${name} added` });
      setName("");
      setRelation("");
      setNotes("");
      // Keep the form open so another member can be added right away
      router.refresh();
    } catch (err: unknown) {
      toast({
        title: isKo ? "추가 실패" : "Failed to add",
        description: err instanceof Error ? err.message : isKo ? "문제가 발생했어요" : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setOpen(false);
    setName("");
    setRelation("");
    setNotes("");
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        className="w-full h-10 border-dashed"
        style={{ borderColor: "#dccaff", color: "#482d7c" }}
        onClick={() => setOpen(true)}
      >
        <Plus className="w-4 h-4 mr-2" />
        {isKo ? "가족 추가" : "Add family member"}
      </Button>
    );
  }

  return (
    <div
      className="space-y-2 p-3 rounded-lg"
      style={{ backgroundColor: "rgba(220, 202, 255, 0.2)", border: "1px solid #dccaff" }}
    >
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={isKo ? "이름" : "Name"}
        className="h-9 text-sm"
        autoFocus
      />
      <Input
        value={relation}
        onChange={(e) => setRelation(e.target.value)}
        placeholder={isKo ? "관계 (예: 아들, 딸, 배우자)" : "Relation (e.g. son, wife, brother)"}
        className="h-9 text-sm"
      />
      <Input
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder={isKo ? "메모 (선택)" : "Notes (optional)"}
        className="h-9 text-sm"
      />
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          className="h-9 flex-1"
          onClick={handleAdd}
          disabled={saving || !name.trim() || !relation.trim()}
        >
          {saving ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Check className="w-3 h-3 mr-1" />
          )}
          {isKo ? "추가" : "Add"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9"
          onClick={handleCancel}
          disabled={saving}
        >
          <X className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}
