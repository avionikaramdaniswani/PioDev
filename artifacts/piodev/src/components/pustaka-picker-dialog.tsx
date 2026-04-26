import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Search, FileText, Image as ImageIcon, FileCode, FileSpreadsheet,
  File as FileIcon, Loader2, Library, CheckCircle2, AlertCircle, Clock,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type Doc = {
  id: string;
  name: string;
  file_type: string;
  size_bytes: number;
  page_count: number;
  parse_status: "pending" | "processing" | "done" | "failed" | "skipped";
};

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (files: { name: string; content: string }[]) => void;
}

async function authedFetch(path: string, init?: RequestInit) {
  const { data: { session } } = await supabase.auth.getSession();
  return fetch(path, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      Authorization: `Bearer ${session?.access_token ?? ""}`,
    },
  });
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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function PustakaPickerDialog({ open, onClose, onPick }: Props) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    if (!open) {
      setSelected(new Set());
      setSearch("");
      return;
    }
    setLoading(true);
    (async () => {
      try {
        const res = await authedFetch("/api/pustaka");
        if (res.ok) {
          const data = await res.json();
          setDocs(data.documents || []);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [open]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAttach = async () => {
    if (selected.size === 0) return;
    setFetching(true);
    const results: { name: string; content: string }[] = [];
    for (const id of selected) {
      try {
        const res = await authedFetch(`/api/pustaka/${id}/text`);
        if (res.ok) {
          const data = await res.json();
          if (data.text) {
            results.push({ name: data.name, content: data.text });
          }
        }
      } catch (e) {
        console.error(e);
      }
    }
    setFetching(false);
    if (results.length > 0) onPick(results);
    onClose();
  };

  const filtered = search.trim()
    ? docs.filter((d) => d.name.toLowerCase().includes(search.toLowerCase()))
    : docs;

  const ready = filtered.filter((d) => d.parse_status === "done");
  const notReady = filtered.filter((d) => d.parse_status !== "done");

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-x-4 top-[50%] -translate-y-[50%] sm:inset-auto sm:left-[50%] sm:top-[50%] sm:-translate-x-[50%] sm:-translate-y-[50%] sm:w-[480px] max-h-[85vh] bg-popover border border-border rounded-2xl shadow-xl z-50 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Library className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-semibold">Pilih dari Pustaka</h2>
              </div>
              <button
                onClick={onClose}
                className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search */}
            <div className="px-4 pt-3 pb-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari dokumen..."
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-muted/40 border border-border focus:outline-none focus:border-primary/40"
                />
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto px-2 pb-2">
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : docs.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <Library className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-sm font-medium text-muted-foreground">Pustaka kosong</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    Buka halaman Pustaka buat upload dokumen
                  </p>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {ready.map((doc) => {
                    const Icon = getFileIcon(doc.file_type, doc.name);
                    const isSelected = selected.has(doc.id);
                    return (
                      <button
                        key={doc.id}
                        onClick={() => toggle(doc.id)}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors",
                          isSelected ? "bg-primary/10" : "hover:bg-muted"
                        )}
                      >
                        <div className={cn(
                          "w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                          isSelected ? "bg-primary border-primary" : "border-border"
                        )}>
                          {isSelected && <CheckCircle2 className="w-3 h-3 text-primary-foreground" strokeWidth={3} />}
                        </div>
                        <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{doc.name}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {formatBytes(doc.size_bytes)}
                            {doc.page_count > 0 && ` · ${doc.page_count} hal`}
                          </p>
                        </div>
                      </button>
                    );
                  })}

                  {notReady.length > 0 && (
                    <div className="pt-2 mt-2 border-t border-border">
                      <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/60 px-3 py-1.5">
                        Belum siap
                      </p>
                      {notReady.map((doc) => {
                        const Icon = getFileIcon(doc.file_type, doc.name);
                        const StatusIcon = doc.parse_status === "processing" || doc.parse_status === "pending"
                          ? Loader2
                          : doc.parse_status === "failed"
                          ? AlertCircle
                          : Clock;
                        return (
                          <div
                            key={doc.id}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-lg opacity-50"
                          >
                            <div className="w-4 h-4 shrink-0" />
                            <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm truncate">{doc.name}</p>
                              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                                <StatusIcon className={cn("w-3 h-3", (doc.parse_status === "processing" || doc.parse_status === "pending") && "animate-spin")} />
                                {doc.parse_status === "processing" || doc.parse_status === "pending" ? "Memproses..." :
                                 doc.parse_status === "failed" ? "Gagal diparsing" : "Tidak diparsing"}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-card/50">
              <p className="text-xs text-muted-foreground">
                {selected.size > 0 ? `${selected.size} dipilih` : "Pilih satu atau lebih"}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={onClose}
                  className="px-3 py-1.5 text-sm rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={handleAttach}
                  disabled={selected.size === 0 || fetching}
                  className="px-3 py-1.5 text-sm rounded-lg bg-primary text-primary-foreground font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors flex items-center gap-1.5"
                >
                  {fetching && <Loader2 className="w-3 h-3 animate-spin" />}
                  Lampirkan
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
