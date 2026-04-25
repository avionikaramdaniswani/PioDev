import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { usePremium } from "@/hooks/use-premium";
import { useTheme } from "@/hooks/use-theme";
import {
  ArrowLeft, Check, Sparkles, Zap, Star, Loader2,
  Crown, Image as ImageIcon, Video, MessageSquare, Cpu, Key as KeyIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Tier = {
  id: "free" | "plus" | "pro";
  name: string;
  tagline: string;
  price: string;
  priceSuffix?: string;
  pricePrefix?: string;
  badge?: string;
  icon: React.ReactNode;
  accent: "muted" | "amber" | "violet";
  features: { icon: React.ReactNode; text: string; bold?: boolean }[];
  cta: { label: string; disabled?: boolean; onClick?: () => void; variant: "outline" | "primary" | "soft" };
  highlight?: boolean;
  comingSoon?: boolean;
};

export default function PremiumPricingPage() {
  const { user, isAdmin } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [, setLocation] = useLocation();
  const { status, isLoading } = usePremium(user?.id);

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

  const isPremium = status.isPremium || isAdmin;
  const appStatus = status.application?.status;
  const hasPending = appStatus === "pending";

  const tiers: Tier[] = [
    {
      id: "free",
      name: "Gratis",
      tagline: "Mulai eksplorasi PioCode",
      price: "Rp 0",
      priceSuffix: "/ bulan",
      icon: <Zap className="w-5 h-5" />,
      accent: "muted",
      features: [
        { icon: <MessageSquare className="w-3.5 h-3.5" />, text: "60.000 token/hari", bold: true },
        { icon: <Cpu className="w-3.5 h-3.5" />, text: "Akses model dasar (Mini)" },
        { icon: <ImageIcon className="w-3.5 h-3.5" />, text: "7 gambar AI per hari" },
        { icon: <Video className="w-3.5 h-3.5" />, text: "3 video AI per bulan" },
        { icon: <KeyIcon className="w-3.5 h-3.5" />, text: "API key untuk developer" },
      ],
      cta: !isPremium
        ? { label: "Paket Saat Ini", disabled: true, variant: "outline" }
        : { label: "Paket Dasar", disabled: true, variant: "outline" },
    },
    {
      id: "plus",
      name: "Plus",
      tagline: "Untuk pengguna aktif & power user",
      price: "Gratis",
      priceSuffix: "promo terbatas",
      pricePrefix: "✨",
      badge: "Paling Populer",
      icon: <Sparkles className="w-5 h-5" />,
      accent: "amber",
      highlight: true,
      features: [
        { icon: <MessageSquare className="w-3.5 h-3.5" />, text: "360.000 token/hari (6× lebih banyak)", bold: true },
        { icon: <Cpu className="w-3.5 h-3.5" />, text: "Semua model premium (Pro & Reasoning)" },
        { icon: <ImageIcon className="w-3.5 h-3.5" />, text: "25 gambar AI per hari" },
        { icon: <Video className="w-3.5 h-3.5" />, text: "12 video AI per bulan" },
        { icon: <Star className="w-3.5 h-3.5" />, text: "Prioritas saat server sibuk" },
        { icon: <KeyIcon className="w-3.5 h-3.5" />, text: "API key dengan kuota Plus" },
      ],
      cta: isPremium
        ? { label: "Paket Aktif", disabled: true, variant: "soft" }
        : hasPending
        ? { label: "Aplikasi Diproses…", disabled: false, variant: "outline", onClick: () => setLocation("/premium/apply") }
        : { label: "Dapatkan Plus", variant: "primary", onClick: () => setLocation("/premium/apply") },
    },
    {
      id: "pro",
      name: "Pro",
      tagline: "Untuk tim & profesional",
      price: "Segera",
      priceSuffix: "hadir",
      icon: <Crown className="w-5 h-5" />,
      accent: "violet",
      comingSoon: true,
      features: [
        { icon: <MessageSquare className="w-3.5 h-3.5" />, text: "Token tanpa batas wajar", bold: true },
        { icon: <Cpu className="w-3.5 h-3.5" />, text: "Akses model frontier terbaru" },
        { icon: <ImageIcon className="w-3.5 h-3.5" />, text: "Generate gambar tak terbatas" },
        { icon: <Video className="w-3.5 h-3.5" />, text: "Video HD hingga 60 detik" },
        { icon: <Star className="w-3.5 h-3.5" />, text: "Dukungan prioritas 1-on-1" },
      ],
      cta: { label: "Beri Tahu Aku", disabled: true, variant: "outline" },
    },
  ];

  return (
    <div className={cn("min-h-dvh bg-background text-foreground flex flex-col", isDark ? "dark" : "")}>
      {/* Header */}
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

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-10 sm:py-16">
        {/* Hero */}
        <div className="text-center mb-10 sm:mb-14">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            Pilih paket yang cocok untukmu
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground mb-3">
            Paket yang tumbuh bersamamu
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
            Mulai gratis, naik level kapan saja. Tidak ada kontrak jangka panjang —
            kamu bisa berhenti atau ganti paket kapan pun.
          </p>
        </div>

        {/* Tiers */}
        <div className="grid grid-cols-3 gap-3 sm:gap-5 max-w-5xl mx-auto pt-4">
          {tiers.map((t) => (
            <TierCard key={t.id} tier={t} />
          ))}
        </div>

        {/* Footer note */}
        <div className="mt-12 text-center">
          <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
            Semua paket termasuk akses penuh ke fitur chat utama, riwayat percakapan,
            dan pengaturan profil. Kuota direset setiap hari pada pukul 00:00 WIB.
          </p>
        </div>
      </main>
    </div>
  );
}

function TierCard({ tier }: { tier: Tier }) {
  const accentRing =
    tier.accent === "amber" ? "ring-amber-500/40 dark:ring-amber-400/40"
    : tier.accent === "violet" ? "ring-violet-500/30 dark:ring-violet-400/30"
    : "ring-border";

  const accentBg =
    tier.accent === "amber" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
    : tier.accent === "violet" ? "bg-violet-500/10 text-violet-600 dark:text-violet-400"
    : "bg-muted text-muted-foreground";

  const accentBadge =
    tier.accent === "amber" ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white"
    : tier.accent === "violet" ? "bg-violet-500 text-white"
    : "bg-muted text-muted-foreground";

  return (
    <div
      className={cn(
        "relative rounded-2xl border bg-card flex flex-col px-4 sm:px-5 pb-4 sm:pb-5",
        tier.highlight
          ? "pt-7 sm:pt-8 border-amber-500/40 dark:border-amber-400/40 shadow-lg shadow-amber-500/10 ring-1 " + accentRing
          : "pt-4 sm:pt-5 border-border",
        tier.comingSoon && "opacity-90"
      )}
    >
      {tier.badge && (
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 z-10">
          <span className={cn("text-[9px] sm:text-[10px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-wide shadow-sm whitespace-nowrap", accentBadge)}>
            {tier.badge}
          </span>
        </div>
      )}
      {tier.comingSoon && (
        <div className="absolute top-3 right-3 z-10">
          <span className="text-[9px] sm:text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground uppercase tracking-wide">
            Segera
          </span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <div className={cn("w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0", accentBg)}>
          {tier.icon}
        </div>
        <h3 className="text-base sm:text-lg font-bold text-foreground">{tier.name}</h3>
      </div>
      <p className="text-[11px] sm:text-xs text-muted-foreground mb-4 leading-snug">{tier.tagline}</p>

      {/* Price */}
      <div className="mb-4">
        <div className="flex items-baseline gap-1">
          {tier.pricePrefix && <span className="text-sm sm:text-base">{tier.pricePrefix}</span>}
          <span className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">{tier.price}</span>
        </div>
        {tier.priceSuffix && (
          <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">{tier.priceSuffix}</p>
        )}
      </div>

      {/* CTA */}
      <button
        onClick={tier.cta.onClick}
        disabled={tier.cta.disabled}
        className={cn(
          "w-full h-10 sm:h-11 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-1.5 mb-5 px-2",
          tier.cta.variant === "primary" &&
            "bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 shadow-md shadow-amber-500/20",
          tier.cta.variant === "soft" &&
            "bg-amber-500/10 text-amber-600 dark:text-amber-400 cursor-default",
          tier.cta.variant === "outline" &&
            "border border-border bg-background text-foreground hover:bg-muted",
          tier.cta.disabled && "cursor-not-allowed opacity-70 hover:bg-background"
        )}
      >
        {tier.cta.variant === "primary" && <Sparkles className="w-3.5 h-3.5 shrink-0" />}
        {tier.cta.variant === "soft" && <Check className="w-3.5 h-3.5 shrink-0" />}
        <span className="truncate">{tier.cta.label}</span>
      </button>

      {/* Divider */}
      <div className="border-t border-border mb-3" />

      {/* Features */}
      <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2.5">
        Yang kamu dapat
      </p>
      <ul className="space-y-2 flex-1">
        {tier.features.map((f, i) => (
          <li key={i} className="flex items-start gap-2">
            <div className={cn(
              "w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5",
              tier.accent === "amber" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
              : tier.accent === "violet" ? "bg-violet-500/10 text-violet-600 dark:text-violet-400"
              : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            )}>
              <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3" strokeWidth={3} />
            </div>
            <span className={cn("text-xs sm:text-sm leading-snug", f.bold ? "text-foreground font-medium" : "text-muted-foreground")}>
              {f.text}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
