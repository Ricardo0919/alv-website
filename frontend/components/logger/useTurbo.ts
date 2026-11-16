"use client";

import { useEffect, useRef } from "react";

/**
 * Botones +/- con "modo turbo": un toque ejecuta un paso; mantener presionado
 * repite cada 100 ms. `onStep` recibe cuántas repeticiones lleva (para acelerar).
 * Usa pointer events (mouse y touch unificados, sin contar doble en móvil).
 */
export function useTurbo(onStep: (direction: 1 | -1, tick: number) => void) {
  const delay = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interval = useRef<ReturnType<typeof setInterval> | null>(null);
  // Siempre la versión más reciente del callback, sin reiniciar el intervalo
  const stepRef = useRef(onStep);
  useEffect(() => {
    stepRef.current = onStep;
  });

  const stop = () => {
    if (delay.current) clearTimeout(delay.current);
    if (interval.current) clearInterval(interval.current);
    delay.current = null;
    interval.current = null;
  };

  // Limpia al desmontar (si el botón desaparece no llega el pointerup)
  useEffect(() => stop, []);

  const start = (direction: 1 | -1) => {
    stop();
    let tick = 0;
    stepRef.current(direction, tick);
    delay.current = setTimeout(() => {
      interval.current = setInterval(() => stepRef.current(direction, ++tick), 100);
    }, 300);
  };

  const handlers = (direction: 1 | -1) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.stopPropagation();
      start(direction);
    },
    onPointerUp: stop,
    onPointerLeave: stop,
    onPointerCancel: stop,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });

  return { handlers, stop };
}
