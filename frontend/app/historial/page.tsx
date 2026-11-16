"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowDownIcon, ArrowUpIcon, GiftIcon, HistoryIcon, SpinnerIcon } from "../../components/icons";
import LoadingScreen from "../../components/LoadingScreen";
import PageShell from "../../components/PageShell";
import { api, type Interaction } from "../../lib/api";
import { useRequireAuth } from "../../lib/auth";

const formatter = new Intl.NumberFormat("es-MX");
const dayFormat = new Intl.DateTimeFormat("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const timeFormat = new Intl.DateTimeFormat("es-MX", { hour: "numeric", minute: "2-digit" });

/** Historial de movimientos de migajas del usuario, agrupado por día. */
export default function HistoryPage() {
  const { status } = useRequireAuth();
  const [items, setItems] = useState<Interaction[] | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") return;
    let active = true;
    api
      .history(1)
      .then((res) => {
        if (!active) return;
        setItems(res.results);
        setHasMore(res.next !== null);
      })
      .catch(() => active && setError(true));
    return () => {
      active = false;
    };
  }, [status]);

  if (status !== "authenticated") return <LoadingScreen />;

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const res = await api.history(page + 1);
      setItems((prev) => [...(prev ?? []), ...res.results]);
      setHasMore(res.next !== null);
      setPage((p) => p + 1);
    } catch {
      setError(true);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <PageShell title="Historial" subtitle="Cada migaja que sumaste, quitaste o te regalaron" icon={<HistoryIcon className="h-6 w-6" />} backHref="/" narrow>
      {error && <p className="mb-4 rounded-lg bg-red-100 p-3 text-center text-sm text-red-700">No pudimos cargar tu historial.</p>}
      {items === null && !error && (
        <div className="flex justify-center py-10 text-[#8B4513]">
          <SpinnerIcon />
        </div>
      )}

      {items?.length === 0 && (
        <div className="rounded-2xl border border-white/40 bg-white/50 p-8 text-center text-sm text-gray-500">
          Aún no tienes movimientos.{" "}
          <Link href="/log" className="font-bold text-[#8B4513] underline-offset-2 hover:underline">
            Registra tus primeras migajas
          </Link>
          .
        </div>
      )}

      {items && items.length > 0 && (
        <div className="space-y-6">
          {groupByDay(items).map(([day, entries]) => (
            <section key={day}>
              <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-[#8B4513]/70">{day}</h2>
              <ul className="divide-y divide-[#8B4513]/10 overflow-hidden rounded-2xl border border-white/40 bg-white/60 shadow-sm">
                {entries.map((entry) => (
                  <HistoryRow key={entry.id} entry={entry} />
                ))}
              </ul>
            </section>
          ))}

          {hasMore && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="mx-auto flex items-center gap-2 rounded-xl border border-[#8B4513]/20 bg-white/60 px-5 py-2 text-sm font-bold text-[#8B4513] transition hover:bg-white active:scale-95 disabled:opacity-60"
            >
              {loadingMore && <SpinnerIcon className="h-4 w-4" />}
              Ver más
            </button>
          )}
        </div>
      )}
    </PageShell>
  );
}

function groupByDay(items: Interaction[]): [string, Interaction[]][] {
  const groups = new Map<string, Interaction[]>();
  for (const item of items) {
    const day = dayFormat.format(new Date(item.created_at));
    groups.set(day, [...(groups.get(day) ?? []), item]);
  }
  return [...groups.entries()];
}

/** Texto e ícono según el tipo de movimiento. */
function describe(entry: Interaction): { title: string; icon: React.ReactNode; tone: string } {
  if (entry.type === "GIFT") {
    return {
      title: entry.gift_from ? `Regalo de ${entry.gift_from}` : "Regalo",
      icon: <GiftIcon className="h-5 w-5" />,
      tone: "bg-amber-100 text-amber-700",
    };
  }
  if (entry.crumbs < 0 || entry.type === "REMOVAL") {
    return { title: "Quitaste", icon: <ArrowDownIcon className="h-5 w-5" />, tone: "bg-red-100 text-red-600" };
  }
  const legacy = entry.type === "CONVERSATION" ? "Conversación" : entry.type === "CALL" ? "Llamada" : "Sumaste";
  return { title: legacy, icon: <ArrowUpIcon className="h-5 w-5" />, tone: "bg-green-100 text-green-700" };
}

function HistoryRow({ entry }: { entry: Interaction }) {
  const { title, icon, tone } = describe(entry);
  const sign = entry.crumbs > 0 ? "+" : "";
  return (
    <li className="flex items-start gap-3 p-4">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${tone}`}>{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="truncate font-bold">{title}</p>
          <span
            className={`shrink-0 font-black tabular-nums ${entry.crumbs < 0 ? "text-red-600" : entry.crumbs > 0 ? "text-green-700" : "text-gray-400"}`}
          >
            {sign}
            {formatter.format(entry.crumbs)}
          </span>
        </div>
        {entry.reason && <p className="mt-0.5 break-words text-sm text-gray-600">“{entry.reason}”</p>}
        <p className="mt-0.5 text-xs text-gray-400">{timeFormat.format(new Date(entry.created_at))}</p>
      </div>
    </li>
  );
}
