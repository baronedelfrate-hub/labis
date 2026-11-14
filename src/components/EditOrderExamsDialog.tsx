import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Item = { id: string; status: string; price: number | null; exam: { code: string; name: string } | null };

const brl = (n: number) => `R$ ${n.toFixed(2)}`;

// Edição dos exames de um pedido já salvo: adiciona (com o preço do convênio do pedido) e remove
// exames que ainda não têm resultado. O total do pedido é recalculado ao final de cada alteração.
export function EditOrderExamsDialog({
  open, onOpenChange, orderId, companyId, priceTableId, items, resultItemIds, orderStatus,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  orderId: string;
  companyId: string;
  priceTableId: string | null;
  items: Item[];
  resultItemIds: Set<string>;
  orderStatus: string;
}) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const existingExamIds = new Set<string>();

  const { data: current = [] } = useQuery({
    queryKey: ["order-items-exam-ids", orderId, items.length],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.from("order_items").select("id,exam_id").eq("order_id", orderId);
      if (error) throw error;
      return data ?? [];
    },
  });
  current.forEach((c: any) => existingExamIds.add(c.exam_id));

  const { data: found = [], isFetching } = useQuery({
    queryKey: ["edit-order-exam-search", q, priceTableId],
    enabled: open && q.trim().length >= 2,
    queryFn: async () => {
      const term = q.trim().replace(/[%,()]/g, " ");
      const { data: exams, error } = await supabase.from("exams").select("id,code,name")
        .or(`name.ilike.%${term}%,code.ilike.%${term}%`).order("name").limit(20);
      if (error) throw error;
      const ids = (exams ?? []).map((e) => e.id);
      let prices: Record<string, number> = {};
      if (priceTableId && ids.length) {
        const { data: p, error: pe } = await supabase.from("price_table_items")
          .select("exam_id,price").eq("price_table_id", priceTableId).in("exam_id", ids);
        if (pe) throw pe;
        prices = Object.fromEntries((p ?? []).map((x) => [x.exam_id, Number(x.price)]));
      }
      return (exams ?? []).map((e) => ({ ...e, price: prices[e.id] as number | undefined }));
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["order", orderId] });
    qc.invalidateQueries({ queryKey: ["orders"] });
    qc.invalidateQueries({ queryKey: ["order-items-exam-ids", orderId] });
  };

  // Soma os preços que sobraram no pedido e grava no total
  async function recomputeTotal() {
    const { data, error } = await supabase.from("order_items").select("price").eq("order_id", orderId);
    if (error) throw error;
    const total = (data ?? []).reduce((s, r: any) => s + Number(r.price ?? 0), 0);
    const { error: e2 } = await supabase.from("orders").update({ total_value: total }).eq("id", orderId);
    if (e2) throw e2;
  }

  const add = useMutation({
    mutationFn: async (e: { id: string; price?: number }) => {
      const { error } = await supabase.from("order_items")
        .insert({ order_id: orderId, exam_id: e.id, price: e.price ?? 0, company_id: companyId });
      if (error) throw error;
      await recomputeTotal();
    },
    onSuccess: () => {
      toast.success("Exame adicionado ao pedido");
      refresh();
    },
    onError: (e: any) => toast.error(e.message ?? "Não foi possível adicionar o exame"),
  });

  const remove = useMutation({
    mutationFn: async (item: Item) => {
      if (resultItemIds.has(item.id) || item.status === "com_resultado" || item.status === "liberado") {
        throw new Error("Este exame já tem resultado. Devolva o resultado antes de retirá-lo.");
      }
      const { error } = await supabase.from("order_items").delete().eq("id", item.id);
      if (error) throw error;
      await recomputeTotal();
      // Limpeza (opcional): amostras pendentes que ficaram sem nenhum exame. Só o administrador pode apagar amostras.
      try {
        const { data: left } = await supabase.from("order_items").select("sample_id").eq("order_id", orderId);
        const used = new Set((left ?? []).map((r: any) => r.sample_id).filter(Boolean));
        const { data: samples } = await supabase.from("samples").select("id,status").eq("order_id", orderId);
        for (const s of (samples ?? []) as any[]) {
          if (s.status === "pendente" && !used.has(s.id)) {
            const { count } = await supabase.from("order_item_samples").select("order_item_id", { count: "exact", head: true }).eq("sample_id", s.id);
            if (!count) await supabase.from("samples").delete().eq("id", s.id);
          }
        }
      } catch { /* sem permissão ou sem necessidade: segue */ }
    },
    onSuccess: () => {
      toast.success("Exame retirado do pedido");
      refresh();
    },
    onError: (e: any) => toast.error(e.message ?? "Não foi possível retirar o exame"),
  });

  const total = items.reduce((s, i) => s + Number(i.price ?? 0), 0);
  const busy = add.isPending || remove.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar exames do pedido</DialogTitle>
          <DialogDescription>
            Adicione exames (o preço vem do convênio do pedido) ou retire os que ainda não têm resultado.
            O total é recalculado automaticamente.
            {orderStatus === "finalizado" && " Ao adicionar um exame, o pedido volta para análise até o novo resultado ser liberado."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1">Exames no pedido</div>
            <div className="rounded-md border divide-y max-h-56 overflow-auto">
              {items.length === 0 && <div className="px-3 py-3 text-sm text-muted-foreground">Nenhum exame.</div>}
              {items.map((i) => {
                const locked = resultItemIds.has(i.id) || i.status === "com_resultado" || i.status === "liberado";
                const last = items.length === 1;
                return (
                  <div key={i.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                    <span className="font-mono text-xs w-16 shrink-0">{i.exam?.code}</span>
                    <span className="flex-1 truncate">{i.exam?.name}</span>
                    {locked && <Badge variant="outline" className="text-[10px]">com resultado</Badge>}
                    <span className="tabular-nums text-xs w-20 text-right">{brl(Number(i.price ?? 0))}</span>
                    <Button
                      size="icon" variant="ghost" className="size-7"
                      disabled={busy || locked || last}
                      title={locked ? "Já tem resultado" : last ? "O pedido precisa de ao menos um exame" : "Retirar do pedido"}
                      aria-label={`Retirar ${i.exam?.name ?? "exame"}`}
                      onClick={() => remove.mutate(i)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
            <div className="text-right text-sm mt-1">Total: <span className="font-semibold tabular-nums">{brl(total)}</span></div>
          </div>

          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1">Adicionar exame</div>
            <Input placeholder="Buscar por nome ou código (mín. 2 letras)" value={q} onChange={(e) => setQ(e.target.value)} />
            {q.trim().length >= 2 && (
              <div className="rounded-md border divide-y mt-2 max-h-52 overflow-auto">
                {isFetching && <div className="px-3 py-2 text-sm text-muted-foreground">Buscando...</div>}
                {!isFetching && found.length === 0 && <div className="px-3 py-2 text-sm text-muted-foreground">Nenhum exame encontrado.</div>}
                {found.map((e) => {
                  const already = existingExamIds.has(e.id);
                  return (
                    <div key={e.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                      <span className="font-mono text-xs w-16 shrink-0">{e.code}</span>
                      <span className="flex-1 truncate">{e.name}</span>
                      {e.price === undefined
                        ? <Badge variant="outline" className="text-[10px]">sem preço</Badge>
                        : <span className="tabular-nums text-xs">{brl(e.price)}</span>}
                      <Button size="sm" variant="secondary" disabled={busy || already} onClick={() => add.mutate({ id: e.id, price: e.price })}>
                        <Plus className="size-4 mr-1" />{already ? "No pedido" : "Adicionar"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
