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
import { ShieldAlert, AlertTriangle } from "lucide-react";
import { computeAgeMonths, findMatchingRange, type ReferenceRange } from "@/lib/exam-parameters";
import { evaluateFormula, formatCalculated } from "@/lib/formula";
import { getFlag, isPanic, flagLabel, parseNumeric, type ResultFlag } from "@/lib/result-flags";
import { cn } from "@/lib/utils";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
        .select("id, exam_id, exam:exams(id,code,name,sector,material,default_method,standard_notes,is_text), order:orders(id,order_number,collection_date,patient:patients(name,code,birth_date,sex)), sample:samples(status), links:order_item_samples(sample:samples(status))")
        .in("status", ["coletado"]);
      if (error) throw error;
      // todas as amostras do exame precisam ter sido recebidas (exames com mais de uma amostra)
      return (data ?? []).filter((r: any) => {
        const statuses: string[] = r.links?.length ? r.links.map((l: any) => l.sample?.status) : [r.sample?.status];
        return statuses.length > 0 && statuses.every((st) => st === "recebida");
      });
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

// Cor do campo conforme o alerta: pânico (vermelho), fora da faixa (âmbar) ou calculado (verde)
function valueClass(flag: ResultFlag, calculated = false, notCounted = false) {
  if (isPanic(flag)) return "border-red-500 bg-red-50 text-red-900 font-semibold focus-visible:ring-red-500";
  if (flag !== "normal") return "border-amber-500 bg-amber-50 text-amber-950 focus-visible:ring-amber-500";
  if (notCounted) return "border-[#a1887f] bg-[#efe6dc] text-stone-900"; // marrom: preenchido, mas não conta como resultado
  if (calculated) return "border-emerald-300 bg-emerald-50 text-emerald-950";
  return "";
}

function FlagNote({ flag }: { flag: ResultFlag }) {
  if (flag === "normal") return null;
  return (
    <div className={cn("text-[11px] mt-0.5 flex items-center gap-1", isPanic(flag) ? "text-red-700 font-semibold" : "text-amber-800")}>
      {isPanic(flag) && <AlertTriangle className="size-3" />}
      {flagLabel(flag)}
    </div>
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
  const [confirmPanic, setConfirmPanic] = useState(false);

  const isMulti = parameters.length > 0;
  // Exame tipo texto: resultado em texto livre (só vale para exame sem parâmetros)
  const isTextExam = !!item.exam?.is_text && !isMulti;

  const { data: templates = [] } = useQuery({
    queryKey: ["result-templates"],
    enabled: isTextExam,
    queryFn: async () => {
      const { data, error } = await supabase.from("result_templates").select("id, title, body, exam_id").order("title");
      if (error) throw error;
      return (data ?? []) as { id: string; title: string; body: string; exam_id: string | null }[];
    },
  });
  // textos do próprio exame primeiro, depois os gerais
  const usableTemplates = templates
    .filter((t) => !t.exam_id || t.exam_id === item.exam_id)
    .sort((a, b) => (b.exam_id === item.exam_id ? 1 : 0) - (a.exam_id === item.exam_id ? 1 : 0) || a.title.localeCompare(b.title, "pt-BR"));
  const insertTemplate = (id: string) => {
    const t = usableTemplates.find((x) => x.id === id);
    if (!t) return;
    setSimpleValue((cur) => (cur.trim() ? `${cur.replace(/\s+$/, "")}\n\n${t.body}` : t.body));
  };

  // Faixa de referência (e limites de pânico) que vale para este paciente
  const matchFor = (paramId: string) => findMatchingRange(rangesByParam.get(paramId) ?? [], { sex, ageMonths });
  const limitsOf = (m: ReferenceRange | null) => ({
    min: m?.range_min, max: m?.range_max, panicMin: m?.panic_min, panicMax: m?.panic_max,
  });

  // Valores finais: o que foi digitado + campos calculados (recalculados a cada digitação)
  const values = useMemo(() => {
    const calc = parameters.filter((p) => p.formula?.trim());
    const typed: Record<string, string> = {};
    for (const p of parameters) if (!p.formula?.trim()) typed[p.id] = paramValues[p.id] ?? "";
    const computed: Record<string, string> = {};
    // várias passadas: um campo calculado pode usar outro campo calculado
    for (let pass = 0; pass <= calc.length; pass++) {
      const vars: Record<string, number | null> = {};
      for (const p of parameters) {
        if (!p.code) continue;
        vars[p.code] = parseNumeric(p.formula?.trim() ? computed[p.id] : typed[p.id]);
      }
      let changed = false;
      for (const c of calc) {
        const r = evaluateFormula(c.formula, vars);
        const str = r.value == null ? "" : formatCalculated(r.value, c.decimals);
        if (computed[c.id] !== str) {
          computed[c.id] = str;
          changed = true;
        }
      }
      if (!changed) break;
    }
    return { ...typed, ...computed } as Record<string, string>;
  }, [parameters, paramValues]);

  // "Conta como resultado": campos marcados assim completam o exame; os demais só complementam
  const countsAsResult = (p: any) => p.counts_as_result !== false;
  const anyTyped = parameters.some((p) => !p.formula?.trim() && paramValues[p.id]?.trim());
  const countingFilled = parameters.some((p) => countsAsResult(p) && values[p.id]?.trim());
  const missingCounting = isMulti && anyTyped && !countingFilled;

  const simpleMatch = findMatchingRange(rangesByExam.get(item.exam_id) ?? [], { sex, ageMonths });
  const simpleFlag = getFlag(simpleValue, limitsOf(simpleMatch));

  // Itens em pânico (para o selo no cartão e a confirmação ao lançar)
  const panicItems: { name: string; value: string; unit: string | null; flag: ResultFlag }[] = isMulti
    ? parameters
        .map((p) => ({ name: p.name, value: values[p.id] ?? "", unit: p.unit ?? null, flag: getFlag(values[p.id], limitsOf(matchFor(p.id))) }))
        .filter((x) => isPanic(x.flag))
    : isPanic(simpleFlag)
      ? [{ name: item.exam?.name ?? "", value: simpleValue.trim(), unit: null, flag: simpleFlag }]
      : [];

  const save = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();

      if (isMulti) {
        // ao menos um valor digitado (campo calculado sozinho não conta)
        if (!anyTyped) throw new Error("Informe ao menos um valor");
        if (!countingFilled) throw new Error("Preencha ao menos um campo que conta como resultado (os campos em marrom só complementam o exame)");

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
          .filter((p) => values[p.id]?.trim())
          .map((p) => {
            const match = matchFor(p.id);
            return {
              result_id: resultId,
              exam_parameter_id: p.id,
              value: values[p.id].trim(),
              unit: p.unit ?? null,
              reference_display_text: match?.display_text ?? null,
              reference_min: match?.range_min ?? null,
              reference_max: match?.range_max ?? null,
              panic_min: match?.panic_min ?? null,
              panic_max: match?.panic_max ?? null,
              extra_before: p.extra_line_before ?? null,
              extra_after: p.extra_line_after ?? null,
            };
          });
        if (rows.length > 0) {
          const { error: e2 } = await supabase.from("result_values").insert(rows as never);
          if (e2) throw e2;
        }
      } else {
        if (!simpleValue.trim()) throw new Error("Informe o valor");
        const { error } = await supabase.from("results").insert({
          company_id: companyId!,
          order_item_id: item.id,
          value: simpleValue.trim(),
          observation: observation?.trim() || null,
          method: method?.trim() || null,
          reference_min: simpleMatch?.range_min ?? null,
          reference_max: simpleMatch?.range_max ?? null,
          panic_min: simpleMatch?.panic_min ?? null,
          panic_max: simpleMatch?.panic_max ?? null,
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

  // Pânico exige confirmação explícita antes de gravar
  const submit = () => {
    if (panicItems.length > 0) setConfirmPanic(true);
    else save.mutate();
  };

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
    <div className={cn("rounded-md border bg-card p-4 space-y-3", panicItems.length > 0 && "border-red-400 ring-1 ring-red-300")}>
      <div className="flex flex-wrap items-start gap-4">
        <div className="text-sm flex-1 min-w-[180px]">
          <div className="text-xs text-muted-foreground">#{item.order?.order_number} · {item.exam?.code}</div>
          <div className="font-medium flex flex-wrap items-center gap-2">
            {item.exam?.name}
            {panicItems.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded bg-red-600 px-2 py-0.5 text-[11px] font-semibold text-white">
                <AlertTriangle className="size-3" />PÂNICO
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground">{patient?.name}{sex ? ` · ${sex}` : ""}{ageMonths != null ? ` · ${Math.floor(ageMonths/12)}a` : ""}</div>
        </div>
        <div className="w-full sm:w-auto sm:min-w-[200px]">
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
                <div className="hidden sm:grid grid-cols-[1fr_140px_60px_1fr] gap-2 bg-muted/50 px-3 py-1 text-[11px] font-medium text-muted-foreground">
                  <div>Parâmetro</div><div>Valor</div><div>Unid.</div><div>Referência</div>
                </div>
                {(params as any[]).map((p) => {
                  const match = matchFor(p.id);
                  const isCalc = !!p.formula?.trim();
                  const notCounted = !countsAsResult(p);
                  const flag = getFlag(values[p.id], limitsOf(match));
                  return (
                    <div key={p.id} className="grid grid-cols-[1fr_130px] sm:grid-cols-[1fr_140px_60px_1fr] gap-x-2 gap-y-0.5 px-3 py-1.5 items-start border-t text-sm">
                      <div className="pt-2">
                        {p.name}
                        {isCalc && <span className="ml-1 text-[10px] text-emerald-700" title={`Calculado: ${p.formula}`}>ƒ calculado</span>}
                        {notCounted && <span className="ml-1 text-[10px] text-[#795548]" title="Sozinho, este campo não faz o exame ter resultado">não conta como resultado</span>}
                      </div>
                      <div>
                        <Input
                          value={values[p.id] ?? ""}
                          readOnly={isCalc}
                          tabIndex={isCalc ? -1 : undefined}
                          placeholder={isCalc ? "auto" : undefined}
                          className={valueClass(flag, isCalc, notCounted && !!values[p.id]?.trim())}
                          onChange={(e) => setParamValues((v) => ({ ...v, [p.id]: e.target.value }))}
                        />
                        <FlagNote flag={flag} />
                      </div>
                      <div className="text-xs text-muted-foreground sm:pt-2.5">{p.unit ?? "—"}</div>
                      <div className="text-xs text-muted-foreground sm:pt-2.5 col-span-2 sm:col-span-1">{match?.display_text ?? "—"}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : isTextExam ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <label className="text-xs text-muted-foreground">Resultado (texto)</label>
            {usableTemplates.length > 0 && (
              <Select value="" onValueChange={insertTemplate}>
                <SelectTrigger className="w-full sm:w-72 h-8"><SelectValue placeholder="Inserir texto-modelo…" /></SelectTrigger>
                <SelectContent>
                  {usableTemplates.map((t) => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
          <Textarea rows={10} value={simpleValue} onChange={(e) => setSimpleValue(e.target.value)} placeholder="Escreva o resultado do exame…" />
          {usableTemplates.length === 0 && (
            <div className="text-xs text-muted-foreground">Dica: cadastre textos-modelo em Cadastros → Textos-modelo para inserir aqui.</div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr] gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Valor</label>
            <Input value={simpleValue} className={valueClass(simpleFlag)} onChange={(e) => setSimpleValue(e.target.value)} placeholder="Ex: 4.7" />
            <FlagNote flag={simpleFlag} />
          </div>
          <div className="text-xs text-muted-foreground sm:self-end pb-2">
            Ref: {simpleMatch?.display_text ?? "—"}
          </div>
        </div>
      )}

      <div>
        <label className="text-xs text-muted-foreground">Observação</label>
        <Textarea rows={2} value={observation} onChange={(e) => setObservation(e.target.value)} />
      </div>

      {missingCounting && (
        <div className="rounded border border-[#a1887f] bg-[#efe6dc] px-3 py-2 text-xs text-stone-900">
          Só há campos que não contam como resultado preenchidos (marrom). Preencha um campo de resultado para poder lançar.
        </div>
      )}
      <div className="flex justify-end">
        <Button onClick={submit} disabled={save.isPending || missingCounting} variant={panicItems.length > 0 ? "destructive" : "default"}>
          Lançar
        </Button>
      </div>

      <AlertDialog open={confirmPanic} onOpenChange={setConfirmPanic}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="size-5" />Valor de pânico
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>Estes valores indicam risco de vida. Confira se foram digitados corretamente antes de lançar:</p>
                <ul className="rounded border border-red-200 bg-red-50 p-2 space-y-1 text-red-900">
                  {panicItems.map((x, i) => (
                    <li key={i} className="flex justify-between gap-3">
                      <span>{x.name}</span>
                      <span className="font-semibold tabular-nums">{x.value}{x.unit ? ` ${x.unit}` : ""} · {flagLabel(x.flag).replace("PÂNICO — ", "")}</span>
                    </li>
                  ))}
                </ul>
                <p>Resultados de pânico devem ser comunicados conforme o protocolo do laboratório.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar e conferir</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => save.mutate()}>
              Confirmar e lançar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
