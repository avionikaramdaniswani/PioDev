import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { User, Lock, Check, Eye, EyeOff, Sun, Moon, Menu, X, BarChart2, Sparkles, Trash2, Star, Zap, ImageIcon, Clapperboard, ChevronRight, MessageSquare, Shield, AlertTriangle, Mail } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { useChat } from "@/hooks/use-chat";
import { ChatSidebar } from "@/components/chat-sidebar";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { useShowTokenUsage, useTokenUsageData } from "@/hooks/use-token-usage";
import { usePersonalization } from "@/hooks/use-personalization";

type Section = "profil" | "personalisasi" | "statistik" | "plus";

const navItems: { id: Section; label: string; icon: typeof User }[] = [
  { id: "profil", label: "Profil", icon: User },
  { id: "personalisasi", label: "Personalisasi", icon: Sparkles },
  { id: "statistik", label: "Statistik", icon: BarChart2 },
  { id: "plus", label: "Plus", icon: Star },
];

export default function Settings() {
  const [, navigate] = useLocation();
  const { user, logout, isAdmin } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { show: showTokenUsage, toggle: toggleTokenUsage } = useShowTokenUsage();

  const { chats, activeChat, createNewChat, selectChat, deleteChat, deleteAllChats, updateChatTitle } = useChat(user?.id);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(true);
  const [activeSection, setActiveSection] = useState<Section>("profil");

  const { data: persona, save: savePersona, isSaving: personaSaving } = usePersonalization();

  // Load token usage langsung dari Supabase
  const { todayUsage, weekUsage, monthUsage, daily7, isLoading: statsLoading } = useTokenUsageData(user?.id);

  // Usage summary untuk section Plus
  type UsageSummary = {
    isPremium: boolean; isAdmin: boolean; premiumExpiresAt: string | null;
    tier?: "free" | "plus" | "pro";
    token: { used: number; limit: number };
    image: { used: number; limit: number };
    video: { credits: number; max: number };
  };
  const [usageSummary, setUsageSummary] = useState<UsageSummary | null>(null);
  const [usageSummaryLoading, setUsageSummaryLoading] = useState(false);

  useEffect(() => {
    if (activeSection !== "plus") return;
    let cancelled = false;
    setUsageSummaryLoading(true);
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/me/usage-summary", {
        headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
      });
      if (!cancelled && res.ok) setUsageSummary(await res.json());
      if (!cancelled) setUsageSummaryLoading(false);
    })();
    return () => { cancelled = true; };
  }, [activeSection]);

  const [name, setName] = useState(user?.name || "");
  const [nameSaving, setNameSaving] = useState(false);
  const [nameSuccess, setNameSuccess] = useState(false);
  const [nameError, setNameError] = useState("");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwError, setPwError] = useState("");

  if (!user) return null;

  const handleSaveName = async () => {
    if (!name.trim()) { setNameError("Nama tidak boleh kosong."); return; }
    setNameSaving(true); setNameError(""); setNameSuccess(false);
    const { error } = await supabase.auth.updateUser({ data: { full_name: name.trim() } });
    setNameSaving(false);
    if (error) { setNameError("Gagal menyimpan. Coba lagi."); }
    else { setNameSuccess(true); setTimeout(() => setNameSuccess(false), 3000); }
  };

  const handleSavePassword = async () => {
    if (!newPassword) { setPwError("Password baru tidak boleh kosong."); return; }
    if (newPassword.length < 6) { setPwError("Password minimal 6 karakter."); return; }
    if (newPassword !== confirmPassword) { setPwError("Konfirmasi password tidak cocok."); return; }
    setPwSaving(true); setPwError(""); setPwSuccess(false);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPwSaving(false);
    if (error) { setPwError("Gagal mengubah password. Coba lagi."); }
    else {
      setPwSuccess(true);
      setNewPassword(""); setConfirmPassword("");
      setTimeout(() => setPwSuccess(false), 3000);
    }
  };

  const sidebarProps = {
    user,
    chats,
    activeChatId: activeChat?.id,
    createNewChat: () => { createNewChat(); navigate("/chat"); },
    selectChat: (id: string) => { selectChat(id); navigate("/chat"); },
    deleteChat,
    updateChatTitle,
    logout,
    isAdmin,
  };

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden font-sans">

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isMobileSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsMobileSidebarOpen(false)}
              className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 md:hidden"
            />
            <motion.div
              initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-72 bg-sidebar border-r border-sidebar-border z-50 flex flex-col md:hidden shadow-2xl"
            >
              <div className="flex items-center justify-end p-2 border-b border-sidebar-border">
                <button
                  onClick={() => setIsMobileSidebarOpen(false)}
                  className="p-2 text-sidebar-foreground/60 hover:text-sidebar-foreground rounded-lg hover:bg-sidebar-accent/50 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <ChatSidebar {...sidebarProps} createNewChat={() => { createNewChat(); navigate("/chat"); setIsMobileSidebarOpen(false); }} selectChat={(id) => { selectChat(id); navigate("/chat"); setIsMobileSidebarOpen(false); }} />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <AnimatePresence initial={false}>
        {isDesktopSidebarOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 288, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: "spring", damping: 30, stiffness: 250 }}
            className="hidden md:flex flex-col bg-sidebar border-r border-sidebar-border overflow-hidden shrink-0"
          >
            <ChatSidebar {...sidebarProps} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Panel + Content */}
      <div className="flex flex-1 min-w-0 overflow-hidden">

        {/* Settings Nav — hidden on mobile, shown as side panel on desktop */}
        <div className="hidden md:flex w-48 shrink-0 border-r border-border flex-col bg-sidebar/30 overflow-y-auto">
          <div className="p-5 pb-3">
            <h1 className="text-xl font-bold text-foreground">Pengaturan</h1>
          </div>
          <nav className="px-3 py-2 space-y-0.5">
            {navItems.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveSection(id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-colors text-left",
                  activeSection === id
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground"
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </button>
            ))}
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {/* Top Bar */}
          <header className="h-14 flex items-center justify-between px-4 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-10">
            <div className="flex items-center gap-2">
              {/* Mobile: hamburger */}
              <button
                onClick={() => setIsMobileSidebarOpen(true)}
                className="md:hidden p-2 -ml-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
              >
                <Menu className="w-5 h-5" />
              </button>
              {/* Desktop: toggle sidebar */}
              <button
                onClick={() => setIsDesktopSidebarOpen(!isDesktopSidebarOpen)}
                className="hidden md:flex p-2 -ml-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
              >
                <Menu className="w-5 h-5" />
              </button>
              {/* Mobile: show title in header */}
              <span className="md:hidden text-sm font-semibold text-foreground">Pengaturan</span>
            </div>
            <button
              onClick={toggleTheme}
              className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
            >
              {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </header>

          {/* Mobile: horizontal tab navigation */}
          <div className="md:hidden flex border-b border-border bg-background">
            {navItems.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveSection(id)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors border-b-2",
                  activeSection === id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-2xl mx-auto px-4 sm:px-8 py-8">

              {activeSection === "profil" && (
                <div className="space-y-6">
                  {/* Page heading (desktop only) */}
                  <div className="hidden md:block">
                    <h2 className="text-lg font-semibold text-foreground mb-1">Profil & Akun</h2>
                    <p className="text-sm text-muted-foreground">Informasi akun, keamanan, dan pengelolaan data kamu.</p>
                  </div>

                  {/* Hero: avatar + identitas */}
                  <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
                    <div className="flex items-center gap-4">
                      <div className="relative shrink-0">
                        <div className="w-16 h-16 sm:w-[68px] sm:h-[68px] rounded-full bg-gradient-to-br from-primary to-primary/70 text-primary-foreground flex items-center justify-center text-xl font-bold select-none shadow-sm">
                          {name.trim()
                            ? name.trim().split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
                            : user.initials}
                        </div>
                        {isAdmin && (
                          <span className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-primary text-primary-foreground border-2 border-card">
                            ADMIN
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-base font-semibold text-foreground truncate">{name || user.name}</p>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                          <Mail className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{user.email}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card: Informasi Profil */}
                  <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
                    <div className="flex items-center gap-2 mb-1">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <h3 className="text-sm font-semibold text-foreground">Informasi Profil</h3>
                    </div>
                    <p className="text-xs text-muted-foreground mb-5">Nama yang ditampilkan di aplikasi.</p>

                    <div className="space-y-5">
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1.5">Nama lengkap</label>
                        <input
                          type="text"
                          value={name}
                          onChange={(e) => { setName(e.target.value); setNameError(""); setNameSuccess(false); }}
                          className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60 transition"
                          placeholder="Nama kamu"
                        />
                        {nameError && <p className="text-xs text-red-500 mt-1.5">{nameError}</p>}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1.5">Email</label>
                        <input
                          type="email"
                          value={user.email || ""}
                          disabled
                          className="w-full px-4 py-2.5 rounded-xl border border-border bg-muted/60 text-muted-foreground text-sm cursor-not-allowed"
                        />
                        <p className="text-xs text-muted-foreground mt-1.5">Email tidak dapat diubah.</p>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 pt-1">
                        <button
                          onClick={handleSaveName}
                          disabled={nameSaving || name.trim() === user.name}
                          className={cn(
                            "px-5 py-2 rounded-xl text-sm font-medium transition-all",
                            nameSaving || name.trim() === user.name
                              ? "bg-muted text-muted-foreground cursor-not-allowed"
                              : "bg-primary text-primary-foreground hover:bg-primary/90"
                          )}
                        >
                          {nameSaving ? "Menyimpan..." : "Simpan perubahan"}
                        </button>
                        {nameSuccess && (
                          <span className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
                            <Check className="w-4 h-4" />
                            Nama berhasil diperbarui
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Card: Keamanan Akun */}
                  <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
                    <div className="flex items-center gap-2 mb-1">
                      <Shield className="w-4 h-4 text-muted-foreground" />
                      <h3 className="text-sm font-semibold text-foreground">Keamanan Akun</h3>
                    </div>
                    <p className="text-xs text-muted-foreground mb-5">Perbarui password untuk menjaga akunmu tetap aman.</p>

                    <div className="space-y-5">
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1.5">Password baru</label>
                        <div className="relative">
                          <input
                            type={showNew ? "text" : "password"}
                            value={newPassword}
                            onChange={(e) => { setNewPassword(e.target.value); setPwError(""); setPwSuccess(false); }}
                            className="w-full px-4 py-2.5 pr-11 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60 transition"
                            placeholder="Minimal 6 karakter"
                          />
                          <button
                            type="button"
                            onClick={() => setShowNew(!showNew)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1.5">Konfirmasi password baru</label>
                        <div className="relative">
                          <input
                            type={showConfirm ? "text" : "password"}
                            value={confirmPassword}
                            onChange={(e) => { setConfirmPassword(e.target.value); setPwError(""); setPwSuccess(false); }}
                            className="w-full px-4 py-2.5 pr-11 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60 transition"
                            placeholder="Ulangi password baru"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirm(!showConfirm)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {pwError && <p className="text-xs text-red-500">{pwError}</p>}

                      <div className="flex flex-wrap items-center gap-3 pt-1">
                        <button
                          onClick={handleSavePassword}
                          disabled={pwSaving || !newPassword || !confirmPassword}
                          className={cn(
                            "inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium transition-all",
                            pwSaving || !newPassword || !confirmPassword
                              ? "bg-muted text-muted-foreground cursor-not-allowed"
                              : "bg-primary text-primary-foreground hover:bg-primary/90"
                          )}
                        >
                          <Lock className="w-4 h-4" />
                          {pwSaving ? "Menyimpan..." : "Perbarui password"}
                        </button>
                        {pwSuccess && (
                          <span className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
                            <Check className="w-4 h-4" />
                            Password berhasil diubah
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Card: Zona Bahaya */}
                  <div className="rounded-2xl border border-red-500/25 bg-red-500/[0.04] p-5 sm:p-6">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                      <h3 className="text-sm font-semibold text-foreground">Zona Bahaya</h3>
                    </div>
                    <p className="text-xs text-muted-foreground mb-5">Tindakan di bawah ini bersifat permanen dan tidak bisa dikembalikan.</p>

                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-xl border border-red-500/20 bg-background/50">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground flex items-center gap-2">
                          <Trash2 className="w-4 h-4 text-red-500 shrink-0" />
                          Hapus semua percakapan
                        </p>
                        <p className="text-xs text-muted-foreground mt-1 ml-6">
                          {chats.length > 0
                            ? `${chats.length} percakapan akan dihapus permanen.`
                            : "Belum ada percakapan untuk dihapus."}
                        </p>
                      </div>
                      {!confirmDeleteAll ? (
                        <button
                          onClick={() => setConfirmDeleteAll(true)}
                          disabled={chats.length === 0}
                          className="shrink-0 px-4 py-2 rounded-xl text-sm font-medium border border-red-500/30 text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Hapus semua
                        </button>
                      ) : (
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => setConfirmDeleteAll(false)}
                            className="px-3 py-2 rounded-xl text-sm font-medium border border-border text-muted-foreground hover:bg-muted transition-colors"
                          >
                            Batal
                          </button>
                          <button
                            onClick={async () => {
                              setIsDeletingAll(true);
                              await deleteAllChats();
                              setIsDeletingAll(false);
                              setConfirmDeleteAll(false);
                            }}
                            disabled={isDeletingAll}
                            className="px-3 py-2 rounded-xl text-sm font-semibold bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-60"
                          >
                            {isDeletingAll ? "Menghapus..." : "Ya, hapus"}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeSection === "personalisasi" && (
                <div className="space-y-8">
                  <div>
                    <h2 className="hidden md:block text-lg font-semibold text-foreground mb-1">Personalisasi</h2>
                    <p className="hidden md:block text-sm text-muted-foreground mb-8">Sesuaikan cara Pioo 2.0 berinteraksi denganmu.</p>

                    <div className="space-y-6">

                      {/* Nama panggilan */}
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1.5">Nama panggilan</label>
                        <input
                          type="text"
                          value={persona.nickname}
                          onChange={(e) => savePersona({ nickname: e.target.value })}
                          placeholder="Misal: Pio, Budi, Alex..."
                          className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60 transition"
                        />
                        <p className="text-xs text-muted-foreground mt-1.5">AI akan menyapamu dengan nama ini.</p>
                      </div>

                      {/* Role / Pekerjaan */}
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1.5">Role / Pekerjaan</label>
                        <input
                          type="text"
                          value={persona.role}
                          onChange={(e) => savePersona({ role: e.target.value })}
                          placeholder="Misal: Frontend Developer, Backend Engineer, Student..."
                          className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60 transition"
                        />
                      </div>

                      {/* Tech stack */}
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1.5">Tech stack utama</label>
                        <input
                          type="text"
                          value={persona.stack}
                          onChange={(e) => savePersona({ stack: e.target.value })}
                          placeholder="Misal: React, TypeScript, Node.js, Python..."
                          className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60 transition"
                        />
                        <p className="text-xs text-muted-foreground mt-1.5">Contoh kode akan disesuaikan dengan stack ini.</p>
                      </div>

                      {/* Level */}
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">Level pengalaman</label>
                        <div className="grid grid-cols-3 gap-2">
                          {(["junior", "mid", "senior"] as const).map((lvl) => (
                            <button
                              key={lvl}
                              onClick={() => savePersona({ level: lvl })}
                              className={cn(
                                "py-2.5 rounded-xl border text-sm font-medium capitalize transition-all",
                                persona.level === lvl
                                  ? "border-primary bg-primary/10 text-primary"
                                  : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                              )}
                            >
                              {lvl}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Bahasa jawaban */}
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">Bahasa jawaban</label>
                        <div className="grid grid-cols-3 gap-2">
                          {([
                            { value: "indonesia", label: "Indonesia" },
                            { value: "english", label: "English" },
                            { value: "mixed", label: "Campur" },
                          ] as const).map(({ value, label }) => (
                            <button
                              key={value}
                              onClick={() => savePersona({ language: value })}
                              className={cn(
                                "py-2.5 rounded-xl border text-sm font-medium transition-all",
                                persona.language === value
                                  ? "border-primary bg-primary/10 text-primary"
                                  : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                              )}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Gaya jawaban */}
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">Gaya jawaban</label>
                        <div className="grid grid-cols-2 gap-2">
                          {([
                            { value: "concise", label: "Ringkas", desc: "Langsung ke poin" },
                            { value: "detailed", label: "Detail", desc: "Penjelasan lengkap" },
                          ] as const).map(({ value, label, desc }) => (
                            <button
                              key={value}
                              onClick={() => savePersona({ answerStyle: value })}
                              className={cn(
                                "py-3 px-4 rounded-xl border text-left transition-all",
                                persona.answerStyle === value
                                  ? "border-primary bg-primary/10"
                                  : "border-border bg-background hover:border-primary/40"
                              )}
                            >
                              <p className={cn("text-sm font-medium", persona.answerStyle === value ? "text-primary" : "text-foreground")}>{label}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Tone */}
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">Tone komunikasi</label>
                        <div className="grid grid-cols-3 gap-2">
                          {([
                            { value: "casual", label: "Santai" },
                            { value: "formal", label: "Formal" },
                            { value: "humor", label: "Humor" },
                          ] as const).map(({ value, label }) => (
                            <button
                              key={value}
                              onClick={() => savePersona({ tone: value })}
                              className={cn(
                                "py-2.5 rounded-xl border text-sm font-medium transition-all",
                                persona.tone === value
                                  ? "border-primary bg-primary/10 text-primary"
                                  : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                              )}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Preview system prompt */}
                      {(persona.nickname || persona.role || persona.stack || persona.level) && (
                        <div className="p-4 rounded-xl border border-border bg-muted/30">
                          <p className="text-xs font-medium text-muted-foreground mb-2">Preview instruksi ke AI:</p>
                          <p className="text-xs text-muted-foreground leading-relaxed italic">
                            {persona.nickname && `Nama user: ${persona.nickname}. `}
                            {persona.role && `Role: ${persona.role}. `}
                            {persona.stack && `Stack: ${persona.stack}. `}
                            {persona.level && `Level: ${persona.level}. `}
                            {persona.language === "indonesia" && "Jawab dalam Bahasa Indonesia. "}
                            {persona.language === "english" && "Respond in English. "}
                            {persona.language === "mixed" && "Jawab dengan code-switching. "}
                            {persona.answerStyle === "concise" && "Gaya: ringkas. "}
                            {persona.answerStyle === "detailed" && "Gaya: detail. "}
                            {persona.tone && `Tone: ${persona.tone}.`}
                          </p>
                        </div>
                      )}

                      <p className="text-xs text-muted-foreground">
                        {personaSaving ? "Menyimpan ke database..." : "Tersimpan otomatis ke database. Berlaku mulai pesan berikutnya."}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {activeSection === "statistik" && (
                <div className="space-y-8">
                  <div>
                    <h2 className="hidden md:block text-lg font-semibold text-foreground mb-1">Statistik Penggunaan</h2>
                    <p className="hidden md:block text-sm text-muted-foreground mb-8">Rekap penggunaan selama percakapan dengan Pioo 2.0.</p>
                    {statsLoading && (
                      <div className="text-xs text-muted-foreground/60 mb-4 flex items-center gap-1.5">
                        <span className="inline-block w-2 h-2 rounded-full bg-primary/40 animate-pulse" />
                        Memuat statistik...
                      </div>
                    )}

                    {/* Ringkasan chat & pesan */}
                    <div className="grid grid-cols-2 gap-3 mb-6">
                      <div className="p-4 rounded-xl border border-border bg-card flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <MessageSquare className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-foreground tabular-nums">{chats.length}</p>
                          <p className="text-xs text-muted-foreground">Percakapan</p>
                        </div>
                      </div>
                      <div className="p-4 rounded-xl border border-border bg-card flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <BarChart2 className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-foreground tabular-nums">
                            {chats.reduce((sum, c) => sum + c.messages.length, 0)}
                          </p>
                          <p className="text-xs text-muted-foreground">Total pesan</p>
                        </div>
                      </div>
                    </div>

                    {/* Toggle tampilkan token per pesan */}
                    <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-card mb-6">
                      <div>
                        <p className="text-sm font-medium text-foreground">Tampilkan token per pesan</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Tampilkan jumlah token di bawah setiap respons AI</p>
                      </div>
                      <button
                        onClick={toggleTokenUsage}
                        className={cn(
                          "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none",
                          showTokenUsage ? "bg-primary" : "bg-input"
                        )}
                      >
                        <span className={cn(
                          "pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg transition-transform",
                          showTokenUsage ? "translate-x-5" : "translate-x-0"
                        )} />
                      </button>
                    </div>

                    {/* Ringkasan */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
                      {[
                        { label: "Hari ini", usage: todayUsage },
                        { label: "7 hari terakhir", usage: weekUsage },
                        { label: "30 hari terakhir", usage: monthUsage },
                      ].map(({ label, usage }) => (
                        <div key={label} className="p-4 rounded-xl border border-border bg-card space-y-1.5">
                          <p className="text-xs text-muted-foreground font-medium">{label}</p>
                          <p className="text-2xl font-bold text-foreground tabular-nums">
                            {usage.totalTokens > 0 ? usage.totalTokens.toLocaleString() : "—"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {usage.totalTokens > 0 ? `${usage.messages} pesan` : "belum ada data"}
                          </p>
                        </div>
                      ))}
                    </div>

                    {/* Bar chart 7 hari */}
                    <div>
                      <p className="text-sm font-medium text-foreground mb-4">Penggunaan 7 Hari Terakhir</p>
                      {daily7.every(d => d.usage.totalTokens === 0) ? (
                        <div className="flex items-center justify-center h-32 rounded-xl border border-dashed border-border text-sm text-muted-foreground">
                          Belum ada data. Mulai ngobrol dengan Pioo 2.0!
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {(() => {
                            const max = Math.max(...daily7.map(d => d.usage.totalTokens), 1);
                            return daily7.map(({ date, usage }) => {
                              const pct = Math.round((usage.totalTokens / max) * 100);
                              const label = new Date(date + "T00:00:00").toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" });
                              return (
                                <div key={date} className="flex items-center gap-3">
                                  <span className="text-xs text-muted-foreground w-24 shrink-0">{label}</span>
                                  <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-primary/70 rounded-full transition-all"
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                  <span className="text-xs text-muted-foreground tabular-nums w-20 text-right shrink-0">
                                    {usage.totalTokens > 0 ? usage.totalTokens.toLocaleString() : "—"}
                                  </span>
                                </div>
                              );
                            });
                          })()}
                        </div>
                      )}
                    </div>

                    {/* Detail breakdown */}
                    {weekUsage.totalTokens > 0 && (
                      <div className="mt-8 p-4 rounded-xl border border-border bg-card space-y-3">
                        <p className="text-sm font-medium text-foreground">Detail 7 Hari</p>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="text-muted-foreground">Token prompt (input)</div>
                          <div className="text-foreground text-right tabular-nums">{weekUsage.promptTokens.toLocaleString()}</div>
                          <div className="text-muted-foreground">Token completion (output)</div>
                          <div className="text-foreground text-right tabular-nums">{weekUsage.completionTokens.toLocaleString()}</div>
                          <div className="text-muted-foreground font-medium">Total token</div>
                          <div className="text-foreground text-right tabular-nums font-medium">{weekUsage.totalTokens.toLocaleString()}</div>
                          <div className="text-muted-foreground">Jumlah pesan</div>
                          <div className="text-foreground text-right tabular-nums">{weekUsage.messages}</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}


              {activeSection === "plus" && (
                <div className="space-y-6">
                  <div className="hidden md:block">
                    <h2 className="text-lg font-semibold text-foreground mb-1">Penggunaan Akun</h2>
                    <p className="text-sm text-muted-foreground mb-6">Status Plus dan kuota pemakaianmu hari ini.</p>
                  </div>

                  {usageSummaryLoading || !usageSummary ? (
                    <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">Memuat data...</div>
                  ) : (
                    <>
                      {/* Status Plus */}
                      <div className={cn(
                        "rounded-2xl border p-5",
                        usageSummary.isPremium
                          ? "border-amber-500/25 bg-amber-500/5"
                          : "border-border bg-card"
                      )}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                              usageSummary.isPremium ? "bg-amber-500/15" : "bg-muted"
                            )}>
                              <Star className={cn("w-5 h-5", usageSummary.isPremium ? "text-amber-500 fill-amber-500/30" : "text-muted-foreground")} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-foreground">
                                  {usageSummary.isAdmin
                                    ? "Admin"
                                    : usageSummary.tier === "pro"
                                    ? "Pro Aktif"
                                    : usageSummary.isPremium
                                    ? "Plus Aktif"
                                    : "Free"}
                                </span>
                                {usageSummary.isPremium && !usageSummary.isAdmin && (
                                  <span className="text-xs px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 font-medium">
                                    {usageSummary.tier === "pro" ? "PRO" : "PLUS"}
                                  </span>
                                )}
                              </div>
                              {usageSummary.isPremium && usageSummary.premiumExpiresAt && !usageSummary.isAdmin ? (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  Berakhir {new Date(usageSummary.premiumExpiresAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                                </p>
                              ) : !usageSummary.isPremium ? (
                                <p className="text-xs text-muted-foreground mt-0.5">Upgrade untuk kuota lebih besar</p>
                              ) : null}
                            </div>
                          </div>
                          {!usageSummary.isPremium && (
                            <button
                              onClick={() => navigate("/premium")}
                              className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-medium hover:underline shrink-0"
                            >
                              Lihat Paket
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Kuota Hari Ini */}
                      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
                        <h3 className="text-sm font-semibold text-foreground">Kuota Hari Ini</h3>

                        {/* Token */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Zap className="w-3.5 h-3.5" />
                              <span>Token chat</span>
                            </div>
                            <span className="text-foreground tabular-nums font-medium">
                              {usageSummary.token.used.toLocaleString("id-ID")} / {usageSummary.token.limit >= 9_999_000 ? "∞" : (usageSummary.token.limit / 1000).toFixed(0) + "K"}
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className={cn("h-full rounded-full transition-all", usageSummary.isPremium ? "bg-amber-500" : "bg-primary")}
                              style={{ width: `${Math.min(100, (usageSummary.token.used / usageSummary.token.limit) * 100)}%` }}
                            />
                          </div>
                        </div>

                        {/* Gambar */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <ImageIcon className="w-3.5 h-3.5" />
                              <span>Gambar hari ini</span>
                            </div>
                            <span className="text-foreground tabular-nums font-medium">
                              {usageSummary.image.used} / {usageSummary.image.limit >= 9999 ? "∞" : usageSummary.image.limit}
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className={cn("h-full rounded-full transition-all", usageSummary.isPremium ? "bg-amber-500" : "bg-primary")}
                              style={{ width: `${Math.min(100, (usageSummary.image.used / usageSummary.image.limit) * 100)}%` }}
                            />
                          </div>
                        </div>

                        {/* Video Credits */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Clapperboard className="w-3.5 h-3.5" />
                              <span>Kredit video (bulan ini)</span>
                            </div>
                            <span className="text-foreground tabular-nums font-medium">
                              {usageSummary.video.credits} / {usageSummary.video.max >= 999 ? "∞" : usageSummary.video.max}
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className={cn("h-full rounded-full transition-all", usageSummary.isPremium ? "bg-amber-500" : "bg-primary")}
                              style={{ width: `${Math.min(100, ((usageSummary.video.max - usageSummary.video.credits) / Math.max(usageSummary.video.max, 1)) * 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Benefit Plus */}
                      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
                        <h3 className="text-sm font-semibold text-foreground">Keuntungan Plus</h3>
                        <div className="space-y-3">
                          {[
                            { icon: Zap, label: "360.000 token/hari", sub: "6× lebih banyak dari Free (60K)", plus: true },
                            { icon: ImageIcon, label: "25 gambar/hari", sub: "vs 7 untuk Free", plus: true },
                            { icon: Clapperboard, label: "12 kredit video/bulan", sub: "vs 3 untuk Free", plus: true },
                            { icon: Star, label: "Akses semua model", sub: "Model Plus & Coder eksklusif", plus: true },
                            { icon: Star, label: "Badge Plus di header", sub: "Tampil berbeda dari pengguna Free", plus: true },
                          ].map(({ icon: Icon, label, sub }) => (
                            <div key={label} className="flex items-start gap-3">
                              <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0 mt-0.5">
                                <Icon className="w-3.5 h-3.5 text-amber-500" />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-foreground">{label}</p>
                                <p className="text-xs text-muted-foreground">{sub}</p>
                              </div>
                              <Check className="w-4 h-4 text-amber-500 ml-auto shrink-0 mt-0.5" />
                            </div>
                          ))}
                        </div>

                        {!usageSummary.isPremium && (
                          <button
                            onClick={() => navigate("/premium")}
                            className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-colors"
                          >
                            <Star className="w-4 h-4" />
                            Lihat Paket Plus & Pro
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
