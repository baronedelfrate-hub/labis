import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, PageBody } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { ClipboardList, Clock, CheckCircle2, AlertTriangle, Plus } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — LIS" }] }),
  component: Dashboard,
});

function Dashboard() {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = useQuery({
    queryKey: ["dashboard", today],
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("id, status, is_urgent").eq("order_date", today);
      if (error) throw error;
      return data;
    },
  });

  const total = data?.length ?? 0;
  const abertos = data?.filter(o => o.status === "aberto").length ?? 0;
  const finalizados = data?.filter(o => o.status === "finalizado").length ?? 0;
  const urgentes = data?.filter(o => o.is_urgent).length ?? 0;

  return (
    <>
      <PageHeader title="Dashboard" description={`Movimento de hoje — ${new Date().toLocaleDateString("pt-BR")}`} actions={
        <Button asChild><Link to="/pedidos/novo"><Plus className="size-4 mr-1" />Novo pedido</Link></Button>
      } />
      <PageBody>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat icon={ClipboardList} label="Pedidos hoje" value={total} tone="primary" />
          <Stat icon={Clock} label="Em aberto" value={abertos} tone="info" />
          <Stat icon={CheckCircle2} label="Finalizados" value={finalizados} tone="success" />
          <Stat icon={AlertTriangle} label="Urgentes" value={urgentes} tone="warning" />
        </div>
      </PageBody>
    </>
  );
}

function Stat({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: number; tone: "primary" | "info" | "success" | "warning" }) {
  const toneClass = {
    primary: "bg-primary/10 text-primary",
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
      <div className="mt-3 text-3xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
