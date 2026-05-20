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
import { useLanguage } from "@/contexts/LanguageContext";
import { getLanguage } from "@/lib/i18n";

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
  const { language } = useLanguage();
  const ko = language === "ko";
  const speechLocale = getLanguage(language).locale;
  const [isPending, startTransition] = useTransition();
  const newRowRef = useRef<HTMLDivElement>(null);

  const [notes, setNotes] = useState(initialNotes);
  const [notesDirty, setNotesDirty] = useState(false);

  // ── Notes voice recording (rectangle mic button BELOW the notes textarea) ─
  // Captures audio with MediaRecorder, sends to /api/ai/transcribe with the
  // polish flag, appends Gemini's grammar-cleaned transcript to the existing
  // notes value. While recording we ALSO run the browser's Web Speech API to
  // show an italic live transcript so the user gets immediate feedback. The
  // authoritative final text is always Gemini's polished version on stop.
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [recDuration, setRecDuration] = useState(0);
  const [livePartial, setLivePartial] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recDurationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recMaxDurationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Web Speech API refs — best-effort live preview only. MediaRecorder is the
  // authoritative capture; Web Speech can drop on silence and we auto-restart
  // it as long as we're still recording.
  const speechRecognitionRef = useRef<SpeechRecognition | null>(null);
  const finalsRef = useRef<string[]>([]);
  // Set while recording is still active. Drives onend's auto-restart logic.
  // We use a ref (not state) so the closure captured by onend always sees the
  // latest value without rebinding the handler.
  const recordingRef = useRef(false);
  // Diagnostic surface for the Live preview card — populated by recognition
  // .onerror so the user can tell when Web Speech failed (vs just being slow).
  const [speechStatus, setSpeechStatus] = useState<string | null>(null);

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

  // ── Live preview via Web Speech API (best-effort) ───────────────────────
  // The Android Chromium WebView's `webkitSpeechRecognition` reliably ENDS
  // after a brief silence. We auto-restart inside `onend` as long as we're
  // still recording — this is the difference between a working live preview
  // and one that goes blank after the first pause.
  function startLivePreview() {
    if (typeof window === "undefined") return;
    const SR =
      (window as typeof window & { SpeechRecognition?: typeof SpeechRecognition })
        .SpeechRecognition ??
      (window as typeof window & {
        webkitSpeechRecognition?: typeof SpeechRecognition;
      }).webkitSpeechRecognition;
    if (!SR) {
      console.warn("[voice-note] Web Speech API not available in this browser");
      setSpeechStatus("unavailable");
      return;
    }

    finalsRef.current = [];
    let recognition: SpeechRecognition;
    try {
      recognition = new SR();
    } catch (err) {
      console.warn("[voice-note] could not create SpeechRecognition:", err);
      setSpeechStatus("init-failed");
      return;
    }
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = speechLocale;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const segment = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          const trimmed = segment.trim();
          if (trimmed) finalsRef.current.push(trimmed);
        } else {
          interimText += segment;
        }
      }
      const finals = finalsRef.current.join(" ").trim();
      const interim = interimText.trim();
      setLivePartial(
        finals && interim ? finals + " " + interim : finals || interim
      );
      // Clear any prior diagnostic — we're actively transcribing again.
      setSpeechStatus(null);
    };

    recognition.onerror = (e: Event) => {
      // The Web Speech spec exposes `.error` on the error event but the
      // bundled lib.dom types don't include `SpeechRecognitionErrorEvent`,
      // so we narrow defensively. "no-speech" and "aborted" are normal
      // lifecycle events on Android; anything else is worth logging.
      const code = (e as Event & { error?: string }).error ?? "";
      if (code && code !== "no-speech" && code !== "aborted") {
        console.warn("[voice-note] recognition error:", code);
        setSpeechStatus(`error:${code}`);
      }
    };

    recognition.onend = () => {
      // Android Chromium ends recognition on silence after a few seconds.
      // Auto-restart as long as we're still recording so the user keeps
      // seeing live text across pauses.
      if (recordingRef.current) {
        try {
          recognition.start();
        } catch (err) {
          // "InvalidStateError" can fire if start is called too rapidly;
          // a small retry covers that.
          console.warn("[voice-note] restart failed, retrying:", err);
          setTimeout(() => {
            if (recordingRef.current) {
              try {
                recognition.start();
              } catch {}
            }
          }, 250);
        }
      }
    };

    speechRecognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (err) {
      console.warn("[voice-note] initial recognition.start failed:", err);
      setSpeechStatus("start-failed");
    }
  }

  function stopLivePreview() {
    // Flip recordingRef BEFORE calling abort so onend doesn't auto-restart.
    recordingRef.current = false;
    try {
      speechRecognitionRef.current?.abort();
    } catch {}
    speechRecognitionRef.current = null;
  }

  // Cleanup on unmount: guarantee no hot mic survives a route change.
  useEffect(() => {
    return () => {
      try {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
          mediaRecorderRef.current.stop();
        }
      } catch {}
      stopLivePreview();
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
        // Live preview is no longer needed — Gemini's polished version is now
        // committed to notes.
        setLivePartial("");
        finalsRef.current = [];
      } else {
        toast({
          title: ko ? "음성을 인식하지 못했어요" : "Couldn't hear anything",
          description: ko
            ? "다시 시도하거나 직접 입력해 주세요."
            : "Try again or type your note instead.",
        });
        // Fallback: if Gemini returned nothing but Web Speech captured
        // something, promote the live preview into notes so the recording
        // isn't lost.
        const fallback = livePartial.trim();
        if (fallback) {
          setNotes((prev) => {
            const trimmed = prev.trimEnd();
            const joined = trimmed ? `${trimmed}\n${fallback}` : fallback;
            return joined.slice(0, 4000);
          });
          setNotesDirty(true);
        }
        setLivePartial("");
        finalsRef.current = [];
      }
    } catch (err: unknown) {
      // Same fallback: promote whatever Web Speech captured so the user
      // doesn't lose their recording. They can clean it up by hand.
      const fallback = livePartial.trim();
      if (fallback) {
        setNotes((prev) => {
          const trimmed = prev.trimEnd();
          const joined = trimmed ? `${trimmed}\n${fallback}` : fallback;
          return joined.slice(0, 4000);
        });
        setNotesDirty(true);
      }
      setLivePartial("");
      finalsRef.current = [];
      toast({
        title: ko ? "음성 인식 실패" : "Transcription failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setTranscribing(false);
    }
  }

  async function startVoiceNote() {
    setRecDuration(0);
    setLivePartial("");
    setSpeechStatus(null);
    finalsRef.current = [];
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
    // recordingRef drives onend auto-restart — must be set BEFORE
    // startLivePreview kicks off recognition.
    recordingRef.current = true;

    // Best-effort live transcript via Web Speech. Independent of MediaRecorder.
    startLivePreview();

    recDurationTimerRef.current = setInterval(() => {
      setRecDuration((p) => p + 1);
    }, 1000);

    recMaxDurationTimerRef.current = setTimeout(() => {
      if (mediaRecorderRef.current?.state === "recording") {
        toast({
          title: ko ? "녹음 시간 제한 도달" : "Recording limit reached",
          description: ko
            ? `최대 ${MAX_RECORDING_SECONDS}초까지 녹음할 수 있습니다.`
            : `Recordings are capped at ${MAX_RECORDING_SECONDS} seconds.`,
        });
        stopVoiceNote();
      }
    }, MAX_RECORDING_SECONDS * 1000);
  }

  function stopVoiceNote() {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    stopLivePreview();
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
      <div className="space-y-2">
        <Label htmlFor="notes" className="text-sm font-medium">
          Notes
        </Label>
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
          */
          className="min-h-[100px] text-base md:text-sm resize-none"
        />

        {/* Live transcript card — only visible while recording or while there
            is in-flight Web Speech text. Italic = "not committed yet"; the
            authoritative polished version replaces it on stop. */}
        {(recording || livePartial) && (
          <div
            className="p-3 rounded-[10px_2px_10px_2px]"
            style={{ backgroundColor: "#f0e8ff", border: "1px solid #dccaff" }}
          >
            <p
              className="text-[10px] uppercase tracking-wider mb-1"
              style={{ color: "#665b7b", fontFamily: "'Hammersmith One', sans-serif" }}
            >
              {ko ? "실시간 미리보기" : "Live preview"}
            </p>
            <p
              className="text-[13px] leading-relaxed italic min-h-[1.25rem]"
              style={{ color: "#5e7983" }}
            >
              {livePartial ||
                (recording
                  ? speechStatus === "unavailable"
                    ? ko
                      ? "실시간 미리보기를 지원하지 않는 기기입니다 — 녹음은 계속됩니다."
                      : "Live preview not supported on this device — recording continues."
                    : speechStatus === "init-failed" || speechStatus === "start-failed"
                      ? ko
                        ? "실시간 인식을 시작할 수 없어요 — 녹음은 계속됩니다."
                        : "Couldn't start live recognition — recording continues."
                      : ko
                        ? "듣고 있어요…"
                        : "Listening…"
                  : "")}
            </p>
          </div>
        )}

        {/* Voice-note button — full-width rectangle matching the "Log meeting"
            CTA style (asymmetric corners, navy gradient when active). Sits
            BELOW the notes textarea so it never overlays user input. */}
        <button
          type="button"
          onClick={toggleVoiceNote}
          disabled={transcribing}
          aria-label={
            recording
              ? ko ? "녹음 중지" : "Stop recording"
              : transcribing
                ? ko ? "변환 중" : "Transcribing"
                : ko ? "음성 메모 녹음" : "Record voice note"
          }
          className="w-full h-11 flex items-center justify-center gap-2 rounded-[10px_2px_10px_2px] transition-all active:opacity-80 disabled:opacity-70"
          style={
            recording
              ? {
                  background: "linear-gradient(to right, #284e72, #482d7c)",
                  color: "#ffffff",
                }
              : {
                  backgroundColor: "#f5f0ff",
                  border: "1px solid #dccaff",
                  color: "#284e72",
                }
          }
        >
          {transcribing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span style={{ fontFamily: "'Hammersmith One', sans-serif" }}>
                {ko ? "변환 중..." : "Transcribing..."}
              </span>
            </>
          ) : recording ? (
            <>
              <MicOff className="w-4 h-4" />
              <span style={{ fontFamily: "'Hammersmith One', sans-serif" }}>
                {ko ? "녹음 중지" : "Stop"} · {formatDuration(recDuration)}
              </span>
            </>
          ) : (
            <>
              <Mic className="w-4 h-4" />
              <span style={{ fontFamily: "'Hammersmith One', sans-serif" }}>
                {ko ? "음성 메모" : "Voice note"}
              </span>
            </>
          )}
        </button>
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
