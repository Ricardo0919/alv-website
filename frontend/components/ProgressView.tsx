"use client";

import { useState } from "react";
import type { Stats } from "../lib/api";
import BolilloProgressBar from "./BolilloProgressBar";
import CrumbDisplay from "./CrumbDisplay";
import { ChevronDownIcon, CoinsIcon, FlagIcon } from "./icons";
import { CONTAINER } from "./PageShell";

const card = "rounded-2xl border border-white/40 bg-white/50 shadow-lg";
const formatter = new Intl.NumberFormat("es-MX");

interface Props {
  stats: Stats;
  title: string;
  /** Barra superior del header (usa <HeaderBar />) */
  topBar?: React.ReactNode;
  /** Contenido extra en la columna derecha (p. ej. link al historial). */
  extra?: React.ReactNode;
  /** Acción principal: flotante en celular, dentro de la columna en tablet/computadora. */
  children?: React.ReactNode;
}

/**
 * Vista del progreso de un usuario (página principal y perfil público).
 *   Celular: una columna + botón flotante.
 *   Tablet: una columna ancha. Computadora: bolillo a la izquierda, datos y acciones a la derecha.
 */
export default function ProgressView({ stats, title, topBar, extra, children }: Props) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <main className="min-h-screen pb-32 font-sans text-[#3E2723] selection:bg-[#DEB887] selection:text-white md:pb-16">
      <header className="mb-8 rounded-b-[2.5rem] bg-gradient-to-b from-[#8B4513] to-[#6d360f] pb-8 pt-4 text-[#FFF8DC] shadow-2xl md:mb-10 md:pb-12">
        <div className={CONTAINER}>
          {topBar}
          <div className="text-center">
            <h1 className="break-words text-3xl font-black uppercase tracking-tight opacity-95 md:text-4xl lg:text-5xl">
              {title}
            </h1>
            <p className="mt-1 text-xs font-bold uppercase tracking-[0.2em] text-[#DEB887] md:text-sm">
              Monitor de progreso
            </p>
            <div className="mt-6 flex flex-col items-center">
              <div className="text-6xl font-black tabular-nums tracking-tighter md:text-7xl">
                {stats.percent.toFixed(2)}
                <span className="text-3xl opacity-60 md:text-4xl">%</span>
              </div>
              <span className="mt-2 rounded-full bg-black/20 px-3 py-1 text-xs font-medium">de la meta</span>
            </div>
          </div>
        </div>
      </header>

      <div className={`${CONTAINER} grid gap-6 lg:grid-cols-[3fr_2fr] lg:gap-8`}>
        {/* Columna izquierda: bolillo */}
        <section className={`${card} flex flex-col justify-center rounded-3xl p-6 md:p-8`}>
          <h2 className="mb-6 text-center text-xs font-bold uppercase tracking-widest text-[#8B4513]/70">Visualización</h2>
          <BolilloProgressBar currentCrumbs={stats.total_crumbs} maxCrumbs={stats.goal} />
        </section>

        {/* Columna derecha: datos y acciones */}
        <div className="flex flex-col gap-4 md:gap-5">
          <section className="grid grid-cols-2 gap-4">
            <Stat icon={<CoinsIcon className="h-7 w-7" />} label="Acumuladas" value={stats.total_crumbs} />
            <Stat icon={<FlagIcon className="h-7 w-7" />} label="Meta" value={stats.goal} />
          </section>

          {children && (
            <div className="pointer-events-none fixed bottom-[max(2rem,env(safe-area-inset-bottom))] left-0 right-0 z-50 flex justify-center px-4 md:pointer-events-auto md:static md:block md:px-0">
              {children}
            </div>
          )}

          {extra}

          <section className="overflow-hidden rounded-2xl border border-white/40 bg-white/40 shadow-sm">
            <button
              onClick={() => setShowDetails((v) => !v)}
              aria-expanded={showDetails}
              className="flex w-full items-center justify-between p-4 text-sm font-bold text-[#8B4513] transition-colors hover:bg-white/40"
            >
              <span>{showDetails ? "Ocultar" : "Ver"} detalles técnicos</span>
              <ChevronDownIcon className={`h-5 w-5 transition-transform duration-300 ${showDetails ? "rotate-180" : ""}`} />
            </button>
            {showDetails && (
              <div className="border-t border-white/10 p-4">
                <p className="mb-3 text-center text-xs italic text-gray-600">Representación cruda de las migajas:</p>
                <CrumbDisplay count={stats.total_crumbs} />
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className={`${card} flex flex-col items-center justify-center p-5`}>
      <span className="mb-2 text-[#8B4513]/80">{icon}</span>
      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{label}</span>
      <span className="text-2xl font-black tabular-nums text-[#8B4513] lg:text-3xl">{formatter.format(value)}</span>
    </div>
  );
}

/** Botón de acción principal (flotante en celular, ancho completo en tablet/computadora). */
export const fabClass =
  "group pointer-events-auto flex items-center justify-center gap-3 whitespace-nowrap rounded-full border border-white/60 bg-white/85 px-8 py-4 font-black uppercase tracking-widest text-[#8B4513] shadow-[0_8px_32px_0_rgba(31,38,135,0.15)] transition-transform duration-300 hover:scale-105 active:scale-95 md:w-full md:rounded-2xl md:border-transparent md:bg-gradient-to-r md:from-orange-500 md:to-amber-600 md:text-white md:hover:scale-[1.02]";
