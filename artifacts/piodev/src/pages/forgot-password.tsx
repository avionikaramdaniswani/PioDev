import { useState } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Mail, ArrowRight, Sun, Moon, Loader2 } from "lucide-react";
import { Logo } from "@/components/logo";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { supabase } from "@/lib/supabase";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const { isAuthenticated } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [, setLocation] = useLocation();

  if (isAuthenticated) { setLocation("/"); return null; }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) return;
    setIsLoading(true);
    setError("");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setIsLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setIsSubmitted(true);
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
        {/* Logo */}
        <div className="flex items-center gap-2 mb-8">
          <Logo size={32} />
          <span className="font-bold text-foreground tracking-tight">PioDev</span>
        </div>

        {isSubmitted ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center">
            <div className="w-14 h-14 bg-green-100 dark:bg-green-900/30 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <Mail className="w-7 h-7 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">Cek emailmu</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Link reset telah dikirim ke{" "}
              <span className="font-medium text-foreground">{email}</span>.
            </p>
            <Link href="/login"
              className="block w-full py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-semibold text-sm text-center shadow-lg shadow-primary/25 hover:-translate-y-0.5 transition-all">
              Kembali ke halaman masuk
            </Link>
          </motion.div>
        ) : (
          <>
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-foreground tracking-tight">Reset kata sandi</h1>
              <p className="text-muted-foreground text-sm mt-1">
                Masukkan emailmu, kami kirimkan link resetnya.
              </p>
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
                  placeholder="kamu@email.com"
                  required disabled={isLoading}
                  className="w-full px-4 py-2.5 rounded-xl bg-muted/40 border border-border focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all placeholder:text-muted-foreground text-foreground text-sm disabled:opacity-60"
                />
              </div>

              <button type="submit" disabled={isLoading}
                className="w-full py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-semibold text-sm shadow-lg shadow-primary/25 hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2 group disabled:opacity-70 disabled:translate-y-0 disabled:cursor-not-allowed">
                {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Mengirim...</> : <>Kirim Link Reset <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" /></>}
              </button>
            </form>

            <div className="mt-6 flex justify-center">
              <Link href="/login" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="w-4 h-4" />
                Kembali ke halaman masuk
              </Link>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
