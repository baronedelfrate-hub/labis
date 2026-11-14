import { supabase } from "@/integrations/supabase/client";

// Um pedido só pode ser excluído enquanto nada aconteceu com ele: sem coleta, sem resultado,
// sem pagamento e fora de lote de convênio. Devolve o motivo do bloqueio por pedido (ausente = pode excluir).
export async function orderDeleteBlockers(orderIds: string[]): Promise<Map<string, string>> {
  const blockers = new Map<string, string>();
  if (!orderIds.length) return blockers;

  const { data: orders, error } = await supabase.from("orders")
    .select("id,order_number,status,billing_batch_id").in("id", orderIds);
  if (error) throw error;
  const num = new Map((orders ?? []).map((o: any) => [o.id, o.order_number]));
  const block = (id: string, why: string) => { if (!blockers.has(id)) blockers.set(id, `Pedido #${num.get(id) ?? "?"}: ${why}`); };

  for (const o of (orders ?? []) as any[]) {
    if (o.billing_batch_id) block(o.id, "está em lote de convênio.");
    else if (o.status !== "aberto" && o.status !== "cancelado") block(o.id, "já foi coletado ou está em análise.");
  }

  const { data: items, error: e2 } = await supabase.from("order_items").select("id,order_id,status").in("order_id", orderIds);
  if (e2) throw e2;
  const itemOrder = new Map<string, string>();
  for (const i of (items ?? []) as any[]) {
    itemOrder.set(i.id, i.order_id);
    if (i.status !== "pendente") block(i.order_id, "tem exame já coletado ou com resultado.");
  }
  const itemIds = Array.from(itemOrder.keys());
  if (itemIds.length) {
    const { data: res, error: e3 } = await supabase.from("results").select("order_item_id").in("order_item_id", itemIds);
    if (e3) throw e3;
    for (const r of (res ?? []) as any[]) block(itemOrder.get(r.order_item_id)!, "tem resultado lançado.");
  }
  const { data: samples, error: e4 } = await supabase.from("samples").select("order_id,status").in("order_id", orderIds);
  if (e4) throw e4;
  for (const s of (samples ?? []) as any[]) if (s.status !== "pendente") block(s.order_id, "tem amostra já coletada.");
  const { data: pays, error: e5 } = await supabase.from("payments").select("order_id").in("order_id", orderIds);
  if (e5) throw e5;
  for (const p of (pays ?? []) as any[]) block(p.order_id, "tem pagamento registrado.");
  return blockers;
}

export async function deleteOrders(orderIds: string[]) {
  const blockers = await orderDeleteBlockers(orderIds);
  if (blockers.size) throw new Error(Array.from(blockers.values())[0]);
  if (!orderIds.length) return;
  const { error } = await supabase.from("orders").delete().in("id", orderIds);
  if (error) throw error;
}

// Antes de excluir um paciente: apaga os pedidos dele que ainda não foram coletados;
// se algum já foi coletado/tem resultado, não exclui nada e explica o motivo.
export async function deletePatientOrdersIfSafe(patientId: string) {
  const { data, error } = await supabase.from("orders").select("id").eq("patient_id", patientId);
  if (error) throw error;
  const ids = (data ?? []).map((o: any) => o.id as string);
  if (!ids.length) return;
  const blockers = await orderDeleteBlockers(ids);
  if (blockers.size) {
    throw new Error(`Este paciente não pode ser excluído. ${Array.from(blockers.values())[0]}`);
  }
  await deleteOrders(ids);
}
