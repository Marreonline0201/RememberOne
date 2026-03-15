"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { languages, type LanguageCode } from "@/lib/i18n";

interface Props {
  onSelect: (lang: LanguageCode) => Promise<void>;
}

export function LanguagePickerModal({ onSelect }: Props) {
  const [selected, setSelected] = useState<LanguageCode | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleContinue() {
    if (!selected) return;
    setSaving(true);
    await onSelect(selected);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center px-5 py-10"
      style={{ background: "linear-gradient(to bottom right, #ddf6ff, #fbf6ff)" }}
    >
      <div className="w-full max-w-sm space-y-6">
        {/* Branding + title */}
        <div className="text-center space-y-1">
          <h1
            className="text-2xl uppercase tracking-wider text-black"
            style={{ fontFamily: "'Hammersmith One', sans-serif" }}
          >
            RememberOne
          </h1>
          <p className="text-sm text-muted-foreground">
            Select the language you&apos;d like to use
          </p>
        </div>

        {/* Language grid */}
        <div className="grid grid-cols-2 gap-3">
          {languages.map((lang) => {
            const isSelected = selected === lang.code;
            return (
              <button
                key={lang.code}
                onClick={() => setSelected(lang.code)}
                disabled={saving}
                className="relative flex items-center gap-3 p-3 rounded-[10px_2px_10px_2px] border text-left transition-all active:opacity-80 disabled:pointer-events-none"
                style={{
                  borderColor: isSelected ? "#284e72" : "#dccaff",
                  backgroundColor: isSelected ? "#e8f4ff" : "white",
                  boxShadow: isSelected ? "0 0 0 1px #284e72" : "none",
                }}
              >
                <span className="text-xl leading-none">{lang.flag}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 leading-tight truncate">
                    {lang.nativeName}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">{lang.name}</p>
                </div>
                {isSelected && (
                  <Check
                    className="absolute right-2 top-2 w-3.5 h-3.5 shrink-0"
                    style={{ color: "#284e72" }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Continue */}
        <button
          disabled={!selected || saving}
          onClick={handleContinue}
          className="w-full h-12 rounded-[10px_2px_10px_2px] text-white font-medium text-sm flex items-center justify-center gap-2 transition-opacity active:opacity-80 disabled:opacity-40"
          style={{ background: "linear-gradient(to right, #284e72, #482d7c)" }}
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Continue"
          )}
        </button>
      </div>
    </div>
  );
}
