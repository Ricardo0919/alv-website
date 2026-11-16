"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ApiError } from "../lib/api";
import { safeNext, useAuth, useRedirectIfAuthenticated } from "../lib/auth";
import { WheatIcon } from "./icons";
import LoadingScreen from "./LoadingScreen";
import PasswordInput from "./PasswordInput";

type Mode = "login" | "register";

const COPY: Record<Mode, { title: string; button: string; alt: string; altLink: string; altHref: string }> = {
  login: {
    title: "Inicia sesión",
    button: "Entrar",
    alt: "¿No tienes cuenta?",
    altLink: "Crear cuenta",
    altHref: "/register",
  },
  register: {
    title: "Crea tu cuenta",
    button: "Crear cuenta",
    alt: "¿Ya tienes cuenta?",
    altLink: "Iniciar sesión",
    altHref: "/login",
  },
};

const inputClass =
  "w-full rounded-xl border border-[#8B4513]/20 bg-white/80 px-4 py-3 text-[#3E2723] outline-none transition focus:border-[#8B4513] focus:ring-2 focus:ring-[#DEB887]";

export default function AuthForm({ mode }: { mode: Mode }) {
  // ?next=/ruta → a dónde volver después de entrar
  const next = useSearchParams().get("next");
  const { status } = useRedirectIfAuthenticated(next);
  const { login, register } = useAuth();
  const copy = COPY[mode];
  const altHref = next ? `${copy.altHref}?next=${encodeURIComponent(safeNext(next))}` : copy.altHref;

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [submitting, setSubmitting] = useState(false);

  if (status !== "anonymous") return <LoadingScreen />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    if (mode === "register" && password !== confirm) {
      setFieldErrors({ confirm: ["Las contraseñas no coinciden."] });
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "login") await login(username.trim(), password);
      else await register(username.trim(), password, email.trim() || undefined);
      // La redirección la hace useRedirectIfAuthenticated
    } catch (err) {
      if (err instanceof ApiError) {
        setFieldErrors(err.fields);
        if (err.status === 429) setError("Demasiados intentos. Espera un minuto.");
        else if (!Object.keys(err.fields).some((k) => k !== "non_field_errors")) setError(err.message);
      } else {
        setError("Ocurrió un error inesperado.");
      }
      setSubmitting(false);
    }
  };

  const fieldError = (name: string) =>
    fieldErrors[name]?.map((msg) => (
      <p key={msg} className="mt-1 text-xs text-red-600">
        {msg}
      </p>
    ));

  return (
    <main className="flex min-h-screen items-center justify-center p-4 text-[#3E2723]">
      <div className="w-full max-w-sm rounded-3xl border border-white/40 bg-white/60 p-8 shadow-xl">
        <div className="mb-6 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#8B4513] to-[#6d360f] text-[#FFF8DC] shadow-lg">
            <WheatIcon className="h-8 w-8" />
          </span>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-[#8B4513]">MIGAJERO</h1>
          <p className="mt-1 text-sm text-[#A0522D]">{copy.title}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="username" className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-600">
              Usuario
            </label>
            <input
              id="username"
              className={inputClass}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              required
            />
            {fieldError("username")}
          </div>

          {mode === "register" && (
            <div>
              <label htmlFor="email" className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-600">
                Correo <span className="font-normal normal-case text-gray-400">(opcional)</span>
              </label>
              <input
                id="email"
                type="email"
                className={inputClass}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
              {fieldError("email")}
            </div>
          )}

          <div>
            <label htmlFor="password" className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-600">
              Contraseña
            </label>
            <PasswordInput
              id="password"
              className={inputClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
            />
            {fieldError("password")}
            {mode === "register" && !fieldErrors.password && (
              <p className="mt-1 text-xs text-gray-500">Mínimo 8 caracteres, no solo números.</p>
            )}
          </div>

          {mode === "register" && (
            <div>
              <label htmlFor="confirm" className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-600">
                Confirmar contraseña
              </label>
              <PasswordInput
                id="confirm"
                  className={inputClass}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                required
              />
              {fieldError("confirm")}
            </div>
          )}

          {error && <p className="rounded-lg bg-red-100 p-3 text-center text-sm text-red-700">{error}</p>}

          <button
            type="submit"
            disabled={submitting || !username || !password}
            className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 py-3 font-bold uppercase tracking-wider text-white shadow-lg transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "..." : copy.button}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600">
          {copy.alt}{" "}
          <Link href={altHref} className="font-bold text-[#8B4513] underline-offset-2 hover:underline">
            {copy.altLink}
          </Link>
        </p>
      </div>
    </main>
  );
}
