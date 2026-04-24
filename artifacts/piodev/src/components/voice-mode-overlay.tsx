import { useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Mic, MicOff, Loader2 } from "lucide-react";
import { useVoiceMode, stripMarkdownForSpeech } from "@/hooks/use-voice-mode";
import { cn } from "@/lib/utils";

interface ChatMessage {
  id: string;
  role: "user" | "ai";
  content: string;
}

interface ActiveChat {
  id: string;
  messages: ChatMessage[];
}

interface VoiceModeOverlayProps {
  open: boolean;
  onClose: () => void;
  sendMessage: (
    content: string,
    imageUrls?: string[],
    fileDatas?: { name: string; content: string }[],
    options?: { webSearch?: boolean; thinking?: boolean; imageGen?: boolean; modelTier?: "plus" | "mini" | "coder"; voiceMode?: boolean },
  ) => Promise<void> | void;
  activeChat: ActiveChat | null | undefined;
  isTyping: boolean;
  modelTier: "plus" | "mini" | "coder";
  voice?: string;
}

// Pisahin kalimat: berakhir dengan .!? + whitespace/EOL, ATAU newline.
// Negatif lookbehind buat skip "2.0", "v1.5", angka desimal, dll.
const SENTENCE_RE = /[^.!?。！？\n]+?(?:[.!?。！？]+(?=\s|$)|[\n]+)/gs;

// Cek apakah teks layak diucapkan (ada huruf/angka cukup, bukan emoji/symbol doang)
function isSpeakable(text: string): boolean {
  const cleaned = text.trim();
  if (!cleaned) return false;
  const letters = cleaned.match(/[A-Za-z\u00C0-\u024F\u1E00-\u1EFF]/g) || [];
  if (letters.length < 2) return false;
  return true;
}

export function VoiceModeOverlay({
  open,
  onClose,
  sendMessage,
  activeChat,
  isTyping,
  modelTier,
  voice,
}: VoiceModeOverlayProps) {
  const lastAiMsgIdRef = useRef<string | null>(null);
  const lastSentLengthRef = useRef(0);

  const handleUserUtterance = useCallback(
    (text: string) => {
      sendMessage(text, undefined, undefined, { modelTier, voiceMode: true });
    },
    [sendMessage, modelTier],
  );

  const vm = useVoiceMode({
    voice,
    language: "id-ID",
    onUserUtterance: handleUserUtterance,
  });

  const { state, level, error, micMuted, toggleMute, aiSubtitle, userSubtitle, start, end, enqueueAiSentence, finishAiTurn } = vm;

  // Open / close session
  useEffect(() => {
    if (open) {
      // Skip current last AI message (don't re-speak history)
      const last = activeChat?.messages?.at(-1);
      if (last?.role === "ai") {
        lastAiMsgIdRef.current = last.id;
        lastSentLengthRef.current = last.content.length;
      } else {
        lastAiMsgIdRef.current = null;
        lastSentLengthRef.current = 0;
      }
      start();
    } else {
      end();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Stream AI message → enqueue complete sentences as they arrive
  const lastAiContent = activeChat?.messages?.at(-1)?.role === "ai"
    ? activeChat?.messages?.at(-1)?.content || ""
    : "";
  const lastAiId = activeChat?.messages?.at(-1)?.role === "ai"
    ? activeChat?.messages?.at(-1)?.id || null
    : null;

  useEffect(() => {
    if (!open) return;
    if (!lastAiId) return;
    if (lastAiId !== lastAiMsgIdRef.current) {
      lastAiMsgIdRef.current = lastAiId;
      lastSentLengthRef.current = 0;
    }
    const content = lastAiContent;
    SENTENCE_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = SENTENCE_RE.exec(content)) !== null) {
      const end = m.index + m[0].length;
      if (end > lastSentLengthRef.current) {
        const raw = content.slice(lastSentLengthRef.current, end);
        const cleaned = stripMarkdownForSpeech(raw);
        if (cleaned && isSpeakable(cleaned)) {
          console.log("[VoiceMode] enqueue sentence:", cleaned.slice(0, 80));
          enqueueAiSentence(cleaned);
        }
        lastSentLengthRef.current = end;
      }
    }
  }, [open, lastAiId, lastAiContent, enqueueAiSentence]);

  // When AI done typing → flush remaining tail and finish turn
  useEffect(() => {
    if (!open) return;
    if (isTyping) return;
    if (!lastAiId) return;
    if (lastAiId !== lastAiMsgIdRef.current) return;
    const remaining = lastAiContent.slice(lastSentLengthRef.current);
    const cleaned = stripMarkdownForSpeech(remaining);
    if (cleaned && isSpeakable(cleaned)) {
      console.log("[VoiceMode] enqueue tail:", cleaned.slice(0, 80));
      enqueueAiSentence(cleaned);
    }
    lastSentLengthRef.current = lastAiContent.length;
    finishAiTurn();
  }, [open, isTyping, lastAiId, lastAiContent, enqueueAiSentence, finishAiTurn]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Status label
  let statusText = "";
  switch (state) {
    case "connecting":
      statusText = "Menyambungkan…";
      break;
    case "listening":
      statusText = micMuted ? "Mic mati" : "Mendengarkan…";
      break;
    case "userSpeaking":
      statusText = "Lanjut, aku dengerin…";
      break;
    case "processing":
      statusText = "Mikir…";
      break;
    case "aiSpeaking":
      statusText = "Pio lagi ngomong…";
      break;
    case "error":
      statusText = error || "Ada error";
      break;
    default:
      statusText = "";
  }

  // Orb scale animation
  const baseScale = state === "userSpeaking" ? 1 + level * 0.6 : state === "aiSpeaking" ? 1.05 : 1;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-between bg-gradient-to-b from-background via-background to-muted/40 backdrop-blur-xl px-6 py-10"
        >
          {/* Top: header */}
          <div className="flex items-center justify-between w-full max-w-2xl">
            <div className="text-sm font-medium text-muted-foreground">
              Voice Mode
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-muted transition-colors"
              title="Tutup voice mode"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Center: orb */}
          <div className="flex flex-col items-center gap-8 flex-1 justify-center">
            <div className="relative w-64 h-64 flex items-center justify-center">
              {/* Outer pulse rings */}
              {(state === "listening" || state === "userSpeaking" || state === "aiSpeaking") && (
                <>
                  <motion.div
                    className="absolute inset-0 rounded-full bg-primary/10"
                    animate={{
                      scale: [1, 1.4, 1.4],
                      opacity: [0.4, 0, 0],
                    }}
                    transition={{
                      duration: 2.4,
                      repeat: Infinity,
                      ease: "easeOut",
                    }}
                  />
                  <motion.div
                    className="absolute inset-0 rounded-full bg-primary/10"
                    animate={{
                      scale: [1, 1.4, 1.4],
                      opacity: [0.4, 0, 0],
                    }}
                    transition={{
                      duration: 2.4,
                      repeat: Infinity,
                      ease: "easeOut",
                      delay: 1.2,
                    }}
                  />
                </>
              )}

              {/* Main orb */}
              <motion.div
                animate={{
                  scale: baseScale,
                }}
                transition={{ duration: 0.08, ease: "linear" }}
                className={cn(
                  "relative w-48 h-48 rounded-full overflow-hidden shadow-2xl",
                  "bg-gradient-to-br from-primary via-primary/80 to-primary/40",
                )}
                style={{
                  boxShadow: `0 0 ${40 + level * 80}px ${10 + level * 30}px hsl(var(--primary) / 0.35)`,
                }}
              >
                {/* AI speaking: rotating shimmer */}
                {state === "aiSpeaking" && (
                  <motion.div
                    className="absolute inset-0 rounded-full"
                    style={{
                      background:
                        "conic-gradient(from 0deg, transparent, hsl(var(--primary-foreground) / 0.4), transparent)",
                    }}
                    animate={{ rotate: 360 }}
                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                  />
                )}
                {/* Processing: shimmer */}
                {state === "processing" && (
                  <motion.div
                    className="absolute inset-0 rounded-full"
                    style={{
                      background:
                        "conic-gradient(from 0deg, transparent, hsl(var(--primary-foreground) / 0.5), transparent)",
                    }}
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
                  />
                )}
                {/* Idle/listening: subtle breathing */}
                {(state === "listening" || state === "idle") && (
                  <motion.div
                    className="absolute inset-0 rounded-full bg-primary-foreground/10"
                    animate={{ opacity: [0.1, 0.3, 0.1] }}
                    transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
                  />
                )}
                {/* Inner highlight */}
                <div className="absolute top-4 left-6 w-16 h-16 rounded-full bg-primary-foreground/20 blur-xl" />
              </motion.div>

              {/* Connecting spinner */}
              {state === "connecting" && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="w-10 h-10 animate-spin text-primary-foreground" />
                </div>
              )}
            </div>

            {/* Status text */}
            <div className="text-center min-h-[3rem]">
              <div className="text-base font-medium text-foreground">
                {statusText}
              </div>
              {state === "error" && (
                <button
                  onClick={() => start()}
                  className="mt-2 text-xs text-primary underline"
                >
                  Coba lagi
                </button>
              )}
            </div>

            {/* Subtitles */}
            <div className="w-full max-w-md space-y-2 min-h-[4rem]">
              {userSubtitle && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 0.7, y: 0 }}
                  className="text-sm text-muted-foreground italic text-center"
                >
                  "{userSubtitle}"
                </motion.div>
              )}
              {aiSubtitle && (state === "aiSpeaking" || state === "processing") && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-sm text-foreground/80 text-center leading-relaxed line-clamp-3"
                >
                  {aiSubtitle.slice(-220)}
                </motion.div>
              )}
            </div>
          </div>

          {/* Bottom: controls */}
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={toggleMute}
              className={cn(
                "w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-md",
                micMuted
                  ? "bg-muted text-muted-foreground hover:bg-muted/80"
                  : "bg-card text-foreground hover:bg-muted border border-border",
              )}
              title={micMuted ? "Aktifkan mic" : "Matikan mic"}
            >
              {micMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            <button
              onClick={onClose}
              className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-all shadow-lg shadow-red-500/30"
              title="Akhiri voice mode"
            >
              <X className="w-7 h-7" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
