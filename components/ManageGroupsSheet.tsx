"use client";

// ManageGroupsSheet — create / rename / re-describe / delete groups. Opened by
// the [+] chip on the home filter row. Group CRUD is ONLINE-ONLY (v1): offline
// the whole sheet is disabled with a hint. Deleting a group only removes the
// memberships — the people stay.

import { useState } from "react";
import { Check, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import { useOnline } from "@/lib/use-online";
import { useGroups, GROUPS_ERR_DUPLICATE, GROUPS_ERR_OFFLINE } from "@/lib/use-groups";
import type { Group } from "@/types/database";

interface Props {
  open: boolean;
  onOpenChange(open: boolean): void;
}

export function ManageGroupsSheet({ open, onOpenChange }: Props) {
  const { t } = useLanguage();
  const online = useOnline();
  const { groups, createGroup, updateGroup, deleteGroup } = useGroups();

  // Create form
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);
  // Inline edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<Group | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [error, setError] = useState<string | null>(null);

  function errText(err: unknown): string {
    const msg = err instanceof Error ? err.message : "";
    if (msg === GROUPS_ERR_DUPLICATE) return t("groups.duplicate");
    if (msg === GROUPS_ERR_OFFLINE) return t("groups.offline_hint");
    return t("groups.create_failed");
  }

  async function handleCreate() {
    const name = newName.trim();
    if (!name || creating) return;
    setCreating(true);
    setError(null);
    try {
      await createGroup(name, newDesc.trim() || null);
      setNewName("");
      setNewDesc("");
    } catch (err) {
      setError(errText(err));
    } finally {
      setCreating(false);
    }
  }

  function startEdit(g: Group) {
    setEditingId(g.id);
    setEditName(g.name);
    setEditDesc(g.description ?? "");
    setError(null);
  }

  async function handleSaveEdit() {
    if (!editingId || savingEdit) return;
    const name = editName.trim();
    if (!name) return;
    setSavingEdit(true);
    setError(null);
    try {
      await updateGroup(editingId, { name, description: editDesc.trim() || null });
      setEditingId(null);
    } catch (err) {
      setError(errText(err));
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteGroup(deleteTarget.id);
      setDeleteTarget(null);
    } catch (err) {
      setError(errText(err));
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !creating && !savingEdit && onOpenChange(o)}>
        <DialogContent
          className="max-w-xs w-[calc(100%-3rem)] mx-auto p-5"
          style={{ borderRadius: "10px 2px 10px 2px" }}
        >
          <DialogHeader>
            <DialogTitle
              style={{ fontFamily: "'Hammersmith One', sans-serif", color: "#284e72" }}
            >
              {t("groups.manage_title")}
            </DialogTitle>
            <DialogDescription className="leading-relaxed" style={{ color: "#5e7983" }}>
              {t("groups.manage_hint")}
            </DialogDescription>
          </DialogHeader>

          {!online && (
            <p className="text-[12px] -mt-1" style={{ color: "#c0344d" }}>
              {t("groups.offline_hint")}
            </p>
          )}

          {/* Create */}
          <div className="space-y-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t("groups.new_name")}
              maxLength={60}
              disabled={!online || creating}
              className="h-10 text-sm rounded-[10px_2px_10px_2px]"
              style={{ backgroundColor: "#f0e8ff", borderColor: "#dccaff" }}
            />
            <div className="flex gap-2">
              <Input
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder={t("groups.new_desc")}
                maxLength={300}
                disabled={!online || creating}
                className="h-10 text-sm rounded-[10px_2px_10px_2px]"
                style={{ backgroundColor: "#f0e8ff", borderColor: "#dccaff" }}
              />
              <button
                type="button"
                onClick={() => void handleCreate()}
                disabled={!online || creating || !newName.trim()}
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
          </div>

          {error && (
            <p className="text-[12px]" style={{ color: "#c0344d" }}>
              {error}
            </p>
          )}

          {/* Existing groups */}
          <div className="max-h-[38vh] overflow-y-auto space-y-2 mt-1">
            {groups.length === 0 ? (
              <p className="text-sm py-1" style={{ color: "#5e7983" }}>
                {t("groups.empty")}
              </p>
            ) : (
              groups.map((g) =>
                editingId === g.id ? (
                  <div
                    key={g.id}
                    className="p-2 space-y-2"
                    style={{
                      borderRadius: "10px 2px 10px 2px",
                      border: "1px solid #dccaff",
                      backgroundColor: "#f8f5ff",
                    }}
                  >
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      maxLength={60}
                      disabled={savingEdit}
                      className="h-9 text-sm rounded-[10px_2px_10px_2px]"
                      style={{ backgroundColor: "#ffffff", borderColor: "#dccaff" }}
                    />
                    <Input
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      placeholder={t("groups.new_desc")}
                      maxLength={300}
                      disabled={savingEdit}
                      className="h-9 text-sm rounded-[10px_2px_10px_2px]"
                      style={{ backgroundColor: "#ffffff", borderColor: "#dccaff" }}
                    />
                    <div className="flex gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        disabled={savingEdit}
                        aria-label={t("groups.cancel")}
                        className="w-9 h-9 flex items-center justify-center"
                        style={{
                          borderRadius: "8px 1px 8px 1px",
                          border: "1px solid #dccaff",
                          color: "#284e72",
                        }}
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleSaveEdit()}
                        disabled={savingEdit || !editName.trim()}
                        aria-label={t("groups.save")}
                        className="w-9 h-9 flex items-center justify-center text-white disabled:opacity-40"
                        style={{
                          borderRadius: "8px 1px 8px 1px",
                          background: "linear-gradient(to right, #284e72, #482d7c)",
                        }}
                      >
                        {savingEdit ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    key={g.id}
                    className="flex items-center gap-2 p-2"
                    style={{
                      borderRadius: "10px 2px 10px 2px",
                      border: "1px solid #dccaff",
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-[14px] truncate"
                        style={{ fontFamily: "'Hammersmith One', sans-serif", color: "#284e72" }}
                      >
                        {g.name}
                      </p>
                      {g.description && (
                        <p className="text-[11px] truncate" style={{ color: "#5e7983" }}>
                          {g.description}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => startEdit(g)}
                      disabled={!online}
                      aria-label={t("groups.edit")}
                      className="shrink-0 w-9 h-9 flex items-center justify-center disabled:opacity-40"
                      style={{ color: "#284e72" }}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(g)}
                      disabled={!online}
                      aria-label={t("groups.delete")}
                      className="shrink-0 w-9 h-9 flex items-center justify-center disabled:opacity-40"
                      style={{ color: "#c0344d" }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )
              )
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm — mirrors the person-delete confirm styling. */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !deleting && !o && setDeleteTarget(null)}>
        <DialogContent
          className="max-w-xs w-[calc(100%-3rem)] mx-auto p-5"
          style={{ borderRadius: "10px 2px 10px 2px" }}
        >
          <DialogHeader>
            <DialogTitle
              style={{ fontFamily: "'Hammersmith One', sans-serif", color: "#284e72" }}
            >
              {t("groups.delete_confirm_title")}
            </DialogTitle>
            <DialogDescription className="leading-relaxed" style={{ color: "#5e7983" }}>
              {deleteTarget?.name} — {t("groups.delete_confirm_body")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row gap-2 mt-2 sm:justify-end">
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
              className="flex-1 h-11 text-[14px] disabled:opacity-50"
              style={{
                borderRadius: "10px 2px 10px 2px",
                border: "1px solid #dccaff",
                color: "#284e72",
                fontFamily: "'Hammersmith One', sans-serif",
              }}
            >
              {t("confirm.no")}
            </button>
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={deleting}
              className="flex-1 h-11 text-[14px] text-white flex items-center justify-center gap-2 disabled:opacity-70"
              style={{
                borderRadius: "10px 2px 10px 2px",
                background: "linear-gradient(to right, #284e72, #482d7c)",
                fontFamily: "'Hammersmith One', sans-serif",
              }}
            >
              {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
              {t("confirm.yes")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
