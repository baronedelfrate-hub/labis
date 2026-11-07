// Prazo de retorno dos exames enviados a laboratórios de apoio.
//
// Previsão = data do envio + prazo, em dias corridos. O prazo é o do laboratório de apoio (cadastro de apoios)
// e, se o apoio não tiver prazo, o prazo do próprio exame. Sem nenhum dos dois, não há alerta.
// A comparação é por dia (calendário local): no dia da previsão ainda está "vence hoje".

export type DelayState = "atrasado" | "vence_hoje" | "no_prazo" | "sem_prazo";

export type Delay = {
  state: DelayState;
  due: Date | null;
  /** dias de atraso (>0 só quando atrasado) */
  daysLate: number;
  /** dias que faltam (>0 só quando no prazo) */
  daysLeft: number;
  days: number | null;
};

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const DAY = 24 * 60 * 60 * 1000;

export function computeDelay(sentAt: string | Date, labDays: number | null | undefined, examDays: number | null | undefined, now: Date = new Date()): Delay {
  const days = labDays != null && labDays > 0 ? labDays : examDays != null && examDays > 0 ? examDays : null;
  if (days == null) return { state: "sem_prazo", due: null, daysLate: 0, daysLeft: 0, days: null };
  const sent = startOfDay(new Date(sentAt));
  const due = new Date(sent.getFullYear(), sent.getMonth(), sent.getDate() + days);
  const diff = Math.round((startOfDay(now).getTime() - due.getTime()) / DAY);
  if (diff > 0) return { state: "atrasado", due, daysLate: diff, daysLeft: 0, days };
  if (diff === 0) return { state: "vence_hoje", due, daysLate: 0, daysLeft: 0, days };
  return { state: "no_prazo", due, daysLate: 0, daysLeft: -diff, days };
}

export function delayLabel(d: Delay): string {
  switch (d.state) {
    case "atrasado": return `Atrasado ${d.daysLate} dia${d.daysLate > 1 ? "s" : ""}`;
    case "vence_hoje": return "Vence hoje";
    case "no_prazo": return `No prazo (${d.daysLeft} dia${d.daysLeft > 1 ? "s" : ""})`;
    default: return "Sem prazo";
  }
}

// Ordem da lista: atrasados (mais atrasado primeiro), vence hoje, no prazo (mais perto primeiro), sem prazo
export function delayRank(d: Delay): number {
  if (d.state === "atrasado") return -1_000_000 - d.daysLate;
  if (d.state === "vence_hoje") return -1;
  if (d.state === "no_prazo") return d.daysLeft;
  return 1_000_000;
}
