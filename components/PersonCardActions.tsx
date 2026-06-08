"use client";

// PersonCardActions — the long-press menu (Share / Edit / Delete) that floats
// over a PersonCard, plus the destructive "are you sure?" confirm dialog.
// PersonCard owns the `open` state (driven by its long-press handler) and
// renders this unconditionally so the confirm dialog survives the menu closing.

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Share2, Pencil, Trash2, Loader2, type LucideIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { localizeKey, localizeRelation } from "@/lib/utils";
import { queuedFetch } from "@/lib/offline-queue";
import type { PersonFull } from "@/types/app";

interface Props {
  person: PersonFull;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Compose a readable, shareable text blob: name + every attribute + family +
// the latest meeting recap. Localized keys so a Korean user shares Korean labels.
function buildShareText(person: PersonFull, language: string): string {
  const lines: string[] = [person.name];

  for (const a of person.attributes) {
    lines.push(`• ${localizeKey(a.key, language)}: ${a.value}`);
  }

  if (person.family_members.length > 0) {
    lines.push("");
    lines.push(language === "ko" ? "가족" : "Family");
    for (const fm of person.family_members) {
      const attrs = fm.attributes
        .map((a) => `${localizeKey(a.key, language)}: ${a.value}`)
        .join(", ");
      const rel = localizeRelation(fm.relation, language);
      lines.push(`• ${fm.name} (${rel})${attrs ? ` — ${attrs}` : ""}`);
    }
  }

  const recap = person.meetings[0]?.summary;
  if (recap) {
    lines.push("");
    lines.push(recap);
  }

  return lines.join("\n");
}

export function PersonCardActions({ person, open, onOpenChange }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const { language, t } = useLanguage();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  // The same press that opens the menu also fires a trailing click on
  // finger-lift. Stay "unarmed" briefly so that stray click can't instantly
  // dismiss the menu or activate an item; real taps happen after this window.
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!open) {
      setArmed(false);
      return;
    }
    setArmed(false);
    const id = setTimeout(() => setArmed(true), 350);
    return () => clearTimeout(id);
  }, [open]);

  // Close the floating menu on Escape.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onOpenChange(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  async function handleShare() {
    const text = buildShareText(person, language);
    const title = person.name;
    onOpenChange(false);

    // 1) Native share sheet (only works in an app build that bundles
    //    @capacitor/share; on older installs the call rejects and we fall back).
    try {
      const { Capacitor } = await import("@capacitor/core");
      if (Capacitor.isNativePlatform()) {
        const { Share } = await import("@capacitor/share");
        await Share.share({ title, text });
        return;
      }
    } catch {
      // fall through to web
    }

    // 2) Web Share API (Chromium WebView / supporting browsers).
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title, text });
        return;
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      // fall through to clipboard
    }

    // 3) Clipboard fallback.
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: t("toast.copied") });
    } catch (err) {
      console.warn("[person-card] share + clipboard both failed:", err);
    }
  }

  function handleEdit() {
    onOpenChange(false);
    router.push(`/people/${person.id}`);
  }

  function handleDelete() {
    startTransition(async () => {
      try {
        const res = await queuedFetch(`/api/people/${person.id}`, { method: "DELETE" });
        // Check status BEFORE parsing: a 5xx may return an HTML body, and
        // res.json() on that throws a confusing SyntaxError into the toast.
        if (!res.ok) {
          let message = "Delete failed";
          try {
            const j = await res.json();
            if (j?.error) message = j.error;
          } catch {
            // non-JSON error body (e.g. a proxy/cold-start HTML page)
          }
          throw new Error(message);
        }
        setConfirmOpen(false);
        toast({ title: t("toast.deleted"), description: person.name });
      } catch (err: unknown) {
        console.error("[person-card] delete failed:", err);
        toast({
          title: t("toast.delete_failed"),
          description: err instanceof Error ? err.message : "Unknown error",
          variant: "destructive",
        });
      }
    });
  }

  return (
    <>
      {open && (
        <>
          {/* Backdrop — tap outside dismisses (once armed). */}
          <div
            className="fixed inset-0 z-50"
            onClick={() => armed && onOpenChange(false)}
            aria-hidden="true"
          />
          {/* Floating menu anchored over the card (PersonCard root is relative). */}
          <div
            role="menu"
            className="absolute left-1/2 top-2 z-[60] w-[210px] -translate-x-1/2 p-1.5 shadow-xl"
            style={{
              borderRadius: "10px 2px 10px 2px",
              background: "#ffffff",
              border: "1px solid #dccaff",
            }}
          >
            <MenuButton
              icon={Share2}
              label={t("card.share")}
              onClick={() => armed && handleShare()}
            />
            <MenuButton
              icon={Pencil}
              label={t("card.edit")}
              onClick={() => armed && handleEdit()}
            />
            <MenuButton
              icon={Trash2}
              label={t("card.delete")}
              destructive
              onClick={() => {
                if (!armed) return;
                onOpenChange(false);
                setConfirmOpen(true);
              }}
            />
          </div>
        </>
      )}

      {/* Destructive confirm — Yes / No, styled to the app. */}
      <Dialog
        open={confirmOpen}
        onOpenChange={(o) => {
          if (!isPending) setConfirmOpen(o);
        }}
      >
        <DialogContent
          className="max-w-xs w-[calc(100%-3rem)] mx-auto p-5"
          style={{ borderRadius: "10px 2px 10px 2px" }}
        >
          <DialogHeader>
            <DialogTitle
              style={{ fontFamily: "'Hammersmith One', sans-serif", color: "#284e72" }}
            >
              {t("confirm.delete_title")}
            </DialogTitle>
            <DialogDescription className="leading-relaxed" style={{ color: "#5e7983" }}>
              {t("confirm.delete_body")}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex-row gap-2 mt-2 sm:justify-end">
            <button
              type="button"
              onClick={() => setConfirmOpen(false)}
              disabled={isPending}
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
              onClick={handleDelete}
              disabled={isPending}
              className="flex-1 h-11 text-[14px] text-white flex items-center justify-center gap-2 disabled:opacity-70"
              style={{
                borderRadius: "10px 2px 10px 2px",
                background: "linear-gradient(to right, #284e72, #482d7c)",
                fontFamily: "'Hammersmith One', sans-serif",
              }}
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {t("confirm.yes")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function MenuButton({
  icon: Icon,
  label,
  onClick,
  destructive,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-3 h-11 px-3 text-left transition-colors hover:bg-black/5"
      style={{
        borderRadius: "8px 1px 8px 1px",
        color: destructive ? "#c0344d" : "#284e72",
        fontFamily: "'Hammersmith One', sans-serif",
      }}
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span className="text-[14px]">{label}</span>
    </button>
  );
}
