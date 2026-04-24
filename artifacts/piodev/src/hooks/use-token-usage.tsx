import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export type DailyUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  messages: number;
};

const SHOW_TOKENS_KEY = "pioo_show_token_usage";

/** Tanggal hari ini dalam WIB (UTC+7) */
function getToday(): string {
  const wib = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return wib.toISOString().slice(0, 10);
}

// Upsert token harian ke Supabase (fire-and-forget)
export async function recordTokenUsageToDB(
  userId: string,
  promptTokens: number,
  completionTokens: number,
) {
  const today = getToday();
  try {
    const { data: existing } = await supabase
      .from("daily_token_usage")
      .select("*")
      .eq("user_id", userId)
      .eq("date", today)
      .single();

    if (existing) {
      await supabase
        .from("daily_token_usage")
        .update({
          prompt_tokens: existing.prompt_tokens + promptTokens,
          completion_tokens: existing.completion_tokens + completionTokens,
          total_tokens: existing.total_tokens + promptTokens + completionTokens,
          messages: existing.messages + 1,
        })
        .eq("user_id", userId)
        .eq("date", today);
    } else {
      await supabase.from("daily_token_usage").insert({
        user_id: userId,
        date: today,
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: promptTokens + completionTokens,
        messages: 1,
      });
    }
  } catch {
    // Gagal simpan tidak kritis
  }
}

// Hook untuk load semua data token usage langsung dari Supabase (+ realtime)
export function useTokenUsageData(userId: string | undefined) {
  const empty: DailyUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0, messages: 0 };

  const [todayUsage, setTodayUsage] = useState<DailyUsage>(empty);
  const [weekUsage, setWeekUsage] = useState<DailyUsage>(empty);
  const [monthUsage, setMonthUsage] = useState<DailyUsage>(empty);
  const [daily7, setDaily7] = useState<{ date: string; usage: DailyUsage }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const buildStats = useCallback((data: any[]) => {
    const store: Record<string, DailyUsage> = {};
    for (const row of data) {
      store[row.date] = {
        promptTokens: row.prompt_tokens,
        completionTokens: row.completion_tokens,
        totalTokens: row.total_tokens,
        messages: row.messages,
      };
    }

    const calcRange = (days: number): DailyUsage => {
      const result: DailyUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0, messages: 0 };
      for (let i = 0; i < days; i++) {
        const d = new Date(Date.now() + 7 * 60 * 60 * 1000 - i * 24 * 60 * 60 * 1000);
        const key = d.toISOString().slice(0, 10);
        const day = store[key];
        if (day) {
          result.promptTokens += day.promptTokens;
          result.completionTokens += day.completionTokens;
          result.totalTokens += day.totalTokens;
          result.messages += day.messages;
        }
      }
      return result;
    };

    const calcBreakdown = (days: number): { date: string; usage: DailyUsage }[] => {
      const result: { date: string; usage: DailyUsage }[] = [];
      for (let i = 0; i < days; i++) {
        const d = new Date(Date.now() + 7 * 60 * 60 * 1000 - i * 24 * 60 * 60 * 1000);
        const key = d.toISOString().slice(0, 10);
        result.push({ date: key, usage: store[key] || { promptTokens: 0, completionTokens: 0, totalTokens: 0, messages: 0 } });
      }
      return result;
    };

    setTodayUsage(calcRange(1));
    setWeekUsage(calcRange(7));
    setMonthUsage(calcRange(30));
    setDaily7(calcBreakdown(7));
  }, []);

  useEffect(() => {
    if (!userId) { setIsLoading(false); return; }

    const load = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("daily_token_usage")
        .select("*")
        .eq("user_id", userId);

      if (!error && data) buildStats(data);
      setIsLoading(false);
    };

    load();

    // Realtime: re-fetch tiap kali row milik user ini berubah (INSERT atau UPDATE)
    const channel = supabase
      .channel(`token-usage-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "daily_token_usage",
          filter: `user_id=eq.${userId}`,
        },
        async () => {
          const { data, error } = await supabase
            .from("daily_token_usage")
            .select("*")
            .eq("user_id", userId);
          if (!error && data) buildStats(data);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, buildStats]);

  return { todayUsage, weekUsage, monthUsage, daily7, isLoading };
}

export function useShowTokenUsage() {
  const [show, setShow] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(SHOW_TOKENS_KEY);
      return stored === null ? true : stored === "true";
    } catch {
      return true;
    }
  });

  const toggle = useCallback(() => {
    setShow((prev) => {
      const next = !prev;
      try { localStorage.setItem(SHOW_TOKENS_KEY, String(next)); } catch {}
      return next;
    });
  }, []);

  return { show, toggle };
}
