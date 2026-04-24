import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Sparkles } from "lucide-react";
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

const TAG_COLORS: Record<Tag, string> = {
  new: "bg-blue-500/15 text-blue-500 border-blue-500/20",
  improvement: "bg-green-500/15 text-green-600 border-green-500/20",
  fix: "bg-orange-500/15 text-orange-500 border-orange-500/20",
  removed: "bg-red-500/15 text-red-500 border-red-500/20",
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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-4 py-10">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => setLocation(isAuthenticated ? "/chat" : "/")}
            className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">What's New</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Update dan perbaikan terbaru Pioo 2.0</p>
          </div>
        </div>

        {/* Entries */}
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="rounded-xl border border-border p-5 animate-pulse">
                <div className="flex gap-2 mb-3">
                  <div className="h-5 bg-muted rounded-full w-16" />
                  <div className="h-5 bg-muted rounded w-24" />
                </div>
                <div className="h-5 bg-muted rounded w-2/3 mb-2" />
                <div className="h-4 bg-muted rounded w-full mb-1" />
                <div className="h-4 bg-muted rounded w-4/5" />
              </div>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-24 text-muted-foreground">
            <Sparkles className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="font-medium">Belum ada update.</p>
            <p className="text-sm mt-1">Pantau terus ya, banyak yang sedang dimasak!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {entries.map((entry) => (
              <div key={entry.id} className="rounded-xl border border-border bg-card p-5 hover:border-border/80 transition-colors">
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <span className={cn("text-[11px] font-semibold px-2.5 py-0.5 rounded-full border", TAG_COLORS[entry.tag])}>
                    {TAG_LABELS[entry.tag]}
                  </span>
                  <span className="text-xs text-muted-foreground">{formatDate(entry.created_at)}</span>
                </div>
                <h3 className="font-semibold text-foreground mb-1.5 text-[15px]">{entry.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{entry.description}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
