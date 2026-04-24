import { Link } from "wouter";
import { motion } from "framer-motion";
import { Mail, ArrowLeft, Terminal } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { Sun, Moon } from "lucide-react";

export default function CheckEmail() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="h-screen overflow-hidden flex flex-col lg:flex-row bg-background">

      <div className="hidden lg:flex lg:w-[45%] relative flex-col justify-between p-12 bg-[hsl(240,12%,6%)] overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-primary/20 blur-[120px]" />
          <div className="absolute -bottom-20 -right-20 w-[400px] h-[400px] rounded-full bg-violet-500/15 blur-[100px]" />
        </div>

        <div className="relative z-10 flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gradient-to-br from-primary to-indigo-400 rounded-lg flex items-center justify-center">
            <Terminal className="w-4 h-4 text-white" />
          </div>
          <span className="text-white font-bold tracking-tight">PioDev</span>
        </div>

        <div className="relative z-10">
          <h2 className="text-4xl font-bold text-white leading-tight tracking-tight">
            Satu langkah lagi<br />
            <span className="bg-gradient-to-r from-primary via-indigo-400 to-violet-400 bg-clip-text text-transparent">
              sebelum mulai.
            </span>
          </h2>
          <p className="mt-4 text-[hsl(240,5%,55%)] text-base leading-relaxed max-w-xs">
            Konfirmasi email kamu untuk mengaktifkan akun dan mulai coding bersama Pioo 2.0.
          </p>
        </div>

        <p className="relative z-10 text-xs text-[hsl(240,5%,35%)]">
          Dibuat untuk developer yang ingin bekerja lebih efisien.
        </p>
      </div>

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
            className="w-full max-w-sm text-center"
          >
            <div className="flex items-center gap-2 mb-8 lg:hidden justify-center">
              <div className="w-8 h-8 bg-gradient-to-br from-primary to-indigo-400 rounded-lg flex items-center justify-center">
                <Terminal className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-foreground tracking-tight">PioDev</span>
            </div>

            <div className="mx-auto w-16 h-16 bg-primary/10 border border-primary/20 rounded-2xl flex items-center justify-center mb-6">
              <Mail className="w-8 h-8 text-primary" />
            </div>

            <h1 className="text-2xl font-bold text-foreground tracking-tight">Cek email kamu</h1>
            <p className="text-muted-foreground text-sm mt-3 leading-relaxed">
              Kami sudah mengirim email konfirmasi ke alamat email yang kamu daftarkan.
              Buka email tersebut dan klik link konfirmasi untuk mengaktifkan akunmu.
            </p>

            <div className="mt-6 p-4 rounded-xl bg-muted/40 border border-border text-left">
              <p className="text-xs font-medium text-foreground mb-2">Tidak menerima email?</p>
              <ul className="space-y-1.5 text-xs text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="w-1 h-1 rounded-full bg-muted-foreground mt-1.5 shrink-0" />
                  Cek folder <span className="font-medium text-foreground">Spam</span> atau <span className="font-medium text-foreground">Junk</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1 h-1 rounded-full bg-muted-foreground mt-1.5 shrink-0" />
                  Pastikan alamat email yang dimasukkan sudah benar
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1 h-1 rounded-full bg-muted-foreground mt-1.5 shrink-0" />
                  Tunggu beberapa menit, kadang email butuh waktu
                </li>
              </ul>
            </div>

            <div className="mt-8 flex flex-col gap-3">
              <Link href="/login"
                className="w-full py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-semibold shadow-lg shadow-primary/25 hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2 text-sm">
                Masuk ke Akun
              </Link>
              <Link href="/register"
                className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="w-4 h-4" />
                Kembali ke halaman daftar
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
