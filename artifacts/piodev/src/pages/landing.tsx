import { Link } from "wouter";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { Terminal, Sparkles, ArrowRight } from "lucide-react";

export default function LandingPage() {
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (isAuthenticated) setLocation("/chat");
  }, [isAuthenticated]);

  return (
    <div className="min-h-screen bg-[hsl(240,12%,5%)] text-white overflow-x-hidden">
      {/* Ambient blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-60 -left-60 w-[700px] h-[700px] rounded-full bg-primary/10 blur-[140px]" />
        <div className="absolute top-1/2 -right-40 w-[500px] h-[500px] rounded-full bg-indigo-500/8 blur-[120px]" />
        <div className="absolute -bottom-40 left-1/3 w-[400px] h-[400px] rounded-full bg-violet-500/8 blur-[100px]" />
      </div>

      {/* Navbar */}
      <nav className="relative z-10 flex items-center justify-between px-6 sm:px-10 py-5 max-w-6xl mx-auto">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gradient-to-br from-primary to-indigo-400 rounded-lg flex items-center justify-center">
            <Terminal className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight">PioDev</span>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/login">
            <button className="px-4 py-1.5 rounded-lg text-sm font-medium text-white/70 hover:text-white transition-colors">
              Masuk
            </button>
          </Link>
          <Link href="/register">
            <button className="px-4 py-1.5 rounded-lg text-sm font-semibold bg-primary hover:bg-primary/90 text-white transition-colors shadow-lg shadow-primary/20">
              Daftar Gratis
            </button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 max-w-4xl mx-auto px-6 sm:px-10 pt-20 pb-28 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium mb-8">
            <Sparkles className="w-3 h-3" />
            AI terbaru · Gratis untuk semua
          </div>

          <h1 className="text-5xl sm:text-6xl font-bold leading-tight tracking-tight mb-6">
            AI yang jawab,<br />
            <span className="bg-gradient-to-r from-primary via-indigo-400 to-violet-400 bg-clip-text text-transparent">
              bukan cuma googling buat kamu
            </span>
          </h1>

          <p className="text-lg text-white/50 max-w-xl mx-auto mb-10 leading-relaxed">
            Tanya soal bug, minta review kode, diskusi arsitektur, atau generate gambar —
            semua dalam satu tempat, tanpa ribet.
          </p>

          <div className="flex items-center justify-center gap-3">
            <Link href="/register">
              <button className="flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 text-white rounded-xl font-semibold text-sm shadow-xl shadow-primary/25 hover:-translate-y-0.5 transition-all group">
                Mulai gratis
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </Link>
            <Link href="/login">
              <button className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl font-medium text-sm transition-all">
                Sudah punya akun? Masuk
              </button>
            </Link>
          </div>
        </motion.div>

        {/* Mock chat preview */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-16 relative"
        >
          <div className="bg-[hsl(240,10%,9%)] border border-white/8 rounded-2xl p-5 text-left max-w-2xl mx-auto shadow-2xl">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/5">
              <div className="w-3 h-3 rounded-full bg-red-500/60" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
              <div className="w-3 h-3 rounded-full bg-green-500/60" />
              <span className="ml-2 text-xs text-white/20 font-mono">PioDev Chat</span>
            </div>
            <div className="space-y-4">
              <div className="flex justify-end">
                <div className="bg-primary/20 border border-primary/20 rounded-xl rounded-tr-sm px-4 py-2.5 text-sm text-white/80 max-w-xs">
                  Kenapa useEffect ku infinite loop ya?
                </div>
              </div>
              <div className="flex gap-2.5">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Terminal className="w-3 h-3 text-white" />
                </div>
                <div className="bg-white/5 border border-white/8 rounded-xl rounded-tl-sm px-4 py-2.5 text-sm text-white/70 max-w-sm">
                  Kemungkinan besar karena dependency array kamu salah. Kalau kamu taruh <code className="bg-white/10 px-1 rounded text-primary/90">object</code> atau <code className="bg-white/10 px-1 rounded text-primary/90">array</code> langsung di sana, React akan selalu anggap itu referensi baru di setiap render...
                </div>
              </div>
            </div>
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-[hsl(240,12%,5%)] via-transparent to-transparent pointer-events-none" style={{ top: "60%" }} />
        </motion.div>
      </section>

      {/* CTA bottom */}
      <section className="relative z-10 max-w-2xl mx-auto px-6 pb-24 text-center">
        <div className="bg-gradient-to-br from-primary/15 to-indigo-500/10 border border-primary/20 rounded-3xl p-10">
          <h2 className="text-2xl font-bold mb-3">Siap coba sekarang?</h2>
          <p className="text-white/50 text-sm mb-7">Gratis selamanya. Tidak perlu kartu kredit.</p>
          <Link href="/register">
            <button className="inline-flex items-center gap-2 px-7 py-3 bg-primary hover:bg-primary/90 text-white rounded-xl font-semibold text-sm shadow-xl shadow-primary/30 hover:-translate-y-0.5 transition-all group">
              Buat akun gratis
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 py-8 text-center">
        <div className="flex items-center justify-center gap-2 text-white/30 text-xs">
          <Terminal className="w-3.5 h-3.5" />
          <span>PioDev — teman ngoding yang selalu siap</span>
        </div>
      </footer>
    </div>
  );
}
