import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Upload, FileText, Image as ImageIcon, FileCode, FileSpreadsheet,
  File as FileIcon, Trash2, Search, X, Loader2, AlertCircle, CheckCircle2,
  Clock, Pencil, Library, Sparkles,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Document = {
  id: string;
  name: string;
  file_type: string;
  size_bytes: number;
  page_count: number;
  parse_status: "pending" | "processing" | "done" | "failed" | "skipped";
  parse_error: string | null;
  tags: string[];
  created_at: string;
};

type Usage = {
  tier: "free" | "plus" | "pro";
  isAdmin: boolean;
  fileCount: number;
  fileLimit: number;
  fileMaxBytes: number;
  pagesUsed: number;
  pagesLimit: number;
};

async function getValidToken(): Promise<string | null> {
  for (let i = 0; i < 10; i++) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) return session.access_token;
    await new Promise((r) => setTimeout(r, 150));
  }
  return null;
}

async function authedFetch(path: string, init?: RequestInit) {
  let token = await getValidToken();
  let res = await fetch(path, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      Authorization: `Bearer ${token ?? ""}`,
    },
  });
  if (res.status === 401) {
    await new Promise((r) => setTimeout(r, 300));
    token = await getValidToken();
    res = await fetch(path, {
      ...init,
      headers: {
        ...(init?.headers || {}),
        Authorization: `Bearer ${token ?? ""}`,
      },
    });
  }
  return res;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(s: string): string {
  const d = new Date(s);
  return d.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

function getFileIcon(mime: string, name: string) {
  const m = (mime || "").toLowerCase();
  const n = (name || "").toLowerCase();
  if (m.startsWith("image/")) return ImageIcon;
  if (m === "application/pdf") return FileText;
  if (/\.(csv|xls|xlsx)$/i.test(n)) return FileSpreadsheet;
  if (/\.(js|ts|jsx|tsx|py|java|cpp|c|rb|php|go|rs|swift|kt|html|css|sh|sql|json|yaml|yml|md)$/i.test(n)) return FileCode;
  if (m.startsWith("text/")) return FileText;
  return FileIcon;
}

function getStatusBadge(status: Document["parse_status"], error: string | null) {
  switch (status) {
    case "done":
      return { icon: CheckCircle2, label: "Siap pakai", color: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200/60 dark:border-emerald-800/40" };
    case "processing":
    case "pending":
      return { icon: Loader2, label: "Memproses...", color: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 border-blue-200/60 dark:border-blue-800/40", spin: true };
    case "failed":
      return { icon: AlertCircle, label: "Gagal", color: "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border-red-200/60 dark:border-red-800/40", tooltip: error };
    case "skipped":
      return { icon: Clock, label: "Tidak diparsing", color: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border-amber-200/60 dark:border-amber-800/40", tooltip: error };
  }
}

const TIER_LABELS: Record<string, string> = { free: "Free", plus: "Plus", pro: "Pro" };

export default function PustakaPage() {
  const [, navigate] = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string[]>([]); // file names being uploaded
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Document | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate("/login");
  }, [authLoading, isAuthenticated, navigate]);

  const fetchData = useCallback(async () => {
    try {
      const [docsRes, usageRes] = await Promise.all([
        authedFetch("/api/pustaka"),
        authedFetch("/api/pustaka/usage"),
      ]);
      if (docsRes.ok) {
        const data = await docsRes.json();
        setDocuments(data.documents || []);
      } else {
        console.error("[Pustaka] list failed:", docsRes.status);
        toast({
          title: "Gagal memuat Pustaka",
          description: `Status ${docsRes.status}. Coba refresh halaman.`,
          variant: "destructive",
        });
      }
      if (usageRes.ok) {
        const data = await usageRes.json();
        setUsage(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) fetchData();
  }, [isAuthenticated, fetchData]);

  // Auto-poll for processing documents
  useEffect(() => {
    const hasProcessing = documents.some((d) => d.parse_status === "processing" || d.parse_status === "pending");
    if (!hasProcessing) return;
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [documents, fetchData]);

  useEffect(() => {
    if (renameId) renameInputRef.current?.focus();
  }, [renameId]);

  const uploadFiles = async (files: File[]) => {
    if (files.length === 0) return;

    if (usage && usage.fileLimit !== -1 && usage.fileCount + files.length > usage.fileLimit) {
      toast({
        title: "Kuota habis",
        description: `Cuma muat ${usage.fileLimit - usage.fileCount} file lagi (tier ${TIER_LABELS[usage.tier]})`,
        variant: "destructive",
      });
      return;
    }

    for (const file of files) {
      if (usage && file.size > usage.fileMaxBytes) {
        toast({
          title: "File terlalu besar",
          description: `${file.name} lebih dari ${(usage.fileMaxBytes / 1024 / 1024).toFixed(0)} MB`,
          variant: "destructive",
        });
        continue;
      }

      setUploading((prev) => [...prev, file.name]);
      const formData = new FormData();
      formData.append("file", file);

      try {
        const res = await authedFetch("/api/pustaka", { method: "POST", body: formData });
        const json = await res.json();
        if (!res.ok) {
          toast({ title: "Upload gagal", description: json.error || "Error", variant: "destructive" });
        } else {
          if (json.document) {
            setDocuments((prev) => [json.document, ...prev]);
          }
          if (json.warning) {
            toast({ title: "Perhatian", description: json.warning });
          }
        }
      } catch (e: any) {
        toast({ title: "Upload gagal", description: e?.message || "Network error", variant: "destructive" });
      } finally {
        setUploading((prev) => prev.filter((n) => n !== file.name));
      }
    }

    fetchData(); // refresh usage stats
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    uploadFiles(files);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files || []);
    uploadFiles(files);
  };

  const handleDelete = async (doc: Document) => {
    setPendingDelete(null);
    try {
      const res = await authedFetch(`/api/pustaka/${doc.id}`, { method: "DELETE" });
      if (res.ok) {
        setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
        toast({ title: "Dihapus", description: doc.name });
        fetchData();
      } else {
        const json = await res.json();
        toast({ title: "Gagal hapus", description: json.error, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Gagal hapus", description: e?.message, variant: "destructive" });
    }
  };

  const startRename = (doc: Document) => {
    setRenameId(doc.id);
    setRenameValue(doc.name);
  };

  const commitRename = async () => {
    if (!renameId) return;
    const newName = renameValue.trim();
    if (!newName) { setRenameId(null); return; }
    const oldDoc = documents.find((d) => d.id === renameId);
    if (oldDoc?.name === newName) { setRenameId(null); return; }

    try {
      const res = await authedFetch(`/api/pustaka/${renameId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      });
      if (res.ok) {
        const json = await res.json();
        setDocuments((prev) => prev.map((d) => (d.id === renameId ? json.document : d)));
      } else {
        const j = await res.json();
        toast({ title: "Gagal rename", description: j.error, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Gagal rename", description: e?.message, variant: "destructive" });
    } finally {
      setRenameId(null);
    }
  };

  const filteredDocs = searchQuery.trim()
    ? documents.filter((d) => d.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : documents;

  if (authLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-dvh bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate("/chat")}
            className="p-2 -ml-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Library className="w-5 h-5 text-primary shrink-0" />
            <h1 className="text-base sm:text-lg font-semibold truncate">Pustaka</h1>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Intro / usage */}
        <div className="space-y-3">
          <div>
            <p className="text-sm text-muted-foreground">
              Simpen dokumen, PDF, atau file kode di sini. Bisa di-attach ke chat manapun biar Pioo bisa baca konteks.
            </p>
          </div>

          {usage && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-border bg-card px-4 py-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">Tier</p>
                  <span className={cn(
                    "text-[10px] font-semibold px-2 py-0.5 rounded-full",
                    usage.tier === "pro" ? "bg-purple-500/10 text-purple-600 dark:text-purple-400" :
                    usage.tier === "plus" ? "bg-primary/10 text-primary" :
                    "bg-muted text-muted-foreground"
                  )}>
                    {TIER_LABELS[usage.tier]}
                  </span>
                </div>
                <p className="text-sm font-medium mt-1">
                  Maks {(usage.fileMaxBytes / 1024 / 1024).toFixed(0)} MB / file
                </p>
              </div>

              <div className="rounded-xl border border-border bg-card px-4 py-3">
                <p className="text-xs text-muted-foreground">File tersimpan</p>
                <p className="text-sm font-medium mt-1">
                  {usage.fileCount}
                  <span className="text-muted-foreground"> / {usage.fileLimit === -1 ? "∞" : usage.fileLimit}</span>
                </p>
                {usage.fileLimit !== -1 && (
                  <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${Math.min(100, (usage.fileCount / usage.fileLimit) * 100)}%` }}
                    />
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-border bg-card px-4 py-3">
                <p className="text-xs text-muted-foreground">Halaman PDF/foto bulan ini</p>
                <p className="text-sm font-medium mt-1">
                  {usage.pagesUsed}
                  <span className="text-muted-foreground"> / {usage.pagesLimit}</span>
                </p>
                <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${Math.min(100, (usage.pagesUsed / usage.pagesLimit) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Upload area */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "border-2 border-dashed rounded-2xl px-6 py-8 sm:py-10 text-center cursor-pointer transition-colors",
            isDragging
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50 hover:bg-muted/30"
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            className="hidden"
            accept=".pdf,.txt,.md,.json,.csv,.html,.css,.js,.ts,.jsx,.tsx,.py,.java,.cpp,.c,.rb,.php,.swift,.kt,.dart,.go,.rs,.sh,.sql,.yaml,.yml,.xml,.png,.jpg,.jpeg,.webp,.gif"
          />
          <Upload className="w-7 h-7 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm font-medium">Drop file di sini atau klik buat upload</p>
          <p className="text-xs text-muted-foreground mt-1">
            PDF, gambar (PNG/JPG/WebP), atau file teks/kode
          </p>
        </div>

        {/* Uploading list */}
        {uploading.length > 0 && (
          <div className="space-y-2">
            {uploading.map((name) => (
              <div key={name} className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-muted/40 border border-border">
                <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
                <span className="text-sm truncate flex-1">{name}</span>
                <span className="text-xs text-muted-foreground shrink-0">Upload...</span>
              </div>
            ))}
          </div>
        )}

        {/* Search */}
        {documents.length > 0 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari dokumen..."
              className="w-full pl-10 pr-9 py-2.5 text-sm rounded-xl bg-card border border-border focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 placeholder:text-muted-foreground/50"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* Documents list */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-12">
            <Library className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">Belum ada dokumen</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Upload file pertama lo di atas</p>
          </div>
        ) : filteredDocs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Tidak ada dokumen yang cocok dengan "{searchQuery}"
          </p>
        ) : (
          <div className="space-y-2">
            <AnimatePresence initial={false}>
              {filteredDocs.map((doc) => {
                const Icon = getFileIcon(doc.file_type, doc.name);
                const badge = getStatusBadge(doc.parse_status, doc.parse_error);
                return (
                  <motion.div
                    key={doc.id}
                    layout
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ duration: 0.15 }}
                    className="group flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-card hover:border-primary/30 hover:shadow-sm transition-all"
                  >
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5 text-muted-foreground" />
                    </div>

                    <div className="flex-1 min-w-0">
                      {renameId === doc.id ? (
                        <input
                          ref={renameInputRef}
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={commitRename}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") { e.preventDefault(); commitRename(); }
                            if (e.key === "Escape") { setRenameId(null); }
                          }}
                          className="w-full bg-background border border-primary/40 rounded-md px-2 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                        />
                      ) : (
                        <p className="text-sm font-medium truncate">{doc.name}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span>{formatBytes(doc.size_bytes)}</span>
                        {doc.page_count > 0 && (
                          <>
                            <span>·</span>
                            <span>{doc.page_count} halaman</span>
                          </>
                        )}
                        <span>·</span>
                        <span>{formatDate(doc.created_at)}</span>
                      </div>
                    </div>

                    {badge && (
                      <span
                        title={badge.tooltip || badge.label}
                        className={cn(
                          "hidden sm:inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-full border",
                          badge.color
                        )}
                      >
                        <badge.icon className={cn("w-3 h-3", badge.spin && "animate-spin")} />
                        {badge.label}
                      </span>
                    )}

                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => startRename(doc)}
                        className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        title="Rename"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setPendingDelete(doc)}
                        className="p-2 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors"
                        title="Hapus"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}

        {/* Tips */}
        {!loading && documents.length === 0 && (
          <div className="rounded-2xl border border-primary/10 bg-primary/5 p-4">
            <div className="flex items-start gap-3">
              <Sparkles className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-medium">Tips pakai Pustaka</p>
                <ul className="text-xs text-muted-foreground space-y-0.5 list-disc list-inside">
                  <li>Upload PDF atau screenshot kode → bisa diparsing otomatis pake AI</li>
                  <li>Di chat, klik tombol + → "Pilih dari Pustaka" buat attach</li>
                  <li>Tag (coming soon) buat ngelompokin dokumen biar gampang dicari</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => { if (!open) setPendingDelete(null); }}>
        <AlertDialogContent className="max-w-sm rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus dokumen?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete && (
                <>Dokumen <span className="font-medium text-foreground">"{pendingDelete.name}"</span> akan dihapus permanen.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingDelete && handleDelete(pendingDelete)}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
