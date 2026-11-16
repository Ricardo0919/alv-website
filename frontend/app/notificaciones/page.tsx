"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useConfirm, useToast } from "../../components/feedback/FeedbackProvider";
import { BellIcon, XIcon } from "../../components/icons";
import LoadingScreen from "../../components/LoadingScreen";
import PageShell from "../../components/PageShell";
import { api, ApiError, type CrumbRequest, type FriendRequest } from "../../lib/api";
import { useRequireAuth } from "../../lib/auth";

const dateFormat = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" });

async function fetchInbox() {
  const [pending, all, friends] = await Promise.all([
    api.crumbRequests("PENDING"),
    api.crumbRequests(),
    api.friendRequests(),
  ]);
  return {
    pending: pending.results,
    history: all.results.filter((r) => r.status !== "PENDING").slice(0, 20),
    friendRequests: friends.received,
  };
}

/** Solicitudes de amistad y de migajas que otros te enviaron: aceptar o rechazar. */
export default function NotificationsPage() {
  const { status } = useRequireAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [pending, setPending] = useState<CrumbRequest[] | null>(null);
  const [history, setHistory] = useState<CrumbRequest[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = (isActive: () => boolean = () => true) =>
    fetchInbox()
      .then((inbox) => {
        if (!isActive()) return;
        setPending(inbox.pending);
        setHistory(inbox.history);
        setFriendRequests(inbox.friendRequests);
        setError(null);
      })
      .catch(() => isActive() && setError("No pudimos cargar tus notificaciones."));

  useEffect(() => {
    if (status !== "authenticated") return;
    let active = true;
    fetchInbox()
      .then((inbox) => {
        if (!active) return;
        setPending(inbox.pending);
        setHistory(inbox.history);
        setFriendRequests(inbox.friendRequests);
      })
      .catch(() => active && setError("No pudimos cargar tus notificaciones."));
    return () => {
      active = false;
    };
  }, [status]);

  if (status !== "authenticated") return <LoadingScreen />;

  const resolve = async (req: CrumbRequest, action: "accept" | "reject") => {
    if (action === "reject") {
      const ok = await confirm({
        title: `¿Rechazar las migajas de ${req.sender}?`,
        message: `No se sumarán las ${req.crumbs.toLocaleString("es-MX")} migajas a tu progreso.`,
        confirmText: "Rechazar",
        tone: "danger",
      });
      if (!ok) return;
    }
    setBusyId(req.id);
    try {
      const res = await api.resolveCrumbRequest(req.id, action);
      if (action === "reject") toast.info(`Rechazaste las migajas de ${req.sender}.`);
      else toast.success(`Ahora llevas ${res.total_crumbs.toLocaleString("es-MX")} migajas.`, { title: `Aceptaste +${req.crumbs.toLocaleString("es-MX")}` });
    } catch (err) {
      if (err instanceof ApiError && err.code === "goal_reached") toast.goal(err.message, { title: "Meta alcanzada" });
      // 404 = ya se había respondido (otra pestaña): solo recargamos la lista
      else if (!(err instanceof ApiError && err.status === 404)) toast.error("Error de conexión. Intenta de nuevo.");
    }
    await load();
    setBusyId(null);
  };

  const respondFriend = async (req: FriendRequest, action: "accept" | "reject") => {
    setBusyId(-req.id); // ids negativos = solicitudes de amistad (no chocan con las de migajas)
    try {
      await api.respondFriendRequest(req.id, action);
      if (action === "accept") toast.success(`Ahora ${req.from_user} y tú son amigos.`, { title: "Nuevo amigo" });
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 404)) toast.error("Error de conexión. Intenta de nuevo.");
    }
    await load();
    setBusyId(null);
  };

  return (
    <PageShell title="Notificaciones" icon={<BellIcon className="h-6 w-6" />} backHref="/" narrow>

      {error && <p className="mb-4 rounded-lg bg-red-100 p-3 text-center text-sm text-red-700">{error}</p>}

      {friendRequests.length > 0 && (
        <section className="mb-8 space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-[#8B4513]/70">Solicitudes de amistad</h2>
          {friendRequests.map((req) => (
            <article key={req.id} className="flex items-center gap-3 rounded-2xl border border-white/40 bg-white/60 p-4 shadow-sm">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#DEB887] font-black uppercase text-[#6d360f]">
                {req.from_user.charAt(0)}
              </span>
              <p className="min-w-0 flex-1 text-sm">
                <Link href={`/u/${encodeURIComponent(req.from_user)}`} className="font-bold text-[#8B4513] hover:underline">
                  {req.from_user}
                </Link>{" "}
                quiere ser tu amigo
              </p>
              <div className="flex shrink-0 gap-2">
                <button
                  onClick={() => respondFriend(req, "reject")}
                  disabled={busyId === -req.id}
                  className="rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-bold text-red-600 transition active:scale-95 disabled:opacity-50"
                  aria-label={`Rechazar a ${req.from_user}`}
                >
                  <XIcon className="h-4 w-4" />
                </button>
                <button
                  onClick={() => respondFriend(req, "accept")}
                  disabled={busyId === -req.id}
                  className="rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 px-3 py-2 text-sm font-bold text-white shadow transition active:scale-95 disabled:opacity-50"
                >
                  Aceptar
                </button>
              </div>
            </article>
          ))}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-widest text-[#8B4513]/70">Migajas por aceptar</h2>
        {pending === null && !error && <p className="text-sm text-gray-500">Cargando...</p>}
        {pending?.length === 0 && (
          <p className="rounded-2xl border border-white/40 bg-white/50 p-6 text-center text-sm text-gray-500">
            Nadie te ha regalado migajas por ahora.
          </p>
        )}
        {pending?.map((req) => (
          <article key={req.id} className="rounded-2xl border border-white/40 bg-white/60 p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm">
                  <Link href={`/u/${encodeURIComponent(req.sender)}`} className="font-bold text-[#8B4513] hover:underline">
                    {req.sender}
                  </Link>{" "}
                  te quiere regalar
                </p>
                <p className="text-2xl font-black text-orange-600">+{req.crumbs.toLocaleString("es-MX")} migajas</p>
              </div>
              <time className="shrink-0 text-[10px] text-gray-400">{dateFormat.format(new Date(req.created_at))}</time>
            </div>
            <blockquote className="mt-2 break-words rounded-lg bg-[#FFF8DC] p-3 text-sm italic text-gray-700">
              “{req.reason}”
            </blockquote>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                onClick={() => resolve(req, "reject")}
                disabled={busyId === req.id}
                className="rounded-xl border border-red-200 bg-white py-2 font-bold text-red-600 transition active:scale-95 disabled:opacity-50"
              >
                Rechazar
              </button>
              <button
                onClick={() => resolve(req, "accept")}
                disabled={busyId === req.id}
                className="rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 py-2 font-bold text-white shadow transition active:scale-95 disabled:opacity-50"
              >
                {busyId === req.id ? "..." : "Aceptar"}
              </button>
            </div>
          </article>
        ))}
      </section>

      {history.length > 0 && (
        <section className="mt-8 space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-widest text-[#8B4513]/70">Historial</h2>
          {history.map((req) => (
            <div
              key={req.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-white/40 bg-white/40 px-4 py-3 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate">
                  <span className="font-bold">{req.sender}</span> · +{req.crumbs.toLocaleString("es-MX")}
                </p>
                <p className="truncate text-xs italic text-gray-500">“{req.reason}”</p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${req.status === "ACCEPTED" ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"}`}
              >
                {req.status === "ACCEPTED" ? "Aceptada" : "Rechazada"}
              </span>
            </div>
          ))}
        </section>
      )}
    </PageShell>
  );
}
