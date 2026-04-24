import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Key, Plus, Copy, Trash2, AlertTriangle, Check, ArrowLeft, Code, Zap, Clock, Sparkles, MessageSquare, Image as ImageIcon, Video, FileText, ScanText, Lock, Lightbulb, AlertCircle, Rocket, BookOpen, Layers } from "lucide-react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type ApiKey = {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

type ApiUsage = {
  usage: { total_tokens: number; image_count: number; video_count: number; request_count: number };
  limits: { tokens: number; images: number; videos: number; requests: number };
};

async function authedFetch(path: string, init?: RequestInit) {
  const { data: { session } } = await supabase.auth.getSession();
  return fetch(path, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      Authorization: `Bearer ${session?.access_token ?? ""}`,
      "Content-Type": "application/json",
    },
  });
}

function formatDate(s: string | null) {
  if (!s) return "—";
  const d = new Date(s);
  return d.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

export default function ApiKeysPage() {
  const [, navigate] = useLocation();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [usage, setUsage] = useState<ApiUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"keys" | "docs">("keys");

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate("/login");
  }, [authLoading, isAuthenticated, navigate]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [kRes, uRes] = await Promise.all([
        authedFetch("/api/me/api-keys"),
        authedFetch("/api/me/api-usage"),
      ]);
      if (kRes.status === 403) {
        setError("Fitur API key hanya untuk pengguna Plus. Upgrade ke Plus dulu ya!");
        setLoading(false);
        return;
      }
      if (!kRes.ok) throw new Error("Gagal load keys");
      const kData = await kRes.json();
      setKeys(kData.keys || []);
      if (uRes.ok) setUsage(await uRes.json());
    } catch (e: any) {
      setError(e.message || "Gagal load data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (user?.id) load(); /* eslint-disable-next-line */ }, [user?.id]);

  async function handleCreate() {
    if (!newKeyName.trim()) return;
    setCreating(true);
    try {
      const res = await authedFetch("/api/me/api-keys", {
        method: "POST",
        body: JSON.stringify({ name: newKeyName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal buat key");
        setCreating(false);
        return;
      }
      setCreatedKey(data.key);
      setNewKeyName("");
      await load();
    } catch (e: any) {
      setError(e.message || "Gagal buat key");
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: string) {
    if (!confirm("Yakin mau revoke key ini? Aplikasi yang masih pakai bakal langsung berhenti.")) return;
    setDeletingId(id);
    try {
      await authedFetch(`/api/me/api-keys/${id}`, { method: "DELETE" });
      await load();
    } finally {
      setDeletingId(null);
    }
  }

  async function copyKey(text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const activeKeys = keys.filter((k) => !k.revoked_at);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => navigate("/settings")}
            className="p-2 rounded-lg hover:bg-muted transition"
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Key className="w-6 h-6 text-primary" />
              API Keys
            </h1>
            <p className="text-sm text-muted-foreground">
              Pakai PioDev AI dari aplikasi atau script kamu sendiri.
            </p>
          </div>
        </div>

        {/* Error/Premium gate */}
        {error && (
          <div className="mb-6 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm">{error}</p>
              {error.includes("Plus") && (
                <button
                  onClick={() => navigate("/premium")}
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600"
                >
                  <Sparkles className="w-4 h-4" /> Upgrade ke Plus
                </button>
              )}
            </div>
          </div>
        )}

        {/* Usage cards */}
        {usage && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <UsageCard label="Token hari ini" used={usage.usage.total_tokens} limit={usage.limits.tokens} />
            <UsageCard label="Image hari ini" used={usage.usage.image_count} limit={usage.limits.images} />
            <UsageCard label="Video hari ini" used={usage.usage.video_count} limit={usage.limits.videos} />
            <UsageCard label="Request hari ini" used={usage.usage.request_count} limit={usage.limits.requests} />
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border mb-6">
          <TabButton active={activeTab === "keys"} onClick={() => setActiveTab("keys")}>
            <Key className="w-4 h-4" /> Keys saya
          </TabButton>
          <TabButton active={activeTab === "docs"} onClick={() => setActiveTab("docs")}>
            <Code className="w-4 h-4" /> Dokumentasi
          </TabButton>
        </div>

        {activeTab === "keys" && !error && (
          <>
            {/* Create button */}
            <div className="mb-4">
              <button
                onClick={() => { setShowCreate(true); setCreatedKey(null); }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition"
                data-testid="button-create-key"
              >
                <Plus className="w-4 h-4" /> Buat key baru
              </button>
            </div>

            {/* Keys table */}
            {loading ? (
              <div className="text-center py-12 text-muted-foreground">Loading...</div>
            ) : activeKeys.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-border rounded-xl">
                <Key className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-muted-foreground">Belum ada API key. Buat satu untuk mulai.</p>
              </div>
            ) : (
              <div className="border border-border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium">Nama</th>
                      <th className="text-left px-4 py-3 font-medium">Key</th>
                      <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Dibuat</th>
                      <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Terakhir dipakai</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeKeys.map((k) => (
                      <tr key={k.id} className="border-t border-border" data-testid={`row-key-${k.id}`}>
                        <td className="px-4 py-3 font-medium">{k.name}</td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{k.key_prefix}</td>
                        <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{formatDate(k.created_at)}</td>
                        <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{formatDate(k.last_used_at)}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleRevoke(k.id)}
                            disabled={deletingId === k.id}
                            className="p-2 rounded-lg hover:bg-destructive/10 text-destructive transition disabled:opacity-50"
                            data-testid={`button-revoke-${k.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {activeTab === "docs" && <Docs />}
      </div>

      {/* Create modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            onClick={() => { if (!createdKey) { setShowCreate(false); setNewKeyName(""); } }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-background border border-border rounded-2xl p-6 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              {!createdKey ? (
                <>
                  <h3 className="text-lg font-semibold mb-2">Buat API key baru</h3>
                  <p className="text-sm text-muted-foreground mb-4">Kasih nama biar gampang ngenalin nanti.</p>
                  <input
                    autoFocus
                    type="text"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder="Misal: Project chatbot"
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background mb-4"
                    data-testid="input-key-name"
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => { setShowCreate(false); setNewKeyName(""); }}
                      className="px-4 py-2 rounded-lg hover:bg-muted transition"
                    >
                      Batal
                    </button>
                    <button
                      onClick={handleCreate}
                      disabled={creating || !newKeyName.trim()}
                      className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium disabled:opacity-50"
                      data-testid="button-confirm-create"
                    >
                      {creating ? "Membuat..." : "Buat key"}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                      <Check className="w-5 h-5 text-green-500" />
                    </div>
                    <h3 className="text-lg font-semibold">Key berhasil dibuat</h3>
                  </div>
                  <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/5 text-sm mb-4">
                    <strong className="text-amber-600 dark:text-amber-400">Penting:</strong> Copy sekarang. Setelah modal ditutup, kamu ga bisa lihat lagi.
                  </div>
                  <div className="relative mb-4">
                    <code className="block px-3 py-3 pr-12 rounded-lg bg-muted font-mono text-xs break-all" data-testid="text-new-key">
                      {createdKey}
                    </code>
                    <button
                      onClick={() => copyKey(createdKey)}
                      className="absolute top-2 right-2 p-2 rounded-md hover:bg-background transition"
                      data-testid="button-copy-key"
                    >
                      {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="flex justify-end">
                    <button
                      onClick={() => { setShowCreate(false); setCreatedKey(null); }}
                      className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium"
                    >
                      Selesai
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function UsageCard({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = Math.min((used / limit) * 100, 100);
  return (
    <div className="p-4 rounded-xl border border-border bg-card">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-lg font-semibold mb-2">
        {used.toLocaleString()} <span className="text-xs text-muted-foreground font-normal">/ {limit.toLocaleString()}</span>
      </p>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full transition-all", pct > 80 ? "bg-amber-500" : "bg-primary")}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition flex items-center gap-2",
        active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

const LANG_LABELS: Record<string, { label: string; dot: string }> = {
  bash:       { label: "Terminal",  dot: "bg-green-500" },
  shell:      { label: "Terminal",  dot: "bg-green-500" },
  python:     { label: "Python",    dot: "bg-blue-500" },
  javascript: { label: "JavaScript", dot: "bg-yellow-400" },
  typescript: { label: "TypeScript", dot: "bg-sky-500" },
  json:       { label: "JSON",      dot: "bg-orange-400" },
};

function CodeBlock({ children, lang = "bash" }: { children: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  const meta = LANG_LABELS[lang] ?? { label: lang.toUpperCase(), dot: "bg-zinc-400" };

  async function copy() {
    await navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="rounded-xl overflow-hidden border border-zinc-800 bg-[#1e1e2e] shadow-sm">
      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#181825] border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
            <span className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
          </div>
          <div className="flex items-center gap-1.5 ml-2">
            <span className={cn("w-1.5 h-1.5 rounded-full", meta.dot)} />
            <span className="text-[11px] text-zinc-400 font-medium">{meta.label}</span>
          </div>
        </div>
        <button
          onClick={copy}
          className="flex items-center gap-1.5 px-2 py-1 text-[11px] text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-md transition"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-green-400" />
              <span className="text-green-400">Disalin</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>Salin</span>
            </>
          )}
        </button>
      </div>

      {/* Code body */}
      <SyntaxHighlighter
        language={lang}
        style={oneDark}
        customStyle={{
          margin: 0,
          padding: "16px",
          background: "transparent",
          fontSize: "12.5px",
          lineHeight: "1.6",
        }}
        codeTagProps={{ style: { fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" } }}
        wrapLongLines={false}
      >
        {children}
      </SyntaxHighlighter>
    </div>
  );
}

function detectOS(): "windows" | "mac" | "linux" {
  if (typeof window === "undefined") return "linux";
  const ua = window.navigator.userAgent.toLowerCase();
  if (ua.includes("win")) return "windows";
  if (ua.includes("mac")) return "mac";
  return "linux";
}

function CodeTabs({ tabs, autoSelectByOS }: { tabs: { label: string; lang: string; code: string; os?: "windows" | "mac" | "linux" }[]; autoSelectByOS?: boolean }) {
  const [active, setActive] = useState(() => {
    if (!autoSelectByOS) return 0;
    const os = detectOS();
    const idx = tabs.findIndex((t) => t.os === os);
    return idx >= 0 ? idx : 0;
  });

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2 p-1 rounded-lg bg-muted/40 border border-border w-fit">
        {tabs.map((t, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            className={cn(
              "px-3 py-1.5 text-xs rounded-md transition font-medium",
              active === i
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <CodeBlock lang={tabs[active].lang}>{tabs[active].code}</CodeBlock>
    </div>
  );
}

function SectionHeader({ icon: Icon, title, subtitle, color = "text-primary" }: { icon: any; title: string; subtitle?: string; color?: string }) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={cn("w-5 h-5", color)} />
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      {subtitle && <p className="text-sm text-muted-foreground ml-7">{subtitle}</p>}
    </div>
  );
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("p-5 rounded-xl border border-border bg-card", className)}>{children}</div>;
}

function Callout({ icon: Icon, color, children }: { icon: any; color: "blue" | "amber" | "green" | "red"; children: React.ReactNode }) {
  const styles = {
    blue: "border-blue-500/30 bg-blue-500/5 text-blue-700 dark:text-blue-300",
    amber: "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300",
    green: "border-green-500/30 bg-green-500/5 text-green-700 dark:text-green-300",
    red: "border-red-500/30 bg-red-500/5 text-red-700 dark:text-red-300",
  };
  const iconColor = {
    blue: "text-blue-500", amber: "text-amber-500", green: "text-green-500", red: "text-red-500",
  };
  return (
    <div className={cn("p-3 rounded-lg border flex items-start gap-2 text-sm", styles[color])}>
      <Icon className={cn("w-4 h-4 shrink-0 mt-0.5", iconColor[color])} />
      <div className="flex-1">{children}</div>
    </div>
  );
}

function Docs() {
  const baseUrl = typeof window !== "undefined" ? `${window.location.origin}/v1` : "https://your-domain.com/v1";
  const [docTab, setDocTab] = useState<"start" | "chat" | "image" | "video" | "ocr" | "file" | "ref">("start");

  const tabs: { id: typeof docTab; label: string; icon: any }[] = [
    { id: "start", label: "Mulai di sini", icon: Rocket },
    { id: "chat", label: "Chat", icon: MessageSquare },
    { id: "image", label: "Gambar", icon: ImageIcon },
    { id: "video", label: "Video", icon: Video },
    { id: "ocr", label: "OCR", icon: ScanText },
    { id: "file", label: "File", icon: FileText },
    { id: "ref", label: "Referensi", icon: BookOpen },
  ];

  return (
    <div className="space-y-6">
      {/* Sub-nav */}
      <div className="flex flex-wrap gap-1.5 p-1.5 rounded-xl bg-muted/40 border border-border">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setDocTab(id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition",
              docTab === id
                ? "bg-background text-foreground shadow-sm font-medium"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* MULAI DI SINI */}
      {docTab === "start" && (
        <div className="space-y-6">
          <Card className="bg-gradient-to-br from-primary/5 to-transparent">
            <SectionHeader icon={Rocket} title="Apa itu PioDev API?" />
            <p className="text-sm text-muted-foreground mb-4 ml-7">
              API key yang kamu generate di sini bisa dipakai dari aplikasi, script, atau project apapun
              buat akses semua fitur AI PioDev: chat, generate gambar, video, OCR, dan baca file.
            </p>
            <div className="ml-7 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Check className="w-4 h-4 text-green-500" />
                <span>Format kompatibel <strong>OpenAI SDK</strong> — kode lama kamu langsung jalan</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Check className="w-4 h-4 text-green-500" />
                <span>Pakai dari Python, JavaScript, curl, atau bahasa apapun</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Check className="w-4 h-4 text-green-500" />
                <span>Limit harian terpisah dari web app</span>
              </div>
            </div>
          </Card>

          <Card>
            <SectionHeader icon={Lock} title="3 langkah mulai" subtitle="Yang paling penting kamu hapal cuma ini" />
            <ol className="space-y-3 ml-7">
              <li className="flex gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">1</span>
                <div className="flex-1 text-sm">
                  Buka tab <strong>Keys saya</strong>, klik <strong>"Buat key baru"</strong>, kasih nama, lalu copy key-nya.
                  <Callout icon={AlertTriangle} color="amber">
                    Key cuma muncul <strong>sekali</strong>. Kalau lupa nge-copy, ya udah, bikin baru.
                  </Callout>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">2</span>
                <div className="flex-1 text-sm">
                  Pakai <strong>Base URL</strong> ini di kode kamu:
                  <div className="mt-2 p-2 rounded-lg bg-muted font-mono text-xs break-all">{baseUrl}</div>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">3</span>
                <div className="flex-1 text-sm">
                  Kirim request dengan header <code className="px-1 py-0.5 bg-muted rounded">Authorization: Bearer pio-sk-...</code>. Selesai!
                </div>
              </li>
            </ol>
          </Card>

          <Card>
            <SectionHeader icon={Zap} title="Contoh paling singkat" subtitle="Pilih sesuai OS kamu, terus paste ke terminal" />
            <CodeTabs tabs={[
              {
                label: "macOS / Linux",
                lang: "bash",
                code: `curl ${baseUrl}/chat/completions \\
  -H "Authorization: Bearer pio-sk-..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "qwen-plus",
    "messages": [{"role": "user", "content": "Halo!"}]
  }'`,
              },
              {
                label: "Windows (PowerShell)",
                lang: "bash",
                code: `$headers = @{
  "Authorization" = "Bearer pio-sk-..."
  "Content-Type"  = "application/json"
}
$body = '{
  "model": "qwen-plus",
  "messages": [{"role": "user", "content": "Halo!"}]
}'
Invoke-RestMethod -Uri "${baseUrl}/chat/completions" \`
  -Method Post -Headers $headers -Body $body`,
              },
              {
                label: "Windows (CMD)",
                lang: "bash",
                code: `curl ${baseUrl}/chat/completions ^
  -H "Authorization: Bearer pio-sk-..." ^
  -H "Content-Type: application/json" ^
  -d "{\\"model\\":\\"qwen-plus\\",\\"messages\\":[{\\"role\\":\\"user\\",\\"content\\":\\"Halo!\\"}]}"`,
              },
            ]} />
            <Callout icon={Lightbulb} color="blue">
              Ganti <code>pio-sk-...</code> dengan key kamu yang asli. Tanda <code>\\</code> di Linux, <code>^</code> di CMD, dan backtick <code>`</code> di PowerShell — itu cuma buat lanjut baris, jangan ketuker.
            </Callout>
          </Card>

          <Card>
            <SectionHeader icon={Lightbulb} title="Tips" />
            <div className="space-y-2 ml-7">
              <Callout icon={AlertCircle} color="red">
                <strong>Jangan share key kamu.</strong> Anggap kayak password. Jangan commit ke GitHub, jangan paste di chat publik.
              </Callout>
              <Callout icon={Lightbulb} color="blue">
                Bingung mau mulai dari mana? Coba klik tab <strong>Chat</strong> di atas — itu paling sering dipakai.
              </Callout>
              <Callout icon={AlertCircle} color="amber">
                Kalau dapet error <strong>401</strong> → key salah/sudah revoke. <strong>403</strong> → kamu belum Plus. <strong>429</strong> → limit harian habis.
              </Callout>
            </div>
          </Card>
        </div>
      )}

      {/* CHAT */}
      {docTab === "chat" && (
        <div className="space-y-6">
          <Card>
            <SectionHeader icon={MessageSquare} title="Chat completion" subtitle="Endpoint paling sering dipakai. Buat ngobrol, jawab pertanyaan, generate teks." />
            <div className="ml-7 flex items-center gap-2 text-xs">
              <span className="px-2 py-0.5 rounded bg-green-500/10 text-green-600 dark:text-green-400 font-mono font-semibold">POST</span>
              <code className="text-muted-foreground">{baseUrl}/chat/completions</code>
            </div>
          </Card>

          <div>
            <h3 className="font-semibold mb-3 text-sm">Curl (paling cepat buat test)</h3>
            <CodeBlock>{`curl ${baseUrl}/chat/completions \\
  -H "Authorization: Bearer pio-sk-..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "qwen-plus",
    "messages": [
      {"role": "user", "content": "Halo, siapa kamu?"}
    ]
  }'`}</CodeBlock>
          </div>

          <div>
            <h3 className="font-semibold mb-3 text-sm">Python (pakai OpenAI SDK)</h3>
            <CodeBlock lang="python">{`from openai import OpenAI

client = OpenAI(
    api_key="pio-sk-...",
    base_url="${baseUrl}"
)

response = client.chat.completions.create(
    model="qwen-plus",
    messages=[{"role": "user", "content": "Halo"}]
)
print(response.choices[0].message.content)`}</CodeBlock>
          </div>

          <div>
            <h3 className="font-semibold mb-3 text-sm">Node.js (pakai OpenAI SDK)</h3>
            <CodeBlock lang="javascript">{`import OpenAI from "openai";

const client = new OpenAI({
  apiKey: "pio-sk-...",
  baseURL: "${baseUrl}",
});

const res = await client.chat.completions.create({
  model: "qwen-plus",
  messages: [{ role: "user", content: "Halo" }],
});
console.log(res.choices[0].message.content);`}</CodeBlock>
          </div>

          <div>
            <h3 className="font-semibold mb-3 text-sm">Streaming (jawaban muncul real-time, kayak ChatGPT)</h3>
            <CodeBlock>{`curl ${baseUrl}/chat/completions \\
  -H "Authorization: Bearer pio-sk-..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "qwen-plus",
    "messages": [{"role": "user", "content": "Tulis cerita pendek"}],
    "stream": true,
    "stream_options": {"include_usage": true}
  }'`}</CodeBlock>
            <Callout icon={Lightbulb} color="blue">
              Pakai <code>stream_options.include_usage: true</code> biar token usage tetap kehitung walau pakai streaming.
            </Callout>
          </div>
        </div>
      )}

      {/* IMAGE */}
      {docTab === "image" && (
        <div className="space-y-6">
          <Card>
            <SectionHeader icon={ImageIcon} title="Generate gambar" subtitle="Bikin gambar dari deskripsi teks" />
            <div className="ml-7 flex items-center gap-2 text-xs">
              <span className="px-2 py-0.5 rounded bg-green-500/10 text-green-600 dark:text-green-400 font-mono font-semibold">POST</span>
              <code className="text-muted-foreground">{baseUrl}/images/generations</code>
            </div>
          </Card>

          <div>
            <h3 className="font-semibold mb-3 text-sm">Contoh request</h3>
            <CodeBlock>{`curl ${baseUrl}/images/generations \\
  -H "Authorization: Bearer pio-sk-..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "wan2.2-t2i-flash",
    "prompt": "kucing oranye lagi ngoding di kafe",
    "n": 1,
    "size": "1024x1024"
  }'`}</CodeBlock>
          </div>

          <div>
            <h3 className="font-semibold mb-3 text-sm">Parameter</h3>
            <div className="border border-border rounded-lg overflow-hidden text-sm">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Field</th>
                    <th className="text-left px-3 py-2 font-medium">Wajib?</th>
                    <th className="text-left px-3 py-2 font-medium">Penjelasan</th>
                  </tr>
                </thead>
                <tbody className="text-xs">
                  <ParamRow name="prompt" required text="Deskripsi gambar yang mau dibuat" />
                  <ParamRow name="model" text="Default: wan2.2-t2i-flash" />
                  <ParamRow name="n" text="Jumlah gambar (1–4). Default 1" />
                  <ParamRow name="size" text="Misal 1024x1024, 1280x720. Default 1024x1024" />
                </tbody>
              </table>
            </div>
          </div>

          <Callout icon={Clock} color="blue">
            URL gambar yang di-return berlaku <strong>~24 jam</strong>. Download/simpan kalau mau pakai jangka panjang.
          </Callout>
        </div>
      )}

      {/* VIDEO */}
      {docTab === "video" && (
        <div className="space-y-6">
          <Card>
            <SectionHeader icon={Video} title="Generate video" subtitle="Beda dari gambar — video pakai pola async (kirim → tunggu → ambil hasil)" />
          </Card>

          <Callout icon={Lightbulb} color="amber">
            Video butuh waktu lama (5–10 menit). Jadi alurnya <strong>2 step</strong>: submit dulu, dapat <code>task_id</code>, terus kamu polling sampai status SUCCEEDED.
          </Callout>

          <div>
            <h3 className="font-semibold mb-3 text-sm flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">1</span>
              Submit job
            </h3>
            <div className="ml-7 mb-2 flex items-center gap-2 text-xs">
              <span className="px-2 py-0.5 rounded bg-green-500/10 text-green-600 dark:text-green-400 font-mono font-semibold">POST</span>
              <code className="text-muted-foreground">{baseUrl}/videos/generations</code>
            </div>
            <CodeBlock>{`curl ${baseUrl}/videos/generations \\
  -H "Authorization: Bearer pio-sk-..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "wan2.2-t2v-plus",
    "prompt": "ombak biru di pantai saat sunset",
    "size": "1280x720"
  }'

# Response: { "task_id": "abc123", "status": "PENDING" }`}</CodeBlock>
          </div>

          <div>
            <h3 className="font-semibold mb-3 text-sm flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">2</span>
              Poll status (ulang tiap ~10 detik)
            </h3>
            <div className="ml-7 mb-2 flex items-center gap-2 text-xs">
              <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 font-mono font-semibold">GET</span>
              <code className="text-muted-foreground">{baseUrl}/videos/generations/&#123;task_id&#125;</code>
            </div>
            <CodeBlock>{`curl ${baseUrl}/videos/generations/abc123 \\
  -H "Authorization: Bearer pio-sk-..."

# Status mungkin: PENDING, RUNNING, SUCCEEDED, FAILED
# Kalau SUCCEEDED, ambil video_url dari response`}</CodeBlock>
          </div>
        </div>
      )}

      {/* OCR */}
      {docTab === "ocr" && (
        <div className="space-y-6">
          <Card>
            <SectionHeader icon={ScanText} title="OCR — baca teks dari gambar" subtitle="Extract teks dari foto, dokumen, screenshot, dll" />
            <div className="ml-7 flex items-center gap-2 text-xs">
              <span className="px-2 py-0.5 rounded bg-green-500/10 text-green-600 dark:text-green-400 font-mono font-semibold">POST</span>
              <code className="text-muted-foreground">{baseUrl}/ocr</code>
            </div>
          </Card>

          <div>
            <h3 className="font-semibold mb-3 text-sm">Pakai URL gambar</h3>
            <CodeBlock>{`curl ${baseUrl}/ocr \\
  -H "Authorization: Bearer pio-sk-..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "image": "https://example.com/foto-dokumen.jpg",
    "prompt": "Baca semua teks dengan akurat"
  }'`}</CodeBlock>
          </div>

          <div>
            <h3 className="font-semibold mb-3 text-sm">Pakai gambar dari file lokal (base64)</h3>
            <CodeBlock>{`curl ${baseUrl}/ocr \\
  -H "Authorization: Bearer pio-sk-..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "image": "data:image/png;base64,iVBORw0KGgoAAAANS..."
  }'`}</CodeBlock>
            <Callout icon={Lightbulb} color="blue">
              Field <code>prompt</code> opsional — kalau kosong, default-nya cuma "baca semua teks akurat". Kamu bisa kasih instruksi lain misal "ekstrak nomor invoice aja".
            </Callout>
          </div>
        </div>
      )}

      {/* FILE */}
      {docTab === "file" && (
        <div className="space-y-6">
          <Card>
            <SectionHeader icon={FileText} title="Upload file" subtitle="Upload PDF, dokumen, dll buat dipakai sebagai konteks di chat" />
            <div className="ml-7 flex items-center gap-2 text-xs">
              <span className="px-2 py-0.5 rounded bg-green-500/10 text-green-600 dark:text-green-400 font-mono font-semibold">POST</span>
              <code className="text-muted-foreground">{baseUrl}/files</code>
            </div>
          </Card>

          <div>
            <h3 className="font-semibold mb-3 text-sm">Upload</h3>
            <CodeBlock>{`curl ${baseUrl}/files \\
  -H "Authorization: Bearer pio-sk-..." \\
  -F "file=@dokumen.pdf" \\
  -F "purpose=file-extract"`}</CodeBlock>
            <p className="text-xs text-muted-foreground mt-2">Response berisi <code>id</code> file yang bisa dipakai di chat completion sebagai referensi.</p>
          </div>

          <Callout icon={AlertCircle} color="amber">
            Maksimal 5 MB per upload. Format yang di-support: PDF, DOCX, TXT, dan format dokumen umum lain.
          </Callout>
        </div>
      )}

      {/* REFERENSI */}
      {docTab === "ref" && (
        <div className="space-y-6">
          <Card>
            <SectionHeader icon={Layers} title="Semua endpoint" subtitle="Daftar lengkap apa aja yang bisa dipanggil" />
            <div className="border border-border rounded-lg overflow-hidden text-sm mt-4">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Method</th>
                    <th className="text-left px-3 py-2 font-medium">Path</th>
                    <th className="text-left px-3 py-2 font-medium">Fungsi</th>
                  </tr>
                </thead>
                <tbody className="font-mono text-xs">
                  <Row m="GET" p="/v1/models" d="List model" />
                  <Row m="POST" p="/v1/chat/completions" d="Chat (streaming/non)" />
                  <Row m="POST" p="/v1/embeddings" d="Embeddings" />
                  <Row m="POST" p="/v1/images/generations" d="Generate gambar" />
                  <Row m="POST" p="/v1/videos/generations" d="Generate video (async)" />
                  <Row m="GET" p="/v1/videos/generations/:id" d="Status video" />
                  <Row m="POST" p="/v1/ocr" d="OCR gambar" />
                  <Row m="POST" p="/v1/files" d="Upload file" />
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <SectionHeader icon={Clock} title="Limit harian" subtitle="Reset setiap tengah malam WIB" color="text-amber-500" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
              <div className="p-3 rounded-lg bg-muted/40 text-center">
                <p className="text-2xl font-bold">200K</p>
                <p className="text-xs text-muted-foreground mt-1">Token / hari</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/40 text-center">
                <p className="text-2xl font-bold">50</p>
                <p className="text-xs text-muted-foreground mt-1">Gambar / hari</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/40 text-center">
                <p className="text-2xl font-bold">10</p>
                <p className="text-xs text-muted-foreground mt-1">Video / hari</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/40 text-center">
                <p className="text-2xl font-bold">1.000</p>
                <p className="text-xs text-muted-foreground mt-1">Request / hari</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-4">Limit ini terpisah dari pemakaian via web app PioDev.</p>
          </Card>

          <Card>
            <SectionHeader icon={AlertCircle} title="Kode error umum" color="text-red-500" />
            <div className="space-y-2 mt-3">
              <div className="flex gap-3 text-sm">
                <code className="shrink-0 px-2 py-0.5 rounded bg-red-500/10 text-red-600 dark:text-red-400 font-mono text-xs h-fit">401</code>
                <p className="text-muted-foreground">Key salah, ga ada, atau sudah di-revoke. Cek lagi header Authorization.</p>
              </div>
              <div className="flex gap-3 text-sm">
                <code className="shrink-0 px-2 py-0.5 rounded bg-red-500/10 text-red-600 dark:text-red-400 font-mono text-xs h-fit">403</code>
                <p className="text-muted-foreground">Kamu bukan user Plus aktif. Upgrade dulu di halaman Plus.</p>
              </div>
              <div className="flex gap-3 text-sm">
                <code className="shrink-0 px-2 py-0.5 rounded bg-red-500/10 text-red-600 dark:text-red-400 font-mono text-xs h-fit">429</code>
                <p className="text-muted-foreground">Limit harian habis. Tunggu reset tengah malam WIB.</p>
              </div>
              <div className="flex gap-3 text-sm">
                <code className="shrink-0 px-2 py-0.5 rounded bg-red-500/10 text-red-600 dark:text-red-400 font-mono text-xs h-fit">400</code>
                <p className="text-muted-foreground">Request kamu salah format. Cek field yang wajib (misal <code>prompt</code> atau <code>messages</code>).</p>
              </div>
              <div className="flex gap-3 text-sm">
                <code className="shrink-0 px-2 py-0.5 rounded bg-red-500/10 text-red-600 dark:text-red-400 font-mono text-xs h-fit">502</code>
                <p className="text-muted-foreground">Server upstream lagi bermasalah. Coba lagi sebentar.</p>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function ParamRow({ name, required, text }: { name: string; required?: boolean; text: string }) {
  return (
    <tr className="border-t border-border">
      <td className="px-3 py-2 font-mono text-xs">{name}</td>
      <td className="px-3 py-2">
        {required ? (
          <span className="text-xs text-red-500 font-medium">wajib</span>
        ) : (
          <span className="text-xs text-muted-foreground">opsional</span>
        )}
      </td>
      <td className="px-3 py-2 text-muted-foreground">{text}</td>
    </tr>
  );
}

function Row({ m, p, d }: { m: string; p: string; d: string }) {
  const colors: Record<string, string> = {
    GET: "text-blue-500",
    POST: "text-green-500",
    DELETE: "text-red-500",
  };
  return (
    <tr className="border-t border-border">
      <td className={cn("px-3 py-2 font-semibold", colors[m])}>{m}</td>
      <td className="px-3 py-2">{p}</td>
      <td className="px-3 py-2 font-sans text-muted-foreground">{d}</td>
    </tr>
  );
}
