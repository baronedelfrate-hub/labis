import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { PageHeader, PageBody } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/pedidos/")({
  head: () => ({ meta: [{ title: "Pedidos — LIS" }] }),
  component: Orders,
});

const statusLabel: Record<string, string> = {
  aberto: "Aberto", coletado: "Coletado", em_analise: "Em análise", finalizado: "Finalizado", cancelado: "Cancelado",
};

function Orders() {
  const [search, setSearch] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const { data, isLoading } = useQuery({
    queryKey: ["orders", date, search],
    queryFn: async () => {
      let q = supabase
        .from("orders")
        .select("id, order_number, order_date, status, is_urgent, total_value, patient:patients(id,name,code)")
        .eq("order_date", date)
        .order("order_number", { ascending: false });
      if (search) {
        if (/^\d+$/.test(search)) q = q.eq("order_number", Number(search));
      }
      const { data, error } = await q;
      if (error) throw error;
      const filtered = search && !/^\d+$/.test(search)
        ? data.filter(o => o.patient && (o.patient as { name: string }).name.toLowerCase().includes(search.toLowerCase()))
        : data;
      return filtered;
    },
  });

  return (
    <>
      <PageHeader title="Pedidos" description="Pedidos do dia" actions={
        <Button asChild><Link to="/pedidos/novo"><Plus className="size-4 mr-1" />Novo pedido</Link></Button>
      } />
      <PageBody>
        <div className="mb-4 flex flex-wrap gap-2">
          <div className="relative max-w-sm flex-1 min-w-52">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Paciente ou nº do pedido" className="pl-9" />
          </div>
          <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-auto" />
        </div>
        <div className="rounded-md border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nº</TableHead>
                <TableHead>Paciente</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Urg.</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>}
              {!isLoading && data?.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum pedido nesta data.</TableCell></TableRow>}
              {data?.map(o => {
                const p = o.patient as { name: string; code: string } | null;
                return (
                  <TableRow key={o.id} className="cursor-pointer hover:bg-muted/50" onClick={() => window.location.assign(`/pedidos/${o.id}`)}>
                    <TableCell className="font-medium tabular-nums">#{o.order_number}</TableCell>
                    <TableCell>{p?.name} <span className="text-muted-foreground text-xs">({p?.code})</span></TableCell>
                    <TableCell><Badge variant="outline">{statusLabel[o.status] ?? o.status}</Badge></TableCell>
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
