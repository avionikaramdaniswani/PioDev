import { createContext, useContext, useState, useEffect, ReactNode } from "react";
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

async function fetchRole(token: string): Promise<Role> {
  try {
    const res = await fetch("/api/me/role", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return "user";
    const data = await res.json();
    return data.role === "admin" ? "admin" : "user";
  } catch {
    return "user";
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [, setLocation] = useLocation();

  async function loadUser(sb: SupabaseUser, token: string) {
    const role = await fetchRole(token);
    setUser(toUser(sb, role));
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
      if (session?.user) {
        loadUser(session.user, session.access_token);
      } else {
        setUser(null);
      }
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
