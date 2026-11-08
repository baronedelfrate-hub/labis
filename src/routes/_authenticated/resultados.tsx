import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, PageBody } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useMyRoles } from "@/hooks/useMyRoles";
import { useCompanyId } from "@/hooks/useCompanyId";
import { ShieldAlert, AlertTriangle, Search, ArrowLeft } from "lucide-react";
import { computeAgeMonths, findMatchingRange, type ReferenceRange } from "@/lib/exam-parameters";
import { evaluateFormula, formatCalculated } from "@/lib/formula";
import { getFlag, isPanic, flagLabel, parseNumeric, type ResultFlag } from "@/lib/result-flags";
import { cn } from "@/lib/utils";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/resultados")({
  head: () => ({ meta: [{ title: "Resultados — DFLAB" }] }),
  // ?item=<exame do pedido> ou ?pedido=<pedido>: mostra só esse exame/pedido, mesmo antes de a amostra ser recebida
  validateSearch: (s: Record<string, unknown>): { item?: string; pedido?: string } => {
    const uuid = (v: unknown) => (typeof v === "string" && /^[0-9a-f-]{32,36}$/i.test(v) ? v : undefined);
    return { item: uuid(s.item), pedido: uuid(s.pedido) };
  },
  component: ResultadosPage,
});

const ITEM_SELECT =
  "id, exam_id, exam:exams(id,code,name,sector,material,default_method,standard_notes,is_text,support_lab_id,support_lab:support_labs(name)), order:orders(id,order_number,collection_date,patient:patients(name,code,birth_date,sex)), sample:samples!order_items_sample_id_fkey(status), links:order_item_samples(sample:samples(status)), support_shipment_items(id)";

const isShipped = (r: any) => (Array.isArray(r.support_shipment_items) ? r.support_shipment_items.length > 0 : !!r.support_shipment_items);
const sampleStatuses = (r: any): (string | undefined)[] => (r.links?.length ? r.links.map((l: any) => l.sample?.status) : [r.sample?.status]);

// Aviso quando se lança um resultado antes do fluxo normal (amostra recebida / apoio enviado)
function entryWarning(r: any): string | null {
  if (r.exam?.support_lab_id) return isShipped(r) ? null : "Exame de apoio ainda não enviado ao laboratório. Confira antes de lançar.";
  const st = sampleStatuses(r);
  if (st.length === 0 || st.some((x) => !x)) return "Este exame ainda não tem amostra coletada. Confira antes de lançar.";
  if (st.some((x) => x === "rejeitada")) return "A amostra deste exame foi rejeitada. Confira antes de lançar.";
  if (st.every((x) => x === "recebida")) return null;
  if (st.some((x) => x === "pendente")) return "A amostra ainda não foi coletada. Confira antes de lançar.";
  return "A amostra foi coletada, mas ainda não foi recebida na bancada. Confira antes de lançar.";
}

function ResultadosPage() {
  const qc = useQueryClient();
  const { canEnterResults } = useMyRoles();
  const companyId = useCompanyId();
  const [sector, setSector] = useState<string>("__all__");
  const [text, setText] = useState("");
  const [includeAll, setIncludeAll] = useState(false);
  const { item: itemId, pedido: orderId } = Route.useSearch();
  const scoped = !!(itemId || orderId);

  const { data: queue = [], error: queueError, refetch: refetchQueue, isLoading: queueLoading } = useQuery({
    queryKey: ["pending-results"],
    enabled: canEnterResults && !scoped,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_items")
        .select(ITEM_SELECT)
        .in("status", ["coletado"]);
      if (error) throw error;
      // todas as amostras do exame precisam ter sido recebidas (exames com mais de uma amostra)
      return (data ?? []).filter((r: any) => {
        // Exame de apoio: aparece só depois de enviado (a amostra não passa pela bancada daqui).
        if (r.exam?.support_lab_id) return isShipped(r);
        const statuses: string[] = r.links?.length ? r.links.map((l: any) => l.sample?.status) : [r.sample?.status];
        return statuses.length > 0 && statuses.every((st) => st === "recebida");
      });
    },
  });

  // Modo "um exame / um pedido": traz os exames ainda sem resultado, mesmo sem amostra recebida
  const { data: scopedRows = [], isLoading: scopedLoading, error: scopedError, refetch: refetchScoped } = useQuery({
    queryKey: ["result-scope", itemId ?? null, orderId ?? null],
    enabled: canEnterResults && scoped,
    queryFn: async () => {
      let q = supabase.from("order_items").select(ITEM_SELECT).in("status", ["pendente", "coletado"]);
      q = itemId ? q.eq("id", itemId) : q.eq("order_id", orderId!);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  // Opção "incluir exames sem amostra recebida": todos os exames ainda sem resultado, com aviso quando faltar a amostra
  const { data: allRows = [], isLoading: allLoading, error: allError, refetch: refetchAll } = useQuery({
    queryKey: ["result-all"],
    enabled: canEnterResults && !scoped && includeAll,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_items")
        .select(ITEM_SELECT)
        .in("status", ["pendente", "coletado"])
        .limit(500);
      if (error) throw error;
      return ((data ?? []) as any[]).sort((a, b) => (b.order?.order_number ?? 0) - (a.order?.order_number ?? 0));
    },
  });

  const widened = scoped || includeAll; // mostra exames fora da fila normal, com aviso
  const data = (scoped ? scopedRows : includeAll ? allRows : queue) as any[];
  const loadError = scoped ? scopedError : includeAll ? allError : queueError;
  const loadingNow = scoped ? scopedLoading : includeAll ? allLoading : queueLoading && canEnterResults;
  const reloadNow = () => (scoped ? refetchScoped() : includeAll ? refetchAll() : refetchQueue());
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

  const needle = text.trim().replace(/^#/, "").toLowerCase();
  const matches = (r: any) =>
    !needle ||
    [r.order?.patient?.name, r.order?.patient?.code, r.order?.order_number, r.exam?.code, r.exam?.name].some((v) =>
      String(v ?? "").toLowerCase().includes(needle),
    );
  const filtered = (data as any[]).filter((r) => (sector === "__all__" || r.exam?.sector === sector) && matches(r));

  // Motivo da devolução (Liberação), numa consulta só para os exames da tela. Se falhar, os cartões seguem normais.
  const visibleIds = filtered.slice(0, 150).map((r) => r.id as string);
  const { data: returnsByItem } = useQuery({
    queryKey: ["result-return", visibleIds.join(",")],
    enabled: canEnterResults && visibleIds.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("result_corrections")
        .select("order_item_id, reason, returned_at")
        .in("order_item_id", visibleIds)
        .order("returned_at", { ascending: false });
      const m = new Map<string, { reason: string; returned_at: string }>();
      for (const r of (data ?? []) as { order_item_id: string; reason: string; returned_at: string }[]) {
        if (!m.has(r.order_item_id)) m.set(r.order_item_id, { reason: r.reason, returned_at: r.returned_at });
      }
      return m;
    },
  });

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
        description={scoped ? "Lançamento direto do exame ou do pedido" : "Exames com amostra recebida aguardando resultado"}
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
        {scoped && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border bg-card px-3 py-2 text-sm">
            <span>
              {itemId ? "Mostrando só este exame" : "Mostrando só os exames deste pedido"}
              {data[0]?.order ? <> · <b>#{data[0].order.order_number}</b> {data[0].order.patient?.name}</> : null}
            </span>
            <span className="flex gap-2">
              {(orderId || data[0]?.order?.id) && (
                <Button asChild size="sm" variant="outline"><Link to="/pedidos/$orderId" params={{ orderId: (orderId ?? data[0].order.id) as string }}><ArrowLeft className="mr-1 size-4" />Voltar ao pedido</Link></Button>
              )}
              <Button asChild size="sm" variant="ghost"><Link to="/resultados">Ver a fila completa</Link></Button>
            </span>
          </div>
        )}
        <div className="relative mb-3 max-w-md">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Buscar paciente, nº do pedido ou exame" className="pl-9" aria-label="Buscar" />
        </div>
        {!scoped && (
          <label className="mb-3 flex items-start gap-2 text-sm">
            <Checkbox className="mt-0.5" checked={includeAll} onCheckedChange={(v) => setIncludeAll(!!v)} aria-label="Incluir exames sem amostra recebida" />
            <span>
              Incluir exames ainda sem amostra recebida
              <span className="block text-xs text-muted-foreground">Por padrão a fila mostra só exames com a amostra recebida na bancada. Marque para lançar também os que ainda aguardam coleta ou recebimento.</span>
            </span>
          </label>
        )}
        {loadError && (
          <div role="alert" className="mb-3 flex flex-wrap items-start gap-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="font-medium">Não foi possível carregar os exames.</div>
              <div className="break-words text-xs">{String((loadError as Error)?.message ?? "Erro desconhecido")}</div>
              <div className="mt-1 text-xs">Se o erro continuar, envie este texto ao suporte.</div>
            </div>
            <Button size="sm" variant="outline" onClick={() => reloadNow()}>Tentar de novo</Button>
          </div>
        )}
        {loadingNow && <div className="text-muted-foreground text-sm">Carregando...</div>}
        {filtered.length === 0 && !loadingNow && !loadError && (
          <div className="text-muted-foreground text-sm">
            {text.trim()
              ? "Nenhum exame encontrado para essa busca."
              : scoped
                ? "Este exame ou pedido não tem exames aguardando resultado (já lançados ou liberados)."
                : includeAll
                  ? "Nenhum exame aguardando resultado."
                  : "Nenhum exame com amostra recebida aguardando lançamento. Para lançar os que ainda não tiveram a amostra recebida, marque \"Incluir exames ainda sem amostra recebida\" ou abra o pedido do paciente."}
          </div>
        )}
        <div className="space-y-3">
          {filtered.map((r: any) => (
            <ResultItemCard
              key={r.id}
              item={r}
              warning={widened ? entryWarning(r) : null}
              lastReturn={returnsByItem?.get(r.id) ?? null}
              companyId={companyId}
              parameters={(parametersByExam as Map<string, any[]>).get(r.exam_id) ?? []}
              rangesByExam={(rangesGrouped as any).byExam as Map<string, ReferenceRange[]>}
              rangesByParam={(rangesGrouped as any).byParam as Map<string, ReferenceRange[]>}
              onSaved={() => {
                qc.invalidateQueries({ queryKey: ["pending-results"] });
                qc.invalidateQueries({ queryKey: ["result-scope"] });
                qc.invalidateQueries({ queryKey: ["result-all"] });
                qc.invalidateQueries({ queryKey: ["pending-release"] });
                qc.invalidateQueries({ queryKey: ["order"] });
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
  item, warning, lastReturn, companyId, parameters, rangesByExam, rangesByParam, onSaved,
}: {
  item: any; warning?: string | null; lastReturn?: { reason: string; returned_at: string } | null; companyId: string | null; parameters: any[];
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
          <div className="text-xs text-muted-foreground">#{item.order?.order_number} · {item.exam?.code}{item.exam?.support_lab?.name && <span className="ml-2 rounded bg-sky-100 px-1.5 py-0.5 text-sky-900 dark:bg-sky-900/30 dark:text-sky-200">Apoio: {item.exam.support_lab.name}</span>}</div>
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

      {lastReturn && (
        <div role="note" className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-900">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <span><b>Devolvido para correção</b> em {new Date(lastReturn.returned_at).toLocaleDateString("pt-BR")}: {lastReturn.reason}</span>
        </div>
      )}
      {warning && (
        <div role="note" className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />{warning}
        </div>
      )}

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
