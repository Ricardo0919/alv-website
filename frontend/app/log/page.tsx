"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import ErrorScreen from "../../components/ErrorScreen";
import { useConfirm, useToast } from "../../components/feedback/FeedbackProvider";
import { GiftIcon, MinusIcon, PencilIcon, PlusIcon, TrashIcon, TrophyIcon } from "../../components/icons";
import LoadingScreen from "../../components/LoadingScreen";
import CrumbAmountPicker from "../../components/logger/CrumbAmountPicker";
import { vibrate } from "../../components/logger/haptics";
import ReasonField from "../../components/logger/ReasonField";
import PageShell from "../../components/PageShell";
import { api, ApiError, type Stats } from "../../lib/api";
import { useRequireAuth } from "../../lib/auth";

const formatter = new Intl.NumberFormat("es-MX");

export default function LogPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <LogRouter />
    </Suspense>
  );
}

/**
 * /log            → sumar o quitar migajas de tu cuenta.
 * /log?para=ana   → regalarle migajas a ana (las acepta o rechaza).
 */
function LogRouter() {
  const { status, user } = useRequireAuth();
  const para = useSearchParams().get("para");
  const giftTo = user && para && para.toLowerCase() !== user.username.toLowerCase() ? para : null;

  // Progreso actual de quien recibe (tú o la persona a la que regalas)
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<"not-found" | "network" | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    let active = true;
    (giftTo ? api.publicProfile(giftTo) : api.stats())
      .then((s) => active && setStats(s))
      .catch((err) => active && setError(err instanceof ApiError && err.status === 404 ? "not-found" : "network"));
    return () => {
      active = false;
    };
  }, [status, giftTo]);

  if (status !== "authenticated" || !user) return <LoadingScreen />;
  if (error === "not-found") return <ErrorScreen title="Usuario no encontrado" message={`No existe nadie llamado "${giftTo}".`} />;
  if (error) return <ErrorScreen title="Error de conexión" message="No pudimos cargar tu progreso." retry />;
  if (!stats) return <LoadingScreen />;

  return giftTo ? <GiftForm to={stats.username} stats={stats} /> : <OwnLogger stats={stats} />;
}

const errorMessage = (err: unknown) =>
  err instanceof ApiError && err.status !== 0 ? err.message : "Error de conexión. Intenta de nuevo.";

// ---------------------------------------------------------------------------
// Estructura común
//   Celular: todo en una columna + barra de enviar fija abajo.
//   Tablet / computadora: número y teclado a la izquierda; razón y enviar a la derecha.
// ---------------------------------------------------------------------------

interface LayoutProps {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  picker: React.ReactNode;
  side: React.ReactNode;
  summary: string;
  submit: React.ReactNode;
  onClear: () => void;
  canClear: boolean;
}

function LoggerLayout({ title, subtitle, icon, picker, side, summary, submit, onClear, canClear }: LayoutProps) {
  return (
    <div className="select-none pb-40 md:pb-0">
      <PageShell title={title} subtitle={subtitle} icon={icon}>
        <div className="grid gap-3 md:grid-cols-2 md:items-start md:gap-6">
          <div>{picker}</div>
          <div className="flex flex-col gap-3 md:gap-4">
            {side}
            <div className="fixed bottom-0 left-0 right-0 z-[100] border-t border-white/40 bg-white/90 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-5px_15px_rgba(0,0,0,0.1)] md:static md:rounded-2xl md:border-2 md:bg-white/60 md:p-4 md:shadow-none">
              <div className="mx-auto flex max-w-md flex-col gap-2 px-4 md:max-w-none md:px-0">
                <p className="text-center text-xs text-gray-500">{summary}</p>
                <div className="flex h-14 items-stretch gap-3">
                  <button
                    onClick={() => {
                      vibrate("DOUBLE");
                      onClear();
                    }}
                    disabled={!canClear}
                    className={`flex items-center justify-center rounded-xl px-4 transition-all ${canClear ? "text-gray-500 hover:bg-gray-100/70 hover:text-red-500 active:scale-95" : "text-gray-300"}`}
                    aria-label="Limpiar"
                    title="Limpiar"
                  >
                    <TrashIcon />
                  </button>
                  {submit}
                </div>
              </div>
            </div>
          </div>
        </div>
      </PageShell>
    </div>
  );
}

function SubmitButton({
  label,
  amount,
  disabled,
  danger,
  onClick,
}: {
  label: string;
  amount: number;
  disabled: boolean;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-1 items-center justify-center gap-3 rounded-xl border border-white/20 font-bold shadow-lg transition-all active:scale-95 ${
        disabled
          ? "cursor-not-allowed bg-gray-200/60 text-gray-400 shadow-none"
          : danger
            ? "bg-red-600/90 text-white shadow-red-500/30"
            : "bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-orange-500/30"
      }`}
    >
      <span className="text-sm uppercase tracking-wider">{label}</span>
      {amount !== 0 && (
        <span className={`rounded-lg px-2 py-0.5 text-xl font-black tabular-nums ${danger ? "bg-black/20" : "bg-black/10"}`}>
          {amount > 0 ? "+" : ""}
          {formatter.format(amount)}
        </span>
      )}
    </button>
  );
}

/** Tarjeta que reemplaza al teclado cuando ya no caben más migajas. */
function GoalReachedCard({ title, message, children }: { title: string; message: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border-2 border-amber-200 bg-amber-50/80 p-6 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-400 text-amber-950 shadow-lg">
        <TrophyIcon className="h-8 w-8" />
      </span>
      <h2 className="mt-4 text-xl font-black text-[#8B4513]">{title}</h2>
      <p className="mt-2 text-sm text-[#3E2723]/80">{message}</p>
      {children && <div className="mt-5 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  );
}

const secondaryButton =
  "rounded-xl border border-[#8B4513]/20 bg-white px-4 py-2 text-sm font-bold text-[#8B4513] transition hover:bg-[#FFF8DC] active:scale-95";

// ---------------------------------------------------------------------------
// Registrar en tu propia cuenta: sumar o quitar
// ---------------------------------------------------------------------------

type Mode = "ADD" | "REMOVAL";

const MODES: { value: Mode; label: string; icon: React.ReactNode }[] = [
  { value: "ADD", label: "Sumar", icon: <PlusIcon className="h-4 w-4" /> },
  { value: "REMOVAL", label: "Quitar", icon: <MinusIcon className="h-4 w-4" /> },
];

function OwnLogger({ stats }: { stats: Stats }) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [mode, setMode] = useState<Mode>("ADD");
  const [amount, setAmount] = useState(0);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const removing = mode === "REMOVAL";
  const remaining = Math.max(0, stats.goal - stats.total_crumbs);
  const goalReached = !removing && remaining === 0;
  // Sumar: solo lo que falta para la meta. Quitar: solo lo que llevas.
  const max = removing ? stats.total_crumbs : remaining;

  const changeMode = (value: Mode) => {
    vibrate("MICRO");
    setMode(value);
    setAmount(0);
  };

  const handleSubmit = async () => {
    vibrate("HEAVY");
    const ok = await confirm(
      removing
        ? {
            title: `¿Quitar ${formatter.format(amount)} migajas?`,
            message: "Se restarán de tu progreso.",
            confirmText: "Quitar",
            tone: "danger",
          }
        : {
            title: `¿Registrar +${formatter.format(amount)} migajas?`,
            message: amount === remaining ? "Con esto llegas a tu meta." : undefined,
            confirmText: "Registrar",
          },
    );
    if (!ok) return;

    setSaving(true);
    try {
      const { total_crumbs } = await api.logInteractions([{ type: mode, count_or_duration: amount, reason: reason.trim() }]);
      if (!removing && total_crumbs >= stats.goal) {
        toast.goal("Completaste tu bolillo. ¡Felicidades, migajero!", { title: "¡Llegaste a tu meta!", duration: 7000 });
      } else {
        toast.success(`${removing ? "Quitaste" : "Sumaste"} ${formatter.format(amount)} migajas.`, { title: "Listo" });
      }
      router.push("/");
    } catch (err) {
      if (err instanceof ApiError && err.code === "goal_reached") toast.goal(err.message, { title: "Meta alcanzada" });
      else toast.error(errorMessage(err), { title: "No se pudo registrar" });
      setSaving(false);
    }
  };

  return (
    <LoggerLayout
      title="Registrar migajas"
      subtitle={goalReached ? "Tu bolillo ya está completo" : "Escribe la cantidad o usa + / −"}
      icon={<PencilIcon className="h-6 w-6" />}
      summary={
        goalReached
          ? "Ya llegaste a tu meta"
          : amount === 0
            ? removing
              ? `Llevas ${formatter.format(stats.total_crumbs)} migajas`
              : `Te faltan ${formatter.format(remaining)} para tu meta`
            : `${removing ? "Quitarás" : "Sumarás"} ${formatter.format(amount)} migajas`
      }
      canClear={amount > 0 || reason.length > 0}
      onClear={() => {
        setAmount(0);
        setReason("");
      }}
      submit={
        <SubmitButton
          label={saving ? "..." : removing ? "Quitar" : "Registrar"}
          amount={removing ? -amount : amount}
          danger={removing}
          disabled={saving || amount === 0 || goalReached}
          onClick={handleSubmit}
        />
      }
      picker={
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-1 rounded-2xl bg-[#8B4513]/10 p-1" role="radiogroup" aria-label="Sumar o quitar">
            {MODES.map(({ value, label, icon }) => {
              const active = mode === value;
              return (
                <button
                  key={value}
                  role="radio"
                  aria-checked={active}
                  onClick={() => changeMode(value)}
                  className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-bold transition ${
                    active
                      ? `bg-white shadow ${value === "REMOVAL" ? "text-red-600" : "text-orange-600"}`
                      : "text-[#8B4513]/60 hover:text-[#8B4513]"
                  }`}
                >
                  {icon}
                  {label}
                </button>
              );
            })}
          </div>
          {goalReached ? (
            <GoalReachedCard
              title="¡Ya llegaste a tu meta!"
              message="Ya no puedes sumar más migajas… ya no seas tan migajero. Si quieres seguir, sube tu meta en Ajustes."
            >
              <Link href="/ajustes" className={secondaryButton}>
                Subir mi meta
              </Link>
              <button onClick={() => changeMode("REMOVAL")} className={secondaryButton}>
                Quitar migajas
              </button>
            </GoalReachedCard>
          ) : (
            <CrumbAmountPicker
              label={removing ? "Migajas a quitar" : "Migajas a sumar"}
              value={amount}
              onChange={setAmount}
              max={max}
              tone={removing ? "remove" : "add"}
              hint={removing ? `Máximo ${formatter.format(max)} (lo que llevas)` : `Te faltan ${formatter.format(max)} para tu meta`}
            />
          )}
        </div>
      }
      side={
        goalReached ? null : (
          <ReasonField
            value={reason}
            onChange={setReason}
            placeholder={removing ? "Ej. No me contestó" : "Ej. Platicamos dos horas"}
          />
        )
      }
    />
  );
}

// ---------------------------------------------------------------------------
// Regalar migajas a otro usuario
// ---------------------------------------------------------------------------

function GiftForm({ to, stats }: { to: string; stats: Stats }) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [amount, setAmount] = useState(0);
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);

  // Solo se puede regalar lo que le falta para su meta
  const remaining = Math.max(0, stats.goal - stats.total_crumbs);
  const full = remaining === 0;
  const reasonOk = reason.trim().length >= 3;

  const handleSubmit = async () => {
    vibrate("HEAVY");
    const ok = await confirm({
      title: `¿Enviar +${formatter.format(amount)} migajas a ${to}?`,
      message: "Las recibirá cuando acepte tu solicitud.",
      confirmText: "Enviar",
    });
    if (!ok) return;

    setSending(true);
    try {
      await api.sendCrumbRequest(to, amount, reason.trim());
      toast.success(`${to} verá tu regalo en sus notificaciones.`, { title: "Solicitud enviada" });
      router.push(`/u/${encodeURIComponent(to)}`);
    } catch (err) {
      toast.error(errorMessage(err), { title: "No se pudo enviar" });
      setSending(false);
    }
  };

  let summary = `${formatter.format(amount)} migajas para ${to}`;
  if (full) summary = `${to} ya llegó a su meta`;
  else if (amount === 0) summary = `A ${to} le faltan ${formatter.format(remaining)} migajas`;
  else if (!reasonOk) summary = "Escribe por qué se las regalas";

  return (
    <LoggerLayout
      title={`Regalar a ${to}`}
      subtitle="Solo se suman si las acepta"
      icon={<GiftIcon className="h-6 w-6" />}
      summary={summary}
      canClear={amount > 0 || reason.length > 0}
      onClear={() => {
        setAmount(0);
        setReason("");
      }}
      submit={
        <SubmitButton
          label={sending ? "..." : "Enviar"}
          amount={amount}
          disabled={sending || amount === 0 || !reasonOk || full}
          onClick={handleSubmit}
        />
      }
      picker={
        full ? (
          <GoalReachedCard
            title={`${to} ya llenó su bolillo`}
            message={`Llegó a su meta y ya no le caben más migajas. Guárdalas para alguien que sí las necesite… no seas tan migajero.`}
          >
            <Link href={`/u/${encodeURIComponent(to)}`} className={secondaryButton}>
              Ver su progreso
            </Link>
            <Link href="/amigos" className={secondaryButton}>
              Ver tablero
            </Link>
          </GoalReachedCard>
        ) : (
          <CrumbAmountPicker
            label="Migajas a regalar"
            value={amount}
            onChange={setAmount}
            max={remaining}
            hint={`A ${to} le faltan ${formatter.format(remaining)} para su meta`}
          />
        )
      }
      side={full ? null : <ReasonField value={reason} onChange={setReason} required placeholder="Ej. Por la llamada de anoche" />}
    />
  );
}
