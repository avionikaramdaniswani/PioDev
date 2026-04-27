import { useState } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Eye, EyeOff, ArrowRight, Sun, Moon, Loader2 } from "lucide-react";
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

        {/* Centered tagline */}
        <div className="relative z-10 flex-1 flex items-center">
          <h2 className="text-5xl xl:text-6xl font-bold leading-[1.05] tracking-tight">
            <span className="bg-gradient-to-r from-white via-primary to-indigo-300 bg-clip-text text-transparent">
              Semua dalam
            </span>
            <br />
            <span className="bg-gradient-to-r from-indigo-300 via-violet-400 to-primary bg-clip-text text-transparent">
              satu tempat.
            </span>
          </h2>
        </div>

        {/* Empty bottom for balance */}
        <div className="relative z-10" />
      </div>

      {/* Panel kanan — form */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        <button onClick={toggleTheme}
          className="absolute top-5 right-5 z-50 p-2 rounded-xl bg-muted/60 hover:bg-muted border border-border text-muted-foreground hover:text-foreground transition-colors">
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <div className="flex-1 flex flex-col items-center justify-center px-6 sm:px-10">
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
