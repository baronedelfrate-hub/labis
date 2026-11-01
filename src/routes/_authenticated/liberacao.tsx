import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, PageBody } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useMyRoles } from "@/hooks/useMyRoles";
import { ShieldAlert, CheckCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

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
        .select("id, value, unit, reference_min, reference_max, observation, entered_at, order_item:order_items(id, exam:exams(code,name,sector), order:orders(id,order_number,patient:patients(name,code)))")
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
    const map = new Map<string, { order_number: number; patient: string; orderId: string; rows: any[] }>();
    for (const r of data as any[]) {
      const orderId = r.order_item?.order?.id;
      if (!orderId) continue;
      const entry = map.get(orderId) ?? { order_number: r.order_item.order.order_number, patient: r.order_item.order.patient?.name, orderId, rows: [] as any[] };
      entry.rows.push(r);
      map.set(orderId, entry);
    }
    return Array.from(map.values()).sort((a, b) => b.order_number - a.order_number);
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
              <section key={g.orderId} className="rounded-md border bg-card p-4">
                <header className="flex items-center gap-3 mb-3 flex-wrap">
                  <div className="font-semibold">#{g.order_number}</div>
                  <div className="text-sm text-muted-foreground">{g.patient}</div>
                  <Badge variant="outline">{g.rows.length} resultado(s)</Badge>
                  <div className="ml-auto flex items-center gap-2">
                    <label className="text-xs text-muted-foreground">Revisado por</label>
                    <Select value={reviewer} onValueChange={(v) => setReviewerByOrder((s) => ({ ...s, [g.orderId]: v }))}>
                      <SelectTrigger className="w-56 h-8"><SelectValue placeholder="Selecionar" /></SelectTrigger>
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
                    const ref = r.reference_min != null || r.reference_max != null
                      ? `${r.reference_min ?? "—"} — ${r.reference_max ?? "—"} ${r.unit ?? ""}`
                      : "—";
                    return (
                      <div key={r.id} className="grid grid-cols-[1fr_120px_180px_100px] gap-3 items-center px-3 py-2 rounded border bg-background">
                        <div>
                          <div className="text-xs text-muted-foreground">{ex?.code} · {ex?.sector ?? "—"}</div>
                          <div className="text-sm font-medium">{ex?.name}</div>
                          {r.observation && <div className="text-xs text-muted-foreground">{r.observation}</div>}
                        </div>
                        <div className="font-medium tabular-nums">{r.value} <span className="text-xs text-muted-foreground">{r.unit ?? ""}</span></div>
                        <div className="text-xs text-muted-foreground">Ref: {ref}</div>
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
