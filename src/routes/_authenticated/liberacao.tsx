import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, PageBody } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useMyRoles } from "@/hooks/useMyRoles";
import { ShieldAlert, CheckCheck, AlertTriangle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getFlag, isPanic, flagLabel, type ResultFlag } from "@/lib/result-flags";
import { cn } from "@/lib/utils";

const flagLimits = (r: any) => ({ min: r.reference_min, max: r.reference_max, panicMin: r.panic_min, panicMax: r.panic_max });

// Alerta de cada valor: pânico (vermelho) ou fora da faixa (âmbar)
function FlagBadge({ flag }: { flag: ResultFlag }) {
  if (flag === "normal") return null;
  return (
    <span className={cn(
      "ml-2 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold align-middle",
      isPanic(flag) ? "bg-red-600 text-white" : "bg-amber-100 text-amber-900",
    )}>
      {isPanic(flag) && <AlertTriangle className="size-3" />}{flagLabel(flag)}
    </span>
  );
}

export const Route = createFileRoute("/_authenticated/liberacao")({
  head: () => ({ meta: [{ title: "Liberação — LIS" }] }),
  component: LiberacaoPage,
});

function LiberacaoPage() {
  const qc = useQueryClient();
  const { canRelease } = useMyRoles();
  const [reviewerByOrder, setReviewerByOrder] = useState<Record<string, string>>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null));
  }, []);

  const { data = [] } = useQuery({
    queryKey: ["pending-release"],
    enabled: canRelease,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("results")
        .select("id, value, unit, reference_min, reference_max, panic_min, panic_max, observation, entered_at, order_item:order_items(id, exam:exams(code,name,sector), order:orders(id,order_number,patient:patients(name,code))), values:result_values(id, value, unit, reference_min, reference_max, panic_min, panic_max, reference_display_text, parameter:exam_parameters(name, display_order, group_label))")
        .eq("released", false);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: reviewers = [] } = useQuery({
    queryKey: ["reviewers"],
    enabled: canRelease,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("user_id, role, profile:profiles(id, full_name, professional_council, professional_registration)")
        .in("role", ["bioquimico", "admin"]);
      const map = new Map<string, any>();
      for (const r of (data ?? []) as any[]) {
        if (r.profile) map.set(r.profile.id, r.profile);
      }
      return Array.from(map.values());
    },
  });

  const grouped = useMemo(() => {
    const map = new Map<string, { order_number: number; patient: string; orderId: string; rows: any[]; panicCount: number }>();
    for (const r of data as any[]) {
      const orderId = r.order_item?.order?.id;
      if (!orderId) continue;
      const entry = map.get(orderId) ?? { order_number: r.order_item.order.order_number, patient: r.order_item.order.patient?.name, orderId, rows: [] as any[], panicCount: 0 };
      entry.rows.push(r);
      const flags: ResultFlag[] = (r.values ?? []).length
        ? (r.values as any[]).map((v) => getFlag(v.value, flagLimits(v)))
        : [getFlag(r.value, flagLimits(r))];
      entry.panicCount += flags.filter(isPanic).length;
      map.set(orderId, entry);
    }
    // pedidos com valor de pânico primeiro
    return Array.from(map.values()).sort((a, b) => (b.panicCount > 0 ? 1 : 0) - (a.panicCount > 0 ? 1 : 0) || b.order_number - a.order_number);
  }, [data]);

  const release = useMutation({
    mutationFn: async ({ ids, reviewer }: { ids: string[]; reviewer: string | null }) => {
      const { error } = await supabase
        .from("results")
        .update({ released: true, reviewed_by: reviewer } as never)
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pending-release"] });
      toast.success("Resultado(s) liberado(s)");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!canRelease) {
    return (
      <PageBody>
        <div className="rounded-md border bg-card p-6 flex items-center gap-3 text-muted-foreground">
          <ShieldAlert className="size-5" />Sem permissão para liberar resultados.
        </div>
      </PageBody>
    );
  }

  return (
    <>
      <PageHeader title="Liberação de resultados" description="Resultados lançados aguardando liberação" />
      <PageBody>
        {grouped.length === 0 && <div className="text-muted-foreground text-sm">Nenhum resultado aguardando liberação.</div>}
        <div className="space-y-3">
          {grouped.map((g) => {
            const reviewer = reviewerByOrder[g.orderId] ?? currentUserId ?? "";
            return (
              <section key={g.orderId} className={cn("rounded-md border bg-card p-4", g.panicCount > 0 && "border-red-400 ring-1 ring-red-300")}>
                <header className="flex items-center gap-3 mb-3 flex-wrap">
                  <div className="font-semibold">#{g.order_number}</div>
                  <div className="text-sm text-muted-foreground">{g.patient}</div>
                  <Badge variant="outline">{g.rows.length} resultado(s)</Badge>
                  {g.panicCount > 0 && (
                    <span className="inline-flex items-center gap-1 rounded bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">
                      <AlertTriangle className="size-3.5" />{g.panicCount} valor(es) de PÂNICO
                    </span>
                  )}
                  <div className="w-full sm:w-auto sm:ml-auto flex flex-wrap items-center gap-2">
                    <label className="text-xs text-muted-foreground w-full sm:w-auto">Revisado por</label>
                    <Select value={reviewer} onValueChange={(v) => setReviewerByOrder((s) => ({ ...s, [g.orderId]: v }))}>
                      <SelectTrigger className="w-full sm:w-56 h-8"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                      <SelectContent>
                        {(reviewers as any[]).map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.full_name}{p.professional_council ? ` — ${p.professional_council} ${p.professional_registration ?? ""}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button size="sm" onClick={() => release.mutate({ ids: g.rows.map((r) => r.id), reviewer: reviewer || null })} disabled={release.isPending}>
                      <CheckCheck className="size-4 mr-1" />Liberar pedido
                    </Button>
                  </div>
                </header>
                <div className="grid gap-1">
                  {g.rows.map((r: any) => {
                    const ex = r.order_item?.exam;
                    const vals = ((r.values ?? []) as any[]).slice().sort((a, b) => (a.parameter?.display_order ?? 0) - (b.parameter?.display_order ?? 0));
                    const ref = r.reference_min != null || r.reference_max != null
                      ? `${r.reference_min ?? "—"} — ${r.reference_max ?? "—"} ${r.unit ?? ""}`
                      : "—";
                    const simpleFlag = getFlag(r.value, flagLimits(r));
                    return (
                      <div key={r.id} className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-start px-3 py-2 rounded border bg-background">
                        <div className="min-w-0">
                          <div className="text-xs text-muted-foreground">{ex?.code} · {ex?.sector ?? "—"}</div>
                          <div className="text-sm font-medium">{ex?.name}</div>
                          {vals.length > 0 ? (
                            <div className="mt-1.5 rounded border divide-y text-sm">
                              {vals.map((v) => {
                                const f = getFlag(v.value, flagLimits(v));
                                return (
                                  <div key={v.id} className={cn("grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_150px_1fr] gap-x-3 px-2 py-1", isPanic(f) && "bg-red-50")}>
                                    <div>{v.parameter?.name ?? "—"}</div>
                                    <div className={cn("tabular-nums font-medium", isPanic(f) && "text-red-700", f !== "normal" && !isPanic(f) && "text-amber-800")}>
                                      {v.value} <span className="text-xs font-normal text-muted-foreground">{v.unit ?? ""}</span>
                                      <FlagBadge flag={f} />
                                    </div>
                                    <div className="text-xs text-muted-foreground col-span-2 sm:col-span-1">Ref: {v.reference_display_text ?? "—"}</div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="mt-0.5 flex flex-wrap items-baseline gap-x-4">
                              <div className={cn("font-medium tabular-nums", isPanic(simpleFlag) && "text-red-700")}>
                                {r.value} <span className="text-xs font-normal text-muted-foreground">{r.unit ?? ""}</span>
                                <FlagBadge flag={simpleFlag} />
                              </div>
                              <div className="text-xs text-muted-foreground">Ref: {ref}</div>
                            </div>
                          )}
                          {r.observation && <div className="text-xs text-muted-foreground mt-1">{r.observation}</div>}
                        </div>
                        <Button size="sm" variant="outline" onClick={() => release.mutate({ ids: [r.id], reviewer: reviewer || null })} disabled={release.isPending}>Liberar</Button>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </PageBody>
    </>
  );
}
