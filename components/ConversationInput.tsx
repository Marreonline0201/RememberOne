"use client";

// ConversationInput — main text area where the user describes who they met.
// Mobile-first: large touch target mic button, full-height textarea, sticky submit bar.
// Sends the text to /api/ai/extract, shows a preview, then redirects to profile.

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import {
  Loader2,
  Sparkles,
  ChevronRight,
  User,
  Users,
  Mic,
  MicOff,
} from "lucide-react";
import type { AIExtractionResult, ExtractedPerson } from "@/types/app";
import { capitalize } from "@/lib/utils";

type Step = "input" | "loading" | "preview";

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
      setStep("preview");
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
      <div className="flex flex-col items-center justify-center py-20 gap-5">
        <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
        <div className="text-center">
          <p className="font-semibold text-gray-900 text-base">
            Extracting details...
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            AI is reading your notes and building the profile.
          </p>
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
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Textarea + mic button */}
      <div className="relative">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 4000))}
          placeholder="Today I met Sarah at the networking event. She's a product manager at Stripe, went to NYU. She mentioned her husband John is a doctor and their daughter Emma is 5..."
          /*
            Mobile: min 220px so it feels immersive. Desktop: 240px.
            pr-14 leaves room for the mic button.
          */
          className="min-h-[220px] md:min-h-[240px] text-base leading-relaxed resize-none pr-14"
          autoFocus
          disabled={isLoading}
          maxLength={4000}
        />

        {/* Mic button — 44px touch target, positioned inside textarea */}
        <button
          type="button"
          onClick={toggleVoice}
          disabled={isLoading}
          title={listening ? "Stop recording" : "Start voice input"}
          aria-label={listening ? "Stop recording" : "Start voice input"}
          className={`absolute bottom-3 right-3 w-11 h-11 rounded-full flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-ring ${
            listening
              ? "bg-red-100 text-red-600 hover:bg-red-200 animate-pulse"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          {listening ? (
            <MicOff className="w-5 h-5" />
          ) : (
            <Mic className="w-5 h-5" />
          )}
        </button>
      </div>

      {/* Listening indicator */}
      {listening && (
        <p className="text-xs text-red-600 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse inline-block" />
          Listening... speak now. Tap the mic to stop.
        </p>
      )}

      {/* Footer row: char count + submit */}
      <div className="flex items-center justify-between gap-3">
        <p
          className={`text-xs ${
            text.length >= 3800
              ? "text-amber-600 font-medium"
              : "text-muted-foreground"
          }`}
        >
          {text.length}/4000
        </p>
        {/* Full-width on mobile, auto on md+ */}
        <Button
          type="submit"
          disabled={!text.trim() || isLoading}
          className="h-11 gap-2 flex-1 md:flex-none"
        >
          <Sparkles className="w-4 h-4" />
          Extract &amp; Save
        </Button>
      </div>
    </form>
  );
}
