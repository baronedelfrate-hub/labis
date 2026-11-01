import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, PageBody } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { toast } from "sonner";
import { useCompanyId } from "@/hooks/useCompanyId";

export const Route = createFileRoute("/_authenticated/financeiro/convenios")({
  head: () => ({ meta: [{ title: "Convênios — Financeiro" }] }),
  component: FinanceiroConvenios,
});

function FinanceiroConvenios() {
  const companyId = useCompanyId();
  const [openInsurance, setOpenInsurance] = useState<{ id: string; name: string } | null>(null);

  const { data } = useQuery({
    queryKey: ["financeiro-convenios"],
    queryFn: async () => {
      const { data: orders } = await supabase
        .from("orders")
        .select("id,total_value,insurance_plan_id,insurance:insurance_plans!inner(id,name,is_particular)")
        .eq("status", "finalizado")
        .is("billing_batch_id", null)
        .not("insurance_plan_id", "is", null)
        .eq("insurance.is_particular" as any, false);
      const groups = new Map<string, { id: string; name: string; count: number; total: number }>();
      (orders ?? []).forEach((o: any) => {
        const key = o.insurance_plan_id;
        const name = o.insurance?.name ?? "—";
        const g = groups.get(key) ?? { id: key, name, count: 0, total: 0 };
        g.count += 1;
        g.total += Number(o.total_value);
        groups.set(key, g);
      });
      return Array.from(groups.values());
    },
  });

  return (
    <>
      <PageHeader title="Faturamento por convênio" description="Pedidos finalizados aguardando geração de lote" />
      <PageBody>
        <div className="rounded-md border bg-card overflow-hidden">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Convênio</TableHead>
              <TableHead className="text-right">Pedidos elegíveis</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="w-40" />
            </TableRow></TableHeader>
            <TableBody>
              {(data ?? []).map((g) => (
                <TableRow key={g.id}>
                  <TableCell className="font-medium">{g.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{g.count}</TableCell>
                  <TableCell className="text-right tabular-nums">R$ {g.total.toFixed(2)}</TableCell>
                  <TableCell><Button size="sm" onClick={() => setOpenInsurance({ id: g.id, name: g.name })}>Criar lote</Button></TableCell>
                </TableRow>
              ))}
              {(data ?? []).length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nenhum convênio com pedidos elegíveis.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </PageBody>
      {openInsurance && companyId && (
        <CreateBatchDialog insurance={openInsurance} companyId={companyId} onClose={() => setOpenInsurance(null)} />
      )}
    </>
  );
}

function CreateBatchDialog({ insurance, companyId, onClose }: { insurance: { id: string; name: string }; companyId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const now = new Date();
  const [refMonth, setRefMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const { data: orders } = useQuery({
    queryKey: ["financeiro-convenios-orders", insurance.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("id,order_number,order_date,total_value,patient:patients(name,code)")
        .eq("status", "finalizado")
        .is("billing_batch_id", null)
        .eq("insurance_plan_id", insurance.id)
        .order("order_number", { ascending: true });
      const init: Record<string, boolean> = {};
      (data ?? []).forEach((o: any) => { init[o.id] = true; });
      setSelected(init);
      return data ?? [];
    },
  });

  const total = (orders ?? []).filter((o: any) => selected[o.id]).reduce((s: number, o: any) => s + Number(o.total_value), 0);

  const mut = useMutation({
    mutationFn: async () => {
      const chosen = (orders ?? []).filter((o: any) => selected[o.id]);
      if (chosen.length === 0) throw new Error("Selecione ao menos um pedido");
      const [year, month] = refMonth.split("-").map(Number);
      const referenceDate = new Date(year, month - 1, 1).toISOString().slice(0, 10);
      const { data: batch, error } = await supabase.from("billing_batches").insert({
        company_id: companyId,
        insurance_plan_id: insurance.id,
        reference_month: referenceDate,
        status: "fechado" as any,
        total_value: chosen.reduce((s: number, o: any) => s + Number(o.total_value), 0),
        closed_at: new Date().toISOString(),
      }).select("id").single();
      if (error) throw error;

      const items = chosen.map((o: any) => ({ billing_batch_id: batch.id, order_id: o.id, value: Number(o.total_value) }));
      const { error: e2 } = await supabase.from("billing_batch_items").insert(items);
      if (e2) throw e2;

      const { error: e3 } = await supabase.from("orders").update({ billing_batch_id: batch.id }).in("id", chosen.map((o: any) => o.id));
      if (e3) throw e3;

      return batch.id;
    },
    onSuccess: (batchId) => {
      toast.success("Lote criado");
      qc.invalidateQueries({ queryKey: ["financeiro-convenios"] });
      qc.invalidateQueries({ queryKey: ["financeiro-lotes"] });
      onClose();
      navigate({ to: "/financeiro/lotes/$batchId", params: { batchId } });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao criar lote"),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>Criar lote — {insurance.name}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5 max-w-xs"><Label>Mês de referência</Label><Input type="month" value={refMonth} onChange={(e) => setRefMonth(e.target.value)} /></div>
          <div className="rounded-md border max-h-96 overflow-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead className="w-10" />
                <TableHead>Pedido</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Paciente</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {(orders ?? []).map((o: any) => (
                  <TableRow key={o.id}>
                    <TableCell><Checkbox checked={!!selected[o.id]} onCheckedChange={(v) => setSelected((s) => ({ ...s, [o.id]: !!v }))} /></TableCell>
                    <TableCell className="tabular-nums">#{o.order_number}</TableCell>
                    <TableCell className="tabular-nums text-xs">{new Date(o.order_date).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell>{o.patient?.name}</TableCell>
                    <TableCell className="text-right tabular-nums">R$ {Number(o.total_value).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex justify-end items-baseline gap-3"><span className="text-sm text-muted-foreground">Total do lote</span><span className="text-xl font-semibold tabular-nums">R$ {total.toFixed(2)}</span></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>{mut.isPending ? "Criando..." : "Criar lote"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
