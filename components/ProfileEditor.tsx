"use client";

// ProfileEditor — editable list of key-value attributes for a person.
// Keyframe injected once; Tailwind doesn't ship slide+fade out of the box.
const injectKeyframe = (() => {
  if (typeof document === "undefined") return () => {};
  let injected = false;
  return () => {
    if (injected) return;
    injected = true;
    const style = document.createElement("style");
    style.textContent = `
      @keyframes slideInFade {
        from { opacity: 0; transform: translateY(-8px); }
        to   { opacity: 1; transform: translateY(0); }
      }
    `;
    document.head.appendChild(style);
  };
})();
// Mobile-first: stacked key/value rows (full width each), large tap targets.
// On md+ the key and value fields appear side-by-side.

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Plus, Trash2, Save, Loader2, Undo2, Mic, MicOff } from "lucide-react";
import type { PersonAttribute } from "@/types/database";

// Voice-note recording constants. Same 60-s safety cap as ConversationInput so
// the mic can never silently stay hot in the background.
const MAX_RECORDING_SECONDS = 60;
const PREFERRED_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/ogg;codecs=opus",
  "audio/webm",
  "audio/mp4",
];
function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  for (const mt of PREFERRED_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(mt)) return mt;
  }
  return undefined;
}
function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface Props {
  personId: string;
  initialAttributes: PersonAttribute[];
  initialNotes: string;
}

interface LocalAttribute {
  id: string | null; // null = newly added, not yet saved
  key: string;
  value: string;
  dirty: boolean;
  markedForDelete: boolean;
}

export function ProfileEditor({
  personId,
  initialAttributes,
  initialNotes,
}: Props) {
  injectKeyframe();
  const { toast } = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const newRowRef = useRef<HTMLDivElement>(null);

  const [notes, setNotes] = useState(initialNotes);
  const [notesDirty, setNotesDirty] = useState(false);

  // ── Notes voice recording (mic at the bottom-right of the notes textarea) ─
  // Captures audio with MediaRecorder, sends to /api/ai/transcribe with the
  // polish flag, appends Gemini's grammar-cleaned transcript to the existing
  // notes value. Mirrors the recording lifecycle in ConversationInput.tsx so
  // we get the same robust mic + auto-stop behavior here without changing the
  // page layout.
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [recDuration, setRecDuration] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recDurationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recMaxDurationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function teardownRecorder() {
    audioStreamRef.current?.getTracks().forEach((t) => t.stop());
    audioStreamRef.current = null;
    if (recDurationTimerRef.current) {
      clearInterval(recDurationTimerRef.current);
      recDurationTimerRef.current = null;
    }
    if (recMaxDurationTimerRef.current) {
      clearTimeout(recMaxDurationTimerRef.current);
      recMaxDurationTimerRef.current = null;
    }
  }

  // Cleanup on unmount: guarantee no hot mic survives a route change.
  useEffect(() => {
    return () => {
      try {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
          mediaRecorderRef.current.stop();
        }
      } catch {}
      teardownRecorder();
    };
  }, []);

  async function transcribeBlob(blob: Blob) {
    if (blob.size === 0) {
      setTranscribing(false);
      return;
    }
    setTranscribing(true);

    const filename = blob.type.includes("webm")
      ? "recording.webm"
      : blob.type.includes("mp4")
        ? "recording.mp4"
        : blob.type.includes("ogg")
          ? "recording.ogg"
          : "recording.bin";

    const form = new FormData();
    form.append("audio", blob, filename);
    // Tell the API to polish grammar/punctuation while keeping content intact.
    form.append("polish", "true");

    try {
      const res = await fetch("/api/ai/transcribe", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? "Transcription failed");

      const newText: string = (json.data?.text ?? "").trim();
      if (newText) {
        setNotes((prev) => {
          const trimmed = prev.trimEnd();
          // Newline-separate if there's existing prose; otherwise just use the
          // transcript as-is.
          const joined = trimmed ? `${trimmed}\n${newText}` : newText;
          return joined.slice(0, 4000);
        });
        setNotesDirty(true);
      } else {
        toast({
          title: "Couldn't hear anything",
          description: "Try again or type your note instead.",
        });
      }
    } catch (err: unknown) {
      toast({
        title: "Transcription failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setTranscribing(false);
    }
  }

  async function startVoiceNote() {
    setRecDuration(0);
    audioChunksRef.current = [];

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      toast({
        title: "Microphone unavailable",
        description: "Please allow microphone access in your device settings.",
        variant: "destructive",
      });
      return;
    }
    audioStreamRef.current = stream;

    const mimeType = pickMimeType();
    let recorder: MediaRecorder;
    try {
      recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    } catch {
      teardownRecorder();
      toast({
        title: "Recording not supported",
        description: "Your browser doesn't support audio recording.",
        variant: "destructive",
      });
      return;
    }
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e: BlobEvent) => {
      if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
      audioChunksRef.current = [];
      teardownRecorder();
      void transcribeBlob(blob);
    };
    recorder.onerror = () => {
      setRecording(false);
      teardownRecorder();
    };

    try {
      recorder.start(1000);
    } catch {
      teardownRecorder();
      return;
    }
    setRecording(true);

    recDurationTimerRef.current = setInterval(() => {
      setRecDuration((p) => p + 1);
    }, 1000);

    recMaxDurationTimerRef.current = setTimeout(() => {
      if (mediaRecorderRef.current?.state === "recording") {
        toast({
          title: "Recording limit reached",
          description: `Recordings are capped at ${MAX_RECORDING_SECONDS} seconds.`,
        });
        stopVoiceNote();
      }
    }, MAX_RECORDING_SECONDS * 1000);
  }

  function stopVoiceNote() {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    try {
      recorder.stop();
    } catch {}
    setRecording(false);
  }

  function toggleVoiceNote() {
    if (transcribing) return;
    if (recording) stopVoiceNote();
    else void startVoiceNote();
  }

  const [attributes, setAttributes] = useState<LocalAttribute[]>(
    initialAttributes.map((a) => ({
      id: a.id,
      key: a.key,
      value: a.value,
      dirty: false,
      markedForDelete: false,
    }))
  );

  const [justAdded, setJustAdded] = useState(false);

  function addAttribute() {
    setAttributes((prev) => [
      ...prev,
      { id: null, key: "", value: "", dirty: true, markedForDelete: false },
    ]);
    setJustAdded(true);
  }

  useEffect(() => {
    if (!justAdded || !newRowRef.current) return;
    setJustAdded(false);

    const el = newRowRef.current;
    const firstInput = el.querySelector("input") as HTMLInputElement | null;

    // Smooth scroll with easing via rAF
    const targetY =
      el.getBoundingClientRect().top + window.scrollY - window.innerHeight / 2 + el.offsetHeight / 2;
    const startY = window.scrollY;
    const distance = targetY - startY;
    const duration = 400; // ms
    let start: number | null = null;

    function easeInOut(t: number) {
      return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    }

    function step(timestamp: number) {
      if (start === null) start = timestamp;
      const elapsed = timestamp - start;
      const progress = Math.min(elapsed / duration, 1);
      window.scrollTo(0, startY + distance * easeInOut(progress));
      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        firstInput?.focus();
      }
    }

    requestAnimationFrame(step);
  }, [justAdded, attributes.length]);

  function updateAttribute(
    index: number,
    field: "key" | "value",
    val: string
  ) {
    setAttributes((prev) =>
      prev.map((a, i) =>
        i === index ? { ...a, [field]: val, dirty: true } : a
      )
    );
  }

  function toggleDelete(index: number) {
    setAttributes((prev) =>
      prev.map((a, i) => {
        if (i !== index) return a;
        // Newly added + not yet saved: remove immediately (nothing to undo)
        if (a.id === null) return null as unknown as LocalAttribute;
        return { ...a, markedForDelete: !a.markedForDelete };
      }).filter(Boolean) as LocalAttribute[]
    );
  }

  async function handleSave() {
    const invalid = attributes.some((a) => !a.markedForDelete && (!a.key.trim() || !a.value.trim()));
    if (invalid) {
      toast({
        title: "Please fill in all fields",
        description: "Each attribute needs both a label and a value.",
        variant: "destructive",
      });
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch(`/api/people/${personId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            notes: notes || null,
            attributes: attributes
              .filter((a) => !a.markedForDelete)
              .map((a) => ({
                key: a.key.trim(),
                value: a.value.trim(),
              })),
          }),
        });

        const json = await res.json();
        if (!res.ok || json.error) throw new Error(json.error);

        setAttributes((prev) =>
          prev
            .filter((a) => !a.markedForDelete)
            .map((a) => ({ ...a, dirty: false }))
        );
        setNotesDirty(false);

        toast({ title: "Saved", description: "Profile updated successfully." });
        router.refresh();
      } catch (err: unknown) {
        toast({
          title: "Save failed",
          description:
            err instanceof Error ? err.message : "Unknown error",
          variant: "destructive",
        });
      }
    });
  }

  const hasPendingChanges =
    notesDirty ||
    attributes.some((a) => a.dirty) ||
    attributes.some((a) => a.id === null) ||
    attributes.some((a) => a.markedForDelete);

  return (
    <div className="space-y-6">
      {/* Notes */}
      <div className="space-y-1.5">
        <Label htmlFor="notes" className="text-sm font-medium">
          Notes
        </Label>
        {/* `relative` wrapper so the voice-note mic can sit at the bottom-right
            of the textarea without changing the page layout. The textarea has
            extra bottom padding so typed text never slides under the mic. */}
        <div className="relative">
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
              setNotesDirty(true);
            }}
            placeholder="Add any free-form notes about this person..."
            /*
              min-h-[100px] gives enough space on mobile.
              text-base prevents iOS auto-zoom on focus.
              pb-11 reserves room for the absolute-positioned mic.
            */
            className="min-h-[100px] text-base md:text-sm resize-none pb-11"
          />

          {/* Live recording duration — only while the mic is active. */}
          {recording && (
            <span
              className="absolute bottom-3 right-12 text-[11px] tabular-nums"
              style={{ color: "#5e7983" }}
            >
              {formatDuration(recDuration)}
            </span>
          )}

          <button
            type="button"
            onClick={toggleVoiceNote}
            disabled={transcribing}
            aria-label={
              recording
                ? "Stop voice note"
                : transcribing
                  ? "Transcribing voice note"
                  : "Record voice note"
            }
            className="absolute bottom-2 right-2 w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-95 disabled:opacity-70 shadow-sm"
            style={{
              background: recording
                ? "linear-gradient(135deg, #00d4f7, #c84b8a, #482d7c)"
                : "rgba(220, 202, 255, 0.6)",
            }}
          >
            {transcribing ? (
              <Loader2 className="w-4 h-4 animate-spin" style={{ color: "#482d7c" }} />
            ) : recording ? (
              <MicOff className="w-4 h-4 text-white" />
            ) : (
              <Mic className="w-4 h-4" style={{ color: "#482d7c" }} />
            )}
          </button>
        </div>
      </div>

      {/* Attributes */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Attributes</Label>
          {/* "Add field" — 44px touch target */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addAttribute}
            className="gap-1.5 h-9 px-3"
          >
            <Plus className="w-3.5 h-3.5" />
            Add field
          </Button>
        </div>

        <div className="space-y-3">
          {attributes.length === 0 && (
            <p className="text-sm text-muted-foreground py-2">
              No attributes yet. Tap &quot;Add field&quot; to add details like job,
              company, university, hobby, etc.
            </p>
          )}

          {attributes.map((attr, idx) => (
            /*
              Mobile: stacked vertically — label input on top, value below.
              md+: side-by-side row.
              Delete button is always at the end with a 44px touch target.
            */
            <div
              key={idx}
              ref={idx === attributes.length - 1 ? newRowRef : undefined}
              className="flex flex-col gap-2 md:flex-row md:items-start transition-opacity duration-200"
              style={{
                opacity: attr.markedForDelete ? 0.45 : 1,
                ...(attr.id === null && idx === attributes.length - 1
                  ? { animation: "slideInFade 0.3s ease-out both" }
                  : {}),
              }}
            >
              <Input
                value={attr.key}
                onChange={(e) => updateAttribute(idx, "key", e.target.value)}
                placeholder="Label (e.g. Job Title)"
                disabled={attr.markedForDelete}
                className="h-11 text-base md:text-sm md:flex-[2]"
                style={attr.markedForDelete ? { textDecoration: "line-through" } : undefined}
              />
              <Input
                value={attr.value}
                onChange={(e) => updateAttribute(idx, "value", e.target.value)}
                placeholder="Value"
                disabled={attr.markedForDelete}
                className="h-11 text-base md:text-sm md:flex-[3]"
                style={attr.markedForDelete ? { textDecoration: "line-through" } : undefined}
              />
              {/* Delete / Undo — 44px tap target */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => toggleDelete(idx)}
                className={`h-11 w-11 shrink-0 self-end md:self-auto ${
                  attr.markedForDelete
                    ? "text-amber-500 hover:text-amber-600"
                    : "text-muted-foreground hover:text-destructive"
                }`}
                aria-label={attr.markedForDelete ? "Undo remove" : "Remove attribute"}
              >
                {attr.markedForDelete ? (
                  <Undo2 className="w-4 h-4" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Save button — full width on mobile, right-aligned on desktop */}
      <div className="flex md:justify-end pt-1">
        <Button
          onClick={handleSave}
          disabled={!hasPendingChanges || isPending}
          className="w-full md:w-auto h-11 gap-2"
        >
          {isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {isPending ? "Saving..." : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
