"use client";

// ConversationInput — voice-first input matching the Figma mic page design.
// Input state: big circular mic button + instruction text + tip.
// Sends transcript to /api/ai/extract, shows preview, then redirects.
// On Android (Capacitor) uses the native SpeechRecognition plugin.
// On web falls back to the Web Speech API.

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import {
  Sparkles,
  ChevronRight,
  Users,
  Mic,
  MicOff,
  CheckCircle2,
  X,
} from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { SpeechRecognition } from "@capacitor-community/speech-recognition";
import type { AIExtractionResult, ExtractedPerson } from "@/types/app";
import { useLanguage } from "@/contexts/LanguageContext";
import { getLanguage } from "@/lib/i18n";

type Step = "input" | "loading" | "success" | "preview";

interface ExtractionPreview {
  extraction: AIExtractionResult;
  personIds: string[];
}

export function ConversationInput() {
  const router = useRouter();
  const { toast } = useToast();
  const { language, t } = useLanguage();
  const speechLocale = getLanguage(language).locale;

  const [step, setStep] = useState<Step>("input");
  const isLoading = step === "loading";
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<ExtractionPreview | null>(null);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const isNative = Capacitor.isNativePlatform();

  useEffect(() => {
    return () => {
      if (isNative) {
        SpeechRecognition.stop().catch(() => {});
      } else {
        recognitionRef.current?.stop();
      }
    };
  }, [isNative]);

  async function toggleVoice() {
    // ── Native (Android / iOS) ───────────────────────────────────────────────
    if (isNative) {
      if (listening) {
        await SpeechRecognition.stop();
        setListening(false);
        return;
      }

      // Request permission
      const { speechRecognition } = await SpeechRecognition.requestPermissions();
      if (speechRecognition !== "granted") {
        toast({
          title: t("meet.mic_denied_title"),
          description: t("meet.mic_denied_body"),
          variant: "destructive",
        });
        return;
      }

      setListening(true);
      try {
        const result = await SpeechRecognition.start({
          language: speechLocale,
          maxResults: 1,
          popup: false,
        });
        const transcript = result.matches?.[0] ?? "";
        if (transcript) {
          setText((prev) => {
            const joined = prev ? prev.trimEnd() + " " + transcript : transcript;
            return joined.slice(0, 4000);
          });
        }
      } catch {
        // user cancelled or error — ignore
      } finally {
        setListening(false);
      }
      return;
    }

    // ── Web (browser) ────────────────────────────────────────────────────────
    const SR =
      (window as typeof window & { webkitSpeechRecognition?: typeof SpeechRecognition })
        .SpeechRecognition ??
      (window as typeof window & { webkitSpeechRecognition?: typeof SpeechRecognition })
        .webkitSpeechRecognition;

    if (!SR) {
      toast({
        title: t("meet.not_supported_title"),
        description: t("meet.not_supported_body"),
        variant: "destructive",
      });
      return;
    }

    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = speechLocale;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = Array.from(event.results)
        .slice(event.resultIndex)
        .map((r) => r[0].transcript)
        .join(" ");
      setText((prev) => {
        const joined = prev ? prev.trimEnd() + " " + transcript : transcript;
        return joined.slice(0, 4000);
      });
    };

    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }

  async function handleSubmit() {
    if (!text.trim()) return;

    setStep("loading");

    try {
      const res = await fetch("/api/ai/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? t("meet.extraction_failed"));

      setPreview(json.data);
      setStep("success");
      setTimeout(() => setStep("preview"), 1200);
    } catch (err: unknown) {
      toast({
        title: t("meet.extraction_failed"),
        description: err instanceof Error ? err.message : t("meet.something_wrong"),
        variant: "destructive",
      });
      setStep("input");
    }
  }

  function handleViewPerson(personId: string) {
    router.push(`/people/${personId}`);
  }

  function handleViewAll() {
    router.push("/");
  }

  function handleStartOver() {
    setText("");
    setPreview(null);
    setStep("input");
  }

  // ── LOADING ─────────────────────────────────────────────────────────────
  if (step === "loading") {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-6">
        <div className="relative flex items-center justify-center">
          <span
            className="absolute w-28 h-28 rounded-full opacity-20 animate-ping"
            style={{ backgroundColor: "#dccaff" }}
          />
          <span
            className="absolute w-20 h-20 rounded-full opacity-20 animate-ping"
            style={{ backgroundColor: "#d0f2ff", animationDelay: "150ms" }}
          />
          <div
            className="relative w-24 h-24 rounded-full flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #00d4f7, #c84b8a, #482d7c)" }}
          >
            <Sparkles className="w-10 h-10 text-white" />
          </div>
        </div>
        <p
          className="text-[18px] uppercase text-black"
          style={{ fontFamily: "'Hammersmith One', sans-serif" }}
        >
          {t("meet.loading_title")}
        </p>
        <p className="text-[13px]" style={{ color: "#5e7983" }}>
          {t("meet.loading_subtitle")}
        </p>
      </div>
    );
  }

  // ── SUCCESS ─────────────────────────────────────────────────────────────
  if (step === "success") {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div
          className="w-24 h-24 rounded-full flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, #d0f2ff, #dccaff)" }}
        >
          <CheckCircle2 className="w-12 h-12" style={{ color: "#284e72" }} />
        </div>
        <p
          className="text-[20px] uppercase text-black"
          style={{ fontFamily: "'Hammersmith One', sans-serif" }}
        >
          {t("meet.saved")}
        </p>
      </div>
    );
  }

  // ── PREVIEW ─────────────────────────────────────────────────────────────
  if (step === "preview" && preview) {
    return (
      <div className="space-y-4">
        <p
          className="text-[13px] text-center"
          style={{ color: "#5e7983", fontFamily: "'Hammersmith One', sans-serif" }}
        >
          {language === "ko"
            ? `${preview.extraction.people.length}${t("meet.found_people")}을 찾았어요 — ${t("meet.found_all_saved")}`
            : `Found ${preview.extraction.people.length} ${preview.extraction.people.length === 1 ? "person" : "people"} — ${t("meet.found_all_saved")}`
          }
        </p>

        {preview.extraction.people.map((person: ExtractedPerson, idx: number) => {
          const personId = preview.personIds[idx];
          return (
            <button
              key={idx}
              onClick={() => handleViewPerson(personId)}
              className="w-full text-left p-4 transition-opacity active:opacity-80"
              style={{
                borderRadius: "10px 2px 10px 2px",
                background: "linear-gradient(52deg, #d0f2ff 0%, #dccaff 100%)",
              }}
            >
              <div className="flex items-center justify-between">
                <h3
                  className="text-[22px] text-black"
                  style={{ fontFamily: "'Hammersmith One', sans-serif" }}
                >
                  {person.name}
                </h3>
                <ChevronRight className="w-5 h-5" style={{ color: "#665b7b" }} />
              </div>

              {person.attributes.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {person.attributes.slice(0, 5).map((attr) => (
                    <Badge
                      key={attr.key}
                      variant="secondary"
                      className="text-[10px] py-0.5 px-2 rounded-[5px]"
                      style={{ backgroundColor: "#dccaff", color: "#1a2a3a" }}
                    >
                      {attr.key}: {attr.value}
                    </Badge>
                  ))}
                </div>
              )}

              {person.family_members.length > 0 && (
                <div className="flex items-center gap-1.5 mt-2">
                  <Users className="w-3 h-3 shrink-0" style={{ color: "#665b7b" }} />
                  <span className="text-[11px]" style={{ color: "#665b7b" }}>
                    {person.family_members.map((fm) => fm.name).join(", ")}
                  </span>
                </div>
              )}
            </button>
          );
        })}

        <div className="flex flex-col gap-3 pt-2">
          <button
            onClick={handleViewAll}
            className="w-full h-12 rounded-[10px_2px_10px_2px] text-white font-medium transition-opacity active:opacity-80"
            style={{ background: "linear-gradient(to right, #284e72, #482d7c)" }}
          >
            <span style={{ fontFamily: "'Hammersmith One', sans-serif" }}>
              {t("meet.go_to_people")}
            </span>
          </button>
          <button
            onClick={handleStartOver}
            className="w-full h-12 rounded-[10px_2px_10px_2px] text-[#284e72] font-medium border transition-opacity active:opacity-80"
            style={{ borderColor: "#dccaff", backgroundColor: "#fbf6ff" }}
          >
            <span style={{ fontFamily: "'Hammersmith One', sans-serif" }}>
              {t("meet.log_another")}
            </span>
          </button>
        </div>
      </div>
    );
  }

  // ── INPUT (Figma mic page layout) ────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-[calc(100vh-200px)]">
      {/* Instruction text */}
      <p
        className="text-[13px] leading-relaxed text-center px-2"
        style={{ color: "#5e7983", fontFamily: "'Hammersmith One', sans-serif" }}
      >
        {t("meet.instruction")}
      </p>

      {/* Big circle mic button — center of screen */}
      <div className="flex flex-col items-center justify-center flex-1 gap-5 py-10">
        <div className="relative">
          {/* Pulse rings when listening */}
          {listening && (
            <>
              <span
                className="absolute inset-[-16px] rounded-full opacity-20 animate-ping"
                style={{ backgroundColor: "#482d7c" }}
              />
              <span
                className="absolute inset-[-8px] rounded-full opacity-20 animate-ping"
                style={{ backgroundColor: "#00d4f7", animationDelay: "200ms" }}
              />
            </>
          )}

          {/* Gradient ring → white interior → mic icon */}
          <button
            type="button"
            onClick={toggleVoice}
            disabled={isLoading}
            aria-label={listening ? "Stop recording" : "Tap to speak"}
            className="relative w-32 h-32 rounded-full p-[3px] transition-transform active:scale-95 focus:outline-none shadow-lg"
            style={{
              background: "linear-gradient(135deg, #00d4f7, #c84b8a, #482d7c)",
            }}
          >
            <div
              className="w-full h-full rounded-full flex items-center justify-center"
              style={{
                backgroundColor: listening ? "transparent" : "#fbf6ff",
              }}
            >
              {listening ? (
                <MicOff className="w-10 h-10 text-white" />
              ) : (
                <Mic className="w-10 h-10" style={{ color: "#482d7c" }} />
              )}
            </div>
          </button>
        </div>

        {/* Status label */}
        <p
          className="text-[18px] uppercase"
          style={{
            color: "#5e7983",
            fontFamily: "'Hammersmith One', sans-serif",
          }}
        >
          {listening ? t("meet.listening") : t("meet.tap_to_speak")}
        </p>

        {/* Transcript display */}
        {text && (
          <div
            className="relative w-full rounded-[10px_2px_10px_2px] p-4"
            style={{ backgroundColor: "#f0e8ff", border: "1px solid #dccaff" }}
          >
            <p className="text-sm leading-relaxed text-gray-800 pr-8">{text}</p>
            <button
              type="button"
              onClick={() => setText("")}
              aria-label="Clear transcript"
              className="absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center text-muted-foreground hover:text-gray-700 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Submit button — appears once there's transcript */}
        {text.trim() && (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isLoading}
            className="w-full h-12 rounded-[10px_2px_10px_2px] text-white flex items-center justify-center gap-2 transition-opacity active:opacity-80"
            style={{ background: "linear-gradient(to right, #284e72, #482d7c)" }}
          >
            <Sparkles className="w-4 h-4" />
            <span style={{ fontFamily: "'Hammersmith One', sans-serif" }}>
              {t("meet.extract_save")}
            </span>
          </button>
        )}
      </div>

      {/* TIP section — bottom */}
      <div className="text-center pb-4">
        <p
          className="text-[11px]"
          style={{ color: "#5e7983", fontFamily: "'Hammersmith One', sans-serif" }}
        >
          {t("meet.tip_title")}
        </p>
        <p className="text-[10px] mt-0.5" style={{ color: "#5e7983" }}>
          {t("meet.tip_body")}
        </p>
      </div>
    </div>
  );
}
