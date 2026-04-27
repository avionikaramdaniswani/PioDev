import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic, Menu, Sparkles, Loader2, Play, Pause, Download, Upload, Trash2,
  Wand2, AudioLines, FileAudio, AlertCircle, Volume2, RefreshCw,
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

const TTS_MODELS = [
  { id: "qwen3-tts-flash",          label: "Qwen3 TTS Flash",      desc: "Cepat, multibahasa, default" },
  { id: "qwen3-tts-instruct-flash", label: "Qwen3 TTS Instruct",   desc: "Bisa kontrol gaya via instruksi" },
  { id: "cosyvoice-v3-flash",       label: "CosyVoice v3 Flash",   desc: "Bahasa Indonesia natural" },
  { id: "cosyvoice-v3-plus",        label: "CosyVoice v3 Plus",    desc: "Kualitas premium, lebih lambat" },
];

const LANGUAGES = [
  { id: "Indonesian", label: "Bahasa Indonesia" },
  { id: "English",    label: "English" },
  { id: "Chinese",    label: "中文 (Mandarin)" },
  { id: "Japanese",   label: "日本語 (Japanese)" },
  { id: "Korean",     label: "한국어 (Korean)" },
];

const SAMPLE_TEXTS = [
  "Halo, selamat datang di PioCode. Aku siap bantu kamu hari ini.",
  "Hari ini cuacanya bagus banget, cocok buat kerja sambil ngopi.",
  "Terima kasih sudah pake Voice Studio. Hasil suara ini di-generate pake AI.",
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

  // Quota state
  const [quota, setQuota] = useState<{ credits: number; maxCredits: number; costs: { tts: number; clone: number; design: number } } | null>(null);
  const refreshQuota = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    const res = await fetch("/api/voice-studio/quota", { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setQuota(await res.json());
  }, []);

  // Voices state
  const [voices, setVoices] = useState<VoicesResponse>({ presets: [], custom: [] });
  const refreshVoices = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    const res = await fetch("/api/voice-studio/voices", { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setVoices(await res.json());
  }, []);

  useEffect(() => {
    refreshQuota();
    refreshVoices();
  }, [refreshQuota, refreshVoices]);

  // ── TTS state ────────────────────────────────────────────────────
  const [ttsText, setTtsText] = useState("");
  const [ttsModel, setTtsModel] = useState(TTS_MODELS[0].id);
  const [ttsVoiceKey, setTtsVoiceKey] = useState("preset:Cherry");  // "preset:<id>" atau "custom:<dbId>"
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
      let body: any = {
        text: ttsText,
        model: ttsModel,
        language: ttsLanguage,
      };
      if (ttsVoiceKey.startsWith("preset:")) {
        body.voice = ttsVoiceKey.slice(7);
        if (isInstructModel && ttsInstruction.trim()) body.instruction = ttsInstruction.trim();
      } else if (ttsVoiceKey.startsWith("custom:")) {
        endpoint = "/api/voice-studio/tts-custom";
        body = {
          text: ttsText,
          voice_db_id: ttsVoiceKey.slice(7),
          language: ttsLanguage,
        };
      }
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
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
      setCloneMsg({ type: "ok", text: `Suara "${j.voice?.name}" berhasil dibuat. Cek di tab "Suaraku".` });
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
      setDesignMsg({ type: "ok", text: `Suara "${j.voice?.name}" berhasil dirancang. Cek di tab "Suaraku".` });
      setDesignName(""); setDesignPrompt("");
      refreshVoices(); refreshQuota();
    } catch (err: any) {
      setDesignMsg({ type: "err", text: err?.message || "Voice design gagal" });
    } finally {
      setDesignLoading(false);
    }
  };

  // ── Delete voice ─────────────────────────────────────────────────
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

  const creditsBadgeColor =
    !quota ? "text-muted-foreground" :
    quota.credits === 0 ? "text-red-500" :
    quota.credits < 5 ? "text-amber-500" :
    "text-emerald-500";

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
        {/* Header */}
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
          <div className="flex items-center gap-2.5 flex-1">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-400 flex items-center justify-center shadow-sm">
              <Mic className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold tracking-tight">Voice Studio</h1>
                <span className="text-[9px] font-bold bg-primary/15 text-primary px-1.5 py-0.5 rounded">NEW</span>
              </div>
              <p className="text-[11px] text-muted-foreground">TTS, voice cloning &amp; voice design pake Qwen</p>
            </div>
          </div>
          <div className={cn("flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border/60 bg-card text-xs font-semibold", creditsBadgeColor)}>
            <Sparkles className="w-3.5 h-3.5" />
            {quota ? `${quota.credits}/${quota.maxCredits}` : "..."}
            <button onClick={refreshQuota} className="ml-1 opacity-50 hover:opacity-100">
              <RefreshCw className="w-3 h-3" />
            </button>
          </div>
        </header>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-4 pt-3 border-b border-border/40 shrink-0">
          {([
            { id: "tts" as Tab,    label: "TTS Playground", icon: AudioLines },
            { id: "clone" as Tab,  label: "Voice Cloning",  icon: FileAudio },
            { id: "design" as Tab, label: "Voice Design",   icon: Wand2 },
            { id: "voices" as Tab, label: "Suaraku",        icon: Volume2 },
          ]).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg border-b-2 transition-colors -mb-px",
                tab === id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
              {id === "voices" && voices.custom.length > 0 && (
                <span className="ml-1 text-[9px] bg-muted px-1.5 rounded">{voices.custom.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-auto">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
            {tab === "tts" && (
              <div className="space-y-5">
                {/* Sample chips */}
                <div className="flex flex-wrap gap-2">
                  <span className="text-[11px] text-muted-foreground self-center">Coba:</span>
                  {SAMPLE_TEXTS.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => setTtsText(s)}
                      className="text-[11px] px-2.5 py-1 rounded-full border border-border/60 bg-card hover:bg-muted text-foreground/80 transition-colors"
                    >
                      Sample {i + 1}
                    </button>
                  ))}
                </div>

                {/* Text */}
                <div>
                  <label className="text-xs font-semibold text-foreground mb-1.5 block">Teks ({ttsText.length}/2000)</label>
                  <textarea
                    value={ttsText}
                    onChange={(e) => setTtsText(e.target.value)}
                    rows={5}
                    maxLength={2000}
                    placeholder="Tulis teks yang mau diubah jadi suara..."
                    className="w-full px-3 py-2.5 rounded-xl bg-card border border-border/60 focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 text-sm resize-none"
                  />
                </div>

                {/* Grid: voice + model + language */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-foreground mb-1.5 block">Suara</label>
                    <select
                      value={ttsVoiceKey}
                      onChange={(e) => setTtsVoiceKey(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-card border border-border/60 focus:outline-none focus:border-primary/40 text-sm"
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
                              {c.name} ({c.type === "clone" ? "clone" : "design"})
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-foreground mb-1.5 block">Bahasa</label>
                    <select
                      value={ttsLanguage}
                      onChange={(e) => setTtsLanguage(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-card border border-border/60 focus:outline-none focus:border-primary/40 text-sm"
                    >
                      {LANGUAGES.map(l => (
                        <option key={l.id} value={l.id}>{l.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {ttsVoiceKey.startsWith("preset:") && (
                  <div>
                    <label className="text-xs font-semibold text-foreground mb-1.5 block">Model</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {TTS_MODELS.map(m => (
                        <button
                          key={m.id}
                          onClick={() => setTtsModel(m.id)}
                          className={cn(
                            "text-left p-2.5 rounded-lg border transition-colors",
                            ttsModel === m.id
                              ? "border-primary/50 bg-primary/5"
                              : "border-border/60 bg-card hover:border-border"
                          )}
                        >
                          <div className="text-xs font-semibold">{m.label}</div>
                          <div className="text-[10px] text-muted-foreground">{m.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {isInstructModel && ttsVoiceKey.startsWith("preset:") && (
                  <div>
                    <label className="text-xs font-semibold text-foreground mb-1.5 block">
                      Instruksi gaya <span className="text-muted-foreground font-normal">(opsional, contoh: "ucapkan dengan ceria dan ramah")</span>
                    </label>
                    <input
                      value={ttsInstruction}
                      onChange={(e) => setTtsInstruction(e.target.value)}
                      maxLength={200}
                      placeholder="Misal: bicara pelan dan tenang, atau bersemangat"
                      className="w-full px-3 py-2 rounded-lg bg-card border border-border/60 focus:outline-none focus:border-primary/40 text-sm"
                    />
                  </div>
                )}

                {/* Generate */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleGenerateTTS}
                    disabled={ttsLoading || !ttsText.trim()}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {ttsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {ttsLoading ? "Generating..." : "Generate Audio"}
                  </button>
                  <span className="text-[11px] text-muted-foreground">Biaya: {quota?.costs.tts ?? 1} kredit</span>
                </div>

                {ttsError && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{ttsError}</span>
                  </div>
                )}

                {audioUrl && (
                  <div className="rounded-xl border border-border/60 bg-card p-4">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={togglePlay}
                        className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors"
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
                        className="flex-1 h-9"
                      />
                      <button
                        onClick={downloadAudio}
                        title="Download MP3"
                        className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {tab === "clone" && (
              <div className="space-y-5">
                <div className="rounded-xl bg-violet-500/5 border border-violet-500/20 p-4">
                  <div className="flex items-start gap-2.5">
                    <FileAudio className="w-4 h-4 text-violet-500 shrink-0 mt-0.5" />
                    <div className="text-xs text-foreground/80 leading-relaxed">
                      Upload sample audio <strong>10-30 detik</strong> (mp3/wav/m4a, max 10 MB). Suara kamu bakal dipelajari AI dan disimpan jadi voice yang bisa dipake ulang di TTS Playground. <strong>Pastikan kamu punya hak atas audio yang diupload.</strong>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground mb-1.5 block">Nama suara</label>
                  <input
                    value={cloneName}
                    onChange={(e) => setCloneName(e.target.value)}
                    placeholder="Contoh: Suaraku Sendiri"
                    maxLength={50}
                    className="w-full px-3 py-2 rounded-lg bg-card border border-border/60 focus:outline-none focus:border-primary/40 text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground mb-1.5 block">Audio sample</label>
                  <label className="flex items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed border-border/60 bg-card/50 hover:bg-card cursor-pointer transition-colors">
                    <Upload className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {cloneFile ? cloneFile.name : "Klik untuk pilih file audio"}
                    </span>
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={(e) => setCloneFile(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                  </label>
                  {cloneFile && (
                    <p className="text-[11px] text-muted-foreground mt-1.5">
                      {(cloneFile.size / 1024 / 1024).toFixed(2)} MB · {cloneFile.type || "audio"}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleClone}
                    disabled={cloneLoading || !cloneFile || !cloneName.trim()}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {cloneLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileAudio className="w-4 h-4" />}
                    {cloneLoading ? "Memproses..." : "Buat Voice Clone"}
                  </button>
                  <span className="text-[11px] text-muted-foreground">Biaya: {quota?.costs.clone ?? 5} kredit</span>
                </div>

                {cloneMsg && (
                  <div className={cn(
                    "flex items-start gap-2 p-3 rounded-lg border text-xs",
                    cloneMsg.type === "ok"
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
                      : "bg-red-500/10 border-red-500/20 text-red-500"
                  )}>
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{cloneMsg.text}</span>
                  </div>
                )}
              </div>
            )}

            {tab === "design" && (
              <div className="space-y-5">
                <div className="rounded-xl bg-fuchsia-500/5 border border-fuchsia-500/20 p-4">
                  <div className="flex items-start gap-2.5">
                    <Wand2 className="w-4 h-4 text-fuchsia-500 shrink-0 mt-0.5" />
                    <div className="text-xs text-foreground/80 leading-relaxed">
                      Deskripsiin suara yang kamu mau (gender, umur, karakter, aksen, tempo) — AI bakal merancang voice yang cocok dan disimpan buat dipake di TTS Playground.
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground mb-1.5 block">Nama suara</label>
                  <input
                    value={designName}
                    onChange={(e) => setDesignName(e.target.value)}
                    placeholder="Contoh: Narator Dokumenter"
                    maxLength={50}
                    className="w-full px-3 py-2 rounded-lg bg-card border border-border/60 focus:outline-none focus:border-primary/40 text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground mb-1.5 block">
                    Deskripsi suara ({designPrompt.length}/500)
                  </label>
                  <textarea
                    value={designPrompt}
                    onChange={(e) => setDesignPrompt(e.target.value)}
                    rows={4}
                    maxLength={500}
                    placeholder="Contoh: Pria dewasa berusia sekitar 40 tahun, suara dalam dan berwibawa, tempo bicara santai, cocok untuk narasi dokumenter alam."
                    className="w-full px-3 py-2.5 rounded-xl bg-card border border-border/60 focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 text-sm resize-none"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className="text-[11px] text-muted-foreground self-center">Inspirasi:</span>
                  {[
                    "Wanita muda ceria, suara cerah, cocok buat iklan produk fashion",
                    "Pria paruh baya, suara berat dan tenang, cocok buat narasi dokumenter",
                    "Anak kecil sekitar 8 tahun, polos dan ceria, cocok buat audio book anak",
                  ].map((s, i) => (
                    <button
                      key={i}
                      onClick={() => setDesignPrompt(s)}
                      className="text-[11px] px-2.5 py-1 rounded-full border border-border/60 bg-card hover:bg-muted text-foreground/80 transition-colors"
                    >
                      Contoh {i + 1}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleDesign}
                    disabled={designLoading || !designPrompt.trim() || !designName.trim()}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {designLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                    {designLoading ? "Merancang..." : "Rancang Voice"}
                  </button>
                  <span className="text-[11px] text-muted-foreground">Biaya: {quota?.costs.design ?? 10} kredit</span>
                </div>

                {designMsg && (
                  <div className={cn(
                    "flex items-start gap-2 p-3 rounded-lg border text-xs",
                    designMsg.type === "ok"
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
                      : "bg-red-500/10 border-red-500/20 text-red-500"
                  )}>
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{designMsg.text}</span>
                  </div>
                )}
              </div>
            )}

            {tab === "voices" && (
              <div className="space-y-3">
                {voices.custom.length === 0 ? (
                  <div className="text-center py-16">
                    <Volume2 className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">Belum ada voice custom.</p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Bikin lewat tab <strong>Voice Cloning</strong> atau <strong>Voice Design</strong>.
                    </p>
                  </div>
                ) : (
                  voices.custom.map(v => (
                    <div key={v.id} className="rounded-xl border border-border/60 bg-card p-4 flex items-start gap-3">
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
        </div>
      </div>
    </div>
  );
}
