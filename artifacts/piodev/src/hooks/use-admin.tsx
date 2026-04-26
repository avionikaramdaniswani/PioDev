import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export type Tier = "free" | "plus" | "pro";

export type AdminUser = {
  id: string;
  email: string;
  full_name: string;
  role: "user" | "admin";
  is_premium: boolean;
  tier: Tier;
  premium_expires_at: string | null;
  credit_balance_idr: number;
  trial_claimed_at: string | null;
  created_at: string;
  last_sign_in_at: string | null;
};

export type PremiumApplication = {
  id: string;
  user_id: string;
  email: string;
  instagram: string;
  screenshot_url: string;
  screenshot_url_2: string;
  status: "pending" | "approved" | "rejected";
  rejection_note: string;
  created_at: string;
  reviewed_at: string | null;
};
// ^ DEPRECATED — Plus IG-application flow removed. Type retained only so external imports don't break.

export type AdminStats = {
  totalUsers: number;
  totalConversations: number;
  totalMessages: number;
  totalTokens: number;
};

export type DailyUsage = {
  date: string;
  token: number;
  pesan: number;
};

async function authHeader() {
  const { data: { session } } = await supabase.auth.getSession();
  return { Authorization: `Bearer ${session?.access_token ?? ""}` };
}

export function useAdmin() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [dailyUsage, setDailyUsage] = useState<DailyUsage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", { headers: await authHeader() });
      if (!res.ok) throw new Error((await res.json()).error || "Gagal memuat users");
      const data = await res.json();
      setUsers(data.users);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/stats", { headers: await authHeader() });
      if (!res.ok) return;
      const data = await res.json();
      setStats(data);
    } catch { /**/ }
  }, []);

  const updateRole = useCallback(async (userId: string, role: "user" | "admin") => {
    const res = await fetch(`/api/admin/users/${userId}/role`, {
      method: "PATCH",
      headers: { ...(await authHeader()), "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Gagal mengubah role");
    }
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, role } : u))
    );
  }, []);

  const updatePremium = useCallback(async (
    userId: string,
    is_premium: boolean,
    opts?: { days?: number; tier?: "plus" | "pro" },
  ) => {
    const tier = opts?.tier ?? "plus";
    const days = opts?.days;
    const res = await fetch(`/api/admin/users/${userId}/premium`, {
      method: "PATCH",
      headers: { ...(await authHeader()), "Content-Type": "application/json" },
      body: JSON.stringify({ is_premium, tier, ...(days ? { days } : {}) }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Gagal mengubah status premium");
    }
    // Hitung tanggal expires-at lokal supaya UI langsung update tanpa nunggu refetch.
    let nextExpires: string | null = null;
    if (is_premium) {
      const d = new Date();
      if (typeof days === "number" && days > 0) d.setDate(d.getDate() + days);
      else d.setMonth(d.getMonth() + 1);
      nextExpires = d.toISOString();
    }
    setUsers((prev) =>
      prev.map((u) => (u.id === userId
        ? {
            ...u,
            is_premium,
            tier: is_premium ? tier : "free" as const,
            premium_expires_at: nextExpires,
          }
        : u))
    );
  }, []);

  const updateCredit = useCallback(async (
    userId: string,
    opts: { mode: "set" | "add"; amount_idr: number; note?: string },
  ) => {
    const res = await fetch(`/api/admin/users/${userId}/credit`, {
      method: "PATCH",
      headers: { ...(await authHeader()), "Content-Type": "application/json" },
      body: JSON.stringify(opts),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || "Gagal mengubah saldo");
    const balance = typeof data?.balance_idr === "number" ? data.balance_idr : null;
    if (balance !== null) {
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, credit_balance_idr: balance } : u))
      );
    }
    return data as { ok: boolean; balance_idr: number; delta: number };
  }, []);

  const deleteUser = useCallback(async (userId: string) => {
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "DELETE",
      headers: await authHeader(),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Gagal menghapus user");
    }
    setUsers((prev) => prev.filter((u) => u.id !== userId));
  }, []);

  const fetchDailyUsage = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/daily-usage", { headers: await authHeader() });
      if (!res.ok) return;
      const data = await res.json();
      setDailyUsage(data.daily || []);
    } catch { /**/ }
  }, []);

  return {
    users, stats, dailyUsage,
    isLoading, error,
    fetchUsers, fetchStats, fetchDailyUsage,
    updateRole, updatePremium, updateCredit, deleteUser,
  };
}
