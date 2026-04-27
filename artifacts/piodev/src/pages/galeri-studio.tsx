import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { FolderOpen, Menu, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { useChat } from "@/hooks/use-chat";
import { ChatSidebar } from "@/components/chat-sidebar";
import { cn } from "@/lib/utils";

export default function GaleriStudio() {
  const { user, logout } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [, navigate] = useLocation();
  const { chats, activeChat, createNewChat, selectChat, deleteChat, updateChatTitle } = useChat(user?.id);

  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

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
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-400 flex items-center justify-center shadow-sm">
              <FolderOpen className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight">Galeri Studio</h1>
              <p className="text-[11px] text-muted-foreground">Semua karyamu di Pio Studio</p>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto">
          <div className="max-w-2xl mx-auto px-6 py-20 text-center">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-500/15 to-orange-400/15 flex items-center justify-center mx-auto mb-6">
              <FolderOpen className="w-10 h-10 text-amber-500" />
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-500 text-xs font-semibold mb-4">
              <Sparkles className="w-3.5 h-3.5" />
              Coming Soon
            </div>
            <h2 className="text-2xl font-bold mb-3">Galeri Studio lagi disiapin</h2>
            <p className="text-muted-foreground leading-relaxed mb-8">
              Bentar lagi kamu bisa lihat semua karyamu di sini — video dari Video Studio, audio dari Voice Studio, gambar dari Image Studio, semua dalam satu tempat. Bisa di-share, di-download, atau dipake ulang.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
              <div className="rounded-xl border border-border/60 bg-card p-4">
                <div className="text-xs font-semibold text-foreground mb-1">Riwayat lengkap</div>
                <div className="text-[11px] text-muted-foreground">Semua generation tersimpan rapi</div>
              </div>
              <div className="rounded-xl border border-border/60 bg-card p-4">
                <div className="text-xs font-semibold text-foreground mb-1">Filter & search</div>
                <div className="text-[11px] text-muted-foreground">Cari berdasarkan tipe atau prompt</div>
              </div>
              <div className="rounded-xl border border-border/60 bg-card p-4">
                <div className="text-xs font-semibold text-foreground mb-1">Re-use cepat</div>
                <div className="text-[11px] text-muted-foreground">Pake ulang prompt favoritmu</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
