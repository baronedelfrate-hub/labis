import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, PageBody } from "@/components/PageHeader";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/financeiro/lotes/")({
  head: () => ({ meta: [{ title: "Lotes — Financeiro" }] }),
  component: LotesList,
});

const statusStyles: Record<string, string> = {
  aberto: "bg-muted text-muted-foreground",
  fechado: "bg-sky-100 text-sky-900 dark:bg-sky-900/30 dark:text-sky-200",
  enviado: "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200",
  pago_parcial: "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200",
  pago: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200",
};

function LotesList() {
  const { data } = useQuery({
    queryKey: ["financeiro-lotes"],
    queryFn: async () => {
      const { data: batches } = await supabase.from("billing_batches")
        .select("id,reference_month,status,total_value,insurance:insurance_plans(name)")
        .order("reference_month", { ascending: false });
      const ids = (batches ?? []).map((b: any) => b.id);
      const { data: payments } = ids.length
        ? await supabase.from("payments").select("billing_batch_id,amount").in("billing_batch_id", ids)
        : { data: [] as any[] };
      const paidMap = new Map<string, number>();
      (payments ?? []).forEach((p: any) => paidMap.set(p.billing_batch_id, (paidMap.get(p.billing_batch_id) ?? 0) + Number(p.amount)));
      return (batches ?? []).map((b: any) => ({ ...b, paid: paidMap.get(b.id) ?? 0 }));
    },
  });

  return (
    <>
      <PageHeader title="Lotes de faturamento" description="Lotes gerados por convênio e mês de referência" actions={
        <Button variant="outline" asChild><Link to="/financeiro/convenios">Novo lote</Link></Button>
      } />
      <PageBody>
        <div className="rounded-md border bg-card overflow-hidden">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Convênio</TableHead>
              <TableHead>Referência</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Recebido</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
              <TableHead className="w-10" />
            </TableRow></TableHeader>
            <TableBody>
              {(data ?? []).map((b: any) => {
                const saldo = Math.max(0, Number(b.total_value) - b.paid);
                return (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.insurance?.name}</TableCell>
                    <TableCell className="tabular-nums">{formatMonth(b.reference_month)}</TableCell>
                    <TableCell><Badge variant="outline" className={statusStyles[b.status] ?? ""}>{b.status}</Badge></TableCell>
                    <TableCell className="text-right tabular-nums">R$ {Number(b.total_value).toFixed(2)}</TableCell>
                    <TableCell className="text-right tabular-nums">R$ {b.paid.toFixed(2)}</TableCell>
                    <TableCell className="text-right tabular-nums">R$ {saldo.toFixed(2)}</TableCell>
                    <TableCell><Link to="/financeiro/lotes/$batchId" params={{ batchId: b.id }}><ChevronRight className="size-4" /></Link></TableCell>
                  </TableRow>
                );
              })}
              {(data ?? []).length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum lote gerado.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </PageBody>
    </>
  );
}

function formatMonth(d: string) {
  const dt = new Date(d);
  return dt.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}
