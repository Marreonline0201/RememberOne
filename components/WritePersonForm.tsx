"use client";

// WritePersonForm — the typed "write a person" flow (the counterpart to the
// voice flow in ConversationInput). The user types a NAME (used verbatim) and a
// free-form INFO blob, the AI organizes the info into editable detail chips +
// family + a summary WITHOUT saving, the user reviews/edits, and only on SAVE is
// the person created. See app/api/ai/organize + app/api/people/from-organized.

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, X, Plus, ArrowLeft, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { useOnline } from "@/lib/use-online";
import { BackButton } from "@/components/BackButton";
import { MeetModeToggle } from "@/components/MeetModeToggle";
import { AiLoadingState } from "@/components/AiLoadingState";
import { AiSuccessState } from "@/components/AiSuccessState";
import type { AdditionalExtractionResult } from "@/lib/gemini";
import type { ExtractedAttribute, ExtractedFamilyMember } from "@/types/app";

type WriteStep = "form" | "organizing" | "review" | "saving" | "saved";

// Editable review rows carry a stable client-only id (_rid) so React keeps input
// focus/values correct when rows are added or removed — array-index keys shift on
// delete and would misattach focus/values to the wrong row.
type AttrRow = ExtractedAttribute & { _rid: number };
type FmRow = ExtractedFamilyMember & { _rid: number };

interface ReviewData {
  attributes: AttrRow[];
  family_members: FmRow[];
  meeting_date: string | null;
  location: string | null;
  summary: string;
}

const MAX_INFO = 4000;
const MAX_NAME = 200;

// Card shell shared by the form fields and the review sections.
const cardStyle = {
  borderRadius: "10px 2px 10px 2px",
  backgroundColor: "rgba(220,202,255,0.2)",
  border: "1px solid #dccaff",
} as const;

const labelClass =
  "block text-[11px] uppercase tracking-wide mb-1.5 text-[#665b7b]";

export function WritePersonForm() {
  const router = useRouter();
  const { toast } = useToast();
  const { language, t } = useLanguage();
  const online = useOnline();

  const [step, setStep] = useState<WriteStep>("form");
  const [name, setName] = useState("");
  const [info, setInfo] = useState("");
  const [organized, setOrganized] = useState<ReviewData | null>(null);

  // Monotonic source of stable row ids for the editable review lists.
  const ridRef = useRef(0);
  const nextRid = () => (ridRef.current += 1);

  // Convert an API organize result into editable review rows (tags each with _rid).
  function toReviewData(r: AdditionalExtractionResult): ReviewData {
    return {
      attributes: (r.attributes ?? []).map((a) => ({ ...a, _rid: nextRid() })),
      family_members: (r.family_members ?? []).map((fm) => ({ ...fm, _rid: nextRid() })),
      meeting_date: r.meeting_date ?? null,
      location: r.location ?? null,
      summary: r.summary ?? "",
    };
  }

  const trimmedName = name.trim();
  const canOrganize = trimmedName.length > 0 && online;

  // ── Organize: form → (AI) → review ──────────────────────────────────────
  async function handleOrganize() {
    if (!canOrganize) return;
    const infoText = info.trim();

    // Too little to organize → skip the AI call entirely and go straight to the
    // editable review with an empty structure (the user adds details by hand).
    if (infoText.length < 3) {
      setOrganized(
        toReviewData({
          attributes: [],
          family_members: [],
          meeting_date: null,
          location: null,
          summary: "",
        })
      );
      setStep("review");
      return;
    }

    setStep("organizing");
    try {
      const res = await fetch("/api/ai/organize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName, info: infoText }),
      });
      const json = await res.json();

      if (res.status === 429) {
        toast({
          title: t("write.organize_failed"),
          description: t("write.rate_limited"),
          variant: "destructive",
        });
        setStep("form");
        return;
      }
      if (!res.ok || json.error) {
        throw new Error(json.error ?? t("write.organize_failed"));
      }

      setOrganized(toReviewData(json.data.organized as AdditionalExtractionResult));
      setStep("review");
    } catch (err: unknown) {
      toast({
        title: t("write.organize_failed"),
        description: err instanceof Error ? err.message : t("meet.something_wrong"),
        variant: "destructive",
      });
      setStep("form");
    }
  }

  // ── Save: review → (DB write) → saved → redirect ────────────────────────
  async function handleSave() {
    if (!organized || !trimmedName) return;

    // Drop blank rows and trim. Family relations are stored lowercase singular.
    const attributes = organized.attributes
      .map((a) => ({ key: a.key.trim(), value: a.value.trim() }))
      .filter((a) => a.key && a.value);
    const family_members = organized.family_members
      .map((fm) => ({
        name: fm.name.trim(),
        relation: fm.relation.trim().toLowerCase(),
        attributes: (fm.attributes ?? [])
          .map((a) => ({ key: a.key.trim(), value: a.value.trim() }))
          .filter((a) => a.key && a.value),
      }))
      .filter((fm) => fm.name && fm.relation);

    setStep("saving");
    try {
      const res = await fetch("/api/people/from-organized", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          rawInput: info.trim(),
          organized: {
            attributes,
            family_members,
            meeting_date: organized.meeting_date,
            location: organized.location,
            summary: organized.summary,
          },
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error ?? t("write.save_failed"));
      }

      const personId: string | null = json.data?.personId ?? null;
      setStep("saved");
      setTimeout(() => {
        router.push(personId ? `/people/${personId}` : "/");
        router.refresh();
      }, 1100);
    } catch (err: unknown) {
      toast({
        title: t("write.save_failed"),
        description: err instanceof Error ? err.message : t("meet.something_wrong"),
        variant: "destructive",
      });
      setStep("review");
    }
  }

  // ── Editable-review mutators (immutable updates on `organized`) ──────────
  function patchOrganized(patch: Partial<ReviewData>) {
    setOrganized((prev) => (prev ? { ...prev, ...patch } : prev));
  }
  function updateAttr(i: number, field: keyof ExtractedAttribute, value: string) {
    if (!organized) return;
    const attributes = organized.attributes.map((a, idx) =>
      idx === i ? { ...a, [field]: value } : a
    );
    patchOrganized({ attributes });
  }
  function removeAttr(i: number) {
    if (!organized) return;
    patchOrganized({ attributes: organized.attributes.filter((_, idx) => idx !== i) });
  }
  function addAttr() {
    if (!organized) return;
    patchOrganized({
      attributes: [...organized.attributes, { key: "", value: "", _rid: nextRid() }],
    });
  }
  function updateFm(i: number, field: "name" | "relation", value: string) {
    if (!organized) return;
    const family_members = organized.family_members.map((fm, idx) =>
      idx === i ? { ...fm, [field]: value } : fm
    );
    patchOrganized({ family_members });
  }
  function removeFm(i: number) {
    if (!organized) return;
    patchOrganized({
      family_members: organized.family_members.filter((_, idx) => idx !== i),
    });
  }
  function addFm() {
    if (!organized) return;
    const next: FmRow = { name: "", relation: "", attributes: [], _rid: nextRid() };
    patchOrganized({ family_members: [...organized.family_members, next] });
  }

  // ── Transient states ─────────────────────────────────────────────────────
  if (step === "organizing") {
    return (
      <AiLoadingState
        title={t("write.organizing_title")}
        subtitle={t("write.organizing_subtitle")}
      />
    );
  }
  if (step === "saving") {
    return <AiLoadingState title={t("write.saving_title")} />;
  }
  if (step === "saved") {
    return <AiSuccessState label={t("meet.saved")} />;
  }

  // ── Review (editable) ────────────────────────────────────────────────────
  if (step === "review" && organized) {
    return (
      <div className="flex flex-col gap-4 pb-6">
        <button
          type="button"
          onClick={() => setStep("form")}
          className="inline-flex items-center gap-1 -ml-1 px-1 h-9 text-sm w-fit transition-opacity active:opacity-70 hover:opacity-70"
          style={{ color: "#284e72" }}
        >
          <ArrowLeft className="w-4 h-4 shrink-0" />
          {t("write.back_to_edit")}
        </button>

        <div>
          <h1
            className="text-[20px] uppercase text-black"
            style={{ fontFamily: "'Hammersmith One', sans-serif" }}
          >
            {t("write.review_heading")}
          </h1>
          <p className="text-[13px] mt-0.5" style={{ color: "#5e7983" }}>
            {t("write.review_subheading")}
          </p>
        </div>

        {/* Name (editable) */}
        <div className="p-3" style={cardStyle}>
          <label htmlFor="review-name" className={labelClass}>
            {t("write.name_label")}
          </label>
          <Input
            id="review-name"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, MAX_NAME))}
            placeholder={t("write.name_placeholder")}
            className="h-10 text-sm bg-white"
            maxLength={MAX_NAME}
          />
        </div>

        {/* Details (editable chips) */}
        <div className="p-3" style={cardStyle}>
          <span className={labelClass}>{t("write.details_label")}</span>
          <div className="space-y-2">
            {organized.attributes.map((attr, i) => (
              <div key={attr._rid} className="flex items-center gap-2">
                <Input
                  value={attr.key}
                  onChange={(e) => updateAttr(i, "key", e.target.value)}
                  placeholder={t("write.attr_key_placeholder")}
                  className="h-9 text-sm bg-white w-2/5"
                  aria-label={t("write.attr_key_placeholder")}
                />
                <Input
                  value={attr.value}
                  onChange={(e) => updateAttr(i, "value", e.target.value)}
                  placeholder={t("write.attr_value_placeholder")}
                  className="h-9 text-sm bg-white flex-1"
                  aria-label={t("write.attr_value_placeholder")}
                />
                <button
                  type="button"
                  onClick={() => removeAttr(i)}
                  aria-label={t("write.remove")}
                  className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-muted-foreground hover:bg-black/5 hover:text-gray-700 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addAttr}
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium transition-opacity active:opacity-70 hover:opacity-70"
            style={{ color: "#284e72" }}
          >
            <Plus className="w-3.5 h-3.5" />
            {t("write.add_detail")}
          </button>
        </div>

        {/* Family (editable) */}
        <div className="p-3" style={cardStyle}>
          <span className={labelClass}>
            <Users className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />
            {t("write.family_label")}
          </span>
          <div className="space-y-2">
            {organized.family_members.map((fm, i) => (
              <div key={fm._rid} className="flex items-center gap-2">
                <Input
                  value={fm.name}
                  onChange={(e) => updateFm(i, "name", e.target.value)}
                  placeholder={t("write.fm_name_placeholder")}
                  className="h-9 text-sm bg-white flex-1"
                  aria-label={t("write.fm_name_placeholder")}
                />
                <Input
                  value={fm.relation}
                  onChange={(e) => updateFm(i, "relation", e.target.value)}
                  placeholder={t("write.fm_relation_placeholder")}
                  className="h-9 text-sm bg-white w-2/5"
                  aria-label={t("write.fm_relation_placeholder")}
                />
                <button
                  type="button"
                  onClick={() => removeFm(i)}
                  aria-label={t("write.remove")}
                  className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-muted-foreground hover:bg-black/5 hover:text-gray-700 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addFm}
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium transition-opacity active:opacity-70 hover:opacity-70"
            style={{ color: "#284e72" }}
          >
            <Plus className="w-3.5 h-3.5" />
            {t("write.add_family")}
          </button>
        </div>

        {/* Summary (read-only) */}
        {organized.summary.trim() && (
          <div className="p-3" style={cardStyle}>
            <span className={labelClass}>{t("write.summary_label")}</span>
            <p className="text-sm leading-relaxed text-gray-800">
              {organized.summary}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-3 pt-1">
          <button
            type="button"
            onClick={handleSave}
            className="w-full h-12 rounded-[10px_2px_10px_2px] text-white flex items-center justify-center gap-2 transition-opacity active:opacity-80"
            style={{ background: "linear-gradient(to right, #284e72, #482d7c)" }}
          >
            <Sparkles className="w-4 h-4" />
            <span style={{ fontFamily: "'Hammersmith One', sans-serif" }}>
              {t("write.save")}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setStep("form")}
            className="w-full h-12 rounded-[10px_2px_10px_2px] text-[#284e72] font-medium border transition-opacity active:opacity-80"
            style={{ borderColor: "#dccaff", backgroundColor: "#fbf6ff" }}
          >
            <span style={{ fontFamily: "'Hammersmith One', sans-serif" }}>
              {t("write.back_to_edit")}
            </span>
          </button>
        </div>
      </div>
    );
  }

  // ── Form (default) ───────────────────────────────────────────────────────
  const infoTooShort = info.trim().length < 3;

  return (
    <div className="flex flex-col gap-4 pb-6">
      <div className="flex items-center justify-between">
        <BackButton fallbackHref="/meet" />
      </div>
      <MeetModeToggle active="write" />

      <div className="text-center">
        <h1
          className="text-[20px] uppercase text-black"
          style={{ fontFamily: "'Hammersmith One', sans-serif" }}
        >
          {t("write.heading")}
        </h1>
        <p className="text-[13px] mt-0.5" style={{ color: "#5e7983" }}>
          {t("write.subheading")}
        </p>
      </div>

      {/* Name field — its own card, on top, separate from the rest */}
      <div className="p-3" style={cardStyle}>
        <label htmlFor="write-name" className={labelClass}>
          {t("write.name_label")}
        </label>
        <Input
          id="write-name"
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, MAX_NAME))}
          placeholder={t("write.name_placeholder")}
          className="h-11 text-base bg-white"
          maxLength={MAX_NAME}
          autoFocus
        />
      </div>

      {/* Everything else — free-form info */}
      <div className="p-3" style={cardStyle}>
        <label htmlFor="write-info" className={labelClass}>
          {t("write.info_label")}
        </label>
        <Textarea
          id="write-info"
          value={info}
          onChange={(e) => setInfo(e.target.value.slice(0, MAX_INFO))}
          placeholder={t("write.info_placeholder")}
          className="min-h-[150px] text-sm leading-relaxed resize-none bg-white"
          maxLength={MAX_INFO}
        />
        <div className="flex items-center justify-between mt-1.5">
          <p className="text-[11px]" style={{ color: "#5e7983" }}>
            {infoTooShort ? t("write.empty_info_hint") : " "}
          </p>
          <span
            className={`text-[11px] tabular-nums ${
              info.length > 3800 ? "text-amber-600" : "text-muted-foreground"
            }`}
          >
            {info.length}/{MAX_INFO}
          </span>
        </div>
      </div>

      {/* Organize */}
      <button
        type="button"
        onClick={handleOrganize}
        disabled={!canOrganize}
        className="w-full h-12 rounded-[10px_2px_10px_2px] text-white flex items-center justify-center gap-2 transition-opacity active:opacity-80 disabled:opacity-60 disabled:cursor-not-allowed"
        style={{ background: "linear-gradient(to right, #284e72, #482d7c)" }}
      >
        <Sparkles className="w-4 h-4" />
        <span style={{ fontFamily: "'Hammersmith One', sans-serif" }}>
          {t("write.organize")}
        </span>
      </button>
      {!online && (
        <p className="text-[11px] text-center -mt-2" style={{ color: "#7a6b95" }}>
          {t("write.offline_hint")}
        </p>
      )}
    </div>
  );
}
