import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Sparkles, Wrench, Bug, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

type Tag = "new" | "improvement" | "fix" | "removed";

type Changelog = {
  id: number;
  title: string;
  description: string;
  tag: Tag;
  created_at: string;
};

const TAG_LABELS: Record<Tag, string> = {
  new: "Baru",
  improvement: "Peningkatan",
  fix: "Perbaikan",
  removed: "Dihapus",
};

const TAG_STYLES: Record<Tag, { pill: string; dot: string; icon: typeof Sparkles }> = {
  new: {
    pill: "bg-blue-500/10 text-blue-500",
    dot: "bg-blue-500",
    icon: Sparkles,
  },
  improvement: {
    pill: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-500",
    icon: Wrench,
  },
  fix: {
    pill: "bg-orange-500/10 text-orange-500",
    dot: "bg-orange-500",
    icon: Bug,
  },
  removed: {
    pill: "bg-red-500/10 text-red-500",
    dot: "bg-red-500",
    icon: Trash2,
  },
};

export const WHATS_NEW_LAST_SEEN_KEY = "pioo_whatsNewLastSeen";

export default function WhatsNewPage() {
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();
  const [entries, setEntries] = useState<Changelog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/changelog");
        const data = await r.json();
        setEntries(Array.isArray(data) ? data : []);

        localStorage.setItem(WHATS_NEW_LAST_SEEN_KEY, new Date().toISOString());

        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          fetch("/api/me/whats-new-last-seen", {
            method: "PUT",
            headers: { Authorization: `Bearer ${session.access_token}` },
          }).catch(() => {});
        }
      } catch {}
      setIsLoading(false);
    })();
  }, []);

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("id-ID", {
      day: "numeric", month: "long", year: "numeric",
    });
  }

  function formatMonth(iso: string) {
    return new Date(iso).toLocaleDateString("id-ID", {
      month: "long", year: "numeric",
    });
  }

  // Group entries by month
  const grouped = useMemo(() => {
    const map = new Map<string, Changelog[]>();
    for (const entry of entries) {
      const key = formatMonth(entry.created_at);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(entry);
    }
    return Array.from(map.entries());
  }, [entries]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">

        {/* Header */}
        <div className="flex items-center gap-3 mb-10">
          <button
            onClick={() => setLocation(isAuthenticated ? "/chat" : "/")}
            className="p-2 -ml-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            aria-label="Kembali"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Apa yang baru?</h1>
            <p className="text-sm text-muted-foreground mt-1">Update dan perbaikan terbaru di Pioo 2.0.</p>
          </div>
        </div>

        {/* Loading skeleton */}
        {isLoading ? (
          <div className="relative pl-8 space-y-8">
            <div className="absolute left-[11px] top-1.5 bottom-1.5 w-px bg-border" />
            {[...Array(3)].map((_, i) => (
              <div key={i} className="relative animate-pulse">
                <div className="absolute -left-8 top-1.5 w-[23px] h-[23px] rounded-full border-4 border-background bg-muted" />
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <div className="h-5 bg-muted rounded-full w-20" />
                    <div className="h-5 bg-muted/60 rounded w-24" />
                  </div>
                  <div className="h-5 bg-muted rounded w-2/3" />
                  <div className="h-4 bg-muted/60 rounded w-full" />
                  <div className="h-4 bg-muted/60 rounded w-4/5" />
                </div>
              </div>
            ))}
          </div>
        ) : entries.length === 0 ? (
          /* Empty state */
          <div className="text-center py-24">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-muted mb-4">
              <Sparkles className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="font-medium text-foreground">Belum ada update.</p>
            <p className="text-sm text-muted-foreground mt-1">Pantau terus ya, banyak yang lagi dimasak!</p>
          </div>
        ) : (
          /* Timeline */
          <div className="space-y-10">
            {grouped.map(([month, items]) => (
              <section key={month}>
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-4 pl-8">
                  {month}
                </h2>
                <div className="relative pl-8 space-y-6">
                  {/* Vertical line */}
                  <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border" />

                  {items.map((entry) => {
                    const style = TAG_STYLES[entry.tag];
                    const Icon = style.icon;
                    return (
                      <article key={entry.id} className="relative group">
                        {/* Timeline dot */}
                        <div className={cn(
                          "absolute -left-8 top-1 w-[23px] h-[23px] rounded-full border-4 border-background flex items-center justify-center",
                          style.dot
                        )}>
                          <Icon className="w-2.5 h-2.5 text-white" />
                        </div>

                        {/* Card */}
                        <div className="rounded-xl border border-border bg-card p-4 sm:p-5 transition-colors group-hover:border-border/60">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span className={cn(
                              "text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full",
                              style.pill
                            )}>
                              {TAG_LABELS[entry.tag]}
                            </span>
                            <span className="text-xs text-muted-foreground">{formatDate(entry.created_at)}</span>
                          </div>
                          <h3 className="font-semibold text-foreground text-[15px] mb-1">{entry.title}</h3>
                          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{entry.description}</p>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}

            {/* End of timeline marker */}
            <div className="relative pl-8">
              <div className="absolute left-[7px] top-0 w-[9px] h-[9px] rounded-full bg-border" />
              <p className="text-xs text-muted-foreground">Itu aja untuk sekarang. Sampai jumpa di update berikutnya!</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
