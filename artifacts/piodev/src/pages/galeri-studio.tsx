import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  FolderOpen,
  Menu,
  Sparkles,
  Video as VideoIcon,
  Mic,
  Play,
  Pause,
  Download,
  Trash2,
  Loader2,
  RefreshCw,
  AudioLines,
  X,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { useChat } from "@/hooks/use-chat";
import { ChatSidebar } from "@/components/chat-sidebar";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type FilterTab = "all" | "video" | "voice";

interface VideoItem {
  kind: "video";
  id: string;
  prompt: string;
  model: string;
  status: "pending" | "running" | "succeeded" | "failed";
  videoUrl?: string;
  imageUrl?: string;
  error?: string;
  createdAt: string;
}

interface VoiceItem {
  kind: "voice";
  id: string;
  text: string;
  voiceLabel: string | null;
  language: string | null;
  model: string | null;
  audioUrl: string | null;
  mime: string | null;
  createdAt: string;
}

type GalleryItem = VideoItem | VoiceItem;

async function getToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? "";
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Baru aja";
  if (diffMin < 60) return `${diffMin} menit lalu`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} jam lalu`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay} hari lalu`;
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function downloadUrl(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.target = "_blank";
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export default function GaleriStudio() {
  const { user, logout } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [, navigate] = useLocation();
  const { chats, activeChat, createNewChat, selectChat, deleteChat, updateChatTitle } = useChat(user?.id);

  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const [filter, setFilter] = useState<FilterTab>("all");
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [voices, setVoices] = useState<VoiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [previewVideo, setPreviewVideo] = useState<VideoItem | null>(null);

  // Esc key buat tutup modal
  useEffect(() => {
    if (!previewVideo) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreviewVideo(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [previewVideo]);

  const loadAll = async (silent = false) => {
    if (!silent) setLoading(true);
    setRefreshing(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Sesi habis, silakan login lagi");

      const [vidRes, voiceRes] = await Promise.all([
        fetch("/api/video-jobs", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/voice-studio/history?limit=50", { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (vidRes.ok) {
        const data = await vidRes.json();
        setVideos(
          (data || []).map((j: any): VideoItem => ({
            kind: "video",
            id: j.id,
            prompt: j.prompt || "",
            model: j.model || "",
            status: j.status,
            videoUrl: j.video_url || undefined,
            imageUrl: j.image_url || undefined,
            error: j.error || undefined,
            createdAt: j.created_at,
          })),
        );
      }

      if (voiceRes.ok) {
        const json = await voiceRes.json();
        setVoices(
          (json?.items || []).map((it: any): VoiceItem => ({
            kind: "voice",
            id: it.id,
            text: it.text || "",
            voiceLabel: it.voiceLabel || null,
            language: it.language || null,
            model: it.model || null,
            audioUrl: it.audioUrl || null,
            mime: it.mime || null,
            createdAt: it.createdAt,
          })),
        );
      }
    } catch (err: any) {
      setError(err?.message || "Gagal load galeri");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const items = useMemo<GalleryItem[]>(() => {
    const merged: GalleryItem[] = [];
    if (filter === "all" || filter === "video") merged.push(...videos);
    if (filter === "all" || filter === "voice") merged.push(...voices);
    merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return merged;
  }, [videos, voices, filter]);

  const counts = {
    all: videos.length + voices.length,
    video: videos.length,
    voice: voices.length,
  };

  const handleDeleteVideo = async (id: string) => {
    if (!confirm("Hapus video ini dari galeri?")) return;
    setDeletingId(id);
    try {
      const token = await getToken();
      const res = await fetch(`/api/video-jobs/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setVideos(prev => prev.filter(v => v.id !== id));
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteVoice = async (id: string) => {
    if (!confirm("Hapus audio ini dari galeri?")) return;
    setDeletingId(id);
    try {
      const token = await getToken();
      const res = await fetch(`/api/voice-studio/history/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setVoices(prev => prev.filter(v => v.id !== id));
    } finally {
      setDeletingId(null);
    }
  };

  const togglePlayAudio = (item: VoiceItem) => {
    if (!item.audioUrl) return;
    const id = `voice-${item.id}`;
    const audioEl = document.getElementById(id) as HTMLAudioElement | null;
    if (!audioEl) return;
    if (playingAudioId === item.id) {
      audioEl.pause();
      setPlayingAudioId(null);
    } else {
      // Pause others
      document.querySelectorAll<HTMLAudioElement>("audio[data-gallery-audio]").forEach(a => a.pause());
      audioEl.play().catch(() => {});
      setPlayingAudioId(item.id);
    }
  };

  if (!user) return null;

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
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-400 flex items-center justify-center shadow-sm shrink-0">
              <FolderOpen className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-bold tracking-tight">Galeri Studio</h1>
              <p className="text-[11px] text-muted-foreground truncate">Semua karyamu di Pio Studio</p>
            </div>
          </div>
          <button
            onClick={() => loadAll(true)}
            disabled={refreshing}
            className="p-2 rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
          </button>
        </header>

        <div className="flex-1 overflow-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
            {/* Filter tabs */}
            <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1 -mx-1 px-1">
              {([
                { key: "all" as const, label: "Semua", icon: Sparkles, count: counts.all },
                { key: "video" as const, label: "Video", icon: VideoIcon, count: counts.video },
                { key: "voice" as const, label: "Voice", icon: Mic, count: counts.voice },
              ]).map(tab => {
                const Icon = tab.icon;
                const active = filter === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setFilter(tab.key)}
                    className={cn(
                      "inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap shrink-0",
                      active
                        ? "bg-foreground text-background shadow-sm"
                        : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {tab.label}
                    <span className={cn(
                      "text-[10px] font-semibold px-1.5 py-0.5 rounded-full min-w-[20px] text-center",
                      active ? "bg-background/20" : "bg-foreground/10"
                    )}>
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Loading */}
            {loading && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="rounded-2xl border border-border/60 bg-card overflow-hidden">
                    <div className="aspect-video bg-muted/50 animate-pulse" />
                    <div className="p-3.5 space-y-2">
                      <div className="h-3 bg-muted/50 rounded animate-pulse w-3/4" />
                      <div className="h-2.5 bg-muted/40 rounded animate-pulse w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Error */}
            {!loading && error && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 text-red-500 p-4 text-sm">
                {error}
              </div>
            )}

            {/* Empty */}
            {!loading && !error && items.length === 0 && (
              <div className="max-w-2xl mx-auto px-6 py-16 text-center">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-500/15 to-orange-400/15 flex items-center justify-center mx-auto mb-6">
                  <FolderOpen className="w-10 h-10 text-amber-500" />
                </div>
                <h2 className="text-xl font-bold mb-2">Galeri masih kosong</h2>
                <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                  Mulai bikin karya di Voice Studio atau Video Studio, hasilnya bakal otomatis muncul di sini.
                </p>
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  <button
                    onClick={() => navigate("/voice-studio")}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-br from-primary to-indigo-500 text-white text-sm font-medium shadow-sm hover:brightness-110 transition-all"
                  >
                    <Mic className="w-4 h-4" /> Buka Voice Studio
                  </button>
                  <button
                    onClick={() => navigate("/video-studio")}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted hover:bg-muted/70 text-foreground text-sm font-medium transition-colors"
                  >
                    <VideoIcon className="w-4 h-4" /> Buka Video Studio
                  </button>
                </div>
              </div>
            )}

            {/* Grid */}
            {!loading && !error && items.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {items.map(item => (
                  item.kind === "video" ? (
                    <VideoCard
                      key={`video-${item.id}`}
                      item={item}
                      isDeleting={deletingId === item.id}
                      onPlay={() => setPreviewVideo(item)}
                      onDelete={() => handleDeleteVideo(item.id)}
                    />
                  ) : (
                    <VoiceCard
                      key={`voice-${item.id}`}
                      item={item}
                      isPlaying={playingAudioId === item.id}
                      isDeleting={deletingId === item.id}
                      onTogglePlay={() => togglePlayAudio(item)}
                      onAudioEnded={() => setPlayingAudioId(null)}
                      onDelete={() => handleDeleteVoice(item.id)}
                    />
                  )
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Video Preview Modal ─────────────────────────────────────────── */}
      <AnimatePresence>
        {previewVideo && previewVideo.videoUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 sm:p-8"
            onClick={() => setPreviewVideo(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-5xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                onClick={() => setPreviewVideo(null)}
                className="absolute -top-12 right-0 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
                title="Tutup (Esc)"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="rounded-2xl overflow-hidden bg-black shadow-2xl">
                <video
                  src={previewVideo.videoUrl}
                  controls
                  autoPlay
                  playsInline
                  className="w-full max-h-[80vh] block"
                />
              </div>

              <div className="mt-4 flex items-start justify-between gap-4 text-white">
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-snug line-clamp-3">{previewVideo.prompt || "Tanpa prompt"}</p>
                  <div className="text-[11px] text-white/60 mt-1">
                    {previewVideo.model} · {formatDate(previewVideo.createdAt)}
                  </div>
                </div>
                <button
                  onClick={() => downloadUrl(previewVideo.videoUrl!, `pio-video-${previewVideo.id}.mp4`)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm font-medium transition-colors shrink-0"
                >
                  <Download className="w-4 h-4" /> Download
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Video Card ───────────────────────────────────────────────────────────────
function VideoCard({
  item,
  isDeleting,
  onPlay,
  onDelete,
}: {
  item: VideoItem;
  isDeleting: boolean;
  onPlay: () => void;
  onDelete: () => void;
}) {
  const isReady = item.status === "succeeded" && item.videoUrl;
  const isFailed = item.status === "failed";
  const isPending = item.status === "pending" || item.status === "running";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="group rounded-2xl border border-border/60 bg-card overflow-hidden hover:border-primary/40 hover:shadow-lg transition-all"
    >
      <button
        type="button"
        onClick={isReady ? onPlay : undefined}
        disabled={!isReady}
        className={cn(
          "relative aspect-video w-full bg-gradient-to-br from-primary/10 to-indigo-400/10 overflow-hidden block",
          isReady && "cursor-pointer"
        )}
      >
        {isReady ? (
          // Static thumbnail: pake poster (gambar input untuk i2v) atau frame pertama video.
          // preload="metadata" + muted + tanpa autoplay → cuma load 1 frame.
          item.imageUrl ? (
            <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <video
              src={item.videoUrl}
              muted
              playsInline
              preload="metadata"
              className="w-full h-full object-cover pointer-events-none"
            />
          )
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {isPending && <Loader2 className="w-8 h-8 text-primary animate-spin" />}
            {isFailed && (
              <div className="text-center px-4">
                <div className="text-xs font-semibold text-red-500 mb-1">Gagal</div>
                <div className="text-[10px] text-muted-foreground line-clamp-2">{item.error || "Video gagal di-generate"}</div>
              </div>
            )}
          </div>
        )}

        {/* Top badge */}
        <div className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-sm text-white text-[10px] font-semibold">
          <VideoIcon className="w-3 h-3" /> Video
        </div>

        {/* Status badge */}
        {isPending && (
          <div className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/90 text-white text-[10px] font-semibold">
            <Loader2 className="w-2.5 h-2.5 animate-spin" /> Proses
          </div>
        )}

        {/* Play button overlay (selalu kelihatan, lebih jelas pas hover) */}
        {isReady && (
          <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center">
            <div className="w-14 h-14 rounded-full bg-white/95 text-black flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
              <Play className="w-6 h-6 ml-0.5" fill="currentColor" />
            </div>
          </div>
        )}
      </button>

      <div className="p-3.5">
        <p className="text-sm font-medium leading-snug line-clamp-2 mb-1.5">{item.prompt || "Tanpa prompt"}</p>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground min-w-0">
            <span className="truncate">{item.model}</span>
            <span>·</span>
            <span className="shrink-0">{formatDate(item.createdAt)}</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {isReady && item.videoUrl && (
              <button
                onClick={() => downloadUrl(item.videoUrl!, `pio-video-${item.id}.mp4`)}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="Download"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={onDelete}
              disabled={isDeleting}
              className="p-1.5 rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50"
              title="Hapus"
            >
              {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ── Voice Card ───────────────────────────────────────────────────────────────
function VoiceCard({
  item,
  isPlaying,
  isDeleting,
  onTogglePlay,
  onAudioEnded,
  onDelete,
}: {
  item: VoiceItem;
  isPlaying: boolean;
  isDeleting: boolean;
  onTogglePlay: () => void;
  onAudioEnded: () => void;
  onDelete: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="group rounded-2xl border border-border/60 bg-card overflow-hidden hover:border-primary/40 hover:shadow-lg transition-all"
    >
      <div className="relative aspect-video bg-gradient-to-br from-violet-500/15 via-primary/10 to-indigo-400/15 overflow-hidden flex items-center justify-center">
        {/* Decorative wave bars */}
        <div className="absolute inset-0 flex items-center justify-center gap-1 px-6 pointer-events-none">
          {Array.from({ length: 28 }).map((_, i) => {
            const seed = (item.id.charCodeAt(i % item.id.length) || 50) % 100;
            const h = 12 + (seed % 60);
            return (
              <div
                key={i}
                className={cn(
                  "w-1 rounded-full bg-primary/40 transition-all",
                  isPlaying && "animate-pulse"
                )}
                style={{
                  height: `${h}%`,
                  animationDelay: `${(i % 8) * 80}ms`,
                  animationDuration: `${600 + (seed % 400)}ms`,
                }}
              />
            );
          })}
        </div>

        {/* Top badge */}
        <div className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-sm text-white text-[10px] font-semibold">
          <AudioLines className="w-3 h-3" /> Voice
        </div>

        {/* Voice label */}
        {item.voiceLabel && (
          <div className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/90 text-black text-[10px] font-semibold max-w-[60%] truncate">
            {item.voiceLabel}
          </div>
        )}

        {/* Play button */}
        <button
          onClick={onTogglePlay}
          disabled={!item.audioUrl}
          className="relative z-10 w-14 h-14 rounded-full bg-white/95 text-primary flex items-center justify-center shadow-lg hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100"
          title={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
        </button>

        {item.audioUrl && (
          <audio
            id={`voice-${item.id}`}
            src={item.audioUrl}
            data-gallery-audio="1"
            onEnded={onAudioEnded}
            onPause={onAudioEnded}
            preload="none"
          />
        )}
      </div>

      <div className="p-3.5">
        <p className="text-sm font-medium leading-snug line-clamp-2 mb-1.5">{item.text || "Tanpa teks"}</p>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground min-w-0">
            {item.language && <><span className="truncate">{item.language}</span><span>·</span></>}
            <span className="shrink-0">{formatDate(item.createdAt)}</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {item.audioUrl && (
              <button
                onClick={() => downloadUrl(item.audioUrl!, `pio-voice-${item.id}.${item.mime?.includes("wav") ? "wav" : "mp3"}`)}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="Download"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={onDelete}
              disabled={isDeleting}
              className="p-1.5 rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50"
              title="Hapus"
            >
              {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
