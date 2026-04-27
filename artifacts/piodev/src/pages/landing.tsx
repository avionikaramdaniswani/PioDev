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

      {/* Hero — slim & sharp */}
      <section className="relative z-10 max-w-4xl mx-auto px-6 sm:px-10 pt-16 pb-14 text-center">
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

      {/* Bento Grid */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 sm:px-10 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-3 auto-rows-[180px] gap-4"
        >
          {/* Chat AI — big card */}
          <BentoCard
            href="/register"
            className="md:col-span-2 md:row-span-2"
            icon={<MessageSquare className="w-4 h-4" />}
            label="Chat AI"
            title="Tanya apa aja, jawaban langsung ngalir."
            sub="Streaming, thinking mode, web search, sampe artifact code."
          >
            <ChatDemo />
          </BentoCard>

          {/* Image Gen — vertical */}
          <BentoCard
            href="/register"
            className="md:row-span-2"
            icon={<ImageIcon className="w-4 h-4" />}
            label="Image Studio"
            title="Generate gambar pake Qwen-Image."
          >
            <ImageDemo />
          </BentoCard>

          {/* Video Studio — wide */}
          <BentoCard
            href="/video-studio"
            className="md:col-span-2"
            icon={<Video className="w-4 h-4" />}
            label="Video Studio"
            title="Text-to-video dengan Wan 2.6."
          >
            <VideoDemo />
          </BentoCard>

          {/* Voice Studio */}
          <BentoCard
            href="/voice-studio"
            icon={<AudioWaveform className="w-4 h-4" />}
            label="Voice Studio"
            title="TTS & voice cloning."
          >
            <VoiceDemo />
          </BentoCard>

          {/* Code Artifact — wide */}
          <BentoCard
            href="/register"
            className="md:col-span-2"
            icon={<Code2 className="w-4 h-4" />}
            label="Code Artifact"
            title="Preview HTML/CSS/JS langsung di chat."
          >
            <CodeDemo />
          </BentoCard>

          {/* Pustaka */}
          <BentoCard
            href="/pustaka"
            icon={<Library className="w-4 h-4" />}
            label="Pustaka"
            title="Upload dokumen, AI bisa baca."
          >
            <PustakaDemo />
          </BentoCard>
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
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">
            Siap mulai?
          </h2>
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

// ─────────────────────────── Bento Card Wrapper ──────────────────────────────
function BentoCard({
  href,
  className = "",
  icon,
  label,
  title,
  sub,
  children,
}: {
  href: string;
  className?: string;
  icon: React.ReactNode;
  label: string;
  title: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href}>
      <div
        className={`group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[hsl(240,10%,7%)] hover:bg-[hsl(240,10%,9%)] hover:border-white/15 transition-all hover:-translate-y-0.5 cursor-pointer flex flex-col h-full ${className}`}
      >
        {/* Glow on hover */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/0 via-primary/0 to-primary/0 group-hover:from-primary/5 group-hover:to-transparent transition-all pointer-events-none" />

        {/* Visual area (top) */}
        <div className="relative flex-1 min-h-0 overflow-hidden">{children}</div>

        {/* Text footer */}
        <div className="relative p-5 border-t border-white/[0.05]">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/40 font-semibold mb-1.5">
            <span className="text-primary">{icon}</span>
            {label}
          </div>
          <div className="text-white text-sm font-semibold leading-snug">
            {title}
          </div>
          {sub && (
            <div className="text-white/45 text-xs mt-1 leading-relaxed">
              {sub}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

// ─────────────────────────── Mini Demos ──────────────────────────────────────
function ChatDemo() {
  return (
    <div className="absolute inset-0 p-6 flex flex-col justify-end gap-3">
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="flex justify-end"
      >
        <div className="bg-primary/20 border border-primary/30 rounded-2xl rounded-tr-sm px-4 py-2 text-xs text-white/85 max-w-[60%]">
          Bikinin landing page bento grid dong
        </div>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, delay: 0.5 }}
        className="flex gap-2"
      >
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
          <Terminal className="w-3 h-3 text-white" />
        </div>
        <div className="bg-white/[0.04] border border-white/10 rounded-2xl rounded-tl-sm px-4 py-2 text-xs text-white/70 max-w-[70%]">
          Sip! Aku susun grid 3 kolom asimetris pake Tailwind, tiap kotak
          interaktif{" "}
          <motion.span
            animate={{ opacity: [0.2, 1, 0.2] }}
            transition={{ duration: 1.4, repeat: Infinity }}
            className="inline-block ml-0.5"
          >
            ▍
          </motion.span>
        </div>
      </motion.div>
    </div>
  );
}

function ImageDemo() {
  return (
    <div className="absolute inset-0 p-5 flex items-center justify-center">
      <div className="relative w-full aspect-square max-w-[180px] rounded-xl overflow-hidden border border-white/10">
        <motion.div
          className="absolute inset-0 bg-gradient-to-br from-violet-500 via-primary to-indigo-400"
          animate={{
            background: [
              "linear-gradient(135deg, #8b5cf6, #6366f1, #818cf8)",
              "linear-gradient(135deg, #ec4899, #8b5cf6, #6366f1)",
              "linear-gradient(135deg, #f59e0b, #ec4899, #8b5cf6)",
              "linear-gradient(135deg, #8b5cf6, #6366f1, #818cf8)",
            ],
          }}
          transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
        />
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
          animate={{ x: ["-100%", "100%"] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="absolute bottom-2 left-2 right-2 flex items-center gap-1.5">
          <div className="h-1 flex-1 rounded-full bg-black/30 overflow-hidden">
            <motion.div
              className="h-full bg-white rounded-full"
              animate={{ width: ["0%", "100%", "0%"] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>
          <Sparkles className="w-3 h-3 text-white/70" />
        </div>
      </div>
    </div>
  );
}

function VideoDemo() {
  return (
    <div className="absolute inset-0 p-5 flex items-center justify-center gap-3">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="relative aspect-video flex-1 rounded-lg border border-white/10 overflow-hidden bg-gradient-to-br from-indigo-500/30 to-primary/20"
          animate={{
            opacity: [0.4, 1, 0.4],
          }}
          transition={{
            duration: 2.5,
            delay: i * 0.4,
            repeat: Infinity,
          }}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-6 h-6 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <div className="w-0 h-0 border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent border-l-[6px] border-l-white ml-0.5" />
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function VoiceDemo() {
  const bars = [0.4, 0.7, 0.5, 0.9, 0.3, 0.8, 0.6, 0.4, 0.7, 0.5, 0.85, 0.4];
  return (
    <div className="absolute inset-0 p-5 flex items-center justify-center gap-1">
      {bars.map((h, i) => (
        <motion.div
          key={i}
          className="w-1 rounded-full bg-gradient-to-t from-primary to-indigo-400"
          animate={{
            height: [`${h * 30}%`, `${h * 90}%`, `${h * 40}%`, `${h * 70}%`],
          }}
          transition={{
            duration: 1.2,
            delay: i * 0.08,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

function CodeDemo() {
  return (
    <div className="absolute inset-0 p-5 font-mono text-xs">
      <div className="bg-black/40 border border-white/10 rounded-lg h-full p-3 overflow-hidden">
        <div className="flex items-center gap-1.5 mb-2 pb-2 border-b border-white/5">
          <div className="w-2 h-2 rounded-full bg-red-500/60" />
          <div className="w-2 h-2 rounded-full bg-yellow-500/60" />
          <div className="w-2 h-2 rounded-full bg-green-500/60" />
          <span className="ml-1.5 text-[10px] text-white/30">App.tsx</span>
        </div>
        <div className="space-y-1 text-[11px] leading-relaxed">
          <div>
            <span className="text-pink-400">function</span>{" "}
            <span className="text-yellow-300">App</span>
            <span className="text-white/60">() {"{"}</span>
          </div>
          <div className="pl-4">
            <span className="text-pink-400">return</span>{" "}
            <span className="text-white/60">&lt;</span>
            <span className="text-blue-300">div</span>
            <span className="text-white/60">&gt;</span>
            <motion.span
              className="text-white/80"
              animate={{ opacity: [0, 1] }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              Hello PioCode
            </motion.span>
            <span className="text-white/60">&lt;/</span>
            <span className="text-blue-300">div</span>
            <span className="text-white/60">&gt;</span>
            <motion.span
              animate={{ opacity: [0, 1, 0] }}
              transition={{ duration: 1, repeat: Infinity }}
              className="text-primary"
            >
              ▍
            </motion.span>
          </div>
          <div>
            <span className="text-white/60">{"}"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function PustakaDemo() {
  return (
    <div className="absolute inset-0 p-5 flex items-center justify-center">
      <div className="relative w-20 h-24">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="absolute inset-0 rounded-lg border border-white/15 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-sm flex items-center justify-center"
            initial={{ y: i * 6, x: i * 4, rotate: i * 3 }}
            animate={{
              y: [i * 6, i * 6 - 3, i * 6],
            }}
            transition={{
              duration: 2,
              delay: i * 0.2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            style={{ zIndex: 3 - i }}
          >
            <div className="text-[8px] font-mono text-white/30">PDF</div>
          </motion.div>
        ))}
      </div>
    </div>
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
