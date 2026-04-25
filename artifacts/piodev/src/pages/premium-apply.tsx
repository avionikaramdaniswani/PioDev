import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { usePremium } from "@/hooks/use-premium";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/hooks/use-theme";
import {
  ArrowLeft, Star, Upload, X, Check, Instagram,
  ChevronRight, ImageIcon, Loader2, AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const IG_ACCOUNTS = [
  { username: "not.funn_", label: "not.funn_" },
  { username: "tiarafrtm", label: "tiarafrtm" },
];

function UploadBox({
  label, file, preview, onFile, onClear, inputRef,
}: {
  label: string;
  file: File | null;
  preview: string | null;
  onFile: (f: File) => void;
  onClear: () => void;
  inputRef: React.RefObject<HTMLInputElement>;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1.5">
        Screenshot follow <span className="text-amber-500 font-semibold">@{label}</span>
      </label>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
      />
      {preview ? (
        <div className="relative rounded-xl overflow-hidden border border-border">
          <img src={preview} alt="Preview" className="w-full max-h-52 object-contain bg-muted" />
          <button
            type="button"
            onClick={onClear}
            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80 transition-colors"
          >
            <X className="w-3.5 h-3.5 text-white" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}
          onDragOver={(e) => e.preventDefault()}
          className="w-full rounded-xl border-2 border-dashed border-border hover:border-primary/40 bg-muted/30 hover:bg-primary/5 transition-colors p-6 flex flex-col items-center gap-2 cursor-pointer"
        >
          <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center">
            <ImageIcon className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">Klik untuk upload</p>
            <p className="text-xs text-muted-foreground mt-0.5">JPG, PNG, max 5MB</p>
          </div>
          <div className="flex items-center gap-1 text-xs text-primary font-medium">
            <Upload className="w-3 h-3" /> Pilih File
          </div>
        </button>
      )}
    </div>
  );
}

export default function PremiumApplyPage() {
  const { user, isAdmin } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [, setLocation] = useLocation();
  const { status } = usePremium(user?.id);

  const [igInput, setIgInput] = useState("");
  const [ss1, setSs1] = useState<File | null>(null);
  const [ss1Preview, setSs1Preview] = useState<string | null>(null);
  const [ss2, setSs2] = useState<File | null>(null);
  const [ss2Preview, setSs2Preview] = useState<string | null>(null);
  const ss1Ref = useRef<HTMLInputElement>(null);
  const ss2Ref = useRef<HTMLInputElement>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleFile = (
    file: File,
    setFile: (f: File | null) => void,
    setPreview: (p: string | null) => void,
  ) => {
    if (!file.type.startsWith("image/")) { setError("File harus berupa gambar."); return; }
    if (file.size > 5 * 1024 * 1024) { setError("Ukuran file maksimal 5MB."); return; }
    setError(null);
    setFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ig = igInput.trim().replace(/^@/, "");
    if (!ig) { setError("Username Instagram wajib diisi."); return; }
    if (!ss1) { setError(`Screenshot follow @${IG_ACCOUNTS[0].username} wajib diupload.`); return; }
    if (!ss2) { setError(`Screenshot follow @${IG_ACCOUNTS[1].username} wajib diupload.`); return; }

    setIsSubmitting(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? "";

      // Upload lewat server (service role key — bypass storage RLS)
      const form = new FormData();
      form.append("ss1", ss1);
      form.append("ss2", ss2);
      const uploadRes = await fetch("/api/premium/upload-screenshots", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (!uploadRes.ok) { setError("Gagal upload screenshot. Coba lagi."); return; }
      const { url1, url2 } = await uploadRes.json();

      // Kirim aplikasi
      const res = await fetch("/api/premium/apply", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ instagram: ig, screenshot_url: url1, screenshot_url_2: url2 }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Terjadi kesalahan."); return; }
      setDone(true);
    } catch {
      setError("Terjadi kesalahan. Coba lagi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) { setLocation("/login"); return null; }
  if (isAdmin || status?.isPremium) { setLocation("/chat"); return null; }

  // Loading state — tunggu status dimuat
  if (!status) {
    return (
      <div className={cn("min-h-dvh bg-background flex items-center justify-center", isDark ? "dark" : "")}>
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasApplied = !!status?.application;
  const appStatus = status?.application?.status;
  // Approved tapi Plus tidak aktif (dicabut atau expired) = boleh ajukan ulang
  const canReapply = appStatus === "approved" && !status?.isPremium;

  return (
    <div className={cn("min-h-dvh bg-background text-foreground flex flex-col", isDark ? "dark" : "")}>

      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-4 border-b border-border max-w-lg mx-auto w-full">
        <button onClick={() => setLocation("/premium")} className="p-2 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="font-semibold text-sm">Penawaran Plus Terbatas</span>
      </header>

      <main className="flex-1 px-4 py-8 max-w-lg mx-auto w-full">

        {/* Sudah apply / done */}
        {(done || (hasApplied && appStatus === "pending")) ? (
          <div className="flex flex-col items-center text-center py-16 gap-5">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
              <Star className="w-10 h-10 text-amber-500 fill-amber-500/30" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground mb-2">Aplikasi Terkirim!</h2>
              <p className="text-muted-foreground text-sm leading-relaxed max-w-xs mx-auto">
                Kami akan mengecek akun Instagram kamu dan mengaktifkan Plus dalam waktu dekat. Pantau terus ya!
              </p>
            </div>
            <button
              onClick={() => setLocation("/chat")}
              className="mt-2 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Kembali ke Chat
            </button>
          </div>
        ) : null}

        {canReapply && !done && (
          <div className="rounded-2xl border border-primary/20 bg-primary/10 px-4 py-4 mb-6 flex gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
              <Star className="w-4 h-4 text-amber-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-primary mb-0.5">Plus Kamu Sudah Tidak Aktif</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Kamu bisa mengajukan ulang dengan mengirim screenshot follow terbaru.
              </p>
            </div>
          </div>
        )}

        {hasApplied && appStatus === "rejected" && !done && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-4 mb-6 flex gap-3">
            <div className="w-8 h-8 rounded-full bg-red-500/15 flex items-center justify-center shrink-0 mt-0.5">
              <X className="w-4 h-4 text-red-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-red-500 mb-0.5">Aplikasi Sebelumnya Ditolak</p>
              {status?.application?.rejection_note ? (
                <p className="text-xs text-red-400/80 leading-relaxed">
                  <span className="font-medium">Catatan admin:</span> {status.application.rejection_note}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Pastikan kamu sudah follow kedua akun dan screenshot terlihat jelas, lalu coba kirim ulang.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Form */}
        {(!hasApplied || appStatus === "rejected" || canReapply) && !done && (
          <>
            {/* Hero */}
            <div className="flex flex-col items-center text-center mb-8">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <Star className="w-8 h-8 text-amber-500 fill-amber-500/30" />
              </div>
              <h1 className="text-2xl font-bold text-foreground mb-2">Plus Terbatas — Gratis!</h1>
              <p className="text-muted-foreground text-sm leading-relaxed max-w-sm">
                Dapatkan <strong className="text-foreground">360.000 token/hari</strong> (6× lebih banyak)
                hanya dengan mengikuti dua akun Instagram kami.
              </p>
            </div>

            {/* Langkah */}
            <div className="rounded-2xl border border-border bg-card p-5 mb-6 space-y-4">
              <h2 className="text-sm font-semibold text-foreground">Cara Mendapatkan Plus</h2>

              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                <div className="text-sm text-muted-foreground leading-relaxed">
                  Follow kedua akun ini di Instagram:
                  <div className="mt-2 flex flex-col gap-1.5">
                    {IG_ACCOUNTS.map((acc) => (
                      <a
                        key={acc.username}
                        href={`https://instagram.com/${acc.username}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-primary font-semibold hover:underline"
                      >
                        <Instagram className="w-3.5 h-3.5" />
                        @{acc.username}
                        <ChevronRight className="w-3 h-3" />
                      </a>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                <p className="text-sm text-muted-foreground leading-relaxed">Screenshot halaman profil masing-masing akun yang menunjukkan kamu sudah follow</p>
              </div>

              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                <p className="text-sm text-muted-foreground leading-relaxed">Isi username IG kamu dan upload kedua screenshotnya di bawah</p>
              </div>
            </div>

            {/* Note unfollow */}
            <div className="rounded-xl border border-border bg-muted/50 px-4 py-3 flex items-start gap-2.5 mb-6">
              <AlertTriangle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                <strong className="text-foreground">Perhatian:</strong> Jika kedapatan unfollow salah satu akun, status Plus kamu akan langsung dibatalkan tanpa pemberitahuan.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Username IG */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Username Instagram kamu</label>
                <div className="relative">
                  <Instagram className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={igInput}
                    onChange={(e) => setIgInput(e.target.value)}
                    placeholder="contoh: not.funn_"
                    className="w-full h-11 pl-9 pr-4 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 placeholder:text-muted-foreground"
                  />
                </div>
              </div>

              {/* Screenshot 1 */}
              <UploadBox
                label={IG_ACCOUNTS[0].username}
                file={ss1}
                preview={ss1Preview}
                onFile={(f) => handleFile(f, setSs1, setSs1Preview)}
                onClear={() => { setSs1(null); setSs1Preview(null); }}
                inputRef={ss1Ref}
              />

              {/* Screenshot 2 */}
              <UploadBox
                label={IG_ACCOUNTS[1].username}
                file={ss2}
                preview={ss2Preview}
                onFile={(f) => handleFile(f, setSs2, setSs2Preview)}
                onClear={() => { setSs2(null); setSs2Preview(null); }}
                inputRef={ss2Ref}
              />

              {/* Error */}
              {error && (
                <p className="text-sm text-red-500 flex items-center gap-1.5">
                  <X className="w-3.5 h-3.5 shrink-0" /> {error}
                </p>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmitting || !igInput.trim() || !ss1 || !ss2}
                className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Mengirim...</>
                  : <><Check className="w-4 h-4" /> Kirim Aplikasi</>
                }
              </button>

              <p className="text-xs text-muted-foreground text-center">
                Data kamu hanya digunakan untuk verifikasi dan tidak dibagikan ke pihak lain.
              </p>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
