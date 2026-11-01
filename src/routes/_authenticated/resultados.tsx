import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, PageBody } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useMyRoles } from "@/hooks/useMyRoles";
import { useCompanyId } from "@/hooks/useCompanyId";
import { ShieldAlert } from "lucide-react";
import { computeAgeMonths, findMatchingRange, type ReferenceRange } from "@/lib/exam-parameters";

export const Route = createFileRoute("/_authenticated/resultados")({
  head: () => ({ meta: [{ title: "Resultados — LIS" }] }),
  component: ResultadosPage,
});

function ResultadosPage() {
  const qc = useQueryClient();
  const { canEnterResults } = useMyRoles();
  const companyId = useCompanyId();
  const [sector, setSector] = useState<string>("__all__");

  const { data = [] } = useQuery({
    queryKey: ["pending-results"],
    enabled: canEnterResults,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_items")
        .select("id, exam_id, exam:exams(id,code,name,sector,material,default_method,standard_notes), order:orders(id,order_number,collection_date,patient:patients(name,code,birth_date,sex)), sample:samples(status)")
        .in("status", ["coletado"]);
      if (error) throw error;
      return (data ?? []).filter((r: any) => r.sample?.status === "recebida");
    },
  });

  const examIds = useMemo(() => Array.from(new Set((data as any[]).map((r) => r.exam_id).filter(Boolean))), [data]);

  const { data: parametersByExam = new Map() } = useQuery({
    queryKey: ["params-for-exams", examIds.join(",")],
    enabled: examIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("exam_parameters").select("*").in("exam_id", examIds).order("display_order");
      const map = new Map<string, any[]>();
      for (const p of (data ?? []) as any[]) {
        const arr = map.get(p.exam_id) ?? [];
        arr.push(p);
        map.set(p.exam_id, arr);
      }
      return map;
    },
  });

  const paramIds = useMemo(() => {
    const ids: string[] = [];
    for (const arr of (parametersByExam as Map<string, any[]>).values()) ids.push(...arr.map((p) => p.id));
    return ids;
  }, [parametersByExam]);

  const { data: rangesGrouped = { byExam: new Map(), byParam: new Map() } } = useQuery({
    queryKey: ["ranges-for-exams", examIds.join(","), paramIds.join(",")],
    enabled: examIds.length > 0,
    queryFn: async () => {
      const orExpr =
        paramIds.length > 0
          ? `exam_id.in.(${examIds.join(",")}),exam_parameter_id.in.(${paramIds.join(",")})`
          : `exam_id.in.(${examIds.join(",")})`;
      const { data } = await supabase.from("reference_ranges").select("*").or(orExpr);
      const byExam = new Map<string, ReferenceRange[]>();
      const byParam = new Map<string, ReferenceRange[]>();
      for (const r of (data ?? []) as any[]) {
        if (r.exam_id) {
          const a = byExam.get(r.exam_id) ?? [];
          a.push(r);
          byExam.set(r.exam_id, a);
        } else if (r.exam_parameter_id) {
          const a = byParam.get(r.exam_parameter_id) ?? [];
          a.push(r);
          byParam.set(r.exam_parameter_id, a);
        }
      }
      return { byExam, byParam };
    },
  });

  const sectors = useMemo(() => {
    const s = new Set<string>();
    for (const r of data as any[]) if (r.exam?.sector) s.add(r.exam.sector);
    return Array.from(s).sort();
  }, [data]);

  const filtered = (data as any[]).filter((r) => sector === "__all__" || r.exam?.sector === sector);

  if (!canEnterResults) {
    return (
      <PageBody>
        <div className="rounded-md border bg-card p-6 flex items-center gap-3 text-muted-foreground">
          <ShieldAlert className="size-5" />Sem permissão para lançar resultados.
        </div>
      </PageBody>
    );
  }

  return (
    <>
      <PageHeader
        title="Lançamento de resultados"
        description="Exames com amostra recebida aguardando resultado"
        actions={
          <Select value={sector} onValueChange={setSector}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Setor" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos os setores</SelectItem>
              {sectors.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        }
      />
      <PageBody>
        {filtered.length === 0 && <div className="text-muted-foreground text-sm">Nenhum exame aguardando lançamento.</div>}
        <div className="space-y-3">
          {filtered.map((r: any) => (
            <ResultItemCard
              key={r.id}
              item={r}
              companyId={companyId}
              parameters={(parametersByExam as Map<string, any[]>).get(r.exam_id) ?? []}
              rangesByExam={(rangesGrouped as any).byExam as Map<string, ReferenceRange[]>}
              rangesByParam={(rangesGrouped as any).byParam as Map<string, ReferenceRange[]>}
              onSaved={() => {
                qc.invalidateQueries({ queryKey: ["pending-results"] });
                qc.invalidateQueries({ queryKey: ["pending-release"] });
              }}
            />
          ))}
        </div>
      </PageBody>
    </>
  );
}

function ResultItemCard({
  item, companyId, parameters, rangesByExam, rangesByParam, onSaved,
}: {
  item: any; companyId: string | null; parameters: any[];
  rangesByExam: Map<string, ReferenceRange[]>; rangesByParam: Map<string, ReferenceRange[]>;
  onSaved: () => void;
}) {
  const patient = item.order?.patient;
  const collectionDate = item.order?.collection_date ? new Date(item.order.collection_date) : new Date();
  const ageMonths = computeAgeMonths(patient?.birth_date, collectionDate);
  const sex = (patient?.sex as "M" | "F" | null) ?? null;

  const [method, setMethod] = useState<string>(item.exam?.default_method ?? "");
  const [observation, setObservation] = useState<string>("");
  const [simpleValue, setSimpleValue] = useState<string>("");
  const [paramValues, setParamValues] = useState<Record<string, string>>({});

  const isMulti = parameters.length > 0;

  const save = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();

      if (isMulti) {
        // valida ao menos um valor preenchido
        const hasAny = Object.values(paramValues).some((v) => v?.trim());
        if (!hasAny) throw new Error("Informe ao menos um valor");

        const { data: inserted, error } = await supabase
          .from("results")
          .insert({
            company_id: companyId!,
            order_item_id: item.id,
            value: "—",
            observation: observation?.trim() || null,
            method: method?.trim() || null,
            entered_by: u.user?.id ?? null,
          } as never)
          .select("id")
          .single();
        if (error) throw error;
        const resultId = (inserted as any).id as string;

        const rows = parameters
          .filter((p) => paramValues[p.id]?.trim())
          .map((p) => {
            const ranges = rangesByParam.get(p.id) ?? [];
            const match = findMatchingRange(ranges, { sex, ageMonths });
            return {
              result_id: resultId,
              exam_parameter_id: p.id,
              value: paramValues[p.id].trim(),
              unit: p.unit ?? null,
              reference_display_text: match?.display_text ?? null,
              reference_min: match?.range_min ?? null,
              reference_max: match?.range_max ?? null,
            };
          });
        if (rows.length > 0) {
          const { error: e2 } = await supabase.from("result_values").insert(rows as never);
          if (e2) throw e2;
        }
      } else {
        if (!simpleValue.trim()) throw new Error("Informe o valor");
        const ranges = rangesByExam.get(item.exam_id) ?? [];
        const match = findMatchingRange(ranges, { sex, ageMonths });
        const { error } = await supabase.from("results").insert({
          company_id: companyId!,
          order_item_id: item.id,
          value: simpleValue.trim(),
          observation: observation?.trim() || null,
          method: method?.trim() || null,
          reference_min: match?.range_min ?? null,
          reference_max: match?.range_max ?? null,
          entered_by: u.user?.id ?? null,
        } as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Resultado lançado");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const grouped = useMemo(() => {
    const g = new Map<string, any[]>();
    for (const p of parameters) {
      const key = p.group_label ?? "";
      const arr = g.get(key) ?? [];
      arr.push(p);
      g.set(key, arr);
    }
    return Array.from(g.entries());
  }, [parameters]);

  return (
    <div className="rounded-md border bg-card p-4 space-y-3">
      <div className="flex items-start gap-4">
        <div className="text-sm flex-1">
          <div className="text-xs text-muted-foreground">#{item.order?.order_number} · {item.exam?.code}</div>
          <div className="font-medium">{item.exam?.name}</div>
          <div className="text-xs text-muted-foreground">{patient?.name}{sex ? ` · ${sex}` : ""}{ageMonths != null ? ` · ${Math.floor(ageMonths/12)}a` : ""}</div>
        </div>
        <div className="min-w-[200px]">
          <label className="text-xs text-muted-foreground">Método</label>
          <Input value={method} onChange={(e) => setMethod(e.target.value)} placeholder={item.exam?.default_method ?? "Método"} />
        </div>
      </div>

      {isMulti ? (
        <div className="space-y-2">
          {grouped.map(([groupLabel, params]) => (
            <div key={groupLabel || "__default__"} className="space-y-1">
              {groupLabel && <div className="text-xs font-medium text-muted-foreground mt-1">{groupLabel}</div>}
              <div className="rounded border overflow-hidden">
                <div className="grid grid-cols-[1fr_140px_60px_1fr] gap-2 bg-muted/50 px-3 py-1 text-[11px] font-medium text-muted-foreground">
                  <div>Parâmetro</div><div>Valor</div><div>Unid.</div><div>Referência</div>
                </div>
                {(params as any[]).map((p) => {
                  const ranges = rangesByParam.get(p.id) ?? [];
                  const match = findMatchingRange(ranges, { sex, ageMonths });
                  return (
                    <div key={p.id} className="grid grid-cols-[1fr_140px_60px_1fr] gap-2 px-3 py-1.5 items-center border-t text-sm">
                      <div>{p.name}</div>
                      <Input value={paramValues[p.id] ?? ""} onChange={(e) => setParamValues((v) => ({ ...v, [p.id]: e.target.value }))} />
                      <div className="text-xs text-muted-foreground">{p.unit ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{match?.display_text ?? "—"}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-[1fr_1fr] gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Valor</label>
            <Input value={simpleValue} onChange={(e) => setSimpleValue(e.target.value)} placeholder="Ex: 4.7" />
          </div>
          <div className="text-xs text-muted-foreground self-end pb-2">
            Ref: {findMatchingRange(rangesByExam.get(item.exam_id) ?? [], { sex, ageMonths })?.display_text ?? "—"}
          </div>
        </div>
      )}

      <div>
        <label className="text-xs text-muted-foreground">Observação</label>
        <Textarea rows={2} value={observation} onChange={(e) => setObservation(e.target.value)} />
      </div>

      <div className="flex justify-end">
        <Button onClick={() => save.mutate()} disabled={save.isPending}>Lançar</Button>
      </div>
    </div>
  );
}
