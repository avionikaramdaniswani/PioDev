import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Terminal, Eye, EyeOff, ArrowRight, Sun, Moon, Loader2, CheckCircle } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { supabase } from "@/lib/supabase";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const [, setLocation] = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) { setError("Kata sandi minimal 6 karakter"); return; }
    if (password !== confirm) { setError("Konfirmasi kata sandi tidak cocok"); return; }
    setIsLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setIsLoading(false);
    if (error) { setError(error.message); return; }
    setIsDone(true);
    setTimeout(() => setLocation("/login"), 3000);
  };

  return (
    <div className="h-screen overflow-hidden flex flex-col items-center justify-center bg-background relative px-6">
      <button onClick={toggleTheme}
        className="absolute top-5 right-5 p-2 rounded-xl bg-muted/60 hover:bg-muted border border-border text-muted-foreground hover:text-foreground transition-colors">
        {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </button>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-sm"
      >
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 bg-gradient-to-br from-primary to-indigo-400 rounded-lg flex items-center justify-center">
            <Terminal className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-foreground tracking-tight">PioDev</span>
        </div>

        {isDone ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center">
            <div className="w-14 h-14 bg-green-100 dark:bg-green-900/30 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <CheckCircle className="w-7 h-7 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">Kata sandi berhasil diubah!</h2>
            <p className="text-sm text-muted-foreground">Kamu akan diarahkan ke halaman masuk...</p>
          </motion.div>
        ) : (
          <>
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-foreground tracking-tight">Buat kata sandi baru</h1>
              <p className="text-muted-foreground text-sm mt-1">Masukkan kata sandi barumu di bawah ini.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              {error && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-xl">
                  {error}
                </motion.div>
              )}

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Kata sandi baru</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(""); }}
                    placeholder="Min. 6 karakter"
                    disabled={isLoading}
                    className="w-full px-4 py-2.5 pr-11 rounded-xl bg-muted/40 border border-border focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all placeholder:text-muted-foreground text-foreground text-sm disabled:opacity-60"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Konfirmasi kata sandi</label>
                <div className="relative">
                  <input
                    type={showConfirm ? "text" : "password"}
                    value={confirm}
                    onChange={(e) => { setConfirm(e.target.value); setError(""); }}
                    placeholder="Ulangi kata sandi"
                    disabled={isLoading}
                    className="w-full px-4 py-2.5 pr-11 rounded-xl bg-muted/40 border border-border focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all placeholder:text-muted-foreground text-foreground text-sm disabled:opacity-60"
                  />
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1">
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={isLoading}
                className="w-full py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-semibold text-sm shadow-lg shadow-primary/25 hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2 group disabled:opacity-70 disabled:translate-y-0 disabled:cursor-not-allowed mt-1">
                {isLoading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Menyimpan...</>
                  : <>Simpan Kata Sandi <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" /></>
                }
              </button>
            </form>
          </>
        )}
      </motion.div>
    </div>
  );
}
