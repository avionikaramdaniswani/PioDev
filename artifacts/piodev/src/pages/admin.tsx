import { useEffect, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useAdmin, type AdminUser, type PremiumApplication } from "@/hooks/use-admin";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  LayoutDashboard, Users, ArrowLeft, Search,
  Shield, ShieldOff, Trash2, RefreshCw,
  Zap, MessageSquare, TrendingUp, Newspaper, Plus,
  Star, StarOff, Check, X, ExternalLink, Loader2, Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/logo";

type Section = "ringkasan" | "pengguna" | "changelog" | "premium";

const NAV_ITEMS: { id: Section; label: string; icon: React.ElementType }[] = [
  { id: "ringkasan",  label: "Ringkasan",  icon: LayoutDashboard },
  { id: "pengguna",   label: "Pengguna",   icon: Users },
  { id: "changelog",  label: "What's New", icon: Newspaper },
  { id: "premium",    label: "Plus Terbatas", icon: Star },
];

function useToast() {
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const show = useCallback((msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }, []);
  return { toast, show };
}

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 flex items-start gap-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-bold text-foreground tabular-nums">{value}</div>
        <div className="text-sm text-muted-foreground leading-tight">{label}</div>
        {sub && <div className="text-xs text-muted-foreground/70 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

function SectionRingkasan({ stats, dailyUsage }: {
  stats: ReturnType<typeof useAdmin>["stats"];
  dailyUsage: ReturnType<typeof useAdmin>["dailyUsage"];
}) {
  const totalTokenK = stats?.totalTokens
    ? stats.totalTokens >= 1_000_000
      ? `${(stats.totalTokens / 1_000_000).toFixed(2)}M`
      : `${(stats.totalTokens / 1_000).toFixed(1)}K`
    : "—";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-foreground mb-1">Ringkasan Platform</h2>
        <p className="text-sm text-muted-foreground">Statistik keseluruhan PioCode 2.0</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Users}         label="Total User"      value={stats?.totalUsers ?? "—"}          color="bg-blue-500" />
        <StatCard icon={MessageSquare} label="Percakapan"       value={stats?.totalConversations ?? "—"} color="bg-violet-500" />
        <StatCard icon={TrendingUp}    label="Total Pesan"      value={stats?.totalMessages ?? "—"}      color="bg-green-500" />
        <StatCard icon={Zap}           label="Token Terpakai"   value={totalTokenK}                      color="bg-orange-500" />
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-medium text-foreground text-sm">Penggunaan Token — 7 Hari Terakhir</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Agregat semua user</p>
          </div>
        </div>
        {dailyUsage.every((d) => d.token === 0) ? (
          <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">
            Belum ada data penggunaan dalam 7 hari terakhir.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={dailyUsage} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} className="text-muted-foreground" />
              <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(v: number) => [v.toLocaleString(), "Token"]}
              />
              <Bar dataKey="token" radius={[4, 4, 0, 0]} className="fill-primary" fill="hsl(var(--primary))" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

const PRESET_DURATIONS = [
  { label: "7 Hari",   days: 7 },
  { label: "14 Hari",  days: 14 },
  { label: "30 Hari",  days: 30 },
  { label: "3 Bulan",  days: 90 },
  { label: "6 Bulan",  days: 180 },
  { label: "1 Tahun",  days: 365 },
];

function PlusDurationDialog({ user, onConfirm, onClose }: {
  user: AdminUser | null;
  onConfirm: (u: AdminUser, days: number, tier: "plus" | "pro") => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<number>(30);
  const [customVal, setCustomVal] = useState("");
  const [customUnit, setCustomUnit] = useState<"hari" | "bulan">("hari");
  const [useCustom, setUseCustom] = useState(false);
  const [tier, setTier] = useState<"plus" | "pro">("plus");

  const effectiveDays = useCustom
    ? Math.round(Number(customVal) * (customUnit === "bulan" ? 30 : 1))
    : selected;

  const valid = effectiveDays > 0 && Number.isFinite(effectiveDays);

  if (!user) return null;

  const tierLabel = tier === "pro" ? "Pro" : "Plus";
  const presetActiveClass = tier === "pro"
    ? "bg-amber-600 border-amber-600 text-white"
    : "bg-amber-500 border-amber-500 text-white";

  return (
    <Dialog open={!!user} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Calendar className="w-4 h-4 text-amber-500" />
            Beri {tierLabel} untuk {user.full_name || user.email.split("@")[0]}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Tier selector */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Tier</p>
            <div className="grid grid-cols-2 gap-2">
              {(["plus", "pro"] as const).map((t) => {
                const active = tier === t;
                const proStyle = t === "pro";
                return (
                  <button
                    key={t}
                    onClick={() => setTier(t)}
                    data-testid={`button-tier-${t}`}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? proStyle
                          ? "bg-amber-600 border-amber-600 text-white"
                          : "bg-amber-500 border-amber-500 text-white"
                        : "border-border bg-muted/30 text-foreground hover:border-amber-400 hover:bg-amber-500/10"
                    )}
                  >
                    {t === "pro" ? "Pro · 360k/40/20" : "Plus · 200k/25/12"}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Preset chips */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Durasi</p>
            <div className="grid grid-cols-3 gap-2">
              {PRESET_DURATIONS.map((p) => (
                <button
                  key={p.days}
                  onClick={() => { setSelected(p.days); setUseCustom(false); }}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                    !useCustom && selected === p.days
                      ? presetActiveClass
                      : "border-border bg-muted/30 text-foreground hover:border-amber-400 hover:bg-amber-500/10"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom */}
          <div className="space-y-1.5">
            <button
              onClick={() => setUseCustom(true)}
              className={cn(
                "w-full text-left text-xs px-3 py-2 rounded-lg border transition-colors",
                useCustom
                  ? "border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  : "border-dashed border-border text-muted-foreground hover:border-amber-400"
              )}
            >
              Atau masukkan durasi kustom
            </button>
            {useCustom && (
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={1}
                  placeholder="Jumlah"
                  value={customVal}
                  onChange={(e) => setCustomVal(e.target.value)}
                  className="flex-1"
                  autoFocus
                />
                <div className="flex rounded-lg border border-border overflow-hidden">
                  {(["hari", "bulan"] as const).map((u) => (
                    <button
                      key={u}
                      onClick={() => setCustomUnit(u)}
                      className={cn(
                        "px-3 text-sm transition-colors",
                        customUnit === u ? "bg-amber-500 text-white" : "text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {valid && (
            <p className="text-xs text-muted-foreground text-center">
              {tierLabel} aktif selama <span className="font-semibold text-foreground">{effectiveDays} hari</span>
              {" "}(hingga {new Date(Date.now() + effectiveDays * 86_400_000).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })})
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Batal</Button>
          <Button
            size="sm"
            disabled={!valid}
            className={cn(
              "text-white",
              tier === "pro" ? "bg-amber-600 hover:bg-amber-700" : "bg-amber-500 hover:bg-amber-600",
            )}
            onClick={() => valid && onConfirm(user, effectiveDays, tier)}
          >
            <Star className="w-3.5 h-3.5 mr-1.5" />
            Aktifkan {tierLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SectionPengguna({
  users, isLoading, error, currentUserId, onToggleRole, onTogglePremium, onRevokePlus, onDelete,
}: {
  users: AdminUser[];
  isLoading: boolean;
  error: string | null;
  currentUserId?: string;
  onToggleRole: (u: AdminUser) => void;
  onTogglePremium: (u: AdminUser) => void;
  onRevokePlus: (u: AdminUser) => void;
  onDelete: (u: AdminUser) => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = users.filter(
    (u) =>
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.full_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-foreground mb-1">Manajemen Pengguna</h2>
        <p className="text-sm text-muted-foreground">{users.length} pengguna terdaftar</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Cari email atau nama..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm px-4 py-3">
          {error}
          <div className="text-xs opacity-75 mt-1">Pastikan sudah menjalankan migration SQL di Supabase.</div>
        </div>
      )}

      <div className="rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Pengguna</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Role / Plus</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Bergabung</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Login Terakhir</th>
                <th className="w-28 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="text-center py-14 text-muted-foreground text-sm">Memuat data...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-14 text-muted-foreground text-sm">
                  {search ? "Tidak ada hasil." : "Belum ada pengguna."}
                </td></tr>
              ) : (
                filtered.map((u) => (
                  <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 min-w-0">
                      <div className="font-medium text-foreground truncate leading-tight">{u.email}</div>
                      {u.full_name && <div className="text-xs text-muted-foreground mt-0.5 truncate">{u.full_name}</div>}
                      {u.id === currentUserId && <div className="text-xs text-primary mt-0.5">Ini kamu</div>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant={u.role === "admin" ? "default" : "secondary"} className="shrink-0">
                          {u.role === "admin" ? "Admin" : "User"}
                        </Badge>
                        {u.is_premium && (
                          <Badge className={cn(
                            "shrink-0 border hover:opacity-90",
                            u.tier === "pro"
                              ? "bg-amber-600/15 text-amber-700 dark:text-amber-300 border-amber-600/25"
                              : "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20",
                          )}>
                            {u.tier === "pro" ? "Pro" : "Plus"}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-sm hidden md:table-cell whitespace-nowrap">
                      {new Date(u.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-sm hidden lg:table-cell whitespace-nowrap">
                      {u.last_sign_in_at
                        ? new Date(u.last_sign_in_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-0.5">
                        {/* Toggle Premium */}
                        <button
                          title={u.is_premium ? `Cabut ${u.tier === "pro" ? "Pro" : "Plus"}` : "Beri Plus / Pro"}
                          disabled={u.id === currentUserId}
                          onClick={() => u.is_premium ? onRevokePlus(u) : onTogglePremium(u)}
                          className="p-1.5 rounded-md hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {u.is_premium
                            ? <StarOff className={cn("w-4 h-4", u.tier === "pro" ? "text-amber-600" : "text-amber-500")} />
                            : <Star className="w-4 h-4 text-amber-400/60 hover:text-amber-500" />
                          }
                        </button>
                        {/* Toggle Role */}
                        <button
                          title={u.role === "admin" ? "Turunkan ke User" : "Jadikan Admin"}
                          disabled={u.id === currentUserId}
                          onClick={() => onToggleRole(u)}
                          className="p-1.5 rounded-md hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {u.role === "admin"
                            ? <ShieldOff className="w-4 h-4 text-orange-500" />
                            : <Shield className="w-4 h-4 text-blue-500" />
                          }
                        </button>
                        <button
                          title="Hapus pengguna"
                          disabled={u.id === currentUserId}
                          onClick={() => onDelete(u)}
                          className="p-1.5 rounded-md hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

type ChangelogEntry = {
  id: number; title: string; description: string;
  tag: "new" | "improvement" | "fix" | "removed"; created_at: string;
};

const TAG_LABELS = { new: "Baru", improvement: "Peningkatan", fix: "Perbaikan", removed: "Dihapus" };
const TAG_COLORS: Record<string, string> = {
  new: "bg-blue-500/15 text-blue-500 border-blue-500/20",
  improvement: "bg-green-500/15 text-green-600 border-green-500/20",
  fix: "bg-orange-500/15 text-orange-500 border-orange-500/20",
  removed: "bg-red-500/15 text-red-500 border-red-500/20",
};

async function authHeader() {
  const { data: { session } } = await supabase.auth.getSession();
  return { Authorization: `Bearer ${session?.access_token ?? ""}`, "Content-Type": "application/json" };
}

function SectionChangelog({ showToast }: { showToast: (msg: string, ok: boolean) => void }) {
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", tag: "new" });

  const load = useCallback(async () => {
    setIsFetching(true);
    const r = await fetch("/api/changelog");
    const data = await r.json();
    setEntries(Array.isArray(data) ? data : []);
    setIsFetching(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const title = ((fd.get("title") as string) ?? "").trim();
    const description = ((fd.get("description") as string) ?? "").trim();
    const tag = (fd.get("tag") as string) ?? form.tag ?? "new";
    if (!title || !description) {
      showToast("Title dan deskripsi wajib diisi.", false); return;
    }
    setIsSaving(true);
    try {
      const r = await fetch("/api/admin/changelog", {
        method: "POST",
        headers: await authHeader(),
        body: JSON.stringify({ title, description, tag }),
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error); }
      setForm({ title: "", description: "", tag: "new" });
      showToast("Entry berhasil ditambahkan.", true);
      load();
    } catch (e: any) {
      showToast(e.message, false);
    } finally { setIsSaving(false); }
  }

  async function handleDelete(id: number) {
    try {
      const r = await fetch(`/api/admin/changelog/${id}`, { method: "DELETE", headers: await authHeader() });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error); }
      showToast("Entry dihapus.", true);
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch (e: any) { showToast(e.message, false); }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-foreground mb-1">What's New</h2>
        <p className="text-sm text-muted-foreground">Kelola entri changelog yang ditampilkan ke pengguna.</p>
      </div>

      {/* Add form */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-medium text-foreground mb-4">Tambah Entri Baru</h3>
        <form onSubmit={handleAdd} className="space-y-3">
          <Input
            name="title"
            placeholder="Judul singkat, misal: Fitur Web Search ditingkatkan"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            className="text-sm"
          />
          <textarea
            name="description"
            placeholder="Deskripsi lebih detail tentang update ini..."
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={3}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 resize-none"
          />
          <div className="flex items-center gap-2">
            <select
              name="tag"
              value={form.tag}
              onChange={(e) => setForm((f) => ({ ...f, tag: e.target.value }))}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="new">Baru</option>
              <option value="improvement">Peningkatan</option>
              <option value="fix">Perbaikan</option>
              <option value="removed">Dihapus</option>
            </select>
            <Button type="submit" disabled={isSaving} size="sm" className="gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              {isSaving ? "Menyimpan..." : "Tambah"}
            </Button>
          </div>
        </form>
      </div>

      {/* Entry list */}
      <div>
        <h3 className="text-sm font-medium text-foreground mb-3">Entri yang Dipublish ({entries.length})</h3>
        {isFetching ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="rounded-xl border border-border p-4 animate-pulse">
                <div className="h-4 bg-muted rounded w-1/3 mb-2" />
                <div className="h-3 bg-muted rounded w-full" />
              </div>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Belum ada entri. Tambahkan update pertama di atas!
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map((entry) => (
              <div key={entry.id} className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border", TAG_COLORS[entry.tag])}>
                      {TAG_LABELS[entry.tag as keyof typeof TAG_LABELS]}
                    </span>
                    <span className="text-[11px] text-muted-foreground">{formatDate(entry.created_at)}</span>
                  </div>
                  <p className="text-sm font-medium text-foreground truncate">{entry.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{entry.description}</p>
                </div>
                <button
                  onClick={() => handleDelete(entry.id)}
                  className="p-1.5 text-muted-foreground hover:text-red-500 rounded-md hover:bg-red-500/10 transition-colors shrink-0"
                  title="Hapus"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const STATUS_STYLE: Record<string, string> = {
  pending:  "bg-yellow-500/15 text-yellow-600 border-yellow-500/20",
  approved: "bg-green-500/15 text-green-600 border-green-500/20",
  rejected: "bg-red-500/15 text-red-500 border-red-500/20",
};
const STATUS_LABEL: Record<string, string> = {
  pending: "Menunggu", approved: "Disetujui", rejected: "Ditolak",
};

function SectionPremium({
  applications, onApprove, onReject, showToast,
}: {
  applications: PremiumApplication[];
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string, note: string) => Promise<void>;
  showToast: (msg: string, ok: boolean) => void;
}) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const pending   = applications.filter((a) => a.status === "pending");
  const processed = applications.filter((a) => a.status !== "pending");

  function startReject(id: string) {
    setRejectingId(id);
    setRejectNote("");
  }

  function cancelReject() {
    setRejectingId(null);
    setRejectNote("");
  }

  async function handleApprove(id: string) {
    setLoadingId(id);
    try {
      await onApprove(id);
      showToast("Aplikasi disetujui!", true);
    } catch (e: any) {
      showToast(e.message, false);
    } finally {
      setLoadingId(null);
    }
  }

  async function handleReject(id: string) {
    setLoadingId(id);
    try {
      await onReject(id, rejectNote);
      showToast("Aplikasi ditolak.", false);
      setRejectingId(null);
      setRejectNote("");
    } catch (e: any) {
      showToast(e.message, false);
    } finally {
      setLoadingId(null);
    }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-foreground mb-1">Penawaran Plus Terbatas</h2>
        <p className="text-sm text-muted-foreground">
          {pending.length} menunggu review · {applications.filter(a => a.status === "approved").length} disetujui
        </p>
      </div>

      {/* Pending */}
      <div>
        <h3 className="text-sm font-medium text-foreground mb-3">Menunggu Review ({pending.length})</h3>
        {pending.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Tidak ada aplikasi yang menunggu review.
          </div>
        ) : (
          <div className="space-y-2">
            {pending.map((app) => (
              <div key={app.id} className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="flex items-center gap-4 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground text-sm truncate">{app.email || app.user_id}</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-xs text-muted-foreground">@{app.instagram}</span>
                      <a href={`https://instagram.com/${app.instagram}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80 transition-colors">
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <div className="text-[11px] text-muted-foreground/60 mt-0.5">{formatDate(app.created_at)}</div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {rejectingId === app.id ? (
                      <button onClick={cancelReject} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-muted text-muted-foreground hover:bg-muted/80 transition-colors">
                        Batal
                      </button>
                    ) : (
                      <button onClick={() => startReject(app.id)} disabled={loadingId === app.id} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors disabled:opacity-50">
                        <X className="w-3 h-3" /> Tolak
                      </button>
                    )}
                    <button onClick={() => handleApprove(app.id)} disabled={loadingId === app.id || rejectingId === app.id} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-green-500/10 text-green-600 hover:bg-green-500/20 transition-colors disabled:opacity-50">
                      <Check className="w-3 h-3" /> Setujui
                    </button>
                  </div>
                </div>
                {rejectingId === app.id && (
                  <div className="border-t border-red-500/20 bg-red-500/5 px-4 py-3 flex flex-col gap-2">
                    <label className="text-xs font-medium text-red-500">Alasan penolakan (opsional)</label>
                    <textarea
                      value={rejectNote}
                      onChange={(e) => setRejectNote(e.target.value)}
                      placeholder="Contoh: Screenshot tidak jelas, belum follow kedua akun..."
                      rows={2}
                      autoFocus
                      className="w-full rounded-lg border border-red-500/20 bg-background text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500/20 placeholder:text-muted-foreground resize-none"
                    />
                    <button
                      onClick={() => handleReject(app.id)}
                      disabled={loadingId === app.id}
                      className="self-end flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50"
                    >
                      {loadingId === app.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                      Konfirmasi Tolak
                    </button>
                  </div>
                )}
                {(app.screenshot_url || app.screenshot_url_2) && (
                  <div className="border-t border-border grid grid-cols-2 divide-x divide-border">
                    {[
                      { url: app.screenshot_url, label: "not.funn_" },
                      { url: app.screenshot_url_2, label: "tiarafrtm" },
                    ].map(({ url, label }) =>
                      url ? (
                        <a key={label} href={url} target="_blank" rel="noopener noreferrer" className="relative block hover:opacity-90 transition-opacity group">
                          <img src={url} alt={`Screenshot @${label}`} className="w-full max-h-44 object-cover object-top" />
                          <span className="absolute bottom-1.5 left-1.5 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded font-mono">@{label}</span>
                        </a>
                      ) : (
                        <div key={label} className="flex items-center justify-center text-xs text-muted-foreground p-4">Tidak ada</div>
                      )
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Processed */}
      {processed.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-foreground mb-3">Riwayat ({processed.length})</h3>
          <div className="space-y-2">
            {processed.map((app) => (
              <div key={app.id} className="rounded-xl border border-border bg-card/50 overflow-hidden">
                <div className="flex items-center gap-4 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground text-sm truncate">{app.email || app.user_id}</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-xs text-muted-foreground">@{app.instagram}</span>
                      <a href={`https://instagram.com/${app.instagram}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80 transition-colors">
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                  <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0", STATUS_STYLE[app.status])}>
                    {STATUS_LABEL[app.status]}
                  </span>
                </div>
                {app.status === "rejected" && app.rejection_note && (
                  <div className="border-t border-red-500/15 bg-red-500/5 px-4 py-2.5">
                    <p className="text-xs text-red-500/80"><span className="font-semibold">Alasan:</span> {app.rejection_note}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const {
    users, stats, dailyUsage, premiumApplications, isLoading, error,
    fetchUsers, fetchStats, fetchDailyUsage, fetchPremiumApplications,
    updateRole, updatePremium, deleteUser, approveApplication, rejectApplication,
  } = useAdmin();

  const [activeSection, setActiveSection] = useState<Section>("ringkasan");
  const [toDelete, setToDelete] = useState<AdminUser | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [givePlusUser, setGivePlusUser] = useState<AdminUser | null>(null);
  const { toast, show: showToast } = useToast();

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) setLocation("/chat");
  }, [authLoading, user, isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    fetchUsers();
    fetchStats();
    fetchDailyUsage();
    fetchPremiumApplications();
  }, [isAdmin]);

  async function handleToggleRole(u: AdminUser) {
    if (u.id === user?.id) { showToast("Tidak bisa mengubah role akun sendiri.", false); return; }
    try {
      const newRole = u.role === "admin" ? "user" : "admin";
      await updateRole(u.id, newRole);
      showToast(`Role ${u.email} diubah ke ${newRole}.`, true);
    } catch (e: any) {
      showToast(e.message, false);
    }
  }

  function handleTogglePremium(u: AdminUser) {
    if (u.id === user?.id) { showToast("Tidak bisa mengubah status premium akun sendiri.", false); return; }
    setGivePlusUser(u);
  }

  async function handleGivePlus(u: AdminUser, days: number, tier: "plus" | "pro" = "plus") {
    setGivePlusUser(null);
    try {
      await updatePremium(u.id, true, { days, tier });
      const label = tier === "pro" ? "Pro" : "Plus";
      showToast(`✓ ${u.email} diberi ${label} selama ${days} hari.`, true);
    } catch (e: any) {
      showToast(e.message, false);
    }
  }

  async function handleRevokePlus(u: AdminUser) {
    if (u.id === user?.id) { showToast("Tidak bisa mengubah status premium akun sendiri.", false); return; }
    try {
      await updatePremium(u.id, false);
      const label = u.tier === "pro" ? "Pro" : "Plus";
      showToast(`× ${label} ${u.email} dicabut.`, true);
    } catch (e: any) {
      showToast(e.message, false);
    }
  }

  async function handleDelete() {
    if (!toDelete) return;
    setDeletingId(toDelete.id);
    try {
      await deleteUser(toDelete.id);
      showToast(`${toDelete.email} berhasil dihapus.`, true);
    } catch (e: any) {
      showToast(e.message, false);
    } finally {
      setDeletingId(null);
      setToDelete(null);
    }
  }

  function handleRefresh() {
    fetchUsers();
    fetchStats();
    fetchDailyUsage();
    fetchPremiumApplications();
  }

  if (authLoading || !isAdmin) return null;

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">

      {/* ── Sidebar (desktop) ───────────────────────────────────────────────── */}
      <aside className="hidden md:flex flex-col w-56 shrink-0 border-r border-border bg-sidebar">
        {/* Brand */}
        <div className="px-4 py-4 flex items-center gap-2 border-b border-sidebar-border">
          <Logo size={28} />
          <div>
            <div className="text-sm font-semibold text-sidebar-foreground leading-tight">PioCode Admin</div>
            <div className="text-[10px] text-sidebar-foreground/50">Dashboard</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveSection(id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left",
                activeSection === id
                  ? "bg-primary/10 text-primary"
                  : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-2 py-3 border-t border-sidebar-border space-y-0.5">
          <button
            onClick={handleRefresh}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
          >
            <RefreshCw className="w-4 h-4 shrink-0" />
            Refresh data
          </button>
          <button
            onClick={() => setLocation("/chat")}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" />
            Kembali ke Chat
          </button>
        </div>
      </aside>

      {/* ── Main content ────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Mobile header */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-background/80 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-2">
            <button onClick={() => setLocation("/chat")} className="p-1.5 rounded-md hover:bg-muted transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="font-semibold text-sm">Admin Dashboard</span>
          </div>
          <button onClick={handleRefresh} className="p-1.5 rounded-md hover:bg-muted transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </header>

        {/* Desktop content header */}
        <div className="hidden md:flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div>
            <h1 className="text-lg font-semibold text-foreground">
              {NAV_ITEMS.find(n => n.id === activeSection)?.label}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {user?.email}
            </p>
          </div>
          <button
            onClick={handleRefresh}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg hover:bg-muted"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto px-4 md:px-6 py-6">
          {activeSection === "ringkasan" && (
            <SectionRingkasan stats={stats} dailyUsage={dailyUsage} />
          )}
          {activeSection === "pengguna" && (
            <SectionPengguna
              users={users}
              isLoading={isLoading}
              error={error}
              currentUserId={user?.id}
              onToggleRole={handleToggleRole}
              onTogglePremium={handleTogglePremium}
              onRevokePlus={handleRevokePlus}
              onDelete={setToDelete}
            />
          )}
          {activeSection === "changelog" && (
            <SectionChangelog showToast={showToast} />
          )}
          {activeSection === "premium" && (
            <SectionPremium
              applications={premiumApplications}
              onApprove={approveApplication}
              onReject={rejectApplication}
              showToast={showToast}
            />
          )}
        </main>

        {/* Mobile bottom tab bar */}
        <nav className="md:hidden flex border-t border-border bg-background shrink-0">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveSection(id)}
              className={cn(
                "flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors",
                activeSection === id
                  ? "text-primary"
                  : "text-muted-foreground"
              )}
            >
              <Icon className="w-5 h-5" />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* ── Delete confirm ─────────────────────────────────────────────────── */}
      <PlusDurationDialog
        key={givePlusUser?.id ?? "none"}
        user={givePlusUser}
        onConfirm={handleGivePlus}
        onClose={() => setGivePlusUser(null)}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus pengguna ini?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{toDelete?.email}</strong> akan dihapus permanen beserta semua datanya.
              Tindakan ini tidak bisa dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
              disabled={!!deletingId}
            >
              {deletingId ? "Menghapus..." : "Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Toast ─────────────────────────────────────────────────────────── */}
      {toast && (
        <div className={cn(
          "fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-full text-sm font-medium shadow-lg",
          toast.ok ? "bg-green-600 text-white" : "bg-destructive text-destructive-foreground"
        )}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
