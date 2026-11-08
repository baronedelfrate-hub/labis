import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, PageBody } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { CheckCheck, PackageCheck, XCircle, AlertTriangle, Printer, ScanBarcode, CheckCircle2 } from "lucide-react";
import { parseSampleBarcode, sectorCodeFor, candidateSampleNumbers } from "@/lib/sample-barcode";
import { SampleHistory } from "@/components/SampleHistory";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/coleta")({
  head: () => ({ meta: [{ title: "Coleta — DFLAB" }] }),
  component: ColetaPage,
});

const sampleBadge: Record<string, string> = {
  pendente: "bg-muted text-muted-foreground",
  coletada: "bg-amber-100 text-amber-900",
  recebida: "bg-sky-100 text-sky-900",
  rejeitada: "bg-red-100 text-red-900",
};

function ColetaPage() {
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [scanValue, setScanValue] = useState("");
  const [lastScan, setLastScan] = useState<{ kind: "ok" | "info" | "error"; text: string } | null>(null);
  const scanRef = useRef<HTMLInputElement>(null);

  const { data = [] } = useQuery({
    queryKey: ["coleta", date],
    queryFn: async () => {
      const { data: orders, error } = await supabase
        .from("orders")
        .select("id, order_number, is_urgent, patient:patients(name,code), samples:samples(id,sample_number,material,material_seq,sector,status,rejection_reason,collected_at)")
        .eq("order_date", date)
        .order("order_number", { ascending: false });
      if (error) throw error;
      return orders ?? [];
    },
  });

  const collect = useMutation({
    mutationFn: async (sampleId: string) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("samples").update({
        status: "coletada", collected_at: new Date().toISOString(), collected_by: u.user?.id ?? null,
      }).eq("id", sampleId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["coleta"] }); qc.invalidateQueries({ queryKey: ["sample-events"] }); toast.success("Amostra coletada"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const receive = useMutation({
    mutationFn: async (sampleId: string) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("samples").update({
        status: "recebida", received_at: new Date().toISOString(), received_by: u.user?.id ?? null,
      }).eq("id", sampleId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["coleta"] }); qc.invalidateQueries({ queryKey: ["sample-events"] }); toast.success("Amostra recebida no setor"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const reject = useMutation({
    mutationFn: async () => {
      if (!rejectingId) return;
      const { error } = await supabase.from("samples").update({
        status: "rejeitada", rejection_reason: rejectReason.trim() || "Sem motivo informado",
      }).eq("id", rejectingId);
      if (error) throw error;
    },
    onSuccess: () => {
      setRejectingId(null); setRejectReason("");
      qc.invalidateQueries({ queryKey: ["coleta"] }); qc.invalidateQueries({ queryKey: ["sample-events"] });
      toast.success("Amostra rejeitada. Os exames voltaram para nova coleta.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Triagem por leitor de código de barras: o leitor "digita" os 10 dígitos e aperta Enter.
  const scan = useMutation({
    mutationFn: async (raw: string) => {
      const parsed = parseSampleBarcode(raw);
      if (!parsed) throw new Error("Código inválido: a etiqueta da amostra tem 10 dígitos.");
      const { data: sectors, error: be } = await supabase.from("barcode_sectors").select("sector, code");
      if (be) throw be;
      const codes = new Map<string, number>((sectors ?? []).map((x: any) => [x.sector as string, x.code as number]));
      const { data: rows, error } = await supabase
        .from("samples")
        .select("id, sample_number, sector, material, material_seq, status, orders!inner(order_number, patient:patients(name))")
        .in("sample_number", candidateSampleNumbers(parsed.sample)) // o código só tem 1 dígito de amostra (1 a 9)
        .eq("orders.order_number", parsed.orderSeq);
      if (error) throw error;
      const found = (rows ?? []) as any[];
      if (found.length === 0) throw new Error(`Amostra não encontrada (pedido ${parsed.orderSeq}, amostra ${parsed.sample}).`);
      // o setor do código tem que ser o da amostra; entre as que servem, prefere a que não foi rejeitada
      const sameSector = found.filter((r) => sectorCodeFor(r.sector, codes) === parsed.sectorCode);
      const s = sameSector.find((r) => r.status !== "rejeitada") ?? sameSector[0] ?? found[0];
      const tube = found.filter((r) => r.material === s.material && r.status !== "rejeitada").length > 1 ? ` · tubo ${s.material_seq}` : "";
      const who = `#${s.orders?.order_number} · ${s.orders?.patient?.name ?? ""} · ${s.material}${tube}${s.sector ? ` (${s.sector})` : ""}`;
      if (sectorCodeFor(s.sector, codes) !== parsed.sectorCode) {
        throw new Error(`O setor do código (${String(parsed.sectorCode).padStart(2, "0")}) não confere com o da amostra (${s.sector ?? "sem setor"}). ${who}`);
      }
      if (s.status === "rejeitada") throw new Error(`Amostra rejeitada — precisa de nova coleta. ${who}`);
      if (s.status === "pendente") throw new Error(`Amostra ainda não foi coletada. Colete primeiro. ${who}`);
      if (s.status === "recebida") return { kind: "info" as const, text: `Já estava recebida. ${who}` };
      const { data: u } = await supabase.auth.getUser();
      const { error: ue } = await supabase.from("samples").update({
        status: "recebida", received_at: new Date().toISOString(), received_by: u.user?.id ?? null,
      }).eq("id", s.id);
      if (ue) throw ue;
      return { kind: "ok" as const, text: `Recebida no setor. ${who}` };
    },
    onSuccess: (r) => { setLastScan(r); qc.invalidateQueries({ queryKey: ["coleta"] }); qc.invalidateQueries({ queryKey: ["sample-events"] }); },
    onError: (e: Error) => setLastScan({ kind: "error", text: e.message }),
    onSettled: () => { setScanValue(""); scanRef.current?.focus(); },
  });

  const collectOrder = useMutation({
    mutationFn: async (samples: { id: string; status: string }[]) => {
      const pending = samples.filter((s) => s.status === "pendente");
      if (!pending.length) return;
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("samples").update({
        status: "coletada", collected_at: new Date().toISOString(), collected_by: u.user?.id ?? null,
      }).in("id", pending.map((s) => s.id));
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["coleta"] }); qc.invalidateQueries({ queryKey: ["sample-events"] }); toast.success("Amostras coletadas"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader title="Coleta de amostras" description="Fluxo de coleta e triagem por pedido" actions={
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-auto" />
      } />
      <PageBody>
        <form
          className="mb-4 rounded-md border bg-card p-3 space-y-2"
          onSubmit={(e) => { e.preventDefault(); if (scanValue.trim() && !scan.isPending) scan.mutate(scanValue); }}
        >
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <ScanBarcode className="size-4" />Triagem por código de barras — leia a etiqueta da amostra
          </label>
          <Input
            ref={scanRef}
            value={scanValue}
            onChange={(e) => setScanValue(e.target.value)}
            inputMode="numeric"
            autoComplete="off"
            placeholder="Passe o leitor na etiqueta (10 dígitos) e aperte Enter"
            className="font-mono tracking-widest"
          />
          {lastScan && (
            <div
              role="status"
              className={cn(
                "rounded border px-3 py-2 text-sm flex items-start gap-2",
                lastScan.kind === "ok" && "border-emerald-300 bg-emerald-50 text-emerald-900",
                lastScan.kind === "info" && "border-sky-300 bg-sky-50 text-sky-900",
                lastScan.kind === "error" && "border-red-300 bg-red-50 text-red-900",
              )}
            >
              {lastScan.kind === "error" ? <AlertTriangle className="size-4 mt-0.5 shrink-0" /> : <CheckCircle2 className="size-4 mt-0.5 shrink-0" />}
              <span>{lastScan.text}</span>
            </div>
          )}
        </form>
        {data.length === 0 && <div className="text-muted-foreground text-sm">Sem pedidos nesta data.</div>}
        <div className="space-y-4">
          {data.map((o: any) => {
            const samples = (o.samples ?? []) as any[];
            const activeSamples = samples.filter((s) => s.status !== "rejeitada");
            const hasRejected = samples.some((s) => s.status === "rejeitada");
            const hasRecoleta = hasRejected && activeSamples.some((s) => s.status === "pendente");
            const allDone = activeSamples.every((s) => s.status === "recebida");
            if (allDone && !hasRecoleta) return null;
            return (
              <section key={o.id} className="rounded-md border bg-card p-4">
                <header className="flex flex-wrap items-center gap-3 mb-3">
                  <div className="font-semibold">#{o.order_number}</div>
                  <div className="text-sm">{o.patient?.name} <span className="text-muted-foreground">· {o.patient?.code}</span></div>
                  {o.is_urgent && <Badge className="bg-warning text-warning-foreground">Urgente</Badge>}
                  {hasRecoleta && <Badge className="bg-red-100 text-red-900"><AlertTriangle className="size-3 mr-1" />Recoleta</Badge>}
                  <div className="ml-auto flex gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link to="/pedidos/$orderId/etiquetas" params={{ orderId: o.id }}><Printer className="size-4 mr-1" />Etiquetas</Link>
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => collectOrder.mutate(activeSamples)} disabled={!activeSamples.some((s) => s.status === "pendente")}>
                      <CheckCheck className="size-4 mr-1" />Coletar todas
                    </Button>
                  </div>
                </header>
                <div className="grid gap-2">
                  {activeSamples.map((s: any) => (
                    <div key={s.id} className="rounded-md border bg-background">
                    <div className="flex flex-wrap items-center gap-3 px-3 py-2">
                      <div className="tabular-nums text-xs w-10">#{s.sample_number}</div>
                      <div className="text-sm min-w-0 flex-1">
                        <div className="font-medium truncate">
                          {s.material}
                          {activeSamples.filter((x) => x.material === s.material).length > 1 && (
                            <span className="ml-1 text-xs font-normal text-muted-foreground">· tubo {s.material_seq}</span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">{s.sector ?? "sem setor"}</div>
                      </div>
                      <Badge variant="outline" className={cn(sampleBadge[s.status])}>{s.status}</Badge>
                      <div className="flex gap-1">
                        {s.status === "pendente" && (
                          <Button size="sm" variant="outline" onClick={() => collect.mutate(s.id)}>Coletar</Button>
                        )}
                        {s.status === "coletada" && (
                          <Button size="sm" variant="outline" onClick={() => receive.mutate(s.id)}><PackageCheck className="size-4 mr-1" />Receber</Button>
                        )}
                        {(s.status === "pendente" || s.status === "coletada") && (
                          <Button size="sm" variant="ghost" onClick={() => { setRejectingId(s.id); setRejectReason(""); }}>
                            <XCircle className="size-4 mr-1" />Rejeitar
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="px-3 pb-2"><SampleHistory sampleId={s.id} /></div>
                    </div>
                  ))}
                  {hasRejected && (
                    <details className="text-xs text-muted-foreground mt-1">
                      <summary className="cursor-pointer">Amostras rejeitadas ({samples.filter((s) => s.status === "rejeitada").length})</summary>
                      <div className="pl-4 pt-1 space-y-1">
                        {samples.filter((s) => s.status === "rejeitada").map((s) => (
                          <div key={s.id}>#{s.sample_number} · {s.material} — {s.rejection_reason ?? "sem motivo"}</div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </PageBody>

      <Dialog open={!!rejectingId} onOpenChange={(v) => !v && setRejectingId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rejeitar amostra</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">Motivo da rejeição</label>
            <Textarea autoFocus value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Ex: hemólise, volume insuficiente, tubo trocado..." />
            <p className="text-xs text-muted-foreground">Os exames vinculados voltarão para pendente e aparecerão para nova coleta.</p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejectingId(null)}>Cancelar</Button>
            <Button onClick={() => reject.mutate()} disabled={reject.isPending}>Rejeitar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
