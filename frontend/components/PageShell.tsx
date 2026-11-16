"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeftIcon } from "./icons";

/**
 * Ancho del contenido por dispositivo:
 *   celular → columna angosta · tablet → más ancho · computadora → aún más.
 * Se usa en todas las páginas para que todo quede alineado.
 */
export const CONTAINER = "mx-auto w-full max-w-md px-4 sm:px-6 md:max-w-2xl lg:max-w-5xl";

interface Props {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  /** Ruta de "volver"; sin ella usa el historial del navegador. */
  backHref?: string;
  /** Ancho máximo del contenido en computadora (por defecto el de CONTAINER). */
  narrow?: boolean;
  children: React.ReactNode;
}

/** Página secundaria: cabecera con botón de volver, ícono y título. */
export default function PageShell({ title, subtitle, icon, backHref, narrow, children }: Props) {
  const router = useRouter();
  const back =
    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#8B4513]/70 transition hover:bg-[#8B4513]/10 hover:text-[#8B4513] active:scale-95";

  return (
    <main className={`${CONTAINER} ${narrow ? "lg:max-w-2xl" : ""} min-h-screen pb-16 text-[#3E2723]`}>
      <header className="grid grid-cols-[auto_1fr_auto] items-center gap-2 py-6 md:py-10">
        {backHref ? (
          <Link href={backHref} className={back} aria-label="Volver">
            <ChevronLeftIcon className="h-6 w-6" />
          </Link>
        ) : (
          <button onClick={() => router.back()} className={back} aria-label="Volver">
            <ChevronLeftIcon className="h-6 w-6" />
          </button>
        )}
        <div className="text-center">
          <h1 className="flex items-center justify-center gap-2 text-xl font-bold tracking-tight text-[#3E2723]/85 md:text-2xl">
            {icon && <span className="text-[#8B4513]">{icon}</span>}
            {title}
          </h1>
          {subtitle && <p className="mt-1 text-xs text-[#A0522D] md:text-sm">{subtitle}</p>}
        </div>
        <div className="w-10" />
      </header>
      {children}
    </main>
  );
}

/** Título de sección pequeño en mayúsculas. */
export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-[#8B4513]/70">{children}</h2>;
}
