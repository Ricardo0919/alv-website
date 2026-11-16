"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api, setUnauthorizedHandler, tokenStore, type AuthResponse, type User } from "./api";

type Status = "loading" | "authenticated" | "anonymous";

interface AuthContextValue {
  user: User | null;
  status: Status;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, email?: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Reemplaza los datos del usuario (p. ej. tras cambiar la meta). */
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<Status>("loading");

  const reset = useCallback(() => {
    setUser(null);
    setStatus("anonymous");
  }, []);

  // Al cargar la app: si hay token guardado, valida contra el backend
  useEffect(() => {
    setUnauthorizedHandler(reset);
    let active = true;
    const check = tokenStore.get() ? api.me() : Promise.reject(new Error("sin token"));
    check
      .then((me) => {
        if (!active) return;
        setUser(me);
        setStatus("authenticated");
      })
      .catch(() => {
        // Sin token, token inválido (ya se borró en api.ts) o servidor caído: pedir login
        if (active) reset();
      });
    return () => {
      active = false;
      setUnauthorizedHandler(null);
    };
  }, [reset]);

  const start = useCallback(({ token, user }: AuthResponse) => {
    tokenStore.set(token);
    setUser(user);
    setStatus("authenticated");
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      login: async (username, password) => start(await api.login({ username, password })),
      register: async (username, password, email) => start(await api.register({ username, password, email })),
      updateUser: setUser,
      logout: async () => {
        try {
          await api.logout();
        } catch {
          // Aunque falle la red, cerramos la sesión localmente
        }
        tokenStore.clear();
        reset();
      },
    }),
    [user, status, start, reset],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}

/** Redirige a /login si no hay sesión. Devuelve el estado de auth. */
export function useRequireAuth() {
  const auth = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (auth.status === "anonymous") router.replace("/login");
  }, [auth.status, router]);
  return auth;
}

/** Solo acepta rutas internas ("/algo") para evitar redirecciones a otros sitios. */
export function safeNext(next: string | null | undefined): string {
  // Rechaza "//sitio.com" y "/\sitio.com" (el navegador trata "\" como "/"),
  // además de caracteres de control: evita redirecciones a otros sitios.
  if (!next || !next.startsWith("/") || next[1] === "/" || next[1] === "\\" || /[\u0000-\u001f]/.test(next)) {
    return "/";
  }
  return next;
}

/** Redirige a `next` (o /) si ya hay sesión (para /login y /register). */
export function useRedirectIfAuthenticated(next?: string | null) {
  const auth = useAuth();
  const router = useRouter();
  const target = safeNext(next);
  useEffect(() => {
    if (auth.status === "authenticated") router.replace(target);
  }, [auth.status, router, target]);
  return auth;
}
