"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRightIcon, ClockIcon, SpinnerIcon, TrophyIcon } from "../../components/icons";
import { useToast } from "../../components/feedback/FeedbackProvider";
import LoadingScreen from "../../components/LoadingScreen";
import PageShell, { SectionTitle } from "../../components/PageShell";
import { api, ApiError, type FriendRequest, type LeaderboardEntry } from "../../lib/api";
import { useRequireAuth } from "../../lib/auth";

const formatter = new Intl.NumberFormat("es-MX");
const dateFormat = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" });
// Oro, plata y bronce para los primeros tres lugares
const MEDAL_STYLES = ["bg-amber-400 text-amber-950", "bg-slate-300 text-slate-800", "bg-orange-300 text-orange-950"];

interface FriendsData {
  board: LeaderboardEntry[];
  received: FriendRequest[];
  sent: FriendRequest[];
}

async function fetchFriends(): Promise<FriendsData> {
  const [board, requests] = await Promise.all([api.leaderboard(), api.friendRequests()]);
  return { board, ...requests };
}

/** Tablero de amigos: quién va ganando y quién llegó primero a su meta. */
export default function FriendsPage() {
  const { status } = useRequireAuth();
  const [data, setData] = useState<FriendsData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") return;
    let active = true;
    fetchFriends()
      .then((d) => active && setData(d))
      .catch(() => active && setError(true));
    return () => {
      active = false;
    };
  }, [status]);

  if (status !== "authenticated") return <LoadingScreen />;

  const reload = () =>
    fetchFriends()
      .then(setData)
      .catch(() => setError(true));

  return (
    <PageShell title="Amigos" subtitle="¿Quién llega primero a su meta?" icon={<TrophyIcon className="h-6 w-6" />} backHref="/">
      <div className="grid gap-6 lg:grid-cols-[2fr_3fr] lg:items-start lg:gap-8">
        {/* Columna izquierda: agregar y solicitudes */}
        <div className="flex flex-col gap-4">
          <AddFriendForm onSent={reload} />

          {data && data.received.length > 0 && (
            <Link
              href="/notificaciones"
              className="flex items-center justify-between gap-2 rounded-xl border border-orange-200 bg-orange-50 p-3 text-sm font-bold text-orange-700 transition hover:bg-orange-100"
            >
              <span>
                Tienes {data.received.length} solicitud{data.received.length > 1 ? "es" : ""} de amistad
              </span>
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
          )}

          {data && data.sent.length > 0 && (
            <section>
              <SectionTitle>Solicitudes enviadas</SectionTitle>
              <div className="space-y-2">
                {data.sent.map((req) => (
                  <div
                    key={req.id}
                    className="flex items-center justify-between rounded-xl border border-white/40 bg-white/50 px-4 py-3 text-sm"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <ClockIcon className="h-4 w-4 shrink-0 text-[#8B4513]/60" />
                      <span className="truncate">
                        Esperando a <span className="font-bold">{req.to_user}</span>
                      </span>
                    </span>
                    <button
                      onClick={async () => {
                        await api.cancelFriendRequest(req.id).catch(() => {});
                        reload();
                      }}
                      className="shrink-0 text-xs font-bold text-gray-500 hover:text-red-600"
                    >
                      Cancelar
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Columna derecha: tablero */}
        <section>
          <SectionTitle>Tablero</SectionTitle>
          {error && <p className="rounded-lg bg-red-100 p-3 text-center text-sm text-red-700">No pudimos cargar a tus amigos.</p>}
          {!data && !error && (
            <div className="flex justify-center py-10 text-[#8B4513]">
              <SpinnerIcon />
            </div>
          )}
          {data && (
            <div className="space-y-2">
              {data.board.map((entry) => (
                <LeaderboardRow key={entry.username} entry={entry} />
              ))}
              {data.board.length === 1 && (
                <p className="rounded-2xl border border-white/40 bg-white/50 p-5 text-center text-sm text-gray-500">
                  Aún no tienes amigos. Agrega a alguien por su nombre de usuario para competir.
                </p>
              )}
            </div>
          )}
        </section>
      </div>
    </PageShell>
  );
}

function LeaderboardRow({ entry }: { entry: LeaderboardEntry }) {
  const reached = entry.goal_reached_at !== null;
  const content = (
    <div
      className={`flex items-center gap-3 rounded-2xl border p-3 shadow-sm transition ${
        entry.is_me ? "border-orange-300 bg-orange-50/80" : "border-white/40 bg-white/60 hover:bg-white/80"
      }`}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black ${MEDAL_STYLES[entry.rank - 1] ?? "bg-[#8B4513]/10 text-[#8B4513]"}`}
      >
        {entry.rank}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate font-bold">
            {entry.username}
            {entry.is_me && <span className="ml-1 text-xs font-medium text-orange-600">(tú)</span>}
          </p>
          <span className="shrink-0 text-sm font-black tabular-nums text-[#8B4513]">{entry.percent.toFixed(1)}%</span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#8B4513]/10">
          <div
            className={`h-full rounded-full ${reached ? "bg-gradient-to-r from-amber-400 to-yellow-500" : "bg-gradient-to-r from-orange-400 to-amber-600"}`}
            style={{ width: `${Math.min(100, entry.percent)}%` }}
          />
        </div>
        <p className="mt-1 flex items-center gap-1 truncate text-[11px] text-gray-500">
          {reached ? (
            <>
              <TrophyIcon className="h-3.5 w-3.5 shrink-0 text-amber-500" />
              Meta cumplida el {dateFormat.format(new Date(entry.goal_reached_at!))}
            </>
          ) : (
            `${formatter.format(entry.total_crumbs)} / ${formatter.format(entry.goal)} migajas`
          )}
        </p>
      </div>
    </div>
  );

  return entry.is_me ? content : <Link href={`/u/${encodeURIComponent(entry.username)}`}>{content}</Link>;
}

function AddFriendForm({ onSent }: { onSent: () => void }) {
  const [username, setUsername] = useState("");
  const [sending, setSending] = useState(false);
  const toast = useToast();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = username.trim();
    if (!name) return;
    setSending(true);
    try {
      const req = await api.sendFriendRequest(name);
      if (req.status === "ACCEPTED") toast.success(`Ahora ${req.to_user} y tú son amigos.`, { title: "Nuevo amigo" });
      else toast.success(`${req.to_user} la verá en sus notificaciones.`, { title: "Solicitud enviada" });
      setUsername("");
      onSent();
    } catch (err) {
      const text =
        err instanceof ApiError
          ? err.status === 404
            ? `No existe nadie llamado "${name}".`
            : err.status === 0
              ? "Error de conexión."
              : err.message
          : "Ocurrió un error.";
      toast.error(text, { title: "No se pudo enviar" });
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-2xl border-2 border-white/40 bg-white/60 p-4">
      <label htmlFor="friend" className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-600">
        Agregar amigo
      </label>
      <div className="flex gap-2">
        <input
          id="friend"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Nombre de usuario"
          autoCapitalize="none"
          autoComplete="off"
          className="min-w-0 flex-1 rounded-xl border border-[#8B4513]/20 bg-white/80 px-3 py-2 outline-none focus:border-[#8B4513] focus:ring-2 focus:ring-[#DEB887]"
        />
        <button
          type="submit"
          disabled={sending || !username.trim()}
          className="rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 px-4 font-bold text-white shadow transition active:scale-95 disabled:opacity-50"
        >
          {sending ? "..." : "Enviar"}
        </button>
      </div>
    </form>
  );
}
