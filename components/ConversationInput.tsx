"use client";

// ConversationInput — voice-only input where the user describes who they met.
// Sends the transcript to /api/ai/extract, shows a preview, then redirects to profile.

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
// Textarea removed — voice-only input
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import {
  Sparkles,
  ChevronRight,
  User,
  Users,
  Mic,
  MicOff,
  CheckCircle2,
  X,
} from "lucide-react";
import type { AIExtractionResult, ExtractedPerson } from "@/types/app";
import { capitalize } from "@/lib/utils";

type Step = "input" | "loading" | "success" | "preview";

interface ExtractionPreview {
  extraction: AIExtractionResult;
  personIds: string[];
}

export function ConversationInput() {
  const router = useRouter();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("input");
  const isLoading = step === "loading";
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<ExtractionPreview | null>(null);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  function toggleVoice() {
    const SR =
      (
        window as typeof window & {
          webkitSpeechRecognition?: typeof SpeechRecognition;
        }
      ).SpeechRecognition ??
      (
        window as typeof window & {
          webkitSpeechRecognition?: typeof SpeechRecognition;
        }
      ).webkitSpeechRecognition;

    if (!SR) {
      toast({
        title: "Not supported",
        description: "Voice input requires Chrome or Edge.",
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
    recognition.lang = "en-US";

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;

    setStep("loading");

    try {
      const res = await fetch("/api/ai/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? "Extraction failed");

      setPreview(json.data);
      setStep("success");
      setTimeout(() => setStep("preview"), 1200);
    } catch (err: unknown) {
      toast({
        title: "Extraction failed",
        description: err instanceof Error ? err.message : "Something went wrong",
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

  // ── LOADING STATE ──────────────────────────────────────────────────────
  if (step === "loading") {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-6">
        <div className="relative flex items-center justify-center">
          <span className="absolute w-20 h-20 rounded-full opacity-20 animate-ping" style={{ backgroundColor: "#dccaff" }} />
          <span className="absolute w-14 h-14 rounded-full opacity-20 animate-ping" style={{ backgroundColor: "#d0f2ff", animationDelay: "150ms" }} />
          <div className="relative w-16 h-16 rounded-full flex items-center justify-center shadow-lg" style={{ background: "linear-gradient(to bottom right, #284e72, #482d7c)" }}>
            <Sparkles className="w-8 h-8 text-white" />
          </div>
        </div>
        <div className="text-center space-y-3">
          <p className="font-bold text-gray-900 text-lg">Reading your notes...</p>
          <p className="text-sm text-muted-foreground">AI is extracting people and details.</p>
          <div className="flex flex-col gap-2 w-48 mx-auto">
            <div className="h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: "#f0e8ff" }}>
              <div className="h-full rounded-full animate-pulse w-3/4" style={{ background: "linear-gradient(to right, #d0f2ff, #dccaff)" }} />
            </div>
            <div className="h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: "#f0e8ff" }}>
              <div className="h-full rounded-full animate-pulse w-1/2" style={{ background: "linear-gradient(to right, #dccaff, #482d7c)", animationDelay: "200ms" }} />
            </div>
            <div className="h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: "#f0e8ff" }}>
              <div className="h-full rounded-full animate-pulse w-2/3" style={{ background: "linear-gradient(to right, #d0f2ff, #284e72)", animationDelay: "400ms" }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── SUCCESS STATE ───────────────────────────────────────────────────────
  if (step === "success") {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle2 className="w-10 h-10 text-green-600 animate-bounce" />
        </div>
        <div className="text-center">
          <p className="font-bold text-gray-900 text-lg">Got it!</p>
          <p className="text-sm text-muted-foreground mt-1">Profile saved successfully.</p>
        </div>
      </div>
    );
  }

  // ── PREVIEW STATE ──────────────────────────────────────────────────────
  if (step === "preview" && preview) {
    return (
      <div className="space-y-5">
        {/* Success banner */}
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
          <Sparkles className="w-4 h-4 shrink-0" />
          <span>
            Found{" "}
            <strong>{preview.extraction.people.length}</strong>{" "}
            {preview.extraction.people.length === 1 ? "person" : "people"} and
            saved their details.
          </span>
        </div>

        {/* Per-person preview cards */}
        {preview.extraction.people.map((person: ExtractedPerson, idx: number) => {
          const personId = preview.personIds[idx];
          return (
            <Card key={idx} className="overflow-hidden">
              <CardHeader className="pb-3 px-4 pt-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold shrink-0">
                    {person.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base leading-tight">
                      {person.name}
                    </CardTitle>
                    {person.summary && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {person.summary}
                      </p>
                    )}
                  </div>
                </div>
                {/* View profile — full width on mobile */}
                <Button
                  className="w-full mt-3 h-11"
                  onClick={() => handleViewPerson(personId)}
                >
                  View profile
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </CardHeader>

              <CardContent className="pt-0 px-4 pb-4 space-y-4">
                {/* Attributes */}
                {person.attributes.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Details
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {person.attributes.map((attr) => (
                        <Badge
                          key={attr.key}
                          variant="secondary"
                          className="text-xs py-1"
                        >
                          <span className="text-muted-foreground mr-1">
                            {attr.key}:
                          </span>
                          {attr.value}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Family members */}
                {person.family_members.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      Family
                    </p>
                    <div className="space-y-1.5">
                      {person.family_members.map((fm, fmIdx) => (
                        <div
                          key={fmIdx}
                          className="flex items-center gap-2 text-sm"
                        >
                          <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span className="font-medium">{fm.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {capitalize(fm.relation)}
                          </Badge>
                          {fm.attributes.map((a) => (
                            <span
                              key={a.key}
                              className="text-muted-foreground text-xs"
                            >
                              {a.value}
                            </span>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}

        {/* Action buttons — stacked on mobile, side by side on sm+ */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button onClick={handleViewAll} className="flex-1 h-11">
            Go to dashboard
          </Button>
          <Button
            variant="outline"
            onClick={handleStartOver}
            className="flex-1 h-11"
          >
            Log another meeting
          </Button>
        </div>
      </div>
    );
  }

  // ── INPUT STATE ────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Big mic button */}
      <div className="flex flex-col items-center gap-4 py-6">
        <div className="relative flex items-center justify-center">
          {listening && (
            <>
              <span className="absolute w-28 h-28 rounded-full opacity-20 animate-ping" style={{ backgroundColor: "#482d7c" }} />
              <span className="absolute w-20 h-20 rounded-full opacity-20 animate-ping" style={{ backgroundColor: "#284e72", animationDelay: "150ms" }} />
            </>
          )}
          <button
            type="button"
            onClick={toggleVoice}
            disabled={isLoading}
            title={listening ? "Stop recording" : "Tap to speak"}
            aria-label={listening ? "Stop recording" : "Tap to speak"}
            className="relative w-24 h-24 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-95 focus:outline-none"
            style={{ background: listening ? "linear-gradient(to bottom right, #c0392b, #e74c3c)" : "linear-gradient(to bottom right, #284e72, #482d7c)" }}
          >
            {listening ? <MicOff className="w-10 h-10 text-white" /> : <Mic className="w-10 h-10 text-white" />}
          </button>
        </div>
        <p className="text-sm text-muted-foreground">
          {listening ? (
            <span className="flex items-center gap-1.5 text-red-600 font-medium">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse inline-block" />
              Listening... tap mic to stop
            </span>
          ) : text ? "Tap mic to continue speaking" : "Tap the mic and start speaking"}
        </p>
      </div>

      {/* Transcript display */}
      {text && (
        <div className="relative rounded-xl border p-4" style={{ borderColor: "#dccaff", backgroundColor: "#f5f0ff" }}>
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

      {/* Submit */}
      {text.trim() && (
        <Button
          type="submit"
          disabled={isLoading}
          className="w-full h-12 gap-2 font-semibold text-white border-0"
          style={{ background: "linear-gradient(to right, #284e72, #482d7c)" }}
        >
          <Sparkles className="w-4 h-4" />
          Extract &amp; Save
        </Button>
      )}
    </form>
  );
}
