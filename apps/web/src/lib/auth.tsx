import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { api } from "./api";
export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "OPERATOR" | "SELLER";
};
type AuthValue = {
  user: SessionUser | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};
const AuthContext = createContext<AuthValue | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  });
  const value = useMemo<AuthValue>(
    () => ({
      user,
      async login(email, password) {
        const session = await api<{
          accessToken: string;
          refreshToken: string;
          user: SessionUser;
        }>("/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
        localStorage.setItem("token", session.accessToken);
        localStorage.setItem("refreshToken", session.refreshToken);
        localStorage.setItem("user", JSON.stringify(session.user));
        setUser(session.user);
      },
      async logout() {
        const refreshToken = localStorage.getItem("refreshToken");
        if (refreshToken)
          await api("/auth/logout", {
            method: "POST",
            body: JSON.stringify({ refreshToken }),
          }).catch(() => undefined);
        localStorage.clear();
        setUser(null);
      },
    }),
    [user],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const x = useContext(AuthContext);
  if (!x) throw new Error("AuthProvider ausente");
  return x;
}
