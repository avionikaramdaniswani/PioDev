import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export type Tier = "free" | "plus" | "pro";

export type PremiumStatus = {
  isPremium: boolean;
  isAdmin: boolean;
  tier: Tier;
  premiumExpiresAt: string | null;
  trialClaimedAt?: string | null;
  trialAvailable?: boolean;
};

export type ClaimTrialResponse = {
  ok: true;
  tier: "plus";
  premium_expires_at: string;
  trial_claimed_at: string;
  bonus_granted: boolean;
  bonus_amount_idr: number;
  duration_days: number;
};

export type ClaimTrialError = {
  error: string;
  message: string;
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

  const claimTrial = useCallback(async (): Promise<ClaimTrialResponse | ClaimTrialError> => {
    const res = await fetch("/api/premium/claim-trial", {
      method: "POST",
      headers: { ...(await authHeader()), "Content-Type": "application/json" },
    });
    const data = await res.json();
    if (res.ok) await fetchStatus();
    return data;
  }, [fetchStatus]);

  return { status, isLoading, refetch: fetchStatus, claimTrial };
}
