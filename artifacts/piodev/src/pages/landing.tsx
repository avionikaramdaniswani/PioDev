import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";
import {
  Terminal,
  Sparkles,
  ArrowRight,
  MessageSquare,
  ImageIcon,
  Video,
  AudioWaveform,
  Library,
  Code2,
  Crown,
  Check,
} from "lucide-react";
import { Logo } from "@/components/logo";

export default function LandingPage() {
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (isAuthenticated) setLocation("/chat");
  }, [isAuthenticated]);

  const features = [
    {
      icon: <MessageSquare className="w-5 h-5" />,
      label: "Chat AI",
      title: "Tanya apa aja, jawaban langsung ngalir.",
      desc: "Streaming response, thinking mode, web search, sampe artifact code — semua built-in.",
      href: "/register",
    },
    {
      icon: <ImageIcon className="w-5 h-5" />,
      label: "Image Studio",
      title: "Generate gambar berkualitas tinggi.",
      desc: "Pake Qwen-Image untuk bikin ilustrasi, foto, atau aset visual dari sekedar prompt.",
      href: "/register",
    },
    {
      icon: <Video className="w-5 h-5" />,
      label: "Video Studio",
      title: "Text-to-video & image-to-video.",
      desc: "Bikin video pendek pake Wan 2.6 — cocok untuk konten sosmed atau presentasi.",
      href: "/video-studio",
    },
    {
      icon: <AudioWaveform className="w-5 h-5" />,
      label: "Voice Studio",
      title: "TTS, voice cloning & voice design.",
      desc: "Konversi teks ke suara natural, atau bikin suara custom kamu sendiri.",
      href: "/voice-studio",
    },
    {
      icon: <Library className="w-5 h-5" />,
      label: "Pustaka",
      title: "Upload dokumen, AI bisa baca.",
      desc: "PDF, gambar, file teks — semua bisa di-attach ke chat untuk konteks tambahan.",
      href: "/pustaka",
    },
    {
      icon: <Code2 className="w-5 h-5" />,
      label: "Code Artifact",
      title: "Preview kode HTML/CSS/JS langsung.",
      desc: "Lihat hasil kode yang AI generate tanpa harus copy-paste ke editor sendiri.",
      href: "/register",
    },
  ];

  return (
    <div className="min-h-screen bg-[hsl(240,12%,4%)] text-white overflow-x-hidden relative">
      {/* Ambient blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-60 -left-40 w-[700px] h-[700px] rounded-full bg-primary/10 blur-[140px]" />
        <div className="absolute top-1/3 -right-40 w-[500px] h-[500px] rounded-full bg-indigo-500/8 blur-[120px]" />
        <div className="absolute bottom-0 left-1/3 w-[500px] h-[500px] rounded-full bg-violet-500/8 blur-[120px]" />
      </div>

      {/* Subtle noise texture */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.015] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      {/* Navbar */}
      <nav className="relative z-10 flex items-center justify-between px-6 sm:px-10 py-5 max-w-6xl mx-auto">
        <div className="flex items-center gap-2.5">
          <Logo size={32} />
          <span className="font-bold text-lg tracking-tight">PioCode</span>
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
      <section className="relative z-10 max-w-4xl mx-auto px-6 sm:px-10 pt-16 pb-16 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium mb-6">
            <Sparkles className="w-3 h-3" />
            Satu langganan · Semua AI
          </div>

          <h1 className="text-5xl sm:text-6xl font-bold leading-[1.05] tracking-tight mb-5">
            Satu AI,{" "}
            <span className="bg-gradient-to-r from-primary via-indigo-400 to-violet-400 bg-clip-text text-transparent">
              semua kebutuhan
            </span>
            <br />
            kreatifmu.
          </h1>

          <p className="text-lg text-white/50 max-w-xl mx-auto mb-8 leading-relaxed">
            Chat, gambar, video, suara, sampe baca dokumen — semua dalam satu
            tempat, mulai dari gratis.
          </p>

          <div className="flex items-center justify-center gap-3">
            <Link href="/register">
              <button className="flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 text-white rounded-xl font-semibold text-sm shadow-xl shadow-primary/25 hover:-translate-y-0.5 transition-all group">
                Coba gratis sekarang
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Feature cards — uniform grid */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 sm:px-10 pb-20">
        <div className="text-center mb-10">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
            Semua yang kamu butuhin
          </h2>
          <p className="text-white/50 text-base">
            Enam fitur utama, satu tempat, satu akun.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {features.map((f) => (
            <FeatureCard key={f.label} {...f} />
          ))}
        </motion.div>
      </section>

      {/* Social proof strip */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 sm:px-10 pb-16">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-12 py-6 border-y border-white/5">
          <SocialStat number="10rb+" label="developer & kreator" />
          <SocialDivider />
          <SocialStat number="1jt+" label="chat & gambar dibuat" />
          <SocialDivider />
          <SocialStat number="4.8★" label="rating dari pengguna" />
        </div>
      </section>

      {/* Pricing teaser */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 sm:px-10 pb-20">
        <div className="text-center mb-10">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
            Mulai gratis. Upgrade kalau butuh.
          </h2>
          <p className="text-white/50 text-base">
            Tanpa kartu kredit. Bisa cancel kapan aja.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <PricingCard
            tier="Free"
            price="Rp 0"
            features={["60K token/hari", "7 gambar/hari", "Akses chat dasar"]}
          />
          <PricingCard
            tier="Plus"
            price="Rp 10rb"
            highlighted
            features={[
              "200K token/hari",
              "25 gambar + 12 video/bln",
              "Semua model premium",
            ]}
          />
          <PricingCard
            tier="Pro"
            price="Rp 18rb"
            features={[
              "360K token/hari",
              "40 gambar + 20 video/bln",
              "Frontier models (Qwen3-Max)",
            ]}
          />
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative z-10 max-w-2xl mx-auto px-6 pb-24 text-center">
        <div className="bg-gradient-to-br from-primary/15 to-indigo-500/10 border border-primary/20 rounded-3xl p-10">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">Siap mulai?</h2>
          <p className="text-white/50 text-sm mb-7">
            Gratis selamanya. Tidak perlu kartu kredit.
          </p>
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
          <span>PioCode — teman ngoding yang selalu siap</span>
        </div>
      </footer>
    </div>
  );
}

// ─────────────────────────── Feature Card ────────────────────────────────────
function FeatureCard({
  icon,
  label,
  title,
  desc,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  title: string;
  desc: string;
  href: string;
}) {
  return (
    <Link href={href}>
      <div className="group relative h-full rounded-2xl border border-white/[0.07] bg-[hsl(240,10%,7%)] hover:bg-[hsl(240,10%,9%)] hover:border-white/15 transition-all hover:-translate-y-0.5 cursor-pointer p-6">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 text-primary mb-4 group-hover:bg-primary/15 transition-colors">
          {icon}
        </div>
        <div className="text-[10px] uppercase tracking-wider text-white/40 font-semibold mb-1.5">
          {label}
        </div>
        <div className="text-white text-base font-semibold leading-snug mb-2">
          {title}
        </div>
        <div className="text-white/50 text-sm leading-relaxed">{desc}</div>
      </div>
    </Link>
  );
}

// ─────────────────────────── Social proof helpers ────────────────────────────
function SocialStat({ number, label }: { number: string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-2xl font-bold text-white">{number}</div>
      <div className="text-xs text-white/40 mt-0.5">{label}</div>
    </div>
  );
}

function SocialDivider() {
  return <div className="hidden sm:block w-px h-10 bg-white/10" />;
}

// ─────────────────────────── Pricing card ────────────────────────────────────
function PricingCard({
  tier,
  price,
  features,
  highlighted,
}: {
  tier: string;
  price: string;
  features: string[];
  highlighted?: boolean;
}) {
  return (
    <Link href="/premium">
      <div
        className={`group relative overflow-hidden rounded-2xl border p-6 cursor-pointer transition-all hover:-translate-y-0.5 h-full flex flex-col ${
          highlighted
            ? "border-primary/40 bg-gradient-to-br from-primary/10 to-indigo-500/5 hover:border-primary/60"
            : "border-white/[0.07] bg-[hsl(240,10%,7%)] hover:border-white/15 hover:bg-[hsl(240,10%,9%)]"
        }`}
      >
        {highlighted && (
          <div className="absolute top-3 right-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary text-white text-[10px] font-bold uppercase tracking-wider">
            <Crown className="w-2.5 h-2.5" />
            Populer
          </div>
        )}
        <div className="text-sm font-semibold text-white/60 mb-1">{tier}</div>
        <div className="flex items-baseline gap-1 mb-4">
          <span className="text-3xl font-bold text-white">{price}</span>
          {price !== "Rp 0" && (
            <span className="text-xs text-white/40">/bln</span>
          )}
        </div>
        <ul className="space-y-2 flex-1">
          {features.map((f, i) => (
            <li
              key={i}
              className="flex items-start gap-2 text-xs text-white/70"
            >
              <Check className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
              {f}
            </li>
          ))}
        </ul>
        <div className="mt-5 text-xs font-semibold text-primary group-hover:text-white transition-colors flex items-center gap-1">
          Lihat detail
          <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>
    </Link>
  );
}
