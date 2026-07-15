"use client";

// GroupChecklist — presentational multi-select list of the user's groups plus
// an optional inline quick-create row. Shared by GroupPickerSheet (person
// detail / long-press menu / voice preview) and WritePersonForm's review step.

import { useState } from "react";
import { Check, Loader2, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import { GROUPS_ERR_DUPLICATE, GROUPS_ERR_OFFLINE } from "@/lib/use-groups";
import type { Group } from "@/types/database";

interface Props {
  groups: Group[];
  selectedIds: string[];
  onToggle(id: string): void;
  // Inline "new group" row. Omit to hide (e.g. offline — CRUD is online-only).
  onQuickCreate?(name: string): Promise<void>;
  disabled?: boolean;
}

export function GroupChecklist({
  groups,
  selectedIds,
  onToggle,
  onQuickCreate,
  disabled,
}: Props) {
  const { t } = useLanguage();
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  async function handleQuickCreate() {
    const name = newName.trim();
    if (!name || !onQuickCreate || creating) return;
    setCreating(true);
    setCreateError(null);
    try {
      await onQuickCreate(name);
      setNewName("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      setCreateError(
        msg === GROUPS_ERR_DUPLICATE
          ? t("groups.duplicate")
          : msg === GROUPS_ERR_OFFLINE
            ? t("groups.offline_hint")
            : t("groups.create_failed")
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-3">
      {groups.length === 0 ? (
        <p className="text-sm py-1" style={{ color: "#5e7983" }}>
          {t("groups.empty")}
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {groups.map((g) => {
            const selected = selectedIds.includes(g.id);
            return (
              <button
                key={g.id}
                type="button"
                disabled={disabled}
                onClick={() => onToggle(g.id)}
                aria-pressed={selected}
                className="h-9 px-3 text-[13px] flex items-center gap-1.5 transition-opacity active:opacity-80 disabled:opacity-50"
                style={{
                  borderRadius: "10px 2px 10px 2px",
                  fontFamily: "'Hammersmith One', sans-serif",
                  ...(selected
                    ? {
                        background: "linear-gradient(to right, #284e72, #482d7c)",
                        color: "#ffffff",
                      }
                    : {
                        backgroundColor: "#f0e8ff",
                        border: "1px solid #dccaff",
                        color: "#284e72",
                      }),
                }}
              >
                {selected && <Check className="w-3.5 h-3.5 shrink-0" />}
                <span className="truncate max-w-[180px]">{g.name}</span>
              </button>
            );
          })}
        </div>
      )}

      {onQuickCreate && (
        <div>
          <div className="flex gap-2">
            <Input
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value);
                setCreateError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleQuickCreate();
                }
              }}
              placeholder={t("groups.quick_create")}
              maxLength={60}
              disabled={disabled || creating}
              className="h-10 text-sm rounded-[10px_2px_10px_2px]"
              style={{ backgroundColor: "#f0e8ff", borderColor: "#dccaff" }}
            />
            <button
              type="button"
              onClick={() => void handleQuickCreate()}
              disabled={disabled || creating || !newName.trim()}
              aria-label={t("groups.create")}
              className="shrink-0 w-10 h-10 flex items-center justify-center text-white transition-opacity active:opacity-80 disabled:opacity-40"
              style={{
                borderRadius: "10px 2px 10px 2px",
                background: "linear-gradient(to right, #284e72, #482d7c)",
              }}
            >
              {creating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
            </button>
          </div>
          {createError && (
            <p className="text-[12px] mt-1.5" style={{ color: "#c0344d" }}>
              {createError}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
