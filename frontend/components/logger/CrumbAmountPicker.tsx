"use client";

import { BackspaceIcon, MinusIcon, PlusIcon } from "../icons";
import { vibrate } from "./haptics";
import { useTurbo } from "./useTurbo";

interface Props {
  value: number;
  onChange: React.Dispatch<React.SetStateAction<number>>;
  max: number;
  /** Mínimo para los botones +/- (el teclado permite escribir libremente). */
  min?: number;
  label: string;
  hint?: string;
  /** Color del número (p. ej. rojo al quitar migajas). */
  tone?: "add" | "remove";
}

const formatter = new Intl.NumberFormat("es-MX");

/** Al mantener presionado +/-, el paso crece: 1 → 10 → 100 → 1,000. */
const stepFor = (tick: number) => (tick < 10 ? 1 : tick < 25 ? 10 : tick < 45 ? 100 : 1000);

/**
 *        [ − ]   12,500   [ + ]
 *        [ 1 ][ 2 ][ 3 ]
 *        [ 4 ][ 5 ][ 6 ]      ← teclado siempre visible
 *        [ 7 ][ 8 ][ 9 ]
 *        [ C ][ 0 ][ ⌫ ]
 */
export default function CrumbAmountPicker({ value, onChange, max, min = 0, label, hint, tone = "add" }: Props) {
  const { handlers } = useTurbo((direction, tick) => {
    onChange((prev) => {
      const next = Math.min(max, Math.max(min, prev + direction * stepFor(tick)));
      vibrate(next === prev ? "DOUBLE" : "MICRO");
      return next;
    });
  });

  const pressDigit = (digit: number) =>
    onChange((prev) => {
      const next = prev * 10 + digit;
      if (next > max) {
        vibrate("DOUBLE");
        return prev;
      }
      vibrate("MICRO");
      return next;
    });

  const backspace = () => {
    vibrate("MICRO");
    onChange((prev) => Math.floor(prev / 10));
  };

  const clear = () => {
    vibrate("DOUBLE");
    onChange(0);
  };

  // El número se achica según su largo para nunca chocar con los botones
  const chars = formatter.format(value).length;
  const size = chars <= 3 ? "text-6xl" : chars <= 6 ? "text-5xl" : chars <= 9 ? "text-4xl" : "text-3xl";
  const color = tone === "remove" ? "text-red-600" : "text-orange-600";

  const roundButton =
    "flex h-14 w-14 shrink-0 touch-manipulation select-none items-center justify-center rounded-full border bg-white shadow-md transition-transform active:scale-90";
  const key =
    "h-12 touch-manipulation select-none rounded-xl border-b-4 border-gray-200 bg-white text-xl font-bold text-gray-700 transition active:translate-y-0.5 active:border-b-2";

  return (
    <div className="rounded-2xl border-2 border-white/40 bg-white/60 p-4 text-center">
      <p className="text-xs font-bold uppercase tracking-wider text-gray-600">{label}</p>

      <div className="mt-2 flex items-center justify-between gap-2">
        <button {...handlers(-1)} className={`${roundButton} border-red-100 text-red-500`} aria-label="Restar uno">
          <MinusIcon className="h-6 w-6" />
        </button>
        <output
          className={`min-w-0 flex-1 font-black tabular-nums ${color} ${size} ${value === 0 ? "opacity-30" : ""}`}
          aria-live="polite"
        >
          {formatter.format(value)}
        </output>
        <button {...handlers(1)} className={`${roundButton} border-green-100 text-green-600`} aria-label="Sumar uno">
          <PlusIcon className="h-6 w-6" />
        </button>
      </div>

      <p className="mt-1 text-xs text-[#A0522D]">{hint ?? `Máximo ${formatter.format(max)}`}</p>

      <div className="mt-3 grid grid-cols-3 gap-2" role="group" aria-label="Teclado numérico">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <button key={n} type="button" onClick={() => pressDigit(n)} className={key}>
            {n}
          </button>
        ))}
        <button
          type="button"
          onClick={clear}
          className="h-12 rounded-xl text-sm font-bold text-gray-500 transition hover:bg-gray-100 active:scale-95"
          aria-label="Borrar todo"
        >
          C
        </button>
        <button type="button" onClick={() => pressDigit(0)} className={key}>
          0
        </button>
        <button
          type="button"
          onClick={backspace}
          className="flex h-12 items-center justify-center rounded-xl text-red-400 transition hover:bg-red-50 active:scale-95"
          aria-label="Borrar último dígito"
        >
          <BackspaceIcon />
        </button>
      </div>
    </div>
  );
}
