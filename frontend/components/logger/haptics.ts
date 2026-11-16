// Vibración háptica (solo en dispositivos que la soportan)
const PATTERNS = { MICRO: 5, MEDIUM: 30, HEAVY: 50, DOUBLE: [50, 30, 50] } as const;

export type HapticPattern = keyof typeof PATTERNS;

export function vibrate(pattern: HapticPattern) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(PATTERNS[pattern] as number | number[]);
  }
}
