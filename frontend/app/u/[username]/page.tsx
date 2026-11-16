"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import ErrorScreen from "../../../components/ErrorScreen";
import FriendButton from "../../../components/FriendButton";
import { HeaderBar, IconAction, UserChip } from "../../../components/HeaderBar";
import { GiftIcon, HomeIcon, PencilIcon } from "../../../components/icons";
import LoadingScreen from "../../../components/LoadingScreen";
import ProgressView, { fabClass } from "../../../components/ProgressView";
import { api, ApiError, type Stats } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";

/**
 * Perfil público: cualquiera con el link ve el progreso, pero es solo lectura.
 * Registrar migajas solo es posible desde /log con la sesión del dueño.
 */
export default function PublicProfilePage() {
  const { username } = useParams<{ username: string }>();
  const { status, user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<"not-found" | "network" | null>(null);

  useEffect(() => {
    let active = true;
    api
      .publicProfile(decodeURIComponent(username))
      .then((s) => {
        if (!active) return;
        setStats(s);
        document.title = `Migajero ${s.username} · El Migajero`;
      })
      .catch((err) => active && setError(err instanceof ApiError && err.status === 404 ? "not-found" : "network"));
    return () => {
      active = false;
    };
  }, [username]);

  if (error === "not-found") {
    return <ErrorScreen title="Usuario no encontrado" message={`No existe nadie llamado "${decodeURIComponent(username)}".`} />;
  }
  if (error) return <ErrorScreen title="Error de conexión" message="No pudimos cargar este perfil." retry />;
  if (!stats) return <LoadingScreen message="Buscando migajas..." />;

  const isOwner = status === "authenticated" && user?.username === stats.username;
  const giftHref = `/log?para=${encodeURIComponent(stats.username)}`;

  return (
    <ProgressView
      stats={stats}
      title={`Migajero ${stats.username}`}
      topBar={
        <HeaderBar
          identity={<UserChip username={stats.username} caption={isOwner ? "Tu perfil público" : "Perfil público"} />}
          actions={
            status === "authenticated" ? (
              <>
                {!isOwner && <FriendButton username={stats.username} />}
                <IconAction label={isOwner ? "Volver a mi progreso" : "Ir a mi progreso"} href="/">
                  <HomeIcon />
                </IconAction>
              </>
            ) : undefined
          }
        />
      }
    >
      {isOwner ? (
        <Link href="/log" className={fabClass}>
          <PencilIcon className="h-6 w-6" />
          <span>Registrar migajas</span>
        </Link>
      ) : status === "authenticated" ? (
        <Link href={giftHref} className={fabClass}>
          <GiftIcon className="h-6 w-6" />
          <span>Regalar migajas</span>
        </Link>
      ) : status === "anonymous" ? (
        // Sin sesión: inicia sesión y regresa directo a regalar
        <Link href={`/login?next=${encodeURIComponent(giftHref)}`} className={fabClass}>
          <GiftIcon className="h-6 w-6" />
          <span>Regalar migajas</span>
        </Link>
      ) : null}
    </ProgressView>
  );
}
