"use client";

// GroupPickerSheet — assign one person to groups (multi-select + quick-create).
// Opened from: the person profile page, the card long-press menu, and the
// voice-flow preview. Saving goes through queuedFetch, so membership edits
// work OFFLINE (optimistic cache + outbox); only quick-create is online-gated.

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GroupChecklist } from "@/components/GroupChecklist";
import { useToast } from "@/components/ui/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { useOnline } from "@/lib/use-online";
import { useGroups } from "@/lib/use-groups";
import { queuedFetch } from "@/lib/offline-queue";

interface Props {
  open: boolean;
  onOpenChange(open: boolean): void;
  personId: string;
  personName: string;
  initialGroupIds: string[]; // pass person.group_ids ?? []
}

export function GroupPickerSheet({
  open,
  onOpenChange,
  personId,
  personName,
  initialGroupIds,
}: Props) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const online = useOnline();
  const { groups, createGroup } = useGroups();
  const [selected, setSelected] = useState<string[]>(initialGroupIds);
  const [saving, setSaving] = useState(false);

  // Re-seed the selection every time the sheet opens (the person's memberships
  // may have changed since the last open).
  useEffect(() => {
    if (open) setSelected(initialGroupIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, personId]);

  function toggleId(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
    );
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await queuedFetch(`/api/people/${personId}/groups`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ group_ids: selected }),
      });
      if (!res.ok) {
        let message = "Failed to update groups";
        try {
          const j = await res.json();
          if (j?.error) message = j.error;
        } catch {
          /* non-JSON error body */
        }
        throw new Error(message);
      }
      toast({ title: t("groups.saved"), description: personName });
      onOpenChange(false);
    } catch (err) {
      console.error("[group-picker] save failed:", err);
      toast({
        title: t("groups.save_failed"),
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent
        className="max-w-xs w-[calc(100%-3rem)] mx-auto p-5"
        style={{ borderRadius: "10px 2px 10px 2px" }}
      >
        <DialogHeader>
          <DialogTitle
            style={{ fontFamily: "'Hammersmith One', sans-serif", color: "#284e72" }}
          >
            {t("groups.picker_title")} {personName}
          </DialogTitle>
          <DialogDescription className="leading-relaxed" style={{ color: "#5e7983" }}>
            {t("groups.picker_hint")}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-1 max-h-[45vh] overflow-y-auto">
          <GroupChecklist
            groups={groups}
            selectedIds={selected}
            onToggle={toggleId}
            disabled={saving}
            onQuickCreate={
              online
                ? async (name) => {
                    const g = await createGroup(name);
                    setSelected((prev) => [...prev, g.id]);
                  }
                : undefined
            }
          />
          {!online && (
            <p className="text-[11px] mt-2" style={{ color: "#5e7983" }}>
              {t("groups.offline_hint")}
            </p>
          )}
        </div>

        <DialogFooter className="flex-row gap-2 mt-3 sm:justify-end">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="flex-1 h-11 text-[14px] disabled:opacity-50"
            style={{
              borderRadius: "10px 2px 10px 2px",
              border: "1px solid #dccaff",
              color: "#284e72",
              fontFamily: "'Hammersmith One', sans-serif",
            }}
          >
            {t("groups.cancel")}
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="flex-1 h-11 text-[14px] text-white flex items-center justify-center gap-2 disabled:opacity-70"
            style={{
              borderRadius: "10px 2px 10px 2px",
              background: "linear-gradient(to right, #284e72, #482d7c)",
              fontFamily: "'Hammersmith One', sans-serif",
            }}
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {t("groups.save")}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
