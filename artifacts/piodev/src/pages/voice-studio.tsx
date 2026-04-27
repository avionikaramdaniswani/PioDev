import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic, Menu, Sparkles, Loader2, Play, Pause, Download, Upload, Trash2,
  Wand2, AudioLines, FileAudio, AlertCircle, Volume2,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { useChat } from "@/hooks/use-chat";
import { ChatSidebar } from "@/components/chat-sidebar";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type Tab = "tts" | "clone" | "design" | "voices";

interface VoicePreset {
  id: string;
  name: string;
  lang: string;
  gender: string;
}
interface UserVoice {
  id: string;
  name: string;
  type: "clone" | "design";
  dashscope_voice_id: string;
  source_text: string | null;
  language: string;
  created_at: string;
}
interface VoicesResponse {
  presets: VoicePreset[];
  custom: UserVoice[];
}
interface QuotaResponse {
  credits: number;
  maxCredits: number;
  costs: { tts: number; clone: number; design: number };
}

const TTS_MODELS = [
  { id: "qwen3-tts-flash",          label: "Qwen3 TTS Flash",    desc: "Cepat, multibahasa, default" },
  { id: "qwen3-tts-instruct-flash", label: "Qwen3 TTS Instruct", desc: "Bisa kontrol gaya via instruksi" },
];

const LANGUAGES = [
  { id: "Auto",       label: "Auto (deteksi)" },
  { id: "Indonesian", label: "Bahasa Indonesia" },
  { id: "English",    label: "English" },
  { id: "Chinese",    label: "中文 (Mandarin)" },
  { id: "Japanese",   label: "日本語 (Japanese)" },
  { id: "Korean",     label: "한국어 (Korean)" },
  { id: "Vietnamese", label: "Tiếng Việt" },
  { id: "Thai",       label: "ภาษาไทย" },
  { id: "Spanish",    label: "Español" },
  { id: "French",     label: "Français" },
  { id: "German",     label: "Deutsch" },
  { id: "Italian",    label: "Italiano" },
  { id: "Portuguese", label: "Português" },
  { id: "Russian",    label: "Русский" },
  { id: "Arabic",     label: "العربية" },
];

const SAMPLE_TEXTS = [
  "Halo, selamat datang di PioCode. Aku siap bantu kamu hari ini.",
  "Hari ini cuacanya bagus banget, cocok buat kerja sambil ngopi.",
  "Terima kasih sudah pake Voice Studio. Hasil suara ini di-generate pake AI.",
];

const DESIGN_INSPIRATIONS = [
  "Wanita muda ceria, suara cerah, cocok buat iklan produk fashion",
  "Pria paruh baya, suara berat dan tenang, cocok buat narasi dokumenter",
  "Anak kecil sekitar 8 tahun, polos dan ceria, cocok buat audio book anak",
];

async function getToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? "";
}

export default function VoiceStudio() {
  const { user, logout } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [, navigate] = useLocation();
  const { chats, activeChat, createNewChat, selectChat, deleteChat, updateChatTitle } = useChat(user?.id);

  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const [tab, setTab] = useState<Tab>("tts");

  // Quota & voices
  const [quota, setQuota] = useState<QuotaResponse | null>(null);
  const refreshQuota = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    const res = await fetch("/api/voice-studio/quota", { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setQuota(await res.json());
  }, []);

  const [voices, setVoices] = useState<VoicesResponse>({ presets: [], custom: [] });
  const refreshVoices = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    const res = await fetch("/api/voice-studio/voices", { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setVoices(await res.json());
  }, []);

  useEffect(() => { refreshQuota(); refreshVoices(); }, [refreshQuota, refreshVoices]);

  // ── TTS state ────────────────────────────────────────────────────
  const [ttsText, setTtsText] = useState("");
  const [ttsModel, setTtsModel] = useState(TTS_MODELS[0].id);
  const [ttsVoiceKey, setTtsVoiceKey] = useState("preset:Cherry");
  const [ttsLanguage, setTtsLanguage] = useState(LANGUAGES[0].id);
  const [ttsInstruction, setTtsInstruction] = useState("");
  const [ttsLoading, setTtsLoading] = useState(false);
  const [ttsError, setTtsError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [audioPlaying, setAudioPlaying] = useState(false);

  const isInstructModel = ttsModel === "qwen3-tts-instruct-flash";

  const handleGenerateTTS = async () => {
    if (!ttsText.trim()) { setTtsError("Teks gak boleh kosong"); return; }
    if (ttsText.length > 2000) { setTtsError("Teks terlalu panjang (max 2000 karakter)"); return; }
    setTtsError(null);
    setTtsLoading(true);
    if (audioUrl) { URL.revokeObjectURL(audioUrl); setAudioUrl(null); }
    try {
      const token = await getToken();
      let endpoint = "/api/voice-studio/tts";
      let body: any = { text: ttsText, model: ttsModel, language: ttsLanguage };
      if (ttsVoiceKey.startsWith("preset:")) {
        body.voice = ttsVoiceKey.slice(7);
        if (isInstructModel && ttsInstruction.trim()) body.instruction = ttsInstruction.trim();
      } else if (ttsVoiceKey.startsWith("custom:")) {
        endpoint = "/api/voice-studio/tts-custom";
        body = { text: ttsText, voice_db_id: ttsVoiceKey.slice(7), language: ttsLanguage };
      }
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        const main = j?.error || `HTTP ${res.status}`;
        const detail = j?.detail ? ` — ${j.detail}` : "";
        throw new Error(main + detail);
      }
      const blob = await res.blob();
      setAudioUrl(URL.createObjectURL(blob));
      refreshQuota();
    } catch (err: any) {
      setTtsError(err?.message || "Gagal generate audio");
    } finally {
      setTtsLoading(false);
    }
  };

  const togglePlay = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) { a.play(); setAudioPlaying(true); }
    else { a.pause(); setAudioPlaying(false); }
  };

  const downloadAudio = () => {
    if (!audioUrl) return;
    const a = document.createElement("a");
    a.href = audioUrl;
    a.download = `pio-tts-${Date.now()}.mp3`;
    a.click();
  };

  // ── Clone state ──────────────────────────────────────────────────
  const [cloneName, setCloneName] = useState("");
  const [cloneFile, setCloneFile] = useState<File | null>(null);
  const cloneInputRef = useRef<HTMLInputElement>(null);
  const [cloneLoading, setCloneLoading] = useState(false);
  const [cloneMsg, setCloneMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const handleClone = async () => {
    if (!cloneFile) { setCloneMsg({ type: "err", text: "Upload sample audio dulu (mp3/wav, min 10 detik)" }); return; }
    if (!cloneName.trim()) { setCloneMsg({ type: "err", text: "Kasih nama buat suara ini" }); return; }
    setCloneMsg(null);
    setCloneLoading(true);
    try {
      const token = await getToken();
      const fd = new FormData();
      fd.append("audio", cloneFile);
      fd.append("name", cloneName.trim());
      fd.append("language", "id");
      const res = await fetch("/api/voice-studio/clone", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || `HTTP ${res.status}`);
      setCloneMsg({ type: "ok", text: `Suara "${j.voice?.name}" berhasil dibuat. Cek di tab Suaraku.` });
      setCloneName(""); setCloneFile(null);
      refreshVoices(); refreshQuota();
    } catch (err: any) {
      setCloneMsg({ type: "err", text: err?.message || "Voice cloning gagal" });
    } finally {
      setCloneLoading(false);
    }
  };

  // ── Design state ─────────────────────────────────────────────────
  const [designName, setDesignName] = useState("");
  const [designPrompt, setDesignPrompt] = useState("");
  const [designLoading, setDesignLoading] = useState(false);
  const [designMsg, setDesignMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const handleDesign = async () => {
    if (!designPrompt.trim()) { setDesignMsg({ type: "err", text: "Tulis deskripsi suaranya dulu" }); return; }
    if (!designName.trim()) { setDesignMsg({ type: "err", text: "Kasih nama buat suara ini" }); return; }
    setDesignMsg(null);
    setDesignLoading(true);
    try {
      const token = await getToken();
      const res = await fetch("/api/voice-studio/design", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: designName.trim(), prompt: designPrompt.trim(), language: "id" }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || `HTTP ${res.status}`);
      setDesignMsg({ type: "ok", text: `Suara "${j.voice?.name}" berhasil dirancang. Cek di tab Suaraku.` });
      setDesignName(""); setDesignPrompt("");
      refreshVoices(); refreshQuota();
    } catch (err: any) {
      setDesignMsg({ type: "err", text: err?.message || "Voice design gagal" });
    } finally {
      setDesignLoading(false);
    }
  };

  const handleDeleteVoice = async (id: string) => {
    if (!confirm("Hapus suara ini? Voice ID-nya bakal ilang permanen.")) return;
    const token = await getToken();
    await fetch(`/api/voice-studio/voices/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    refreshVoices();
    if (ttsVoiceKey === `custom:${id}`) setTtsVoiceKey("preset:Cherry");
  };

  if (!user) return null;

  // ── Helpers untuk styling konsisten dengan video-studio ──────────
  const cardCls = cn(
    "rounded-2xl border",
    isDark ? "bg-zinc-900/50 border-white/[0.06]" : "bg-white border-black/[0.06] shadow-sm"
  );
  const inputCls = cn(
    "w-full rounded-xl px-4 py-2.5 text-sm border transition-all",
    "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40",
    isDark
      ? "bg-zinc-800/50 border-white/[0.06] placeholder:text-zinc-600 text-foreground"
      : "bg-zinc-50 border-black/[0.06] placeholder:text-zinc-400 text-foreground"
  );
  const textareaCls = cn(
    "w-full resize-none rounded-xl px-4 py-3 text-sm leading-relaxed border transition-all",
    "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40",
    isDark
      ? "bg-zinc-800/50 border-white/[0.06] placeholder:text-zinc-600"
      : "bg-zinc-50 border-black/[0.06] placeholder:text-zinc-400"
  );

  const creditsBadge = (cost: number) => {
    if (!quota || quota.maxCredits >= 999) return null;
    const enough = quota.credits >= cost;
    return (
      <div className={cn(
        "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium shrink-0",
        enough
          ? isDark ? "bg-emerald-500/10 text-emerald-400" : "bg-emerald-50 text-emerald-600"
          : isDark ? "bg-red-500/10 text-red-400" : "bg-red-50 text-red-600"
      )}>
        <Sparkles className="w-3 h-3" />
        {quota.credits}/{quota.maxCredits}
      </div>
    );
  };

  const generateBtnCls = cn(
    "flex items-center gap-2 px-5 py-2 rounded-lg font-semibold text-xs transition-all shrink-0",
    "bg-gradient-to-r from-primary to-indigo-500 text-white shadow-md shadow-primary/20",
    "hover:shadow-lg hover:shadow-primary/30 hover:brightness-110",
    "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-md disabled:hover:brightness-100"
  );

  const TABS: Array<{ id: Tab; label: string; icon: any }> = [
    { id: "tts",    label: "TTS Playground", icon: AudioLines },
    { id: "clone",  label: "Voice Cloning",  icon: FileAudio },
    { id: "design", label: "Voice Design",   icon: Wand2 },
    { id: "voices", label: "Suaraku",        icon: Volume2 },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <motion.div
        animate={{ width: isDesktopSidebarOpen ? 288 : 64 }}
        transition={{ type: "spring", damping: 30, stiffness: 250 }}
        className="hidden md:flex flex-col bg-sidebar border-r border-sidebar-border overflow-hidden shrink-0"
      >
        <ChatSidebar
          user={{ name: user.name, initials: user.initials, email: user.email }}
          chats={chats.map(c => ({ id: c.id, title: c.title, updatedAt: c.updatedAt }))}
          activeChatId={activeChat?.id}
          createNewChat={() => { createNewChat(); navigate("/chat"); }}
          selectChat={(id) => { selectChat(id); navigate("/chat"); }}
          deleteChat={deleteChat}
          updateChatTitle={updateChatTitle}
          logout={logout}
          isAdmin={user.role === "admin"}
          collapsed={!isDesktopSidebarOpen}
          onExpand={() => setIsDesktopSidebarOpen(true)}
          onCollapse={() => setIsDesktopSidebarOpen(false)}
        />
      </motion.div>

      <AnimatePresence>
        {isMobileSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-40 md:hidden"
              onClick={() => setIsMobileSidebarOpen(false)}
            />
            <motion.div
              initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed left-0 top-0 bottom-0 w-[280px] z-50 md:hidden bg-sidebar"
            >
              <ChatSidebar
                user={{ name: user.name, initials: user.initials, email: user.email }}
                chats={chats.map(c => ({ id: c.id, title: c.title, updatedAt: c.updatedAt }))}
                activeChatId={activeChat?.id}
                createNewChat={() => { createNewChat(); navigate("/chat"); setIsMobileSidebarOpen(false); }}
                selectChat={(id) => { selectChat(id); navigate("/chat"); setIsMobileSidebarOpen(false); }}
                deleteChat={deleteChat}
                updateChatTitle={updateChatTitle}
                logout={logout}
                isAdmin={user.role === "admin"}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header (mirror video-studio) */}
        <header className={cn(
          "flex items-center gap-3 px-4 py-3 border-b shrink-0",
          isDark ? "border-white/[0.06] bg-background" : "border-black/[0.06] bg-white"
        )}>
          <button
            onClick={() => setIsMobileSidebarOpen(true)}
            className="md:hidden p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-indigo-400 flex items-center justify-center shadow-sm">
              <Mic className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-base font-bold">Voice Studio</h1>
                <span className="text-[9px] font-bold bg-primary/15 text-primary px-1.5 py-0.5 rounded">NEW</span>
              </div>
              <p className="text-[11px] text-muted-foreground -mt-0.5">TTS, voice cloning &amp; voice design pake Qwen</p>
            </div>
          </div>
        </header>

        {/* Main content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">

            {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━ MAIN CARD ━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
            <div className={cn(cardCls, "p-5 space-y-5")}>
              {/* Segmented tabs (mirror video-studio mode toggle) */}
              <div className="flex gap-1 p-1 rounded-xl bg-muted/50">
                {TABS.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setTab(id)}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all",
                      tab === id
                        ? "bg-background shadow-sm text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline">{label}</span>
                    <span className="sm:hidden">
                      {id === "tts" ? "TTS" : id === "clone" ? "Clone" : id === "design" ? "Design" : "Suara"}
                    </span>
                    {id === "voices" && voices.custom.length > 0 && (
                      <span className="hidden sm:inline ml-0.5 text-[9px] bg-muted px-1.5 rounded">{voices.custom.length}</span>
                    )}
                  </button>
                ))}
              </div>

              {/* ─────── TTS TAB ─────── */}
              {tab === "tts" && (
                <>
                  {/* Sample chips */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-muted-foreground">Coba:</span>
                    {SAMPLE_TEXTS.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => setTtsText(s)}
                        className={cn(
                          "text-[11px] px-2.5 py-1 rounded-full border transition-colors",
                          isDark
                            ? "border-white/[0.06] bg-zinc-800/50 hover:bg-zinc-800 text-foreground/80"
                            : "border-black/[0.06] bg-zinc-50 hover:bg-zinc-100 text-foreground/80"
                        )}
                      >
                        Sample {i + 1}
                      </button>
                    ))}
                  </div>

                  {/* Textarea */}
                  <div>
                    <textarea
                      value={ttsText}
                      onChange={(e) => setTtsText(e.target.value)}
                      placeholder={"Tulis teks yang mau diubah jadi suara...\nContoh: Halo semua, selamat datang di kanal aku!"}
                      rows={4}
                      maxLength={2000}
                      className={textareaCls}
                    />
                    <div className="text-[10px] text-muted-foreground/60 mt-1 text-right">{ttsText.length}/2000</div>
                  </div>

                  {/* Voice + Bahasa */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Suara</label>
                      <select
                        value={ttsVoiceKey}
                        onChange={(e) => setTtsVoiceKey(e.target.value)}
                        className={inputCls}
                      >
                        <optgroup label="Preset Qwen">
                          {voices.presets.map(p => (
                            <option key={p.id} value={`preset:${p.id}`}>{p.name}</option>
                          ))}
                        </optgroup>
                        {voices.custom.length > 0 && (
                          <optgroup label="Suaraku (Custom)">
                            {voices.custom.map(c => (
                              <option key={c.id} value={`custom:${c.id}`}>
                                {c.name} · {c.type === "clone" ? "clone" : "design"}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Bahasa</label>
                      <select
                        value={ttsLanguage}
                        onChange={(e) => setTtsLanguage(e.target.value)}
                        className={inputCls}
                      >
                        {LANGUAGES.map(l => (
                          <option key={l.id} value={l.id}>{l.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Model picker (only for preset voices) */}
                  {ttsVoiceKey.startsWith("preset:") && (
                    <div>
                      <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Model</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {TTS_MODELS.map(m => (
                          <button
                            key={m.id}
                            onClick={() => setTtsModel(m.id)}
                            className={cn(
                              "text-left p-3 rounded-xl border transition-all",
                              ttsModel === m.id
                                ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
                                : isDark
                                  ? "border-white/[0.06] bg-zinc-800/30 hover:bg-zinc-800/60"
                                  : "border-black/[0.06] bg-zinc-50 hover:bg-zinc-100"
                            )}
                          >
                            <div className="text-xs font-semibold">{m.label}</div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">{m.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Instruct input (conditional) */}
                  {isInstructModel && ttsVoiceKey.startsWith("preset:") && (
                    <div>
                      <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                        Instruksi gaya <span className="text-muted-foreground/60 font-normal normal-case">(opsional)</span>
                      </label>
                      <input
                        value={ttsInstruction}
                        onChange={(e) => setTtsInstruction(e.target.value)}
                        maxLength={200}
                        placeholder='Contoh: "ucapkan dengan ceria dan ramah"'
                        className={inputCls}
                      />
                    </div>
                  )}

                  {/* Bottom row: credits + Generate (mirror video-studio) */}
                  <div className="flex items-center gap-2 justify-end pt-1">
                    {creditsBadge(quota?.costs.tts ?? 1)}
                    <button
                      onClick={handleGenerateTTS}
                      disabled={ttsLoading || !ttsText.trim() || (quota !== null && quota.credits < (quota.costs.tts ?? 1))}
                      className={generateBtnCls}
                    >
                      {ttsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                      {quota !== null && quota.credits < (quota.costs.tts ?? 1) ? "Kredit Habis" : ttsLoading ? "Generating..." : "Generate"}
                    </button>
                  </div>
                </>
              )}

              {/* ─────── CLONE TAB ─────── */}
              {tab === "clone" && (
                <>
                  <div className={cn(
                    "rounded-xl p-3.5 text-xs leading-relaxed",
                    isDark ? "bg-violet-500/5 border border-violet-500/15 text-foreground/80" : "bg-violet-50 border border-violet-200 text-violet-900/80"
                  )}>
                    <div className="flex items-start gap-2.5">
                      <FileAudio className="w-4 h-4 text-violet-500 shrink-0 mt-0.5" />
                      <span>
                        Upload sample audio <strong>10–30 detik</strong> (mp3/wav/m4a, max 10 MB). Suara kamu bakal dipelajari AI dan disimpan jadi voice yang bisa dipake ulang di TTS Playground. <strong>Pastikan kamu punya hak atas audio yang diupload.</strong>
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Nama suara</label>
                    <input
                      value={cloneName}
                      onChange={(e) => setCloneName(e.target.value)}
                      placeholder="Contoh: Suaraku Sendiri"
                      maxLength={50}
                      className={inputCls}
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Audio sample</label>
                    {cloneFile ? (
                      <div className={cn(
                        "rounded-xl p-3 flex items-center gap-3 border",
                        isDark ? "bg-zinc-800/50 border-white/[0.06]" : "bg-zinc-50 border-black/[0.06]"
                      )}>
                        <div className="w-9 h-9 rounded-lg bg-violet-500/15 text-violet-500 flex items-center justify-center shrink-0">
                          <FileAudio className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium truncate">{cloneFile.name}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {(cloneFile.size / 1024 / 1024).toFixed(2)} MB · {cloneFile.type || "audio"}
                          </div>
                        </div>
                        <button
                          onClick={() => { setCloneFile(null); if (cloneInputRef.current) cloneInputRef.current.value = ""; }}
                          className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors"
                          title="Hapus"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => cloneInputRef.current?.click()}
                        className={cn(
                          "w-full py-6 rounded-xl border-2 border-dashed flex flex-col items-center gap-1.5 transition-colors",
                          isDark
                            ? "border-white/10 hover:border-white/20 text-muted-foreground"
                            : "border-black/10 hover:border-black/20 text-muted-foreground"
                        )}
                      >
                        <Upload className="w-5 h-5" />
                        <span className="text-xs font-medium">Klik untuk upload audio</span>
                        <span className="text-[10px] text-muted-foreground/50">MP3, WAV, M4A · max 10 MB</span>
                      </button>
                    )}
                    <input
                      ref={cloneInputRef}
                      type="file"
                      accept="audio/*"
                      onChange={(e) => setCloneFile(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                  </div>

                  {cloneMsg && (
                    <div className={cn(
                      "flex items-start gap-2 p-3 rounded-xl border text-xs",
                      cloneMsg.type === "ok"
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                        : "bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400"
                    )}>
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{cloneMsg.text}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 justify-end pt-1">
                    {creditsBadge(quota?.costs.clone ?? 5)}
                    <button
                      onClick={handleClone}
                      disabled={cloneLoading || !cloneFile || !cloneName.trim() || (quota !== null && quota.credits < (quota.costs.clone ?? 5))}
                      className={generateBtnCls}
                    >
                      {cloneLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileAudio className="w-3.5 h-3.5" />}
                      {quota !== null && quota.credits < (quota.costs.clone ?? 5) ? "Kredit Kurang" : cloneLoading ? "Memproses..." : `Buat Voice Clone (${quota?.costs.clone ?? 5} kredit)`}
                    </button>
                  </div>
                </>
              )}

              {/* ─────── DESIGN TAB ─────── */}
              {tab === "design" && (
                <>
                  <div className={cn(
                    "rounded-xl p-3.5 text-xs leading-relaxed",
                    isDark ? "bg-fuchsia-500/5 border border-fuchsia-500/15 text-foreground/80" : "bg-fuchsia-50 border border-fuchsia-200 text-fuchsia-900/80"
                  )}>
                    <div className="flex items-start gap-2.5">
                      <Wand2 className="w-4 h-4 text-fuchsia-500 shrink-0 mt-0.5" />
                      <span>
                        Deskripsiin suara yang kamu mau (gender, umur, karakter, aksen, tempo) — AI bakal merancang voice yang cocok dan disimpan buat dipake di TTS Playground.
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Nama suara</label>
                    <input
                      value={designName}
                      onChange={(e) => setDesignName(e.target.value)}
                      placeholder="Contoh: Narator Dokumenter"
                      maxLength={50}
                      className={inputCls}
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                      Deskripsi suara
                    </label>
                    <textarea
                      value={designPrompt}
                      onChange={(e) => setDesignPrompt(e.target.value)}
                      rows={4}
                      maxLength={500}
                      placeholder="Contoh: Pria dewasa berusia sekitar 40 tahun, suara dalam dan berwibawa, tempo bicara santai, cocok untuk narasi dokumenter alam."
                      className={textareaCls}
                    />
                    <div className="text-[10px] text-muted-foreground/60 mt-1 text-right">{designPrompt.length}/500</div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-muted-foreground">Inspirasi:</span>
                    {DESIGN_INSPIRATIONS.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => setDesignPrompt(s)}
                        className={cn(
                          "text-[11px] px-2.5 py-1 rounded-full border transition-colors",
                          isDark
                            ? "border-white/[0.06] bg-zinc-800/50 hover:bg-zinc-800 text-foreground/80"
                            : "border-black/[0.06] bg-zinc-50 hover:bg-zinc-100 text-foreground/80"
                        )}
                      >
                        Contoh {i + 1}
                      </button>
                    ))}
                  </div>

                  {designMsg && (
                    <div className={cn(
                      "flex items-start gap-2 p-3 rounded-xl border text-xs",
                      designMsg.type === "ok"
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                        : "bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400"
                    )}>
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{designMsg.text}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 justify-end pt-1">
                    {creditsBadge(quota?.costs.design ?? 10)}
                    <button
                      onClick={handleDesign}
                      disabled={designLoading || !designPrompt.trim() || !designName.trim() || (quota !== null && quota.credits < (quota.costs.design ?? 10))}
                      className={generateBtnCls}
                    >
                      {designLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                      {quota !== null && quota.credits < (quota.costs.design ?? 10) ? "Kredit Kurang" : designLoading ? "Merancang..." : `Rancang Voice (${quota?.costs.design ?? 10} kredit)`}
                    </button>
                  </div>
                </>
              )}

              {/* ─────── VOICES TAB ─────── */}
              {tab === "voices" && (
                <div className="space-y-2">
                  {voices.custom.length === 0 ? (
                    <div className="text-center py-10">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/10 to-indigo-400/10 flex items-center justify-center mx-auto mb-3">
                        <Volume2 className="w-7 h-7 text-primary/50" />
                      </div>
                      <h3 className="text-sm font-semibold text-foreground/70 mb-1">Belum ada voice custom</h3>
                      <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                        Bikin lewat tab Voice Cloning atau Voice Design.
                      </p>
                    </div>
                  ) : (
                    voices.custom.map(v => (
                      <div
                        key={v.id}
                        className={cn(
                          "rounded-xl border p-3.5 flex items-start gap-3",
                          isDark ? "bg-zinc-800/30 border-white/[0.06]" : "bg-zinc-50 border-black/[0.06]"
                        )}
                      >
                        <div className={cn(
                          "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
                          v.type === "clone" ? "bg-violet-500/15 text-violet-500" : "bg-fuchsia-500/15 text-fuchsia-500"
                        )}>
                          {v.type === "clone" ? <FileAudio className="w-4 h-4" /> : <Wand2 className="w-4 h-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-sm font-semibold truncate">{v.name}</span>
                            <span className={cn(
                              "text-[9px] uppercase font-bold px-1.5 py-0.5 rounded",
                              v.type === "clone" ? "bg-violet-500/15 text-violet-500" : "bg-fuchsia-500/15 text-fuchsia-500"
                            )}>{v.type}</span>
                          </div>
                          {v.source_text && (
                            <p className="text-[11px] text-muted-foreground line-clamp-2">{v.source_text}</p>
                          )}
                          <p className="text-[10px] text-muted-foreground/60 mt-1">
                            {new Date(v.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => { setTtsVoiceKey(`custom:${v.id}`); setTab("tts"); }}
                            className="text-[11px] px-2.5 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/15 font-medium transition-colors"
                          >
                            Pakai
                          </button>
                          <button
                            onClick={() => handleDeleteVoice(v.id)}
                            title="Hapus"
                            className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
            {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━ END MAIN CARD ━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}

            {/* TTS error + audio player (di luar card, kayak Riwayat di video-studio) */}
            {tab === "tts" && ttsError && (
              <div className={cn(
                "rounded-xl border p-3 text-xs flex items-start gap-2",
                isDark ? "bg-red-500/5 border-red-500/20 text-red-400" : "bg-red-50 border-red-200 text-red-600"
              )}>
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{ttsError}</span>
              </div>
            )}

            {tab === "tts" && audioUrl && (
              <div className="space-y-3">
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Hasil</h2>
                <div className={cn(cardCls, "p-4 flex items-center gap-3")}>
                  <button
                    onClick={togglePlay}
                    className="w-11 h-11 rounded-full bg-gradient-to-br from-primary to-indigo-500 text-white flex items-center justify-center shadow-md shadow-primary/20 hover:brightness-110 transition-all shrink-0"
                  >
                    {audioPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                  </button>
                  <audio
                    ref={audioRef}
                    src={audioUrl}
                    controls
                    onPlay={() => setAudioPlaying(true)}
                    onPause={() => setAudioPlaying(false)}
                    onEnded={() => setAudioPlaying(false)}
                    className="flex-1 h-9 min-w-0"
                  />
                  <button
                    onClick={downloadAudio}
                    title="Download MP3"
                    className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground shrink-0"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Empty state untuk TTS tab kalo belum pernah generate */}
            {tab === "tts" && !audioUrl && !ttsError && !ttsLoading && (
              <div className="text-center py-8">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/10 to-indigo-400/10 flex items-center justify-center mx-auto mb-3">
                  <AudioLines className="w-7 h-7 text-primary/50" />
                </div>
                <h3 className="text-sm font-semibold text-foreground/70 mb-1">Belum ada audio</h3>
                <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                  Tulis teks di atas, pilih suara, lalu klik Generate untuk bikin audio AI.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
