import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, PageBody } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TissGlosaCombobox } from "@/components/TissGlosaCombobox";
import { ArrowLeft, DollarSign } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/financeiro/lotes/$batchId")({
  head: () => ({ meta: [{ title: "Lote — Financeiro" }] }),
  component: BatchDetail,
});

function BatchDetail() {
  const { batchId } = Route.useParams();
  const qc = useQueryClient();
  const [payOpen, setPayOpen] = useState(false);
  const [editing, setEditing] = useState<{ id: string; glosa_value: string; glosa_reason: string; glosa_codigo: string | null } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["batch", batchId],
    queryFn: async () => {
      const { data: batch, error } = await supabase.from("billing_batches")
        .select("id,company_id,reference_month,status,total_value,opened_at,closed_at,insurance:insurance_plans(name)")
        .eq("id", batchId).single();
      if (error) throw error;
      const { data: items } = await supabase.from("billing_batch_items")
        .select("id,order_id,value,glosa_value,glosa_reason,glosa_codigo,glosa:tiss_glosa_codes(codigo,descricao),order:orders(order_number,order_date,total_value,patient:patients(name,code))")
        .eq("billing_batch_id", batchId);
      const { data: payments } = await supabase.from("payments")
        .select("*").eq("billing_batch_id", batchId).order("paid_at");
      return { batch, items: items ?? [], payments: payments ?? [] };
    },
  });

  const updateItem = useMutation({
    mutationFn: async (payload: { id: string; glosa_value: number; glosa_reason: string | null; glosa_codigo: string | null }) => {
      const { error } = await supabase.from("billing_batch_items").update({ glosa_value: payload.glosa_value, glosa_reason: payload.glosa_reason, glosa_codigo: payload.glosa_codigo } as any).eq("id", payload.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Glosa atualizada"); qc.invalidateQueries({ queryKey: ["batch", batchId] }); setEditing(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase.from("billing_batches").update({ status: status as any }).eq("id", batchId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Status atualizado"); qc.invalidateQueries({ queryKey: ["batch", batchId] }); qc.invalidateQueries({ queryKey: ["financeiro-lotes"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading || !data) return <div className="p-6 text-muted-foreground">Carregando...</div>;
  const b = data.batch as any;
  const paid = data.payments.reduce((s: number, p: any) => s + Number(p.amount), 0);
  const totalGlosa = data.items.reduce((s: number, i: any) => s + Number(i.glosa_value || 0), 0);
  const netValue = Number(b.total_value) - totalGlosa;
  const balance = Math.max(0, netValue - paid);

  return (
    <>
      <PageHeader title={`Lote — ${b.insurance?.name}`} description={new Date(b.reference_month).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })} actions={
        <div className="flex items-center gap-2">
          <Select value={b.status} onValueChange={(v) => updateStatus.mutate(v)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="aberto">Aberto</SelectItem>
              <SelectItem value="fechado">Fechado</SelectItem>
              <SelectItem value="enviado">Enviado</SelectItem>
              <SelectItem value="pago_parcial">Pago parcial</SelectItem>
              <SelectItem value="pago">Pago</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => setPayOpen(true)} disabled={balance <= 0}><DollarSign className="size-4 mr-1" />Registrar recebimento</Button>
          <Button variant="outline" asChild><Link to="/financeiro/lotes"><ArrowLeft className="size-4 mr-1" />Voltar</Link></Button>
        </div>
      } />
      <PageBody>
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <Card label="Total do lote" value={money(Number(b.total_value))} />
          <Card label="Glosa" value={money(totalGlosa)} />
          <Card label="Recebido" value={money(paid)} />
          <Card label="Saldo" value={money(balance)} highlight />
        </div>

        <h3 className="text-sm font-semibold mb-2">Pedidos do lote</h3>
        <div className="rounded-md border bg-card overflow-hidden mb-6">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Pedido</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Paciente</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="text-right">Glosa</TableHead>
              <TableHead>Código TISS</TableHead>
              <TableHead>Observação</TableHead>
              <TableHead className="w-24" />
            </TableRow></TableHeader>
            <TableBody>
              {data.items.map((i: any) => (
                <TableRow key={i.id}>
                  <TableCell className="tabular-nums">#{i.order?.order_number}</TableCell>
                  <TableCell className="tabular-nums text-xs">{new Date(i.order?.order_date).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell>{i.order?.patient?.name}</TableCell>
                  <TableCell className="text-right tabular-nums">R$ {Number(i.value).toFixed(2)}</TableCell>
                  <TableCell className="text-right tabular-nums">R$ {Number(i.glosa_value || 0).toFixed(2)}</TableCell>
                  <TableCell className="text-xs">
                    {i.glosa_codigo ? <><span className="font-mono tabular-nums">{i.glosa_codigo}</span>{i.glosa?.descricao && <span className="text-muted-foreground"> — {i.glosa.descricao}</span>}</> : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{i.glosa_reason ?? "—"}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" onClick={() => setEditing({ id: i.id, glosa_value: String(i.glosa_value ?? 0), glosa_reason: i.glosa_reason ?? "", glosa_codigo: i.glosa_codigo ?? null })}>Editar</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <h3 className="text-sm font-semibold mb-2">Recebimentos</h3>
        <div className="rounded-md border bg-card overflow-hidden">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Forma</TableHead>
              <TableHead>Parcela</TableHead>
              <TableHead className="text-right">Valor</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {data.payments.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell className="tabular-nums text-xs">{new Date(p.paid_at).toLocaleString("pt-BR")}</TableCell>
                  <TableCell>{p.method}</TableCell>
                  <TableCell className="tabular-nums">{p.installment_number}</TableCell>
                  <TableCell className="text-right tabular-nums">R$ {Number(p.amount).toFixed(2)}</TableCell>
                </TableRow>
              ))}
              {data.payments.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Nenhum recebimento registrado.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </PageBody>

      {payOpen && (
        <BatchPaymentDialog
          onClose={() => setPayOpen(false)}
          batchId={batchId}
          companyId={b.company_id}
          suggested={balance}
          nextInstallment={data.payments.length + 1}
        />
      )}

      {editing && (
        <Dialog open onOpenChange={(v) => !v && setEditing(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Editar glosa</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid gap-1.5"><Label>Valor da glosa (R$)</Label><Input value={editing.glosa_value} onChange={(e) => setEditing({ ...editing, glosa_value: e.target.value })} inputMode="decimal" /></div>
              <div className="grid gap-1.5"><Label>Código TISS de glosa</Label>
                <TissGlosaCombobox value={editing.glosa_codigo} onChange={(codigo) => setEditing({ ...editing, glosa_codigo: codigo })} />
              </div>
              <div className="grid gap-1.5"><Label>Observação (opcional)</Label><Input value={editing.glosa_reason} onChange={(e) => setEditing({ ...editing, glosa_reason: e.target.value })} placeholder="Complemento à glosa TISS..." /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
              <Button onClick={() => updateItem.mutate({ id: editing.id, glosa_value: Number(editing.glosa_value.replace(",", ".")) || 0, glosa_reason: editing.glosa_reason.trim() || null, glosa_codigo: editing.glosa_codigo })} disabled={updateItem.isPending}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function BatchPaymentDialog({ onClose, batchId, companyId, suggested, nextInstallment }:
  { onClose: () => void; batchId: string; companyId: string; suggested: number; nextInstallment: number }) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState(suggested.toFixed(2));
  const [method, setMethod] = useState("boleto");
  const [installment, setInstallment] = useState(String(nextInstallment));

  const mut = useMutation({
    mutationFn: async () => {
      const val = Number(amount.replace(",", "."));
      if (!val || val <= 0) throw new Error("Valor inválido");
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("payments").insert({
        company_id: companyId,
        billing_batch_id: batchId,
        amount: val,
        method: method as any,
        received_by: u.user?.id ?? null,
        installment_number: Number(installment) || 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Recebimento registrado");
      qc.invalidateQueries({ queryKey: ["batch", batchId] });
      qc.invalidateQueries({ queryKey: ["financeiro-lotes"] });
      qc.invalidateQueries({ queryKey: ["financeiro-dashboard"] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Registrar recebimento</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">Saldo: <span className="font-medium text-foreground tabular-nums">R$ {suggested.toFixed(2)}</span></div>
          <div className="grid gap-1.5"><Label>Valor (R$)</Label><Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" /></div>
          <div className="grid gap-1.5">
            <Label>Forma</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="dinheiro">Dinheiro</SelectItem>
                <SelectItem value="pix">PIX</SelectItem>
                <SelectItem value="cartao_debito">Cartão débito</SelectItem>
                <SelectItem value="cartao_credito">Cartão crédito</SelectItem>
                <SelectItem value="boleto">Boleto</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5"><Label>Parcela</Label><Input value={installment} onChange={(e) => setInstallment(e.target.value)} type="number" min={1} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>Registrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function money(v: number) { return `R$ ${v.toFixed(2)}`; }
function Card({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-md border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-xl font-semibold tabular-nums ${highlight ? "text-primary" : ""}`}>{value}</div>
    </div>
  );
}
