import { useEffect, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { usePremium } from "@/hooks/use-premium";
import { useTheme } from "@/hooks/use-theme";
import { ArrowLeft, Check, Loader2, CreditCard, Sparkles, AlertTriangle, X as XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

function useInlineToast() {
  const [toast, setToast] = useState<string | null>(null);
  const show = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  }, []);
  return { toast, show };
}

type Tier = {
  id: "free" | "plus" | "pro";
  name: string;
  badge?: string;
  tagline: string;
  price: string;
  priceSuffix: string;
  features: string[];
  cta: { label: string; disabled?: boolean; onClick?: () => void; primary?: boolean };
  secondaryCta?: { label: string; disabled?: boolean; onClick?: () => void };
  highlight?: boolean;
  comingSoon?: boolean;
};

export default function PremiumPricingPage() {
  const { user, isAdmin } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [, setLocation] = useLocation();
  const { status, isLoading, claimTrial } = usePremium(user?.id);
  const { toast, show: showToast } = useInlineToast();

  const [trialModalOpen, setTrialModalOpen] = useState(false);
  const [claiming, setClaiming] = useState(false);

  const handleBuy = useCallback((tierName: "Plus" | "Pro") => {
    showToast(`Payment gateway untuk paket ${tierName} segera hadir. Tunggu update ya!`);
  }, [showToast]);

  const handleOpenTrialModal = useCallback(() => setTrialModalOpen(true), []);
  const handleCloseTrialModal = useCallback(() => {
    if (!claiming) setTrialModalOpen(false);
  }, [claiming]);

  const handleConfirmTrial = useCallback(async () => {
    setClaiming(true);
    try {
      const result = await claimTrial();
      if ("ok" in result && result.ok) {
        const bonusMsg = result.bonus_granted
          ? ` Bonus saldo Rp ${result.bonus_amount_idr.toLocaleString("id-ID")} udah masuk.`
          : "";
        showToast(`Berhasil! Plus aktif sampai 1 bulan ke depan.${bonusMsg}`);
        setTrialModalOpen(false);
      } else {
        const err = result as { error: string; message: string };
        showToast(err.message || "Gagal klaim uji coba. Coba lagi.");
        // Kalau errornya 'trial_already_claimed' atau 'already_premium', tutup modal
        if (err.error === "trial_already_claimed" || err.error === "already_premium" || err.error === "admin_bypass") {
          setTrialModalOpen(false);
        }
      }
    } catch {
      showToast("Gagal klaim uji coba. Cek koneksi internet kamu.");
    } finally {
      setClaiming(false);
    }
  }, [claimTrial, showToast]);

  useEffect(() => {
    if (!user) setLocation("/login");
  }, [user, setLocation]);

  if (!user) return null;

  if (isLoading || !status) {
    return (
      <div className={cn("min-h-dvh bg-background flex items-center justify-center", isDark ? "dark" : "")}>
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const userTier = status.tier ?? (status.isPremium ? "plus" : "free");
  const isPlusActive = userTier === "plus" && !isAdmin;
  const isProActive  = userTier === "pro"  && !isAdmin;
  const isPremium = status.isPremium || isAdmin;
  const trialClaimed = !!status.trialClaimedAt;
  // Tombol trial cuma untuk user free yang belum pernah klaim & bukan admin
  const showTrialButton = !isAdmin && !isPlusActive && !isProActive;

  const tiers: Tier[] = [
    {
      id: "free",
      name: "Gratis",
      tagline: "Mulai eksplorasi PioCode",
      price: "Rp 0",
      priceSuffix: "selamanya",
      features: [
        "60.000 token per hari",
        "Akses model dasar",
        "7 gambar AI per hari",
        "3 video AI per bulan",
      ],
      cta: !isPremium
        ? { label: "Paket Saat Ini", disabled: true }
        : { label: "Paket Dasar", disabled: true },
    },
    {
      id: "plus",
      name: "Plus",
      badge: "Populer",
      tagline: "Untuk pengguna aktif",
      price: "Rp 10.000",
      priceSuffix: "per bulan · gratis lewat promo",
      highlight: true,
      features: [
        "200.000 token per hari",
        "Semua model premium",
        "25 gambar AI per hari",
        "12 video AI per bulan",
        "Prioritas saat server sibuk",
        "API key untuk developer",
        "Bonus saldo Rp 75.000 saat upgrade",
      ],
      cta: isAdmin
        ? { label: "Admin · Bypass", disabled: true }
        : isPlusActive
        ? { label: "Paket Aktif", disabled: true }
        : isProActive
        ? { label: "Sudah Pakai Pro", disabled: true }
        : { label: "Pilih & Beli Sekarang", primary: true, onClick: () => handleBuy("Plus") },
      secondaryCta: !showTrialButton
        ? undefined
        : trialClaimed
        ? { label: "Uji Coba Sudah Diklaim", disabled: true }
        : { label: "Ambil Gratis Uji Coba 1 Bulan", onClick: handleOpenTrialModal },
    },
    {
      id: "pro",
      name: "Pro",
      badge: "Baru",
      tagline: "Untuk power user & developer",
      price: "Rp 18.000",
      priceSuffix: "per bulan",
      features: [
        "360.000 token per hari",
        "Semua model premium",
        "40 gambar AI per hari",
        "20 video AI per bulan",
        "Prioritas tertinggi saat sibuk",
        "API key untuk developer",
        "Bonus saldo Rp 125.000 saat upgrade",
      ],
      cta: isAdmin
        ? { label: "Admin · Bypass", disabled: true }
        : isProActive
        ? { label: "Paket Aktif", disabled: true }
        : { label: "Pilih & Beli Sekarang", onClick: () => handleBuy("Pro") },
    },
  ];

  return (
    <div className={cn("min-h-dvh bg-background text-foreground flex flex-col", isDark ? "dark" : "")}>
      <header className="sticky top-0 z-10 backdrop-blur-md bg-background/80 border-b border-border">
        <div className="max-w-6xl mx-auto flex items-center gap-3 px-4 py-4">
          <button
            onClick={() => setLocation("/chat")}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
            aria-label="Kembali"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="font-semibold text-sm">Paket & Harga</span>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-12 sm:py-16">
        <div className="text-center mb-12">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
            Paket yang tumbuh bersamamu
          </h1>
          <p className="text-sm text-muted-foreground mt-3 max-w-xl mx-auto">
            Mulai gratis. Upgrade kapan pun butuh kapasitas lebih besar.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5 items-stretch">
          {tiers.map((t) => (
            <TierCard key={t.id} tier={t} />
          ))}
        </div>
      </main>

      {/* Toast — payment gateway segera hadir */}
      <div
        className={cn(
          "fixed bottom-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 pointer-events-none",
          toast ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3",
        )}
        role="status"
        aria-live="polite"
      >
        {toast && (
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-foreground text-background shadow-lg max-w-[90vw]">
            <CreditCard className="w-4 h-4 shrink-0" />
            <span className="text-sm font-medium">{toast}</span>
          </div>
        )}
      </div>

      {/* Modal konfirmasi klaim uji coba Plus */}
      {trialModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={handleCloseTrialModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="trial-modal-title"
        >
          <div
            className="bg-card border border-border rounded-2xl shadow-2xl max-w-md w-full p-6 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={handleCloseTrialModal}
              disabled={claiming}
              className="absolute top-4 right-4 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
              aria-label="Tutup"
            >
              <XIcon className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center text-primary">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h2 id="trial-modal-title" className="text-lg font-semibold text-foreground leading-tight">
                  Uji Coba Plus 1 Bulan
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">Gratis, tanpa kartu kredit.</p>
              </div>
            </div>

            <ul className="space-y-2.5 mb-5 text-sm text-foreground">
              <li className="flex items-start gap-2.5">
                <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" strokeWidth={2.5} />
                <span>Akses semua fitur Plus selama <strong>30 hari</strong></span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" strokeWidth={2.5} />
                <span>Bonus saldo <strong>Rp 25.000</strong> langsung masuk</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" strokeWidth={2.5} />
                <span>Otomatis kembali ke Free saat masa uji coba habis</span>
              </li>
            </ul>

            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 mb-5">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <p className="text-xs leading-relaxed">
                Uji coba <strong>cuma bisa diklaim sekali per akun</strong> dan tidak bisa dibatalkan. Pastikan kamu pakai email yang aktif.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleCloseTrialModal}
                disabled={claiming}
                className="flex-1 h-10 rounded-lg text-sm font-medium border border-border bg-background text-foreground hover:bg-muted transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmTrial}
                disabled={claiming}
                className="flex-1 h-10 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                data-testid="button-confirm-trial"
              >
                {claiming ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Memproses…</span>
                  </>
                ) : (
                  <span>Aktifkan Sekarang</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TierCard({ tier }: { tier: Tier }) {
  // Per-tier color tokens
  const isPlus = tier.id === "plus";
  const isPro = tier.id === "pro";

  const cardClasses = isPlus
    ? "border-primary/50 bg-gradient-to-b from-primary/[0.06] to-transparent shadow-lg shadow-primary/10"
    : isPro
    ? "border-amber-500/40 dark:border-amber-400/30 bg-gradient-to-b from-amber-500/[0.04] to-transparent"
    : "border-border";

  const badgeClasses = isPlus
    ? "bg-primary text-primary-foreground"
    : isPro
    ? "bg-amber-500/15 text-amber-600 dark:bg-amber-400/15 dark:text-amber-400"
    : "bg-muted text-muted-foreground";

  const checkClasses = isPlus
    ? "text-primary"
    : isPro
    ? "text-amber-600 dark:text-amber-400"
    : "text-foreground/60";

  return (
    <div
      className={cn(
        "rounded-2xl border bg-card p-5 sm:p-6 flex flex-col transition-shadow",
        cardClasses,
        tier.comingSoon && "opacity-80",
      )}
      data-testid={`card-tier-${tier.id}`}
    >
      {/* Name + badge */}
      <div className="flex items-center gap-2 mb-1.5 min-h-[24px]">
        <h3 className={cn(
          "text-base sm:text-lg font-semibold",
          isPlus ? "text-primary" : isPro ? "text-amber-600 dark:text-amber-400" : "text-foreground",
        )}>
          {tier.name}
        </h3>
        {tier.badge && (
          <span
            className={cn(
              "text-[10px] font-semibold px-1.5 py-0.5 rounded-md uppercase tracking-wide",
              badgeClasses,
            )}
          >
            {tier.badge}
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground mb-5">{tier.tagline}</p>

      {/* Price */}
      <div className="mb-5">
        <div className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight leading-none">
          {tier.price}
        </div>
        <p className="text-xs text-muted-foreground mt-1.5">{tier.priceSuffix}</p>
      </div>

      {/* CTA */}
      <button
        onClick={tier.cta.onClick}
        disabled={tier.cta.disabled}
        data-testid={`button-cta-${tier.id}`}
        className={cn(
          "w-full h-10 rounded-lg text-sm font-medium transition-all px-3",
          tier.cta.primary
            ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm shadow-primary/20"
            : isPlus
            ? "border border-primary/40 bg-primary/10 text-primary hover:bg-primary/15"
            : isPro
            ? "border border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/15"
            : "border border-border bg-background text-foreground hover:bg-muted",
          tier.cta.disabled && "cursor-not-allowed opacity-60 hover:bg-background",
        )}
      >
        <span className="truncate block">{tier.cta.label}</span>
      </button>

      {/* Secondary CTA (mis. uji coba gratis) */}
      {tier.secondaryCta && (
        <button
          onClick={tier.secondaryCta.onClick}
          disabled={tier.secondaryCta.disabled}
          data-testid={`button-secondary-cta-${tier.id}`}
          className={cn(
            "w-full h-10 rounded-lg text-sm font-medium transition-all px-3 mt-2",
            "border border-dashed border-primary/40 bg-transparent text-primary hover:bg-primary/10",
            tier.secondaryCta.disabled && "cursor-not-allowed opacity-60 hover:bg-transparent",
          )}
        >
          <span className="truncate block">{tier.secondaryCta.label}</span>
        </button>
      )}

      <div className="mb-6" />

      {/* Features */}
      <ul className="space-y-2.5 flex-1">
        {tier.features.map((f, i) => (
          <li key={i} className="flex items-start gap-2.5 text-xs sm:text-sm text-muted-foreground leading-relaxed">
            <Check className={cn("w-3.5 h-3.5 shrink-0 mt-0.5", checkClasses)} strokeWidth={2.5} />
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
