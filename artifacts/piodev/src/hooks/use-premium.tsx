import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export type PremiumStatus = {
  isPremium: boolean;
  isAdmin: boolean;
  premiumExpiresAt: string | null;
  application: {
    id: string;
    instagram: string;
    status: "pending" | "approved" | "rejected";
    rejection_note: string;
    created_at: string;
  } | null;
};

async function authHeader() {
  const { data: { session } } = await supabase.auth.getSession();
  return { Authorization: `Bearer ${session?.access_token ?? ""}` };
}

export function usePremium(userId: string | undefined) {
  const [status, setStatus] = useState<PremiumStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    if (!userId) { setIsLoading(false); return; }
    try {
      const res = await fetch("/api/premium/status", { headers: await authHeader() });
      if (res.ok) setStatus(await res.json());
    } catch { /**/ } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const apply = useCallback(async (instagram: string): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await fetch("/api/premium/apply", {
        method: "POST",
        headers: { ...(await authHeader()), "Content-Type": "application/json" },
        body: JSON.stringify({ instagram }),
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, error: data.error };
      await fetchStatus();
      return { ok: true };
    } catch {
      return { ok: false, error: "Terjadi kesalahan. Coba lagi." };
    }
  }, [fetchStatus]);

  return { status, isLoading, apply, refetch: fetchStatus };
}
