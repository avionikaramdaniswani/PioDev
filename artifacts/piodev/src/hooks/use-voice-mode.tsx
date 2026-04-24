import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

export type VoiceModeState =
  | "idle"
  | "connecting"
  | "listening"
  | "userSpeaking"
  | "processing"
  | "aiSpeaking"
  | "error";

interface UseVoiceModeOpts {
  language?: string;
  voice?: string;
  onUserUtterance: (text: string) => void;
}

const TARGET_RATE = 16000;
const BUFFER_SECONDS = 30;
const PREROLL_MS = 400;

function downsampleTo16k(input: Float32Array, inRate: number): Float32Array {
  if (inRate === TARGET_RATE) return input;
  const ratio = inRate / TARGET_RATE;
  const outLen = Math.floor(input.length / ratio);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.floor((i + 1) * ratio);
    let sum = 0;
    let count = 0;
    for (let j = start; j < end && j < input.length; j++) {
      sum += input[j];
      count++;
    }
    out[i] = count > 0 ? sum / count : 0;
  }
  return out;
}

function encodeWavPcm16(samples: Float32Array, sampleRate: number): Blob {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buf);
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, samples.length * 2, true);
  let off = 44;
  for (let i = 0; i < samples.length; i++, off += 2) {
    let s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buf], { type: "audio/wav" });
}

export function useVoiceMode(opts: UseVoiceModeOpts) {
  const [state, setStateRaw] = useState<VoiceModeState>("idle");
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [micMuted, setMicMuted] = useState(false);
  const [aiSubtitle, setAiSubtitle] = useState("");
  const [userSubtitle, setUserSubtitle] = useState("");

  const stateRef = useRef<VoiceModeState>("idle");
  const setState = useCallback((s: VoiceModeState) => {
    stateRef.current = s;
    setStateRaw(s);
  }, []);

  const micMutedRef = useRef(false);
  useEffect(() => {
    micMutedRef.current = micMuted;
  }, [micMuted]);

  const optsRef = useRef(opts);
  useEffect(() => {
    optsRef.current = opts;
  }, [opts]);

  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const procRef = useRef<ScriptProcessorNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const rafRef = useRef<number | null>(null);

  // Circular PCM buffer
  const pcmBufRef = useRef<Float32Array | null>(null);
  const pcmWriteIdxRef = useRef(0);
  const pcmTotalRef = useRef(0); // monotonic count of samples ever written
  const pcmRateRef = useRef(48000);
  const pcmBufLenRef = useRef(0);

  const speechStartTotalRef = useRef(0);
  const speakingStartRef = useRef<number>(0);
  const silenceStartRef = useRef<number>(0);
  const speakingRef = useRef(false);

  const aiTurnRef = useRef(false);
  const aiTurnDoneRef = useRef(false);
  type TtsItem = { text: string; bufPromise: Promise<AudioBuffer | null> };
  const ttsQueueRef = useRef<TtsItem[]>([]);
  const ttsPlayingRef = useRef(false);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const ttsGainRef = useRef<GainNode | null>(null);

  const cleanup = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (procRef.current) {
      try {
        procRef.current.disconnect();
        procRef.current.onaudioprocess = null as any;
      } catch {}
      procRef.current = null;
    }
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.disconnect(); } catch {}
      sourceNodeRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    analyserRef.current = null;
    pcmBufRef.current = null;
    pcmWriteIdxRef.current = 0;
    pcmTotalRef.current = 0;
    if (currentSourceRef.current) {
      try {
        currentSourceRef.current.onended = null as any;
        currentSourceRef.current.stop();
        currentSourceRef.current.disconnect();
      } catch {}
      currentSourceRef.current = null;
    }
    ttsGainRef.current = null;
    ttsQueueRef.current = [];
    ttsPlayingRef.current = false;
    aiTurnRef.current = false;
    aiTurnDoneRef.current = false;
    speakingRef.current = false;
    silenceStartRef.current = 0;
    setLevel(0);
  }, []);

  const cancelAiPlayback = useCallback(() => {
    if (currentSourceRef.current) {
      try {
        currentSourceRef.current.onended = null as any;
        currentSourceRef.current.stop();
        currentSourceRef.current.disconnect();
      } catch {}
      currentSourceRef.current = null;
    }
    ttsQueueRef.current = [];
    ttsPlayingRef.current = false;
    aiTurnRef.current = false;
    aiTurnDoneRef.current = false;
  }, []);

  const fetchAndDecodeTts = useCallback(async (text: string): Promise<AudioBuffer | null> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const r = await fetch("/api/voice/synthesize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ text, voice: optsRef.current.voice }),
      });
      if (!r.ok) {
        const errBody = await r.text().catch(() => "");
        console.warn("[VoiceMode] TTS HTTP error", r.status, errBody.slice(0, 200));
        return null;
      }
      const arrayBuf = await r.arrayBuffer();
      const ctx = audioCtxRef.current;
      if (!ctx) return null;
      if (ctx.state === "suspended") {
        try { await ctx.resume(); } catch {}
      }
      return await ctx.decodeAudioData(arrayBuf.slice(0));
    } catch (err) {
      console.warn("[VoiceMode] TTS fetch/decode error:", err);
      return null;
    }
  }, []);

  const pumpTts = useCallback(async () => {
    if (ttsPlayingRef.current) return;
    const next = ttsQueueRef.current.shift();
    if (!next) {
      if (aiTurnDoneRef.current && aiTurnRef.current) {
        aiTurnRef.current = false;
        aiTurnDoneRef.current = false;
        if (
          stateRef.current === "aiSpeaking" ||
          stateRef.current === "processing"
        ) {
          setState("listening");
        }
      }
      return;
    }
    ttsPlayingRef.current = true;
    if (stateRef.current !== "aiSpeaking") setState("aiSpeaking");
    console.log("[VoiceMode] TTS speak:", next.text.slice(0, 60));
    const audioBuffer = await next.bufPromise;
    const ctx = audioCtxRef.current;
    if (!audioBuffer || !ctx) {
      ttsPlayingRef.current = false;
      pumpTts();
      return;
    }
    try {
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      if (!ttsGainRef.current) {
        const gain = ctx.createGain();
        gain.gain.value = 1.0;
        gain.connect(ctx.destination);
        ttsGainRef.current = gain;
      }
      source.connect(ttsGainRef.current);
      currentSourceRef.current = source;
      source.onended = () => {
        if (currentSourceRef.current === source) {
          try { source.disconnect(); } catch {}
          currentSourceRef.current = null;
        }
        ttsPlayingRef.current = false;
        pumpTts();
      };
      source.start(0);
    } catch (err) {
      console.warn("[VoiceMode] TTS playback exception:", err);
      ttsPlayingRef.current = false;
      pumpTts();
    }
  }, [setState]);

  const extractSpeechSegment = useCallback((): Float32Array => {
    const buf = pcmBufRef.current;
    if (!buf) return new Float32Array(0);
    const bufLen = pcmBufLenRef.current;
    const total = pcmTotalRef.current;
    const prerollSamples = Math.floor((PREROLL_MS / 1000) * pcmRateRef.current);
    const startTotal = Math.max(0, speechStartTotalRef.current - prerollSamples);
    const endTotal = total;
    const length = Math.min(endTotal - startTotal, bufLen);
    if (length <= 0) return new Float32Array(0);
    const startIdx = ((startTotal % bufLen) + bufLen) % bufLen;
    const out = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      out[i] = buf[(startIdx + i) % bufLen];
    }
    return out;
  }, []);

  const finishUserUtterance = useCallback(() => {
    setState("processing");
    speakingRef.current = false;
    silenceStartRef.current = 0;

    const native = extractSpeechSegment();
    const durationMs = (native.length / pcmRateRef.current) * 1000;
    console.log("[VoiceMode] captured PCM samples:", native.length, "≈" + durationMs.toFixed(0) + "ms @" + pcmRateRef.current + "Hz");
    if (native.length < pcmRateRef.current * 0.2) {
      console.log("[VoiceMode] segment too short, back to listening");
      setState("listening");
      return;
    }

    (async () => {
      try {
        const downsampled = downsampleTo16k(native, pcmRateRef.current);
        const wav = encodeWavPcm16(downsampled, TARGET_RATE);
        console.log("[VoiceMode] WAV size:", wav.size, "bytes");

        const fd = new FormData();
        fd.append("audio", wav, "voice.wav");
        fd.append("language", optsRef.current.language || "id-ID");
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = session?.access_token;
        const r = await fetch("/api/voice/transcribe", {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: fd,
        });
        console.log("[VoiceMode] STT HTTP", r.status);
        if (!r.ok) {
          const errBody = await r.text().catch(() => "");
          console.warn("[VoiceMode] STT error body:", errBody.slice(0, 200));
          setError("Transkripsi gagal");
          setState("listening");
          return;
        }
        const data = await r.json();
        const text = (data?.text as string) || "";
        console.log("[VoiceMode] STT text:", JSON.stringify(text), "raw=", data?.raw);
        if (!text.trim()) {
          setError("Suara tidak terdengar, coba ngomong lebih jelas");
          setState("listening");
          return;
        }
        setError(null);
        setUserSubtitle(text);
        setAiSubtitle("");
        aiTurnRef.current = true;
        aiTurnDoneRef.current = false;
        ttsQueueRef.current = [];
        console.log("[VoiceMode] calling onUserUtterance with:", text);
        optsRef.current.onUserUtterance(text);
      } catch (err) {
        console.warn("[VoiceMode] STT exception:", err);
        setState("listening");
      }
    })();
  }, [setState, extractSpeechSegment]);

  const start = useCallback(async () => {
    setError(null);
    setState("connecting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AC();
      audioCtxRef.current = ctx;
      const sampleRate = ctx.sampleRate;
      pcmRateRef.current = sampleRate;

      // Allocate circular PCM buffer
      const bufLen = sampleRate * BUFFER_SECONDS;
      pcmBufRef.current = new Float32Array(bufLen);
      pcmBufLenRef.current = bufLen;
      pcmWriteIdxRef.current = 0;
      pcmTotalRef.current = 0;

      const source = ctx.createMediaStreamSource(stream);
      sourceNodeRef.current = source;

      // Analyser for VAD level
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      analyserRef.current = analyser;
      const data = new Uint8Array(analyser.frequencyBinCount);

      // ScriptProcessor to capture raw PCM into circular buffer
      const proc = ctx.createScriptProcessor(4096, 1, 1);
      procRef.current = proc;
      proc.onaudioprocess = (ev) => {
        const input = ev.inputBuffer.getChannelData(0);
        const buf = pcmBufRef.current;
        if (!buf) return;
        const bufLenLocal = pcmBufLenRef.current;
        let widx = pcmWriteIdxRef.current;
        for (let i = 0; i < input.length; i++) {
          buf[widx] = input[i];
          widx++;
          if (widx >= bufLenLocal) widx = 0;
        }
        pcmWriteIdxRef.current = widx;
        pcmTotalRef.current += input.length;
      };
      source.connect(proc);
      // ScriptProcessor needs a destination connection to fire onaudioprocess in some browsers.
      // Mute its output via a zero-gain node so we don't echo mic to speakers.
      const mute = ctx.createGain();
      mute.gain.value = 0;
      proc.connect(mute);
      mute.connect(ctx.destination);

      const SPEECH_START = 0.05;
      const SPEECH_END = 0.022;
      const SILENCE_HANG_MS = 700;
      const MIN_UTTERANCE_MS = 250;
      const BARGE_IN_THRESHOLD = 0.12;

      const tick = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        setLevel(Math.min(1, rms * 4));

        const now = performance.now();
        const cur = stateRef.current;

        if (!micMutedRef.current) {
          if (cur === "listening") {
            if (rms > SPEECH_START) {
              if (!speakingRef.current) {
                speakingRef.current = true;
                speakingStartRef.current = now;
                silenceStartRef.current = 0;
                speechStartTotalRef.current = pcmTotalRef.current;
                setState("userSpeaking");
              }
            }
          } else if (cur === "userSpeaking") {
            if (rms > SPEECH_END) {
              silenceStartRef.current = 0;
            } else {
              if (silenceStartRef.current === 0) {
                silenceStartRef.current = now;
              } else if (now - silenceStartRef.current > SILENCE_HANG_MS) {
                if (now - speakingStartRef.current > MIN_UTTERANCE_MS) {
                  finishUserUtterance();
                } else {
                  speakingRef.current = false;
                  silenceStartRef.current = 0;
                  setState("listening");
                }
              }
            }
          } else if (cur === "aiSpeaking") {
            if (rms > BARGE_IN_THRESHOLD) {
              cancelAiPlayback();
              speakingRef.current = true;
              speakingStartRef.current = now;
              silenceStartRef.current = 0;
              speechStartTotalRef.current = pcmTotalRef.current;
              setState("userSpeaking");
            }
          }
        }

        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
      setState("listening");
      console.log("[VoiceMode] started, native rate=" + sampleRate + "Hz, buffer=" + BUFFER_SECONDS + "s");
    } catch (e: any) {
      setError(e?.message || "Gagal akses mic");
      setState("error");
      cleanup();
    }
  }, [setState, finishUserUtterance, cancelAiPlayback, cleanup]);

  const enqueueAiSentence = useCallback(
    (sentence: string) => {
      const trimmed = sentence.trim();
      if (!trimmed) return;
      // Kick off the TTS fetch immediately so it can play back-to-back without gaps
      const bufPromise = fetchAndDecodeTts(trimmed);
      ttsQueueRef.current.push({ text: trimmed, bufPromise });
      setAiSubtitle((prev) => (prev ? prev + " " + trimmed : trimmed));
      pumpTts();
    },
    [pumpTts, fetchAndDecodeTts],
  );

  const finishAiTurn = useCallback(() => {
    aiTurnDoneRef.current = true;
    pumpTts();
  }, [pumpTts]);

  const end = useCallback(() => {
    cleanup();
    setState("idle");
    setLevel(0);
    setAiSubtitle("");
    setUserSubtitle("");
    setError(null);
  }, [cleanup, setState]);

  const toggleMute = useCallback(() => {
    setMicMuted((m) => !m);
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  return {
    state,
    level,
    error,
    micMuted,
    toggleMute,
    aiSubtitle,
    userSubtitle,
    start,
    end,
    enqueueAiSentence,
    finishAiTurn,
    cancelAiPlayback,
  };
}

// Regex emoji & symbol pictographs (skip biar gak dibaca TTS)
const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}\u{1F600}-\u{1F64F}\u{1F900}-\u{1F9FF}\u{2700}-\u{27BF}]/gu;

export function stripMarkdownForSpeech(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/^\>\s+/gm, "")
    .replace(/^\s*\d+[.)]\s+/gm, "") // bullet "1. " atau "1) "
    .replace(/^[-=*_]{3,}\s*$/gm, " ") // garis horizontal "---"
    .replace(EMOJI_RE, " ")
    .replace(/[\u{FE0F}\u{200D}]/gu, "") // variation selector & zero-width joiner
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s+/g, " ")
    .trim();
}
