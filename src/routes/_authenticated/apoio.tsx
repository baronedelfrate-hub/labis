import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import { PageHeader, PageBody } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Send, Undo2, ClipboardEdit } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSupportReturns, type SupportReturn } from "@/hooks/useSupportReturns";
import { delayLabel, type DelayState } from "@/lib/support-delay";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Tab = "enviar" | "retorno" | "enviadas";

export const Route = createFileRoute("/_authenticated/apoio")({
  head: () => ({ meta: [{ title: "Envio ao apoio — LIS" }] }),
  validateSearch: (s: Record<string, unknown>): { aba?: Tab } => ({
    aba: s.aba === "retorno" || s.aba === "enviadas" ? s.aba : undefined,
  }),
  component: SupportPage,
});

type PendingItem = {
  id: string;
  order: { id: string; order_number: number; patient: { name: string; code: string } | null } | null;
  exam: { id: string; code: string; name: string; material: string | null; support_lab_id: string } | null;
  sample: { sample_number: number; material: string | null } | null;
  support_shipment_items: unknown;
};

const hasShipment = (x: unknown) => (Array.isArray(x) ? x.length > 0 : !!x);
const fmt = (d: string) => new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

function SupportPage() {
  const navigate = useNavigate();
  const { aba } = Route.useSearch();
  const tab: Tab = aba ?? "enviar";
  const { data: returns = [] } = useSupportReturns();
  const late = returns.filter((r) => r.delay.state === "atrasado").length;
  return (
    <>
      <PageHeader title="Envio ao apoio" description="Exames terceirizados: monte a remessa de cada laboratório de apoio e acompanhe o retorno" />
      <PageBody>
        <Tabs value={tab} onValueChange={(v) => navigate({ to: "/apoio", search: { aba: v === "enviar" ? undefined : (v as Tab) }, replace: true })}>
          <TabsList>
            <TabsTrigger value="enviar">A enviar</TabsTrigger>
            <TabsTrigger value="retorno" className="gap-1.5">
              Aguardando retorno
              {returns.length > 0 && (
                <span className={cn("rounded-full px-1.5 text-[11px] font-medium", late > 0 ? "bg-red-600 text-white" : "bg-muted text-muted-foreground")}>{returns.length}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="enviadas">Remessas enviadas</TabsTrigger>
          </TabsList>
          <TabsContent value="enviar" className="mt-4"><ToSend /></TabsContent>
          <TabsContent value="retorno" className="mt-4"><AwaitingReturn /></TabsContent>
          <TabsContent value="enviadas" className="mt-4"><Sent /></TabsContent>
        </Tabs>
      </PageBody>
    </>
  );
}

function ToSend() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const companyId = useCompanyId();
  const [deselected, setDeselected] = useState<Set<string>>(new Set());

  const { data: labs = [] } = useQuery({
    queryKey: ["support-labs-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("support_labs").select("id, name, turnaround_days, phone");
      if (error) throw error;
      return (data ?? []) as { id: string; name: string; turnaround_days: number | null; phone: string | null }[];
    },
  });

  const { data: pending = [], isLoading } = useQuery({
    queryKey: ["support-pending"],
    queryFn: async (): Promise<PendingItem[]> => {
      const { data, error } = await supabase
        .from("order_items")
        .select("id, order:orders!inner(id, order_number, status, patient:patients(name, code)), exam:exams!inner(id, code, name, material, support_lab_id), sample:samples(sample_number, material), support_shipment_items(id)")
        .eq("status", "coletado")
        .not("exam.support_lab_id", "is", null)
        .neq("order.status", "cancelado")
        .limit(1000);
      if (error) throw error;
      return ((data ?? []) as unknown as PendingItem[]).filter((r) => !hasShipment(r.support_shipment_items));
    },
  });

  const byLab = useMemo(() => {
    const m = new Map<string, PendingItem[]>();
    for (const r of pending) {
      const id = r.exam?.support_lab_id;
      if (!id) continue;
      m.set(id, [...(m.get(id) ?? []), r]);
    }
    for (const arr of m.values()) arr.sort((a, b) => (a.order?.order_number ?? 0) - (b.order?.order_number ?? 0));
    return m;
  }, [pending]);

  const send = useMutation({
    mutationFn: async ({ labId, itemIds }: { labId: string; itemIds: string[] }) => {
      if (!companyId) throw new Error("Sem empresa");
      const { data: u } = await supabase.auth.getUser();
      const { data: ship, error } = await supabase.from("support_shipments")
        .insert({ company_id: companyId, support_lab_id: labId, sent_by: u.user?.id ?? null }).select("id").single();
      if (error) throw error;
      const { error: ie } = await supabase.from("support_shipment_items").insert(itemIds.map((order_item_id) => ({ shipment_id: ship.id, order_item_id })));
      if (ie) {
        await supabase.from("support_shipments").delete().eq("id", ship.id); // não deixa remessa vazia
        throw ie;
      }
      return ship.id as string;
    },
    onSuccess: (id) => {
      toast.success("Remessa criada e marcada como enviada");
      qc.invalidateQueries({ queryKey: ["support-pending"] });
      qc.invalidateQueries({ queryKey: ["support-returns"] });
      qc.invalidateQueries({ queryKey: ["support-shipments"] });
      qc.invalidateQueries({ queryKey: ["pending-results"] });
      navigate({ to: "/apoio/romaneio/$shipmentId", params: { shipmentId: id } });
    },
    onError: (e: Error) => toast.error(e.message.includes("duplicate") ? "Algum exame já está em outra remessa. Atualize a tela." : e.message),
  });

  if (isLoading) return <div className="text-muted-foreground">Carregando...</div>;
  if (byLab.size === 0) {
    return (
      <div className="rounded-md border bg-card p-6 text-sm text-muted-foreground">
        Nenhum exame de apoio aguardando envio. Eles aparecem aqui depois da coleta, para os exames ligados a um
        laboratório de apoio em <Link to="/cadastros/exames" className="underline">Cadastros &gt; Exames</Link>.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {Array.from(byLab.entries()).map(([labId, items]) => {
        const lab = labs.find((l) => l.id === labId);
        const chosen = items.filter((i) => !deselected.has(i.id));
        return (
          <section key={labId} className="rounded-md border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b p-4">
              <div>
                <h2 className="font-semibold">{lab?.name ?? "Laboratório de apoio"}</h2>
                <p className="text-xs text-muted-foreground">
                  {items.length} exame(s) aguardando envio{lab?.turnaround_days != null ? ` · prazo ${lab.turnaround_days} dia(s)` : ""}{lab?.phone ? ` · ${lab.phone}` : ""}
                </p>
              </div>
              <Button disabled={chosen.length === 0 || send.isPending} onClick={() => send.mutate({ labId, itemIds: chosen.map((i) => i.id) })}>
                <Send className="mr-1 size-4" />Criar remessa e marcar como enviada ({chosen.length})
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>Pedido</TableHead>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Exame</TableHead>
                  <TableHead>Amostra</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell>
                      <Checkbox
                        aria-label={`Incluir ${i.exam?.code} do pedido ${i.order?.order_number}`}
                        checked={!deselected.has(i.id)}
                        onCheckedChange={(v) => setDeselected((prev) => { const n = new Set(prev); if (v) n.delete(i.id); else n.add(i.id); return n; })}
                      />
                    </TableCell>
                    <TableCell className="tabular-nums">#{i.order?.order_number}</TableCell>
                    <TableCell>{i.order?.patient?.name} <span className="text-xs text-muted-foreground">({i.order?.patient?.code})</span></TableCell>
                    <TableCell><span className="font-mono tabular-nums mr-1">{i.exam?.code}</span>{i.exam?.name}</TableCell>
                    <TableCell className="text-muted-foreground">{i.sample ? `nº ${i.sample.sample_number}${i.sample.material ? ` · ${i.sample.material}` : ""}` : (i.exam?.material ?? "—")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
        );
      })}
    </div>
  );
}

const stateStyle: Record<DelayState, string> = {
  atrasado: "bg-red-100 text-red-900 border-red-200 dark:bg-red-900/30 dark:text-red-200",
  vence_hoje: "bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200",
  no_prazo: "bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200",
  sem_prazo: "bg-muted text-muted-foreground",
};
const fmtDay = (d: Date | null) => (d ? d.toLocaleDateString("pt-BR") : "—");

function AwaitingReturn() {
  const { data: rows = [], isLoading } = useSupportReturns();
  const [lab, setLab] = useState("__all__");
  const [onlyLate, setOnlyLate] = useState(false);

  const labs = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) m.set(r.labId ?? r.labName, r.labName);
    return Array.from(m.entries()).sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
  }, [rows]);
  const shown = rows.filter((r) => (lab === "__all__" || (r.labId ?? r.labName) === lab) && (!onlyLate || r.delay.state === "atrasado"));
  const late = rows.filter((r) => r.delay.state === "atrasado").length;
  const today = rows.filter((r) => r.delay.state === "vence_hoje").length;

  if (isLoading) return <div className="text-muted-foreground">Carregando...</div>;
  if (rows.length === 0) {
    return <div className="rounded-md border bg-card p-6 text-sm text-muted-foreground">Nenhum exame de apoio aguardando retorno. Eles aparecem aqui depois que a remessa é marcada como enviada, até o resultado ser lançado.</div>;
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="text-sm" data-testid="return-summary">
          <b>{rows.length}</b> aguardando
          {late > 0 && <> · <b className="text-red-700">{late} atrasado{late > 1 ? "s" : ""}</b></>}
          {today > 0 && <> · <b className="text-amber-700">{today} vence{today > 1 ? "m" : ""} hoje</b></>}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={onlyLate} onCheckedChange={(v) => setOnlyLate(!!v)} />Só atrasados</label>
          <Select value={lab} onValueChange={setLab}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Apoio" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos os apoios</SelectItem>
              {labs.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="rounded-md border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Situação</TableHead>
              <TableHead>Apoio</TableHead>
              <TableHead>Remessa</TableHead>
              <TableHead>Pedido</TableHead>
              <TableHead>Paciente</TableHead>
              <TableHead>Exame</TableHead>
              <TableHead>Enviado</TableHead>
              <TableHead>Previsto</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.length === 0 && <TableRow><TableCell colSpan={9} className="py-6 text-center text-muted-foreground">Nenhum exame com esses filtros.</TableCell></TableRow>}
            {shown.map((r: SupportReturn) => (
              <TableRow key={r.id}>
                <TableCell><Badge variant="outline" className={cn("whitespace-nowrap", stateStyle[r.delay.state])}>{delayLabel(r.delay)}</Badge></TableCell>
                <TableCell>{r.labName}</TableCell>
                <TableCell className="tabular-nums">#{r.shipmentNumber}</TableCell>
                <TableCell className="tabular-nums">#{r.orderNumber}</TableCell>
                <TableCell>{r.patientName} <span className="text-xs text-muted-foreground">({r.patientCode})</span></TableCell>
                <TableCell><span className="font-mono tabular-nums mr-1">{r.examCode}</span>{r.examName}</TableCell>
                <TableCell className="tabular-nums text-muted-foreground">{new Date(r.sentAt).toLocaleDateString("pt-BR")}</TableCell>
                <TableCell className="tabular-nums">{fmtDay(r.delay.due)}</TableCell>
                <TableCell className="text-right">
                  <Button asChild size="sm" variant="outline"><Link to="/resultados" search={{ item: r.orderItemId }}><ClipboardEdit className="mr-1 size-4" />Lançar</Link></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">Previsão = data do envio + prazo do laboratório de apoio (ou o prazo do exame, se o apoio não tiver), em dias corridos. Ajuste o prazo em Cadastros &gt; Laboratórios de apoio.</p>
    </div>
  );
}

type Shipment = {
  id: string; number: number; sent_at: string;
  support_lab: { name: string } | null;
  support_shipment_items: { id: string; order_item: { status: string } | null }[];
};

function Sent() {
  const qc = useQueryClient();
  const { data: returns = [] } = useSupportReturns();
  const lateByShipment = new Map<string, number>();
  for (const r of returns) if (r.delay.state === "atrasado") lateByShipment.set(r.shipmentId, (lateByShipment.get(r.shipmentId) ?? 0) + 1);
  const { data: shipments = [], isLoading } = useQuery({
    queryKey: ["support-shipments"],
    queryFn: async (): Promise<Shipment[]> => {
      const { data, error } = await supabase.from("support_shipments")
        .select("id, number, sent_at, support_lab:support_labs(name), support_shipment_items(id, order_item:order_items(status))")
        .order("number", { ascending: false }).limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as Shipment[];
    },
  });

  const undo = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("support_shipments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Envio desfeito. Os exames voltaram para a fila de envio.");
      qc.invalidateQueries({ queryKey: ["support-shipments"] });
      qc.invalidateQueries({ queryKey: ["support-pending"] });
      qc.invalidateQueries({ queryKey: ["support-returns"] });
      qc.invalidateQueries({ queryKey: ["pending-results"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="text-muted-foreground">Carregando...</div>;
  if (shipments.length === 0) return <div className="rounded-md border bg-card p-6 text-sm text-muted-foreground">Nenhuma remessa enviada ainda.</div>;

  return (
    <div className="rounded-md border bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-20">Nº</TableHead>
            <TableHead>Enviada em</TableHead>
            <TableHead>Apoio</TableHead>
            <TableHead>Exames</TableHead>
            <TableHead>Retorno</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {shipments.map((s) => {
            const total = s.support_shipment_items.length;
            const returned = s.support_shipment_items.filter((i) => i.order_item?.status && i.order_item.status !== "coletado").length;
            const canUndo = returned === 0;
            return (
              <TableRow key={s.id}>
                <TableCell className="tabular-nums font-medium">#{s.number}</TableCell>
                <TableCell className="tabular-nums">{fmt(s.sent_at)}</TableCell>
                <TableCell>{s.support_lab?.name}</TableCell>
                <TableCell className="tabular-nums">{total}</TableCell>
                <TableCell>
                  {returned >= total ? <Badge className="bg-emerald-100 text-emerald-900" variant="outline">Completo</Badge> : <Badge variant="outline">{returned} de {total} lançados</Badge>}
                  {(lateByShipment.get(s.id) ?? 0) > 0 && <Badge variant="outline" className={cn("ml-1", stateStyle.atrasado)}>{lateByShipment.get(s.id)} atrasado{(lateByShipment.get(s.id) ?? 0) > 1 ? "s" : ""}</Badge>}
                </TableCell>
                <TableCell className="text-right space-x-1">
                  <Button asChild size="sm" variant="outline"><Link to="/apoio/romaneio/$shipmentId" params={{ shipmentId: s.id }}><FileText className="mr-1 size-4" />Romaneio</Link></Button>
                  <Button size="sm" variant="ghost" disabled={!canUndo || undo.isPending} title={canUndo ? "" : "Já há resultado lançado nesta remessa"}
                    onClick={() => { if (confirm(`Desfazer o envio da remessa #${s.number}? Os exames voltam para a fila de envio.`)) undo.mutate(s.id); }}>
                    <Undo2 className="mr-1 size-4" />Desfazer
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
