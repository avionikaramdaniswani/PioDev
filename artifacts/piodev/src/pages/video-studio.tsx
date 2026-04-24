import { useState, useRef, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Video, Upload, Play, Download, Loader2, X, Sparkles,
  Menu, Image as ImageIcon, Type, AlertCircle,
  Clock, Trash2, RotateCcw, ArrowLeft, ExternalLink, Pause, Maximize2,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { useChat } from "@/hooks/use-chat";
import { ChatSidebar } from "@/components/chat-sidebar";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type VideoMode = "text-to-video" | "image-to-video";

interface VideoJob {
  id: string;
  taskId: string;
  prompt: string;
  model: string;
  mode: VideoMode;
  status: "pending" | "running" | "succeeded" | "failed";
  videoUrl?: string;
  thumbnailUrl?: string;
  error?: string;
  createdAt: Date;
  imageUrl?: string;
}

const T2V_CHAIN = [
  "wan2.6-t2v",
  "wan2.5-t2v-preview",
  "wan2.2-t2v-plus",
  "wan2.1-t2v-plus",
  "wan2.1-t2v-turbo",
];

const I2V_CHAIN = [
  "wan2.6-i2v",
  "wan2.6-i2v-flash",
  "wan2.5-i2v-preview",
  "wan2.2-i2v-plus",
  "wan2.2-i2v-flash",
  "wan2.1-i2v-plus",
  "wan2.1-i2v-turbo",
];

async function getToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? "";
}

async function fetchJobs(token: string): Promise<VideoJob[]> {
  const res = await fetch("/api/video-jobs", { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return [];
  const data = await res.json();
  return data.map((j: any) => ({
    id: j.id,
    taskId: j.task_id,
    prompt: j.prompt,
    model: j.model,
    mode: j.mode as VideoMode,
    status: j.status as VideoJob["status"],
    videoUrl: j.video_url || undefined,
    imageUrl: j.image_url || undefined,
    error: j.error || undefined,
    createdAt: new Date(j.created_at),
  }));
}

async function createJobInDb(token: string, job: { taskId: string; prompt: string; model: string; mode: string; imageUrl?: string }): Promise<string | null> {
  const res = await fetch("/api/video-jobs", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ task_id: job.taskId, prompt: job.prompt, model: job.model, mode: job.mode, image_url: job.imageUrl }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.id;
}

async function updateJobInDb(token: string, id: string, updates: { status?: string; video_url?: string; error?: string }) {
  await fetch(`/api/video-jobs/${id}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
}

async function deleteJobInDb(token: string, id: string) {
  await fetch(`/api/video-jobs/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
}

async function deleteAllJobsInDb(token: string) {
  await fetch("/api/video-jobs", { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
}

export default function VideoStudio() {
  const [, navigate] = useLocation();
  const { user, logout } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const { chats, activeChat, createNewChat, selectChat, deleteChat, updateChatTitle } = useChat(user?.id);

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(true);

  const [mode, setMode] = useState<VideoMode>("text-to-video");
  const [prompt, setPrompt] = useState("");
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedImageFile, setUploadedImageFile] = useState<File | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [jobs, setJobs] = useState<VideoJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [credits, setCredits] = useState<{ credits: number; maxCredits: number } | null>(null);
  const [playingVideos, setPlayingVideos] = useState<Set<string>>(new Set());
  const [expandedVideo, setExpandedVideo] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const cancelledRef = useRef<Set<string>>(new Set());
  const jobsRef = useRef(jobs);
  jobsRef.current = jobs;

  useEffect(() => {
    if (!user) { navigate("/login"); return; }
    (async () => {
      setLoadingJobs(true);
      const token = await getToken();
      const [loaded, creditsData] = await Promise.all([
        fetchJobs(token),
        fetch("/api/video-credits", { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : null),
      ]);
      setJobs(loaded);
      setLoadingJobs(false);
      if (creditsData) setCredits(creditsData);
      loaded.filter(j => j.status === "pending" || j.status === "running").forEach(j => startPolling(j.id, j.taskId));
    })();
    return () => {
      pollingRef.current.forEach(t => clearTimeout(t));
      pollingRef.current.clear();
    };
  }, [user]);

  const startPolling = useCallback((jobId: string, taskId: string) => {
    if (pollingRef.current.has(jobId)) return;
    cancelledRef.current.delete(jobId);

    const poll = async () => {
      if (cancelledRef.current.has(jobId)) {
        pollingRef.current.delete(jobId);
        return;
      }
      try {
        const token = await getToken();
        const res = await fetch(`/api/dashscope/api/v1/tasks/${taskId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelledRef.current.has(jobId)) { pollingRef.current.delete(jobId); return; }
        if (!res.ok) {
          pollingRef.current.set(jobId, setTimeout(poll, 5000));
          return;
        }
        const data = await res.json();
        if (cancelledRef.current.has(jobId)) { pollingRef.current.delete(jobId); return; }
        const status = data.output?.task_status;

        if (status === "SUCCEEDED") {
          const videoUrl = data.output?.video_url || data.output?.results?.video_url || data.output?.results?.[0]?.url;
          pollingRef.current.delete(jobId);
          setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: "succeeded", videoUrl } : j));
          await updateJobInDb(token, jobId, { status: "succeeded", video_url: videoUrl });
        } else if (status === "FAILED") {
          pollingRef.current.delete(jobId);
          const errMsg = data.output?.message || "Gagal generate video";
          setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: "failed", error: errMsg } : j));
          await updateJobInDb(token, jobId, { status: "failed", error: errMsg });
        } else {
          setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: "running" } : j));
          if (jobsRef.current.find(j => j.id === jobId)?.status !== "running") {
            updateJobInDb(token, jobId, { status: "running" });
          }
          pollingRef.current.set(jobId, setTimeout(poll, 5000));
        }
      } catch {
        if (!cancelledRef.current.has(jobId)) {
          pollingRef.current.set(jobId, setTimeout(poll, 8000));
        }
      }
    };

    poll();
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setUploadedImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setUploadedImage(null);
    setUploadedImageFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    if (mode === "image-to-video" && !uploadedImage) return;
    setIsGenerating(true);

    try {
      const token = await getToken();

      const creditCheckRes = await fetch("/api/video-credits", { headers: { Authorization: `Bearer ${token}` } });
      if (creditCheckRes.ok) {
        const creditData = await creditCheckRes.json();
        setCredits(creditData);
        if (creditData.credits <= 0 && creditData.maxCredits < 999) {
          throw new Error("Kredit video habis untuk hari ini. Coba lagi besok!");
        }
      }

      let imageUrl = uploadedImage;
      if (mode === "image-to-video" && uploadedImageFile && uploadedImage?.startsWith("data:")) {
        const formData = new FormData();
        formData.append("file", uploadedImageFile);
        const uploadRes = await fetch("/api/dashscope/api/v1/uploads", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "X-DashScope-OssResourceResolve": "enable",
          },
          body: formData,
        });
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          imageUrl = uploadData.data?.uploaded_url || uploadedImage;
        }
      }

      const chain = mode === "text-to-video" ? T2V_CHAIN : I2V_CHAIN;
      let taskId: string | null = null;
      let successModel = "";

      for (const model of chain) {
        const body: any = mode === "text-to-video"
          ? { model, input: { prompt: prompt.trim() }, parameters: { resolution: "720P", prompt_extend: true } }
          : { model, input: { prompt: prompt.trim(), img_url: imageUrl }, parameters: { prompt_extend: true } };

        const submitRes = await fetch("/api/dashscope/api/v1/services/aigc/video-generation/video-synthesis", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "X-DashScope-Async": "enable",
          },
          body: JSON.stringify(body),
        });

        if (submitRes.ok) {
          const data = await submitRes.json();
          if (data.output?.task_id) {
            taskId = data.output.task_id;
            successModel = model;
            break;
          }
          if (data.code && data.code !== "Success") continue;
        }
      }

      if (!taskId) throw new Error("Semua model sedang tidak tersedia. Coba lagi nanti.");

      const creditRes = await fetch("/api/video-credits/deduct", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      if (creditRes.ok) {
        const newCredits = await creditRes.json();
        setCredits(newCredits);
      }

      const dbId = await createJobInDb(token, {
        taskId,
        prompt: prompt.trim(),
        model: successModel,
        mode,
        imageUrl: mode === "image-to-video" ? uploadedImage || undefined : undefined,
      });
      const jobId = dbId || crypto.randomUUID();
      const newJob: VideoJob = {
        id: jobId,
        taskId,
        prompt: prompt.trim(),
        model: successModel,
        mode,
        status: "pending",
        createdAt: new Date(),
        imageUrl: mode === "image-to-video" ? uploadedImage || undefined : undefined,
      };

      setJobs(prev => [newJob, ...prev]);
      startPolling(jobId, taskId);
      setPrompt("");
      removeImage();
    } catch (err: any) {
      const errorJob: VideoJob = {
        id: crypto.randomUUID(),
        taskId: "",
        prompt: prompt.trim(),
        model: "",
        mode,
        status: "failed",
        error: err.message || "Gagal mengirim request",
        createdAt: new Date(),
      };
      setJobs(prev => [errorJob, ...prev]);
    } finally {
      setIsGenerating(false);
    }
  };

  const deleteJob = async (id: string) => {
    cancelledRef.current.add(id);
    if (pollingRef.current.has(id)) {
      clearTimeout(pollingRef.current.get(id));
      pollingRef.current.delete(id);
    }
    setJobs(prev => prev.filter(j => j.id !== id));
    const token = await getToken();
    await deleteJobInDb(token, id);
  };

  const retryJob = (job: VideoJob) => {
    setMode(job.mode);
    setPrompt(job.prompt);
    if (job.imageUrl && !job.imageUrl.startsWith("data:")) {
      setUploadedImage(job.imageUrl);
    } else {
      removeImage();
    }
    deleteJob(job.id);
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
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-indigo-400 flex items-center justify-center shadow-sm">
              <Video className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold">Pio Studio</h1>
              <p className="text-[11px] text-muted-foreground -mt-0.5">Generate video dengan AI</p>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
            <div className={cn(
              "rounded-2xl border p-5 space-y-5",
              isDark ? "bg-zinc-900/50 border-white/[0.06]" : "bg-white border-black/[0.06] shadow-sm"
            )}>
              <div className="flex gap-1 p-1 rounded-xl bg-muted/50">
                <button
                  onClick={() => setMode("text-to-video")}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all",
                    mode === "text-to-video"
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Type className="w-4 h-4" />
                  Text to Video
                </button>
                <button
                  onClick={() => setMode("image-to-video")}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all",
                    mode === "image-to-video"
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <ImageIcon className="w-4 h-4" />
                  Image to Video
                </button>
              </div>
              {mode === "image-to-video" && (
                <div>
                  {uploadedImage ? (
                    <div className="relative group">
                      <img
                        src={uploadedImage}
                        alt="Uploaded"
                        className="w-full max-h-40 object-contain rounded-xl border border-border"
                      />
                      <button
                        onClick={removeImage}
                        className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className={cn(
                        "w-full py-6 rounded-xl border-2 border-dashed flex flex-col items-center gap-1.5 transition-colors",
                        isDark
                          ? "border-white/10 hover:border-white/20 text-muted-foreground"
                          : "border-black/10 hover:border-black/20 text-muted-foreground"
                      )}
                    >
                      <Upload className="w-5 h-5" />
                      <span className="text-xs font-medium">Upload gambar</span>
                      <span className="text-[10px] text-muted-foreground/50">PNG, JPG, WebP</span>
                    </button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </div>
              )}

              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={mode === "text-to-video"
                  ? "Deskripsikan video yang ingin kamu buat...\nContoh: A golden retriever playing fetch on a sunny beach, slow motion, cinematic"
                  : "Deskripsikan gerakan yang diinginkan untuk gambar...\nContoh: The character slowly turns and smiles at the camera"
                }
                rows={2}
                className={cn(
                  "w-full resize-none rounded-xl px-4 py-3 text-sm leading-relaxed border transition-all",
                  "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40",
                  isDark
                    ? "bg-zinc-800/50 border-white/[0.06] placeholder:text-zinc-600"
                    : "bg-zinc-50 border-black/[0.06] placeholder:text-zinc-400"
                )}
              />

              <div className="flex items-center gap-2 justify-end">
                {credits && credits.maxCredits < 999 && (
                  <div className={cn(
                    "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium shrink-0",
                    credits.credits > 0
                      ? isDark ? "bg-emerald-500/10 text-emerald-400" : "bg-emerald-50 text-emerald-600"
                      : isDark ? "bg-red-500/10 text-red-400" : "bg-red-50 text-red-600"
                  )}>
                    <Sparkles className="w-3 h-3" />
                    {credits.credits}/{credits.maxCredits}
                  </div>
                )}

                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || !prompt.trim() || (mode === "image-to-video" && !uploadedImage) || (credits !== null && credits.credits <= 0)}
                  className={cn(
                    "flex items-center gap-2 px-5 py-2 rounded-lg font-semibold text-xs transition-all shrink-0",
                    "bg-gradient-to-r from-primary to-indigo-500 text-white shadow-md shadow-primary/20",
                    "hover:shadow-lg hover:shadow-primary/30 hover:brightness-110",
                    "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-md disabled:hover:brightness-100"
                  )}
                >
                  {isGenerating ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  {credits !== null && credits.credits <= 0 ? "Kredit Habis" : isGenerating ? "Mengirim..." : "Generate"}
                </button>
              </div>
            </div>

            {jobs.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Riwayat ({jobs.length})
                  </h2>
                  {jobs.length > 1 && (
                    <button
                      onClick={async () => {
                        pollingRef.current.forEach(t => clearTimeout(t));
                        pollingRef.current.clear();
                        setJobs([]);
                        const token = await getToken();
                        await deleteAllJobsInDb(token);
                      }}
                      className="text-xs text-muted-foreground hover:text-red-500 transition-colors"
                    >
                      Hapus semua
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <AnimatePresence mode="popLayout">
                    {jobs.map(job => (
                      <motion.div
                        key={job.id}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className={cn(
                          "rounded-xl border overflow-hidden group",
                          isDark ? "bg-zinc-900/50 border-white/[0.06]" : "bg-white border-black/[0.06] shadow-sm"
                        )}
                      >
                        {(job.status === "pending" || job.status === "running") && (
                          <div className="aspect-video relative overflow-hidden">
                            <div className={cn(
                              "absolute inset-0",
                              isDark ? "bg-zinc-800/80" : "bg-zinc-100"
                            )}>
                              <div className="absolute inset-0 shimmer-bg" />
                              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                                <Loader2 className="w-6 h-6 text-primary animate-spin" />
                                <span className="text-xs font-medium text-muted-foreground">
                                  {job.status === "pending" ? "Menunggu..." : "Memproses..."}
                                </span>
                              </div>
                            </div>
                            <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted/50">
                              <motion.div
                                className="h-full bg-gradient-to-r from-primary to-indigo-400"
                                initial={{ width: "5%" }}
                                animate={{ width: job.status === "running" ? "70%" : "15%" }}
                                transition={{ duration: 30, ease: "linear" }}
                              />
                            </div>
                          </div>
                        )}

                        {job.status === "succeeded" && job.videoUrl && (
                          <div className="aspect-video relative group/video cursor-pointer"
                            onClick={(e) => {
                              const v = (e.currentTarget as HTMLElement).querySelector("video");
                              if (v) {
                                if (v.paused) {
                                  v.play();
                                  setPlayingVideos(prev => new Set(prev).add(job.id));
                                } else {
                                  v.pause();
                                  setPlayingVideos(prev => { const s = new Set(prev); s.delete(job.id); return s; });
                                }
                              }
                            }}
                          >
                            <video
                              src={job.videoUrl}
                              className="w-full h-full object-cover rounded-t-xl"
                              loop
                              onEnded={() => setPlayingVideos(prev => { const s = new Set(prev); s.delete(job.id); return s; })}
                            />
                            <div className={cn(
                              "absolute inset-0 flex items-center justify-center transition-opacity pointer-events-none",
                              playingVideos.has(job.id) ? "opacity-0 group-hover/video:opacity-100" : "opacity-100"
                            )}>
                              <div className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center backdrop-blur-sm">
                                {playingVideos.has(job.id) ? (
                                  <Pause className="w-4 h-4 text-white" />
                                ) : (
                                  <Play className="w-4 h-4 text-white ml-0.5" />
                                )}
                              </div>
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); setExpandedVideo(job.videoUrl!); }}
                              className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/50 text-white opacity-0 group-hover/video:opacity-100 transition-opacity backdrop-blur-sm hover:bg-black/70"
                              title="Perbesar"
                            >
                              <Maximize2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}

                        {job.status === "failed" && (
                          <div className={cn(
                            "aspect-video flex flex-col items-center justify-center gap-2",
                            isDark ? "bg-red-500/5" : "bg-red-50"
                          )}>
                            <AlertCircle className="w-6 h-6 text-red-500/60" />
                            <span className="text-xs text-red-500/80 font-medium">Gagal</span>
                          </div>
                        )}

                        <div className="p-3">
                          <p className="text-xs text-foreground/80 line-clamp-2 leading-relaxed mb-2">{job.prompt}</p>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-muted-foreground/50">
                              {job.mode === "text-to-video" ? "T2V" : "I2V"} · {job.model.replace("wan", "").replace("-", " ").trim()}
                            </span>
                            <div className="flex items-center gap-0.5">
                              {job.status === "succeeded" && job.videoUrl && (
                                <a
                                  href={job.videoUrl}
                                  download
                                  className="p-1 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                                  title="Download"
                                >
                                  <Download className="w-3 h-3" />
                                </a>
                              )}
                              {job.status === "failed" && (
                                <button
                                  onClick={() => retryJob(job)}
                                  className="p-1 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                                  title="Coba lagi"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                </button>
                              )}
                              <button
                                onClick={() => deleteJob(job.id)}
                                className="p-1 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-red-500"
                                title="Hapus"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {loadingJobs && jobs.length === 0 && (
              <div className="text-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mb-3" />
                <p className="text-xs text-muted-foreground">Memuat riwayat video...</p>
              </div>
            )}

            {!loadingJobs && jobs.length === 0 && (
              <div className="text-center py-12">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/10 to-indigo-400/10 flex items-center justify-center mx-auto mb-3">
                  <Video className="w-7 h-7 text-primary/50" />
                </div>
                <h3 className="text-sm font-semibold text-foreground/70 mb-1">Belum ada video</h3>
                <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                  Deskripsikan video yang ingin kamu buat dan klik Generate
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {expandedVideo && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
              onClick={() => setExpandedVideo(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed inset-4 md:inset-12 z-50 flex items-center justify-center"
            >
              <div className="relative w-full h-full flex items-center justify-center">
                <video
                  src={expandedVideo}
                  controls
                  autoPlay
                  className="max-w-full max-h-full rounded-xl shadow-2xl"
                />
                <button
                  onClick={() => setExpandedVideo(null)}
                  className="absolute top-0 right-0 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors backdrop-blur-sm"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
