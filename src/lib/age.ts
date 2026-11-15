// Idade do paciente na data de referência (por padrão, a data do pedido), em texto curto:
// "34 anos", "5 anos e 3 meses" (até 12 anos), "8 meses", "12 dias".
function parseDate(v: string | Date | null | undefined): Date | null {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

export function formatPatientAge(birth: string | Date | null | undefined, at?: string | Date | null): string | null {
  const b = parseDate(birth);
  if (!b) return null;
  const ref = parseDate(at) ?? new Date();
  if (ref < b) return null;
  let months = (ref.getFullYear() - b.getFullYear()) * 12 + (ref.getMonth() - b.getMonth());
  if (ref.getDate() < b.getDate()) months -= 1;
  if (months >= 24) {
    const y = Math.floor(months / 12);
    const rm = months % 12;
    const yTxt = `${y} ${y === 1 ? "ano" : "anos"}`;
    return y < 12 && rm > 0 ? `${yTxt} e ${rm} ${rm === 1 ? "mês" : "meses"}` : yTxt;
  }
  if (months >= 1) return `${months} ${months === 1 ? "mês" : "meses"}`;
  const days = Math.max(0, Math.round((ref.getTime() - b.getTime()) / 86400000));
  return `${days} ${days === 1 ? "dia" : "dias"}`;
}
