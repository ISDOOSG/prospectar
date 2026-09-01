import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { getSession, onAuthChange, signOut as apiSignOut, type ApiSession } from "@/lib/api-client";

interface AuthContextType {
  session: ApiSession | null;
  user: ApiSession["user"] | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<ApiSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = () => {
      getSession().then((s) => {
        if (mounted) { setSession(s); setLoading(false); }
      });
    };
    load();
    const unsub = onAuthChange(load);
    return () => { mounted = false; unsub(); };
  }, []);

  const signOut = async () => {
    apiSignOut();
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
