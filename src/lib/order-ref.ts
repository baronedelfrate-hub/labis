// Como o pedido aparece para as pessoas: o número do dia (5 dígitos + DDMMYYYY, ex.: 0000115112026)
// quando existe; nos pedidos antigos, o número sequencial (#123).
export function orderRef(o: { daily_code?: string | null; order_number?: number | null } | null | undefined): string {
  if (!o) return "—";
  if (o.daily_code) return o.daily_code;
  return o.order_number != null ? `#${o.order_number}` : "—";
}
