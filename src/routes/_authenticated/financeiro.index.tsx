import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, PageBody } from "@/components/PageHeader";
import { DollarSign, Landmark, Layers, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LucideIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/financeiro/")({
  head: () => ({ meta: [{ title: "Financeiro — LIS" }] }),
  component: FinanceiroDashboard,
});

function FinanceiroDashboard() {
  const { data } = useQuery({
    queryKey: ["financeiro-dashboard"],
    queryFn: async () => {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const [{ data: particular }, { data: batches }, { data: paidMonth }] = await Promise.all([
        supabase.from("orders").select("id,total_value,payment_status,insurance:insurance_plans!inner(is_particular)").eq("insurance.is_particular" as any, true).neq("payment_status", "pago").neq("status", "cancelado"),
        supabase.from("billing_batches").select("id,total_value,status").neq("status", "pago"),
        supabase.from("payments").select("amount,paid_at").gte("paid_at", monthStart),
      ]);

      // for batches subtract payments already received
      const batchIds = (batches ?? []).map(b => b.id);
      const { data: batchPayments } = batchIds.length
        ? await supabase.from("payments").select("billing_batch_id,amount").in("billing_batch_id", batchIds)
        : { data: [] as any[] };
      const paidByBatch = new Map<string, number>();
      (batchPayments ?? []).forEach((p: any) => paidByBatch.set(p.billing_batch_id, (paidByBatch.get(p.billing_batch_id) ?? 0) + Number(p.amount)));

      // for particular orders subtract payments
      const orderIds = (particular ?? []).map(o => o.id);
      const { data: orderPayments } = orderIds.length
        ? await supabase.from("payments").select("order_id,amount").in("order_id", orderIds)
        : { data: [] as any[] };
      const paidByOrder = new Map<string, number>();
      (orderPayments ?? []).forEach((p: any) => paidByOrder.set(p.order_id, (paidByOrder.get(p.order_id) ?? 0) + Number(p.amount)));

      const particularDue = (particular ?? []).reduce((s, o: any) => s + Math.max(0, Number(o.total_value) - (paidByOrder.get(o.id) ?? 0)), 0);
      const batchesDue = (batches ?? []).reduce((s, b: any) => s + Math.max(0, Number(b.total_value) - (paidByBatch.get(b.id) ?? 0)), 0);
      const receivedMonth = (paidMonth ?? []).reduce((s, p: any) => s + Number(p.amount), 0);

      return { particularDue, batchesDue, receivedMonth, particularCount: (particular ?? []).length, batchesCount: (batches ?? []).length };
    },
  });

  const total = (data?.particularDue ?? 0) + (data?.batchesDue ?? 0);

  return (
    <>
      <PageHeader title="Financeiro" description="Visão geral de recebimentos e pendências" actions={
        <div className="flex gap-2">
          <Button variant="outline" asChild><Link to="/financeiro/convenios">Convênios</Link></Button>
          <Button variant="outline" asChild><Link to="/financeiro/lotes">Lotes</Link></Button>
        </div>
      } />
      <PageBody>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat icon={DollarSign} label="A receber (total)" value={money(total)} sub="Particular + convênios" tone="warning" />
          <Stat icon={Landmark} label="A receber — particular" value={money(data?.particularDue ?? 0)} sub={`${data?.particularCount ?? 0} pedidos`} tone="info" />
          <Stat icon={Layers} label="A receber — convênios" value={money(data?.batchesDue ?? 0)} sub={`${data?.batchesCount ?? 0} lotes`} tone="info" />
          <Stat icon={TrendingUp} label="Recebido no mês" value={money(data?.receivedMonth ?? 0)} tone="success" />
        </div>
      </PageBody>
    </>
  );
}

function money(v: number) { return `R$ ${v.toFixed(2)}`; }

function Stat({ icon: Icon, label, value, sub, tone }: { icon: LucideIcon; label: string; value: string; sub?: string; tone: "info" | "success" | "warning" }) {
  const toneClass = {
    info: "bg-info/10 text-info",
    success: "bg-success/10 text-success",
    warning: "bg-warning/15 text-warning-foreground",
  }[tone];
  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <div className={`rounded-md p-2 ${toneClass}`}><Icon className="size-4" /></div>
      </div>
      <div className="mt-3 text-2xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}
