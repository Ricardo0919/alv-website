"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ErrorScreen from "../components/ErrorScreen";
import { useToast } from "../components/feedback/FeedbackProvider";
import { HeaderBar, IconAction, UserChip } from "../components/HeaderBar";
import {
  ArrowRightIcon,
  BellIcon,
  CheckIcon,
  HistoryIcon,
  LogoutIcon,
  PencilIcon,
  SettingsIcon,
  ShareIcon,
  UsersIcon,
} from "../components/icons";
import LoadingScreen from "../components/LoadingScreen";
import ProgressView, { fabClass } from "../components/ProgressView";
import { api, type Stats } from "../lib/api";
import { useRequireAuth } from "../lib/auth";

export default function Home() {
  const { status, user, logout } = useRequireAuth();
  const toast = useToast();
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (status !== "authenticated") return;
    let active = true;
    api
      .stats()
      .then((s) => active && setStats(s))
      .catch(() => active && setError(true));
    // Una sola consulta al cargar (sin polling, para no gastar batería ni red)
    api
      .pendingRequestsCount()
      .then(({ pending }) => active && setPendingCount(pending))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [status]);

  if (status !== "authenticated" || !user) return <LoadingScreen />;
  if (error) return <ErrorScreen title="Error de conexión" message="No pudimos conectar con la panadería (backend)." retry />;
  if (!stats) return <LoadingScreen message="Horneando estadísticas..." />;

  const share = async () => {
    const url = `${window.location.origin}/u/${encodeURIComponent(user.username)}`;
    // En celular abre el menú nativo de compartir; en escritorio copia el link
    if (navigator.share) {
      try {
        await navigator.share({ title: "Mi progreso de migajas", url });
      } catch {
        // El usuario canceló
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Compártelo para que vean tu progreso.", { title: "Link copiado" });
    } catch {
      toast.info(url, { title: "Copia tu link", duration: 0 });
    }
  };

  return (
    <ProgressView
      extra={
        <Link
          href="/historial"
          className="flex items-center gap-3 rounded-2xl border border-white/40 bg-white/50 p-4 font-bold text-[#8B4513] shadow-sm transition hover:bg-white/70"
        >
          <HistoryIcon />
          <span className="flex-1">Historial de migajas</span>
          <ArrowRightIcon className="h-4 w-4 opacity-60" />
        </Link>
      }
      stats={stats}
      title={`Migajero ${user.username}`}
      topBar={
        <HeaderBar
          identity={<UserChip username={user.username} />}
          actions={
            <>
              <IconAction label="Notificaciones" href="/notificaciones" badge={pendingCount}>
                <BellIcon />
              </IconAction>
              <IconAction label="Amigos" href="/amigos">
                <UsersIcon />
              </IconAction>
              <IconAction label={copied ? "¡Link copiado!" : "Compartir mi link"} onClick={share}>
                {copied ? <CheckIcon className="h-5 w-5 text-green-300" /> : <ShareIcon />}
              </IconAction>
              <IconAction label="Ajustes" href="/ajustes">
                <SettingsIcon />
              </IconAction>
              <IconAction label="Cerrar sesión" onClick={logout}>
                <LogoutIcon />
              </IconAction>
            </>
          }
        />
      }
    >
      <Link href="/log" className={fabClass}>
        <PencilIcon className="h-6 w-6 transition-transform duration-300 group-hover:-rotate-12" />
        <span>Registrar migajas</span>
      </Link>
    </ProgressView>
  );
}
