import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { PageHeader, PageBody } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, PackageCheck } from "lucide-react";
import { cn } from "@/lib/utils";

type View = "todos" | "prontos" | "andamento";
const today = () => new Date().toISOString().slice(0, 10);

export const Route = createFileRoute("/_authenticated/pedidos/")({
  head: () => ({ meta: [{ title: "Pedidos — LIS" }] }),
  // visao: todos | prontos (finalizados, prontos para entrega) | andamento. data vazia = todas as datas.
  validateSearch: (s: Record<string, unknown>): { visao?: View; data?: string } => ({
    visao: s.visao === "prontos" || s.visao === "andamento" ? s.visao : undefined,
    data: typeof s.data === "string" && /^(\d{4}-\d{2}-\d{2}|todas)$/.test(s.data) ? s.data : undefined,
  }),
  component: Orders,
});

const statusLabel: Record<string, string> = {
  aberto: "Aberto", coletado: "Coletado", em_analise: "Em análise", finalizado: "Pronto", cancelado: "Cancelado",
};
const statusStyle: Record<string, string> = {
  finalizado: "bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200",
  cancelado: "bg-muted text-muted-foreground line-through",
};
const payLabel: Record<string, string> = { pendente: "Pendente", parcial: "Parcial", pago: "Pago" };
const payStyle: Record<string, string> = {
  pendente: "bg-muted text-muted-foreground",
  parcial: "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200",
  pago: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200",
};
const LIMIT = 200;

const views: { key: View; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "prontos", label: "Prontos para entrega" },
  { key: "andamento", label: "Em andamento" },
];

function Orders() {
  const navigate = useNavigate();
  const sp = Route.useSearch();
  const view: View = sp.visao ?? "todos";
  // Prontos para entrega vale para qualquer dia: sem data escolhida, mostra todas.
  const date = sp.data === "todas" ? "" : (sp.data ?? (view === "prontos" ? "" : today()));
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  useEffect(() => { const t = setTimeout(() => setTerm(search.trim()), 300); return () => clearTimeout(t); }, [search]);

  const setView = (v: View) => navigate({ to: "/pedidos", search: { visao: v === "todos" ? undefined : v, data: v === "prontos" ? "todas" : today() }, replace: true });
  const setDate = (d: string) => navigate({ to: "/pedidos", search: { visao: sp.visao, data: d || "todas" }, replace: true });
  // Buscar por nome ou número ignora a data, para achar paciente de outro dia.
  const searching = term.length > 0;

  const { data, isLoading } = useQuery({
    queryKey: ["orders", view, date, term],
    queryFn: async () => {
      let q = supabase
        .from("orders")
        .select("id, order_number, order_date, status, is_urgent, total_value, payment_status, patient:patients!inner(id,name,code)")
        .order("order_date", { ascending: false })
        .order("order_number", { ascending: false })
        .limit(LIMIT);
      if (view === "prontos") q = q.eq("status", "finalizado");
      else if (view === "andamento") q = q.in("status", ["aberto", "coletado", "em_analise"]);
      if (searching) {
        if (/^\d+$/.test(term)) q = q.eq("order_number", Number(term));
        else q = q.ilike("patient.name", `%${term}%`);
      } else if (date) q = q.eq("order_date", date);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const rows = data ?? [];
  const scope = searching ? "em todas as datas" : date ? `em ${date.split("-").reverse().join("/")}` : "de todas as datas";

  return (
    <>
      <PageHeader title="Pedidos" description={view === "prontos" ? "Pedidos com todos os exames liberados, prontos para o laudo" : "Pedidos do laboratório"} actions={
        <Button asChild><Link to="/pedidos/novo"><Plus className="size-4 mr-1" />Novo pedido</Link></Button>
      } />
      <PageBody>
        <div className="mb-3 flex flex-wrap gap-2">
          {views.map(v => (
            <Button key={v.key} size="sm" variant={view === v.key ? "default" : "outline"} onClick={() => setView(v.key)}>
              {v.key === "prontos" && <PackageCheck className="mr-1 size-4" />}{v.label}
            </Button>
          ))}
        </div>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative max-w-sm flex-1 min-w-52">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Paciente ou nº do pedido" className="pl-9" />
          </div>
          <Input type="date" value={date} onChange={e => setDate(e.target.value)} disabled={searching} className="w-auto" />
          {date && !searching && <Button variant="ghost" size="sm" onClick={() => setDate("")}>Todas as datas</Button>}
        </div>
        <p className="mb-2 text-xs text-muted-foreground" data-testid="scope">
          {isLoading ? "Carregando..." : `${rows.length} pedido(s) ${scope}`}{rows.length >= LIMIT ? ` (mostrando os ${LIMIT} mais recentes)` : ""}
        </p>
        <div className="rounded-md border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nº</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Paciente</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead>Urg.</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>}
              {!isLoading && rows.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{view === "prontos" ? "Nenhum pedido pronto para entrega." : "Nenhum pedido encontrado."}</TableCell></TableRow>}
              {rows.map(o => {
                const p = o.patient as { name: string; code: string } | null;
                return (
                  <TableRow key={o.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate({ to: "/pedidos/$orderId", params: { orderId: o.id } })}>
                    <TableCell className="font-medium tabular-nums">#{o.order_number}</TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">{String(o.order_date).split("-").reverse().join("/")}</TableCell>
                    <TableCell>{p?.name} <span className="text-muted-foreground text-xs">({p?.code})</span></TableCell>
                    <TableCell><Badge variant="outline" className={cn(statusStyle[o.status])}>{statusLabel[o.status] ?? o.status}</Badge></TableCell>
                    <TableCell><Badge variant="outline" className={cn(payStyle[o.payment_status])}>{payLabel[o.payment_status] ?? o.payment_status}</Badge></TableCell>
                    <TableCell>{o.is_urgent && <Badge className="bg-warning text-warning-foreground">Urgente</Badge>}</TableCell>
                    <TableCell className="text-right tabular-nums">R$ {Number(o.total_value).toFixed(2)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </PageBody>
    </>
  );
}
