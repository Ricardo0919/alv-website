"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AlertIcon, BellIcon, CheckIcon, TrophyIcon, XIcon } from "../icons";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

type ToastKind = "success" | "error" | "info" | "goal";

interface ToastOptions {
  title?: string;
  /** Milisegundos antes de cerrarse sola (0 = no se cierra sola). */
  duration?: number;
}

interface Toast extends Required<ToastOptions> {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ConfirmOptions {
  title: string;
  message?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  tone?: "default" | "danger";
}

type ToastApi = Record<ToastKind, (message: string, options?: ToastOptions) => void>;

interface FeedbackContextValue {
  toast: ToastApi;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

// Ids únicos para las notificaciones
let toastCounter = 0;

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

/**
 * Notificaciones (toasts) y confirmaciones propias de la app, en lugar de
 * alert()/confirm() del navegador ("localhost:3000 dice…").
 */
export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dialog, setDialog] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null);

  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const value = useMemo<FeedbackContextValue>(() => {
    const push =
      (kind: ToastKind) =>
      (message: string, options: ToastOptions = {}) => {
        const toast: Toast = {
          id: ++toastCounter,
          kind,
          message,
          title: options.title ?? "",
          duration: options.duration ?? (kind === "error" ? 6000 : 4500),
        };
        // Máximo 4 visibles: se descartan las más viejas
        setToasts((list) => [...list.slice(-3), toast]);
      };
    return {
      toast: { success: push("success"), error: push("error"), info: push("info"), goal: push("goal") },
      confirm: (options) => new Promise<boolean>((resolve) => setDialog({ ...options, resolve })),
    };
  }, []);

  const closeDialog = (ok: boolean) => {
    dialog?.resolve(ok);
    setDialog(null);
  };

  return (
    <FeedbackContext.Provider value={value}>
      {children}

      {/* Toasts: arriba a la derecha (computadora) / arriba (celular) */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[200] flex flex-col items-stretch gap-2 sm:inset-x-auto sm:right-4 sm:w-96"
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
        ))}
      </div>

      {dialog && <ConfirmDialog options={dialog} onClose={closeDialog} />}
    </FeedbackContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error("useToast debe usarse dentro de <FeedbackProvider>");
  return ctx.toast;
}

export function useConfirm() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error("useConfirm debe usarse dentro de <FeedbackProvider>");
  return ctx.confirm;
}

// ---------------------------------------------------------------------------
// Toast individual (deslizar para quitar)
// ---------------------------------------------------------------------------

const KIND_STYLES: Record<ToastKind, { icon: React.ReactNode; accent: string }> = {
  success: { icon: <CheckIcon className="h-5 w-5" />, accent: "bg-green-100 text-green-700" },
  error: { icon: <AlertIcon className="h-5 w-5" />, accent: "bg-red-100 text-red-600" },
  info: { icon: <BellIcon className="h-5 w-5" />, accent: "bg-orange-100 text-orange-700" },
  goal: { icon: <TrophyIcon className="h-5 w-5" />, accent: "bg-amber-100 text-amber-700" },
};

const SWIPE_DISMISS_PX = 80;

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const [offset, setOffset] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [paused, setPaused] = useState(false);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ startX: number; pointerId: number } | null>(null);

  const leave = useCallback(
    (direction: 1 | -1) => {
      setLeaving(true);
      setOffset(direction * 420);
      setTimeout(onDismiss, 180);
    },
    [onDismiss],
  );

  // Se cierra sola (pausado mientras el usuario la toca o pasa el mouse)
  useEffect(() => {
    if (!toast.duration || paused) return;
    const timer = setTimeout(() => leave(1), toast.duration);
    return () => clearTimeout(timer);
  }, [toast.duration, paused, leave]);

  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { startX: e.clientX, pointerId: e.pointerId };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(true);
    setPaused(true);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (drag.current) setOffset(e.clientX - drag.current.startX);
  };
  const onPointerUp = () => {
    if (!drag.current) return;
    drag.current = null;
    setDragging(false);
    setPaused(false);
    if (Math.abs(offset) > SWIPE_DISMISS_PX) leave(offset > 0 ? 1 : -1);
    else setOffset(0);
  };

  const { icon, accent } = KIND_STYLES[toast.kind];

  return (
    <div
      role={toast.kind === "error" ? "alert" : "status"}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => !drag.current && setPaused(false)}
      style={{
        transform: `translateX(${offset}px)`,
        opacity: leaving ? 0 : 1 - Math.min(Math.abs(offset) / 300, 0.6),
        transition: dragging ? "none" : "transform 180ms ease-out, opacity 180ms ease-out",
      }}
      className="animate-toast-in pointer-events-auto flex touch-pan-y select-none items-start gap-3 rounded-2xl border border-[#8B4513]/10 bg-white/95 p-3 pr-2 text-[#3E2723] shadow-xl backdrop-blur-sm"
    >
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${accent}`}>{icon}</span>
      <div className="min-w-0 flex-1 py-0.5">
        {toast.title && <p className="text-sm font-bold">{toast.title}</p>}
        <p className={`break-words text-sm ${toast.title ? "text-gray-600" : "font-medium"}`}>{toast.message}</p>
      </div>
      <button
        onClick={() => leave(1)}
        onPointerDown={(e) => e.stopPropagation()}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
        aria-label="Cerrar notificación"
      >
        <XIcon className="h-4 w-4" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Confirmación (ventana modal)
// ---------------------------------------------------------------------------

function ConfirmDialog({ options, onClose }: { options: ConfirmOptions; onClose: (ok: boolean) => void }) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const danger = options.tone === "danger";

  useEffect(() => {
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="animate-fade-in fixed inset-0 z-[150] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onClick={() => onClose(false)}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onClick={(e) => e.stopPropagation()}
        className="animate-slide-up w-full max-w-sm rounded-t-3xl bg-white p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl sm:pb-6"
      >
        <h2 id="confirm-title" className="text-lg font-bold text-[#3E2723]">
          {options.title}
        </h2>
        {options.message && <div className="mt-2 text-sm text-gray-600">{options.message}</div>}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            onClick={() => onClose(false)}
            className="rounded-xl border border-gray-200 bg-white py-3 font-bold text-gray-600 transition hover:bg-gray-50 active:scale-95"
          >
            {options.cancelText ?? "Cancelar"}
          </button>
          <button
            ref={confirmRef}
            onClick={() => onClose(true)}
            className={`rounded-xl py-3 font-bold text-white shadow-lg transition active:scale-95 ${
              danger ? "bg-red-600 shadow-red-500/30" : "bg-gradient-to-r from-orange-500 to-amber-600 shadow-orange-500/30"
            }`}
          >
            {options.confirmText ?? "Aceptar"}
          </button>
        </div>
      </div>
    </div>
  );
}
