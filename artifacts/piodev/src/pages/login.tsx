import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Eye, EyeOff, ArrowRight, ArrowLeft, Sun, Moon, Loader2, MessageSquare, Image as ImageIcon, Video, Mic, Code2 } from "lucide-react";
import { Logo } from "@/components/logo";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login, isAuthenticated } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [, setLocation] = useLocation();

  if (isAuthenticated) { setLocation("/chat"); return null; }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError("Isi semua kolom terlebih dahulu"); return; }
    setIsSubmitting(true);
    setError("");
    const err = await login(email, password);
    if (err) { setError(err === "Invalid login credentials" ? "Email atau kata sandi salah" : err); setIsSubmitting(false); }
  };

  return (
    <div className="h-screen overflow-hidden flex flex-col lg:flex-row bg-background">

      {/* Panel kiri — pure visual gradient */}
      <div className="hidden lg:flex lg:w-[50%] relative flex-col justify-between p-12 bg-[hsl(240,12%,6%)] overflow-hidden">
        {/* Animated ambient blobs */}
        <motion.div
          className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-primary/25 blur-[140px]"
          animate={{ x: [0, 40, 0], y: [0, 30, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute top-1/2 -right-32 w-[450px] h-[450px] rounded-full bg-indigo-500/20 blur-[120px]"
          animate={{ x: [0, -30, 0], y: [0, -40, 0] }}
          transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -bottom-32 -left-20 w-[500px] h-[500px] rounded-full bg-violet-500/20 blur-[130px]"
          animate={{ x: [0, 50, 0], y: [0, -30, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Logo top-left */}
        <div className="relative z-10 flex items-center gap-2.5">
          <Logo size={32} />
          <span className="text-white font-bold tracking-tight">PioCode</span>
        </div>

        {/* Centered tagline + features */}
        <div className="relative z-10 flex-1 flex flex-col justify-center gap-10">
          <TypingTagline />
          <FeaturePills />
        </div>
      </div>

      {/* Panel kanan — form */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        <Link href="/"
          className="absolute top-5 left-5 z-50 inline-flex items-center gap-1.5 pl-2 pr-3 py-2 rounded-xl bg-muted/60 hover:bg-muted border border-border text-muted-foreground hover:text-foreground text-sm transition-colors group">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span className="hidden sm:inline">Kembali</span>
        </Link>
        <button onClick={toggleTheme}
          className="absolute top-5 right-5 z-50 p-2 rounded-xl bg-muted/60 hover:bg-muted border border-border text-muted-foreground hover:text-foreground transition-colors">
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <div className="flex-1 flex flex-col items-center justify-center px-6 sm:px-10 pt-20 lg:pt-0">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="w-full max-w-sm"
          >
            <div className="flex items-center gap-2 mb-7 lg:hidden">
              <Logo size={32} />
              <span className="font-bold text-foreground tracking-tight">PioCode</span>
            </div>

            <div className="mb-6">
              <h1 className="text-2xl font-bold text-foreground tracking-tight">Selamat datang kembali</h1>
              <p className="text-muted-foreground text-sm mt-1">Masuk ke akunmu untuk melanjutkan</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              {error && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-xl">
                  {error}
                </motion.div>
              )}

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Email</label>
                <input type="email" value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(""); }}
                  placeholder="kamu@email.com" disabled={isSubmitting}
                  className="w-full px-4 py-2.5 rounded-xl bg-muted/40 border border-border focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all placeholder:text-muted-foreground text-foreground text-sm disabled:opacity-60"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium text-foreground">Kata sandi</label>
                  <Link href="/forgot-password" className="text-xs font-medium text-primary hover:text-primary/80 transition-colors">
                    Lupa kata sandi?
                  </Link>
                </div>
                <div className="relative">
                  <input type={showPassword ? "text" : "password"} value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(""); }}
                    placeholder="••••••••" disabled={isSubmitting}
                    className="w-full px-4 py-2.5 pr-11 rounded-xl bg-muted/40 border border-border focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all placeholder:text-muted-foreground text-foreground text-sm disabled:opacity-60"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={isSubmitting}
                className="w-full py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-semibold shadow-lg shadow-primary/25 hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2 group text-sm mt-1 disabled:opacity-70 disabled:translate-y-0 disabled:cursor-not-allowed">
                {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Memproses...</> : <>Masuk <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" /></>}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              Belum punya akun?{" "}
              <Link href="/register" className="font-semibold text-primary hover:text-primary/80 transition-colors">Daftar</Link>
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────── Typing tagline ──────────────────────────────────
const TAGLINES: { l1: string; l2: string }[] = [
  { l1: "Semua dalam", l2: "satu tempat." },
  { l1: "Satu langganan,", l2: "semua AI." },
  { l1: "Bikin apa aja,", l2: "di sini aja." },
];

function TypingTagline() {
  const [idx, setIdx] = useState(0);
  const current = TAGLINES[idx];
  const total = current.l1.length + current.l2.length;

  const [count, setCount] = useState(0);
  const [phase, setPhase] = useState<"typing" | "holding" | "deleting" | "pausing">("typing");

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    if (phase === "typing") {
      if (count < total) {
        t = setTimeout(() => setCount((c) => c + 1), 75);
      } else {
        t = setTimeout(() => setPhase("holding"), 0);
      }
    } else if (phase === "holding") {
      t = setTimeout(() => setPhase("deleting"), 2000);
    } else if (phase === "deleting") {
      if (count > 0) {
        t = setTimeout(() => setCount((c) => c - 1), 30);
      } else {
        t = setTimeout(() => setPhase("pausing"), 0);
      }
    } else {
      t = setTimeout(() => {
        setIdx((i) => (i + 1) % TAGLINES.length);
        setPhase("typing");
      }, 400);
    }
    return () => clearTimeout(t);
  }, [phase, count, total]);

  const line1Visible = current.l1.slice(0, Math.min(count, current.l1.length));
  const line2Visible = count > current.l1.length ? current.l2.slice(0, count - current.l1.length) : "";
  const showLine2Started = count > current.l1.length;

  return (
    <h2 className="text-4xl xl:text-5xl font-bold leading-[1.1] tracking-tight min-h-[2.4em]">
      <span className="bg-gradient-to-r from-white via-primary to-indigo-300 bg-clip-text text-transparent">
        {line1Visible.split("").map((c, i) => (
          <span key={`a${i}`}>{c === " " ? "\u00A0" : c}</span>
        ))}
      </span>
      {showLine2Started && <br />}
      <span className="bg-gradient-to-r from-indigo-300 via-violet-400 to-primary bg-clip-text text-transparent">
        {line2Visible.split("").map((c, i) => (
          <span key={`b${i}`}>{c === " " ? "\u00A0" : c}</span>
        ))}
      </span>
      <motion.span
        className="inline-block ml-1 w-[3px] h-[0.8em] align-middle bg-primary translate-y-[-0.05em]"
        animate={{ opacity: [1, 1, 0, 0] }}
        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      />
    </h2>
  );
}

// ─────────────────────────── Feature pills ───────────────────────────────────
function FeaturePills() {
  const items = [
    { icon: MessageSquare, label: "Chat AI" },
    { icon: ImageIcon, label: "Gambar" },
    { icon: Video, label: "Video" },
    { icon: Mic, label: "Voice" },
    { icon: Code2, label: "API" },
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item, i) => {
        const Icon = item.icon;
        return (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 + i * 0.08, duration: 0.4, ease: "easeOut" }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/10 bg-white/[0.04] backdrop-blur-sm text-xs text-white/70 hover:bg-white/[0.07] hover:border-primary/30 transition-colors"
          >
            <Icon className="w-3.5 h-3.5 text-primary" />
            {item.label}
          </motion.div>
        );
      })}
    </div>
  );
}
