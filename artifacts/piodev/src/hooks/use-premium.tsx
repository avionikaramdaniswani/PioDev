import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export type Tier = "free" | "plus" | "pro";

export type PremiumStatus = {
  isPremium: boolean;
  isAdmin: boolean;
  tier: Tier;
  premiumExpiresAt: string | null;
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

  return { status, isLoading, refetch: fetchStatus };
}
