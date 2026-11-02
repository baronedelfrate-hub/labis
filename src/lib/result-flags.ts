// Sinalização de resultados: normal, fora da faixa (baixo/alto) e valores de pânico
// (risco de vida ao paciente). Valores de pânico têm prioridade sobre a faixa normal.
// Pânico: abaixo do "pânico mínimo" ou acima do "pânico máximo" cadastrados.

export type ResultFlag = "normal" | "low" | "high" | "panic_low" | "panic_high";

export type FlagLimits = {
  min?: number | null;
  max?: number | null;
  panicMin?: number | null;
  panicMax?: number | null;
};

/** Converte "4.7", "4,7" ou " 12 " em número. Textos como "<0,5" ou "Positivo" viram null. */
export function parseNumeric(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const s = value.trim();
  if (!/^-?\d+([.,]\d+)?$/.test(s)) return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

const num = (v: unknown): number | null => (v == null || v === "" ? null : parseNumeric(String(v)));

export function getFlag(value: string | number | null | undefined, limits: FlagLimits): ResultFlag {
  const v = parseNumeric(value);
  if (v == null) return "normal";
  const panicMin = num(limits.panicMin);
  const panicMax = num(limits.panicMax);
  if (panicMin != null && v < panicMin) return "panic_low";
  if (panicMax != null && v > panicMax) return "panic_high";
  const min = num(limits.min);
  const max = num(limits.max);
  if (min != null && v < min) return "low";
  if (max != null && v > max) return "high";
  return "normal";
}

export const isPanic = (f: ResultFlag) => f === "panic_low" || f === "panic_high";
export const isAbnormal = (f: ResultFlag) => f !== "normal";

/** Sinal curto para o laudo impresso: ↓ ↑ e !! para pânico. */
export function flagMark(f: ResultFlag): string {
  switch (f) {
    case "low": return "↓";
    case "high": return "↑";
    case "panic_low": return "↓ !!";
    case "panic_high": return "↑ !!";
    default: return "";
  }
}

export function flagLabel(f: ResultFlag): string {
  switch (f) {
    case "low": return "Abaixo da faixa";
    case "high": return "Acima da faixa";
    case "panic_low": return "PÂNICO — muito baixo";
    case "panic_high": return "PÂNICO — muito alto";
    default: return "";
  }
}
