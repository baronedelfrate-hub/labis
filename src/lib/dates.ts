// Datas "só dia" (colunas DATE, como 2026-11-17) não podem ser lidas com new Date("2026-11-17"):
// o JavaScript trata como meia-noite em UTC e, no Brasil, mostra o dia anterior. Aqui o dia é lido como local.
export function parseDateOnly(v: string | Date | null | undefined): Date | null {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.trim());
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

/** dd/mm/aaaa para colunas de data (nascimento, data do pedido, data da coleta). */
export function formatDateBR(v: string | Date | null | undefined): string {
  const d = parseDateOnly(v);
  return d ? d.toLocaleDateString("pt-BR") : "—";
}

/** Hoje no relógio do usuário, como aaaa-mm-dd (new Date().toISOString() usaria o dia em UTC). */
export function todayLocal(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
