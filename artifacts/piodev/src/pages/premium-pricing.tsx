import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { usePremium } from "@/hooks/use-premium";
import { useTheme } from "@/hooks/use-theme";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Tier = {
  id: "free" | "plus" | "pro";
  name: string;
  badge?: string;
  tagline: string;
  price: string;
  priceSuffix: string;
  features: string[];
  cta: { label: string; disabled?: boolean; onClick?: () => void; primary?: boolean };
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
      priceSuffix: "selamanya",
      features: [
        "60.000 token per hari",
        "Akses model dasar",
        "7 gambar AI per hari",
        "3 video AI per bulan",
        "API key untuk developer",
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
      price: "Gratis",
      priceSuffix: "promo terbatas",
      highlight: true,
      features: [
        "360.000 token per hari",
        "Semua model premium",
        "25 gambar AI per hari",
        "12 video AI per bulan",
        "Prioritas saat server sibuk",
        "API key dengan kuota Plus",
      ],
      cta: isPremium
        ? { label: "Paket Aktif", disabled: true }
        : hasPending
        ? { label: "Aplikasi Diproses…", onClick: () => setLocation("/premium/apply") }
        : { label: "Dapatkan Plus", primary: true, onClick: () => setLocation("/premium/apply") },
    },
    {
      id: "pro",
      name: "Pro",
      badge: "Segera",
      tagline: "Untuk tim & profesional",
      price: "—",
      priceSuffix: "sedang dikembangkan",
      comingSoon: true,
      features: [
        "Token tanpa batas wajar",
        "Model frontier terbaru",
        "Gambar AI tak terbatas",
        "Video HD hingga 60 detik",
        "Dukungan prioritas 1-on-1",
      ],
      cta: { label: "Beri Tahu Aku", disabled: true },
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
        </div>

        <div className="grid grid-cols-3 gap-4 sm:gap-5 items-stretch">
          {tiers.map((t) => (
            <TierCard key={t.id} tier={t} />
          ))}
        </div>
      </main>
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
    ? "border-amber-500/30 dark:border-amber-400/25"
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
    >
      {/* Name + badge */}
      <div className="flex items-center gap-2 mb-1.5 min-h-[24px]">
        <h3 className={cn(
          "text-base sm:text-lg font-semibold",
          isPlus ? "text-primary" : "text-foreground",
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
        className={cn(
          "w-full h-10 rounded-lg text-sm font-medium transition-all mb-6 px-3",
          tier.cta.primary
            ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm shadow-primary/20"
            : isPlus
            ? "border border-primary/40 bg-primary/10 text-primary hover:bg-primary/15"
            : "border border-border bg-background text-foreground hover:bg-muted",
          tier.cta.disabled && "cursor-not-allowed opacity-60 hover:bg-background",
        )}
      >
        <span className="truncate block">{tier.cta.label}</span>
      </button>

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
