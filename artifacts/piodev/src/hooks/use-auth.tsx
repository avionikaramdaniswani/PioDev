import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import type { User as SupabaseUser } from "@supabase/supabase-js";

type Role = "user" | "admin";

type User = {
  id: string;
  name: string;
  email: string;
  initials: string;
  role: Role;
};

type AuthContextType = {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<string | null>;
  register: (email: string, password: string, name: string) => Promise<string | null>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function toUser(sb: SupabaseUser, role: Role = "user"): User {
  const name = (sb.user_metadata?.full_name as string) || sb.email?.split("@")[0] || "User";
  const initials = name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
  return { id: sb.id, name, email: sb.email || "", initials, role };
}

// Return null kalau gagal — biar caller bisa preserve role lama (jangan downgrade ke "user").
async function fetchRole(token: string): Promise<Role | null> {
  try {
    const res = await fetch("/api/me/role", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.role === "admin" ? "admin" : "user";
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [, setLocation] = useLocation();
  // Cache role per user-id biar event auth berulang (TOKEN_REFRESHED, dll) gak refetch
  // dan gak nge-overwrite role admin kalau fetch transient gagal.
  const roleCacheRef = useRef<Map<string, Role>>(new Map());

  async function loadUser(sb: SupabaseUser, token: string) {
    const cached = roleCacheRef.current.get(sb.id);
    // Set user dulu pake role cache (atau "user" sebagai default sementara) supaya UI
    // langsung up-to-date tanpa nunggu network.
    setUser(toUser(sb, cached ?? "user"));

    const fetched = await fetchRole(token);
    if (fetched) {
      roleCacheRef.current.set(sb.id, fetched);
      setUser(toUser(sb, fetched));
    }
    // Kalau fetched === null (gagal) DAN cached tersedia, biarkan role cache yang dipake.
    // Kalau gagal & gak ada cache, role default "user" tetap dipertahankan (fail-safe).
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        loadUser(session.user, session.access_token).finally(() => setIsLoading(false));
      } else {
        setUser(null);
        setIsLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setLocation("/reset-password");
        return;
      }
      if (event === "SIGNED_OUT") {
        roleCacheRef.current.clear();
        setUser(null);
        return;
      }
      if (!session?.user) {
        setUser(null);
        return;
      }
      // Buat event yang cuma refresh token / metadata, jangan refetch role kalau
      // role udah di-cache untuk user yang sama. Cuma refetch waktu sign-in baru.
      const cached = roleCacheRef.current.get(session.user.id);
      if (event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        if (cached) {
          setUser(toUser(session.user, cached));
          return;
        }
      }
      loadUser(session.user, session.access_token);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string): Promise<string | null> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return error.message;
    setLocation("/");
    return null;
  };

  const register = async (email: string, password: string, name: string): Promise<string | null> => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    });
    if (error) return error.message;
    setLocation("/check-email");
    return null;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setLocation("/login");
  };

  if (isLoading) return null;

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      isLoading,
      isAdmin: user?.role === "admin",
      login,
      register,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
