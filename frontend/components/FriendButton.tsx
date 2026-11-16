"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError, type Relationship } from "../lib/api";
import { useConfirm, useToast } from "./feedback/FeedbackProvider";
import { CheckIcon, ClockIcon, UserPlusIcon } from "./icons";

const pill =
  "flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-bold text-[#FFF8DC] transition hover:bg-white/15 active:scale-95 disabled:opacity-60";

/** Botón de amistad en un perfil ajeno: agregar / pendiente / responder / amigos. */
export default function FriendButton({ username }: { username: string }) {
  const [state, setState] = useState<{ status: Relationship; requestId: number | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();

  useEffect(() => {
    let active = true;
    api
      .relationship(username)
      .then((r) => active && setState({ status: r.status, requestId: r.request_id }))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [username]);

  if (!state || state.status === "self") return null;

  const run = async (action: () => Promise<unknown>, successMessage?: string) => {
    setBusy(true);
    try {
      await action();
      const r = await api.relationship(username);
      setState({ status: r.status, requestId: r.request_id });
      if (r.status === "friends") toast.success(`Ahora ${username} y tú son amigos.`, { title: "Nuevo amigo" });
      else if (successMessage) toast.success(successMessage);
    } catch (err) {
      toast.error(err instanceof ApiError && err.status !== 0 ? err.message : "No se pudo completar. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  switch (state.status) {
    case "none":
      return (
        <button
          className={pill}
          disabled={busy}
          onClick={() => run(() => api.sendFriendRequest(username), `Le enviaste una solicitud de amistad a ${username}.`)}
        >
          <UserPlusIcon className="h-4 w-4" /> Agregar
        </button>
      );
    case "pending_sent":
      return (
        <button
          className={pill}
          disabled={busy}
          title="Toca para cancelar la solicitud"
          onClick={async () => {
            const ok = await confirm({
              title: "¿Cancelar la solicitud?",
              message: `${username} ya no verá tu solicitud de amistad.`,
              confirmText: "Cancelar solicitud",
              cancelText: "No",
              tone: "danger",
            });
            if (ok) run(() => api.cancelFriendRequest(state.requestId!), "Solicitud cancelada.");
          }}
        >
          <ClockIcon className="h-4 w-4" /> Pendiente
        </button>
      );
    case "pending_received":
      return (
        <button
          className={`${pill} bg-white/15`}
          disabled={busy}
          onClick={() => run(() => api.respondFriendRequest(state.requestId!, "accept"))}
        >
          <UserPlusIcon className="h-4 w-4" /> Aceptar
        </button>
      );
    case "friends":
      return (
        <Link href="/amigos" className={pill} title="Ver tablero de amigos">
          <CheckIcon className="h-4 w-4" /> Amigos
        </Link>
      );
  }
}
