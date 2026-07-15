"use client";

// ConversationInput — voice-first input matching the Figma mic page design.
//
// General mode (no personId prop):
//   Sends transcript to /api/ai/extract, shows multi-person preview, then redirects.
//
// Person mode (personId + personName props):
//   Sends transcript to /api/people/[id]/notes — only adds details about that one person,
//   then navigates back to their profile page.
//
// Recording strategy: continuous audio capture via MediaRecorder. The mic stays
// hot until the user taps stop (or a 60-second safety cap fires). On stop the
// audio blob is uploaded to /api/ai/transcribe where Gemini does the transcript
// in one pass. This replaces the old SpeechRecognition flow which cut off mid-
// sentence on every short pause.

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
  X,
  ArrowLeft,
  Loader2,
  FolderPlus,
} from "lucide-react";
import { GroupPickerSheet } from "@/components/GroupPickerSheet";
import type { AIExtractionResult, ExtractedPerson } from "@/types/app";
import { useLanguage } from "@/contexts/LanguageContext";
import { getLanguage } from "@/lib/i18n";
import { localizeKey, cn } from "@/lib/utils";
import { useOnline } from "@/lib/use-online";
import { MeetModeToggle } from "@/components/MeetModeToggle";
import { AiLoadingState } from "@/components/AiLoadingState";
import { AiSuccessState } from "@/components/AiSuccessState";
import { useAiConsent } from "@/components/AiConsentProvider";
import { cachePerson } from "@/lib/offline-cache";

type Step = "input" | "loading" | "success" | "preview";

interface ExtractionPreview {
  extraction: AIExtractionResult;
  personIds: string[];
}

interface Props {
  /** When set, locks this session to adding details for one specific person. */
  personId?: string;
  personName?: string;
}

// 60-second safety cap: if the user forgets to tap stop we cut them off so we
// don't run a hot mic in the background forever. Tuned so a normal "tell me
// about who you met" monologue fits comfortably.
const MAX_RECORDING_SECONDS = 60;

// MIME types we'll request from MediaRecorder, in preference order. First one
// the browser supports wins. Gemini accepts webm, ogg, mp4(aac) — see lib/gemini.ts.
const PREFERRED_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/ogg;codecs=opus",
  "audio/webm",
  "audio/mp4",
];

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function ConversationInput({ personId, personName }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const { language, t } = useLanguage();
  const speechLocale = getLanguage(language).locale;
  const ko = language === "ko";
  const online = useOnline();
  const { ensureConsent } = useAiConsent();

  // person-specific mode
  const isPerson = !!(personId && personName);

  const [step, setStep] = useState<Step>("input");
  const isLoading = step === "loading";
  const [text, setText] = useState("");
  // Live preview from the browser's Web Speech API — shown in italic while
  // the user is still speaking. Replaced with Gemini's final transcript on
  // stop. Web Speech may stop mid-recording on silence (its built-in timeout)
  // — that's cosmetic only because MediaRecorder is still capturing audio.
  const [livePartial, setLivePartial] = useState("");
  const [preview, setPreview] = useState<ExtractionPreview | null>(null);
  // Preview-step group picker: which just-saved person it's editing (null = closed).
  const [groupsFor, setGroupsFor] = useState<{ id: string; name: string } | null>(null);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [duration, setDuration] = useState(0);
  const [logMeeting, setLogMeeting] = useState(true);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxDurationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Live preview is two-track:
  //   - On Capacitor native (Android/iOS): @capacitor-community/speech-
  //     recognition. Bridges to native OS speech service which actually
  //     works in WebView (Web Speech does not — diagnostic confirmed).
  //   - On web: webkitSpeechRecognition.
  // MediaRecorder + Gemini is always the authoritative final transcript.
  const speechRecognitionRef = useRef<SpeechRecognition | null>(null);
  const finalsRef = useRef<string[]>([]);
  // Fallback used if Gemini transcription fails.
  const livePartialRef = useRef("");
  // Native plugin tracking.
  const nativePartialListenerRef = useRef<{ remove: () => Promise<void> } | null>(null);
  const nativeStateListenerRef = useRef<{ remove: () => Promise<void> } | null>(null);
  const nativeActiveRef = useRef(false);
  const recordingRef = useRef(false);

  function setLivePartialSync(value: string) {
    livePartialRef.current = value;
    setLivePartial(value);
  }

  // Clean up the mic, the recorder, the live-preview recognizer, and any
  // timers on unmount. Guards against a hot mic surviving a route change.
  useEffect(() => {
    return () => {
      try {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
          mediaRecorderRef.current.stop();
        }
      } catch {}
      try {
        speechRecognitionRef.current?.abort();
      } catch {}
      audioStreamRef.current?.getTracks().forEach((track) => track.stop());
      audioStreamRef.current = null;
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
      if (maxDurationTimerRef.current) clearTimeout(maxDurationTimerRef.current);
    };
  }, []);

  function pickMimeType(): string | undefined {
    if (typeof MediaRecorder === "undefined") return undefined;
    for (const mt of PREFERRED_MIME_TYPES) {
      if (MediaRecorder.isTypeSupported(mt)) return mt;
    }
    return undefined;
  }

  // ── Live preview entrypoint ──────────────────────────────────────────────
  // Native plugin first on Capacitor; Web Speech for web browsers.
  async function startLivePreview() {
    if (typeof window !== "undefined") {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (Capacitor.isNativePlatform()) {
          const ok = await startNativeLivePreview();
          if (ok) return;
        }
      } catch (err) {
        console.warn("[conversation] Capacitor probe failed:", err);
      }
    }
    startWebSpeechPreview();
  }

  async function startNativeLivePreview(): Promise<boolean> {
    try {
      const { SpeechRecognition: NativeSR } = await import(
        "@capacitor-community/speech-recognition"
      );
      const availability = await NativeSR.available();
      if (!availability.available) return false;

      const perms = await NativeSR.checkPermissions();
      if (perms.speechRecognition !== "granted") {
        const req = await NativeSR.requestPermissions();
        if (req.speechRecognition !== "granted") return true;
      }

      const partial = await NativeSR.addListener(
        "partialResults",
        (data: { matches?: string[] }) => {
          const text = (data?.matches?.[0] ?? "").trim();
          if (text) setLivePartialSync(text);
        }
      );
      nativePartialListenerRef.current = partial;

      const stateListener = await NativeSR.addListener(
        "listeningState",
        async (data: { status?: string }) => {
          if (data?.status === "stopped" && recordingRef.current) {
            try {
              await NativeSR.start({
                language: speechLocale,
                maxResults: 1,
                partialResults: true,
                popup: false,
                prompt: "",
              });
            } catch (err) {
              console.warn("[conversation] native auto-restart failed:", err);
            }
          }
        }
      );
      nativeStateListenerRef.current = stateListener;

      await NativeSR.start({
        language: speechLocale,
        maxResults: 1,
        partialResults: true,
        popup: false,
        prompt: "",
      });
      nativeActiveRef.current = true;
      return true;
    } catch (err) {
      console.warn("[conversation] native plugin path failed:", err);
      try { await nativePartialListenerRef.current?.remove(); } catch {}
      try { await nativeStateListenerRef.current?.remove(); } catch {}
      nativePartialListenerRef.current = null;
      nativeStateListenerRef.current = null;
      return false;
    }
  }

  async function stopNativeLivePreview() {
    try { await nativePartialListenerRef.current?.remove(); } catch {}
    try { await nativeStateListenerRef.current?.remove(); } catch {}
    nativePartialListenerRef.current = null;
    nativeStateListenerRef.current = null;
    if (!nativeActiveRef.current) return;
    nativeActiveRef.current = false;
    try {
      const { SpeechRecognition: NativeSR } = await import(
        "@capacitor-community/speech-recognition"
      );
      await NativeSR.stop();
    } catch (err) {
      console.warn("[conversation] native stop failed:", err);
    }
  }

  // ── Web Speech fallback (desktop browsers) ──────────────────────────────
  function startWebSpeechPreview() {
    if (typeof window === "undefined") return;
    const SR =
      (window as typeof window & { SpeechRecognition?: typeof SpeechRecognition })
        .SpeechRecognition ??
      (window as typeof window & {
        webkitSpeechRecognition?: typeof SpeechRecognition;
      }).webkitSpeechRecognition;
    if (!SR) return;

    finalsRef.current = [];
    let recognition: SpeechRecognition;
    try {
      recognition = new SR();
    } catch {
      return;
    }
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = speechLocale;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      // Accumulate finalized segments into finalsRef; recompute the
      // currently-displayed string as `finals + " " + interim`.
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
      const combined =
        finals && interim ? finals + " " + interim : finals || interim;
      setLivePartialSync(combined);
    };

    recognition.onerror = () => {
      // Silent: live preview is best-effort. Audio capture continues regardless.
    };
    recognition.onend = () => {
      // Web Speech can end on silence — we DON'T auto-restart. MediaRecorder
      // is still capturing, and the final Gemini transcript will be correct.
    };

    speechRecognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      // Already started or unsupported state — give up silently.
    }
  }

  function stopLivePreview() {
    recordingRef.current = false;
    try {
      speechRecognitionRef.current?.abort();
    } catch {}
    speechRecognitionRef.current = null;
    void stopNativeLivePreview();
  }

  function teardownRecorder() {
    audioStreamRef.current?.getTracks().forEach((track) => track.stop());
    audioStreamRef.current = null;
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
    if (maxDurationTimerRef.current) {
      clearTimeout(maxDurationTimerRef.current);
      maxDurationTimerRef.current = null;
    }
  }

  async function startRecording() {
    setDuration(0);
    setLivePartialSync("");
    audioChunksRef.current = [];

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      console.error("[recorder] getUserMedia failed:", err);
      toast({
        title: t("meet.mic_denied_title"),
        description: t("meet.mic_denied_body"),
        variant: "destructive",
      });
      return;
    }
    audioStreamRef.current = stream;

    const mimeType = pickMimeType();
    let recorder: MediaRecorder;
    try {
      recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    } catch (err) {
      console.error("[recorder] MediaRecorder ctor failed:", err);
      teardownRecorder();
      toast({
        title: t("meet.not_supported_title"),
        description: t("meet.not_supported_body"),
        variant: "destructive",
      });
      return;
    }
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e: BlobEvent) => {
      if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(audioChunksRef.current, {
        type: recorder.mimeType || "audio/webm",
      });
      audioChunksRef.current = [];
      teardownRecorder();
      // Fire off transcription. We don't await here — onstop is a DOM event handler.
      void transcribeBlob(blob);
    };

    recorder.onerror = (e) => {
      console.error("[recorder] error:", e);
      setRecording(false);
      teardownRecorder();
    };

    try {
      // Collect chunks every 1s so the final blob is built incrementally and we
      // don't lose anything if the page is force-closed.
      recorder.start(1000);
    } catch (err) {
      console.error("[recorder] start failed:", err);
      teardownRecorder();
      return;
    }
    setRecording(true);
    recordingRef.current = true;

    // Best-effort live transcript. Async because the native plugin is loaded
    // dynamically on Capacitor; we don't block startRecording on it.
    void startLivePreview();

    // Tick the duration counter once per second.
    durationTimerRef.current = setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);

    // Safety auto-stop.
    maxDurationTimerRef.current = setTimeout(() => {
      if (mediaRecorderRef.current?.state === "recording") {
        toast({
          title: ko ? "녹음 시간 제한 도달" : "Recording limit reached",
          description: ko
            ? `최대 ${MAX_RECORDING_SECONDS}초까지 녹음할 수 있습니다.`
            : `Recordings are capped at ${MAX_RECORDING_SECONDS} seconds.`,
        });
        stopRecording();
      }
    }, MAX_RECORDING_SECONDS * 1000);
  }

  function stopRecording() {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    // Stop the live-preview recognizer first — we keep the last livePartial
    // visible in italic while Gemini finalizes the real transcript. The
    // transcribeBlob success path clears it; the failure path keeps it as
    // a fallback so the user isn't left empty-handed.
    stopLivePreview();
    try {
      recorder.stop();
    } catch (err) {
      console.error("[recorder] stop failed:", err);
    }
    setRecording(false);
  }

  async function transcribeBlob(blob: Blob) {
    if (blob.size === 0) return;
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

    try {
      const res = await fetch("/api/ai/transcribe", {
        method: "POST",
        body: form,
      });
      const json = await res.json();
      if (res.status === 403 && json?.error === "consent_required") {
        // Consent was revoked elsewhere — re-prompt rather than show a raw error.
        void ensureConsent(true);
        return;
      }
      if (!res.ok || json.error) {
        throw new Error(json.error ?? "Transcription failed");
      }
      const newText: string = (json.data?.text ?? "").trim();
      if (newText) {
        setText((prev) => {
          const joined = prev ? prev.trimEnd() + " " + newText : newText;
          return joined.slice(0, 4000);
        });
        // Gemini's transcript is now in `text`. Drop the live preview.
        setLivePartialSync("");
        finalsRef.current = [];
      } else {
        toast({
          title: ko ? "음성을 인식하지 못했어요" : "Couldn't hear anything",
          description: ko
            ? "다시 시도하거나 직접 입력해 주세요."
            : "Try again or type your note instead.",
        });
        // Empty Gemini result — promote the Web-Speech preview as a fallback
        // so the user isn't left staring at nothing.
        const fallback = livePartialRef.current.trim();
        if (fallback) {
          setText((prev) => {
            const joined = prev ? prev.trimEnd() + " " + fallback : fallback;
            return joined.slice(0, 4000);
          });
        }
        setLivePartialSync("");
        finalsRef.current = [];
      }
    } catch (err: unknown) {
      console.error("[transcribe] failed:", err);
      // Failure path: promote the Web-Speech preview into the text field so
      // the recording isn't completely lost. User can edit and submit.
      const fallback = livePartialRef.current.trim();
      if (fallback) {
        setText((prev) => {
          const joined = prev ? prev.trimEnd() + " " + fallback : fallback;
          return joined.slice(0, 4000);
        });
      }
      setLivePartialSync("");
      finalsRef.current = [];
      toast({
        title: ko ? "음성 인식 실패" : "Transcription failed",
        description: err instanceof Error ? err.message : t("meet.something_wrong"),
        variant: "destructive",
      });
    } finally {
      setTranscribing(false);
    }
  }

  async function toggleVoice() {
    if (!online) return; // logging needs the network; mic is disabled offline
    if (recording) {
      stopRecording();
      return;
    }
    // Recording sends audio to Gemini for transcription — gate on AI consent.
    if (!(await ensureConsent())) return;
    void startRecording();
  }

  // ── Submit: person mode uses notes API; general mode uses extract API ────
  async function handleSubmit() {
    // If a recording is still going, stop it first so its transcription kicks
    // off. We don't auto-submit after — the user gets a chance to see what was
    // transcribed and tap submit again.
    if (recording) {
      stopRecording();
      return;
    }
    // If a transcription is still in flight, ask the user to wait.
    if (transcribing) {
      toast({
        title: ko ? "잠시만요" : "Just a moment",
        description: ko
          ? "음성을 텍스트로 변환 중입니다..."
          : "Still transcribing your audio...",
      });
      return;
    }

    const fullText = text.trim();
    if (!fullText) return;

    // Submitting sends the text to Gemini (extract / notes) — gate on consent.
    if (!(await ensureConsent())) return;

    setStep("loading");

    try {
      if (isPerson) {
        const res = await fetch(`/api/people/${personId}/notes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: fullText, logMeeting }),
        });
        const json = await res.json();
        if (res.status === 403 && json.error === "consent_required") {
          setStep("input");
          void ensureConsent(true);
          return;
        }
        if (!res.ok || json.error)
          throw new Error(json.error ?? t("meet.extraction_failed"));

        // Cache the updated person so their profile (and the home list) reflect
        // the new info immediately, not after a stale router.refresh().
        if (json.data?.person) await cachePerson(json.data.person);

        setStep("success");
        setTimeout(() => {
          router.push(`/people/${personId}`);
          router.refresh();
        }, 1200);
      } else {
        const res = await fetch("/api/ai/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: fullText }),
        });
        const json = await res.json();
        if (res.status === 403 && json.error === "consent_required") {
          setStep("input");
          void ensureConsent(true);
          return;
        }
        if (!res.ok || json.error)
          throw new Error(json.error ?? t("meet.extraction_failed"));

        setPreview(json.data);
        setStep("success");
        setTimeout(() => setStep("preview"), 1200);
      }
    } catch (err: unknown) {
      toast({
        title: t("meet.extraction_failed"),
        description: err instanceof Error ? err.message : t("meet.something_wrong"),
        variant: "destructive",
      });
      setStep("input");
    }
  }

  function handleViewPerson(id: string) {
    router.push(`/people/${id}`);
  }

  function handleViewAll() {
    router.push("/");
  }

  function handleStartOver() {
    setText("");
    setPreview(null);
    setStep("input");
  }

  // Logging needs the network (audio → Gemini transcription + extraction). We
  // keep the normal Meet UI offline and only show the mic turned off — disabled
  // and crossed out (see micDisabled + the mic icon below).

  // ── LOADING ─────────────────────────────────────────────────────────────
  if (step === "loading") {
    return (
      <AiLoadingState
        title={t("meet.loading_title")}
        subtitle={t("meet.loading_subtitle")}
      />
    );
  }

  // ── SUCCESS ─────────────────────────────────────────────────────────────
  if (step === "success") {
    return <AiSuccessState label={t("meet.saved")} />;
  }

  // ── PREVIEW (general mode only) ─────────────────────────────────────────
  if (step === "preview" && preview) {
    return (
      <div className="space-y-4">
        <p
          className="text-[13px] text-center"
          style={{ color: "#5e7983", fontFamily: "'Hammersmith One', sans-serif" }}
        >
          {ko
            ? `${preview.extraction.people.length}${t("meet.found_people")}을 찾았어요 — ${t("meet.found_all_saved")}`
            : `Found ${preview.extraction.people.length} ${preview.extraction.people.length === 1 ? "person" : "people"} — ${t("meet.found_all_saved")}`
          }
        </p>

        {preview.extraction.people.map((person: ExtractedPerson, idx: number) => {
          const id = preview.personIds[idx];
          return (
            // The card is a <button> (HTML forbids nesting buttons), so the
            // groups affordance is a sibling row below it.
            <div key={idx}>
              <button
                onClick={() => handleViewPerson(id)}
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
                        {localizeKey(attr.key, language)}: {attr.value}
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
              <div className="flex justify-end mt-1">
                <button
                  type="button"
                  onClick={() => setGroupsFor({ id, name: person.name })}
                  className="inline-flex items-center gap-1 text-[12px] px-1 py-0.5 transition-opacity active:opacity-70"
                  style={{ color: "#482d7c" }}
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                  {t("groups.add_to")}
                </button>
              </div>
            </div>
          );
        })}

        {groupsFor && (
          <GroupPickerSheet
            open
            onOpenChange={(o) => !o && setGroupsFor(null)}
            personId={groupsFor.id}
            personName={groupsFor.name}
            initialGroupIds={[]}
          />
        )}

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

  // ── INPUT ────────────────────────────────────────────────────────────────
  const micDisabled = isLoading || transcribing || !online;
  const showSubmit = text.trim().length > 0 && !recording && !transcribing;

  return (
    <div className="flex flex-col min-h-[calc(100vh-200px)]">

      {/* General mode: Speak / Write mode switch */}
      {!isPerson && <MeetModeToggle active="speak" />}

      {/* Person mode: back link + person name banner */}
      {isPerson && (
        <div className="mb-2 space-y-3">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1 text-sm transition-opacity hover:opacity-70"
            style={{ color: "#284e72" }}
          >
            <ArrowLeft className="w-4 h-4" />
            {ko ? "뒤로" : "Back"}
          </button>
          <div
            className="px-4 py-3 rounded-[10px_2px_10px_2px]"
            style={{ background: "linear-gradient(52deg, #d0f2ff 0%, #dccaff 100%)" }}
          >
            <p className="text-[11px] uppercase tracking-wide mb-0.5" style={{ color: "#5e7983", fontFamily: "'Hammersmith One', sans-serif" }}>
              {ko ? "대상" : "Adding details for"}
            </p>
            <p className="text-[22px] text-black" style={{ fontFamily: "'Hammersmith One', sans-serif" }}>
              {personName}
            </p>
          </div>
        </div>
      )}

      {/* Instruction text */}
      <p
        className="text-[13px] leading-relaxed text-center px-2"
        style={{ color: "#5e7983", fontFamily: "'Hammersmith One', sans-serif" }}
      >
        {isPerson
          ? (ko
              ? `${personName}에 대해 새로운 정보를 말하거나 입력하세요.`
              : `Speak or type anything new about ${personName}.`)
          : t("meet.instruction")
        }
      </p>

      {/* Big circle mic button */}
      <div className="flex flex-col items-center justify-center flex-1 gap-5 py-10">
        <div className="relative">
          {recording && (
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

          <button
            type="button"
            onClick={toggleVoice}
            disabled={micDisabled}
            aria-label={recording ? "Stop recording" : "Tap to speak"}
            className={cn(
              "relative w-32 h-32 rounded-full p-[3px] transition-transform active:scale-95 focus:outline-none shadow-lg",
              micDisabled && "opacity-60"
            )}
            style={{
              background: "linear-gradient(135deg, #00d4f7, #c84b8a, #482d7c)",
            }}
          >
            <div
              className="w-full h-full rounded-full flex items-center justify-center"
              style={{
                backgroundColor: recording ? "transparent" : "#fbf6ff",
              }}
            >
              {transcribing ? (
                <Loader2 className="w-10 h-10 text-white animate-spin" />
              ) : recording ? (
                <MicOff className="w-10 h-10 text-white" />
              ) : !online ? (
                <MicOff className="w-10 h-10" style={{ color: "#9aa7b0" }} />
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
          {transcribing
            ? (ko ? "변환 중..." : "Transcribing...")
            : recording
              ? `${ko ? "녹음 중" : "Recording"} ${formatDuration(duration)}`
              : !online
                ? "" // offline: mic is shown turned off; no prompt label
                : t("meet.tap_to_speak")}
        </p>

        {/* Hint while recording — explain auto-stop */}
        {recording && (
          <p
            className="text-[11px] text-center -mt-3"
            style={{ color: "#7a6b95" }}
          >
            {ko
              ? `다시 누르면 멈춥니다 · ${MAX_RECORDING_SECONDS}초 후 자동 종료`
              : `Tap mic to stop · auto-stops at ${MAX_RECORDING_SECONDS}s`}
          </p>
        )}

        {/* Transcript display — committed text + in-flight live partial */}
        {(text || livePartial) && (
          <div
            className="relative w-full rounded-[10px_2px_10px_2px] p-4"
            style={{ backgroundColor: "#f0e8ff", border: "1px solid #dccaff" }}
          >
            <p className="text-sm leading-relaxed text-gray-800 pr-8">
              {text}
              {text && livePartial && " "}
              {livePartial && (
                <span className="italic" style={{ color: "#7a6b95" }}>
                  {livePartial}
                </span>
              )}
            </p>
            <button
              type="button"
              onClick={() => {
                setText("");
                setLivePartialSync("");
                finalsRef.current = [];
              }}
              aria-label="Clear transcript"
              className="absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center text-muted-foreground hover:text-gray-700 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Meeting type toggle — person mode only */}
        {isPerson && !recording && !transcribing && (
          <div className="flex items-center gap-1 p-1 rounded-lg w-fit mx-auto" style={{ backgroundColor: "rgba(220,202,255,0.3)" }}>
            <button
              type="button"
              onClick={() => setLogMeeting(true)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                logMeeting
                  ? "text-white"
                  : "text-[#5e7983]"
              )}
              style={logMeeting ? { background: "linear-gradient(to right, #284e72, #482d7c)" } : {}}
            >
              {t("meet.log_type_met")}
            </button>
            <button
              type="button"
              onClick={() => setLogMeeting(false)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                !logMeeting
                  ? "text-white"
                  : "text-[#5e7983]"
              )}
              style={!logMeeting ? { background: "linear-gradient(to right, #284e72, #482d7c)" } : {}}
            >
              {t("meet.log_type_details")}
            </button>
          </div>
        )}

        {/* Submit button */}
        {showSubmit && (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isLoading}
            className="w-full h-12 rounded-[10px_2px_10px_2px] text-white flex items-center justify-center gap-2 transition-opacity active:opacity-80"
            style={{ background: "linear-gradient(to right, #284e72, #482d7c)" }}
          >
            <Sparkles className="w-4 h-4" />
            <span style={{ fontFamily: "'Hammersmith One', sans-serif" }}>
              {isPerson
                ? (ko ? "저장하기" : `SAVE FOR ${personName!.split(" ")[0].toUpperCase()}`)
                : t("meet.extract_save")
              }
            </span>
          </button>
        )}
      </div>

      {/* TIP section — bottom (general mode only) */}
      {!isPerson && (
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
      )}
    </div>
  );
}
