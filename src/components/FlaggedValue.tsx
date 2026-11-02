import { getFlag, flagMark, isPanic, type FlagLimits } from "@/lib/result-flags";

// Valor de resultado com sinal de fora da faixa (↑ ↓) e de pânico (!!), pensado para laudo impresso
// (negrito + símbolo, sem depender de cor). `showPanic=false` mostra só ↑/↓, para o paciente no portal.
export function FlaggedValue({
  value, limits, showPanic = true,
}: { value: string; limits: FlagLimits; showPanic?: boolean }) {
  const flag = getFlag(value, limits);
  if (flag === "normal") return <>{value}</>;
  const mark = showPanic ? flagMark(flag) : flagMark(flag).replace(" !!", "");
  return (
    <span style={{ fontWeight: 800 }} className={showPanic && isPanic(flag) ? "text-red-700" : undefined}>
      {value} <span style={{ fontWeight: 700 }}>{mark}</span>
    </span>
  );
}

export const limitsOf = (row: any): FlagLimits => ({
  min: row?.reference_min,
  max: row?.reference_max,
  panicMin: row?.panic_min,
  panicMax: row?.panic_max,
});
