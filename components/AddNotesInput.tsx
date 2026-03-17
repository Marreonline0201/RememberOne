"use client";

// AddNotesInput — lets the user add voice or typed notes to an existing person's profile.
// Calls POST /api/people/[id]/notes, which extracts new info via Gemini and merges it in.

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Mic, MicOff, Plus, Sparkles, X } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { getLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface Props {
  personId: string;
  personName: string;
}

export function AddNotesInput({ personId, personName }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const { language, t } = useLanguage();
  const speechLocale = getLanguage(language).locale;

  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [logMeeting, setLogMeeting] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Stop recognition when component unmounts or panel closes
  useEffect(() => {
    if (!open) recognitionRef.current?.stop();
    return () => recognitionRef.current?.stop();
  }, [open]);

  function toggleVoice() {
    const SR =
      (window as typeof window & { webkitSpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition ??
      (window as typeof window & { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition;

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || loading) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/people/${personId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, logMeeting }),
      });

      const json = await res.json();

      if (!res.ok || json.error) {
        throw new Error(json.error ?? "Failed to analyze notes");
      }

      const { added } = json.data;
      const parts: string[] = [];
      if (added.attributes > 0) parts.push(`${added.attributes} detail${added.attributes > 1 ? "s" : ""}`);
      if (added.family_members > 0) parts.push(`${added.family_members} family member${added.family_members > 1 ? "s" : ""}`);
      if (logMeeting) parts.push("meeting log");

      toast({
        title: "Saved",
        description: parts.length > 0 ? `Added: ${parts.join(", ")}.` : "Details updated.",
      });

      setText("");
      setOpen(false);
      router.refresh();
    } catch (err: unknown) {
      toast({
        title: "Failed to save notes",
        description: err instanceof Error ? err.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    recognitionRef.current?.stop();
    setListening(false);
    setText("");
    setLogMeeting(false);
    setOpen(false);
  }

  if (!open) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={() => setOpen(true)}
      >
        <Plus className="w-4 h-4" />
        Add notes
      </Button>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-blue-500" />
          <p className="text-sm font-medium text-gray-900">
            Add notes about {personName}
          </p>
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="text-muted-foreground hover:text-gray-700 transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="relative">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 4000))}
            placeholder={`e.g. "Caught up with ${personName} today. She mentioned she recently moved to Berlin and started a new job at Spotify..."`}
            className="min-h-[130px] text-sm leading-relaxed resize-none pr-12"
            autoFocus
            disabled={loading}
            maxLength={4000}
          />
          <button
            type="button"
            onClick={toggleVoice}
            disabled={loading}
            title={listening ? "Stop recording" : "Start voice input"}
            className={`absolute bottom-3 right-3 p-2 rounded-full transition-colors ${
              listening
                ? "bg-red-100 text-red-600 hover:bg-red-200 animate-pulse"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
        </div>

        {listening && (
          <p className="text-xs text-red-600 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse inline-block" />
            Listening... speak now. Click the mic to stop.
          </p>
        )}

        {/* Meeting toggle */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-muted w-fit">
          <button
            type="button"
            onClick={() => setLogMeeting(false)}
            className={cn(
              "px-3 py-1 rounded-md text-xs font-medium transition-colors",
              !logMeeting ? "bg-white shadow-sm text-gray-900" : "text-muted-foreground"
            )}
          >
            {t("meet.log_type_details")}
          </button>
          <button
            type="button"
            onClick={() => setLogMeeting(true)}
            className={cn(
              "px-3 py-1 rounded-md text-xs font-medium transition-colors",
              logMeeting ? "bg-white shadow-sm text-gray-900" : "text-muted-foreground"
            )}
          >
            {t("meet.log_type_met")}
          </button>
        </div>

        <div className="flex items-center justify-between">
          <p className={`text-xs ${text.length >= 3800 ? "text-amber-600 font-medium" : "text-muted-foreground"}`}>
            {text.length}/4000 characters
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={!text.trim() || loading} className="gap-2">
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  Analyze &amp; save
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
