import { createFileRoute } from "@tanstack/react-router";
import { CrudPage, Field } from "@/components/CrudPage";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import { Plus, Trash2, SlidersHorizontal } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { SectorSelect } from "@/components/SectorSelect";
import { toast } from "sonner";
import { formatAgeMonths } from "@/lib/exam-parameters";
import { validateFormula, findFormulaCycle } from "@/lib/formula";
import { LegacyCatalogPicker, LegacyPricesSection } from "@/components/LegacyExamCatalog";

type Exam = { id: string; code: string; name: string; sector: string | null; tech_sector: string | null; price_sector: string | null; material: string | null; deadline_days: number; fasting_hours: number; is_urgent_allowed: boolean; preparation_instructions: string | null; tiss_codigo_procedimento: string | null; default_method: string | null; standard_notes: string | null; is_text: boolean; samples_count: number; labels_per_sample: number };

export const Route = createFileRoute("/_authenticated/cadastros/exames")({
  head: () => ({ meta: [{ title: "Exames — LIS" }] }),
  component: ExamesPage,
});

function ExamesPage() {
  return (
    <div className="space-y-3">
      <PendingReviewBanner />
      <CrudPage<Exam>
      title="Exames" description="Catálogo de exames do laboratório" table="exams"
      reopenOnCreate
      orderBy={{ column: "name" }}
      searchColumn="name" searchPlaceholder="Buscar por nome..."
      emptyValue={{ code: "", name: "", sector: "", tech_sector: null, price_sector: null, material: "", deadline_days: 1, fasting_hours: 0, is_urgent_allowed: true, is_text: false, samples_count: 1, labels_per_sample: 1, tiss_codigo_procedimento: "", default_method: "", standard_notes: "" }}
      itemLabel={r => r.name}
      columns={[
        { key: "code", label: "Código", className: "w-24 tabular-nums" },
        { key: "name", label: "Nome" },
        { key: "sector", label: "Setor", className: "w-32" },
        { key: "material", label: "Material", className: "w-32" },
        { key: "tech_sector", label: "Executa", className: "w-28" },
      ]}
      renderForm={({ value, setValue }) => (
        <>
          {!value.id && (
            <LegacyCatalogPicker
              onPick={(r) => setValue({
                ...value,
                code: r.code,
                name: r.name,
                material: r.material ?? value.material ?? "",
                tech_sector: (r.sector ?? "").trim() || value.tech_sector || null,
                price_sector: (r.price_sector ?? "").trim() || value.price_sector || null,
                deadline_days: r.days ?? value.deadline_days,
                fasting_hours: r.fasting_hours ?? value.fasting_hours ?? 0,
                is_text: r.is_text || (value.is_text ?? false),
              })}
            />
          )}
          <div className="grid grid-cols-4 gap-3">
            <Field label="Código*"><Input required autoFocus value={value.code ?? ""} onChange={e => setValue({ ...value, code: e.target.value })} /></Field>
            <div className="col-span-3"><Field label="Nome*"><Input required value={value.name ?? ""} onChange={e => setValue({ ...value, name: e.target.value })} /></Field></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Setor"><Input value={value.sector ?? ""} onChange={e => setValue({ ...value, sector: e.target.value })} /></Field>
            <Field label="Material"><Input value={value.material ?? ""} onChange={e => setValue({ ...value, material: e.target.value })} /></Field>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Setor técnico (quem executa)">
              <SectorSelect kind="tecnico" value={value.tech_sector} onChange={v => setValue({ ...value, tech_sector: v })} />
              <span className="text-[11px] text-muted-foreground">Setor do laboratório ou laboratório de apoio que realiza o exame. Lista do XLAB7.</span>
            </Field>
            <Field label="Setor de preço">
              <SectorSelect kind="preco" value={value.price_sector} onChange={v => setValue({ ...value, price_sector: v })} />
              <span className="text-[11px] text-muted-foreground">Agrupamento usado para preço e faturamento. Lista do XLAB7.</span>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Prazo (dias)"><Input type="number" min={0} value={value.deadline_days ?? 1} onChange={e => setValue({ ...value, deadline_days: Number(e.target.value) })} /></Field>
            <Field label="Jejum (horas)"><Input type="number" min={0} value={value.fasting_hours ?? 0} onChange={e => setValue({ ...value, fasting_hours: Number(e.target.value) })} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nº de amostras (tubos)">
              <Input type="number" min={1} max={9} value={value.samples_count ?? 1} onChange={e => setValue({ ...value, samples_count: Math.min(9, Math.max(1, Number(e.target.value) || 1)) })} />
              <span className="text-[11px] text-muted-foreground">Mais de 1 quando o exame precisa de coletas separadas (ex.: glicose em jejum e pós-prandial). Aparece com + na etiqueta.</span>
            </Field>
            <Field label="Etiquetas por amostra">
              <Input type="number" min={1} max={5} value={value.labels_per_sample ?? 1} onChange={e => setValue({ ...value, labels_per_sample: Math.min(5, Math.max(1, Number(e.target.value) || 1)) })} />
              <span className="text-[11px] text-muted-foreground">Mais de 1 quando a amostra é dividida em partes. Aparece com ^ na etiqueta.</span>
            </Field>
          </div>
          <Field label="Preparo"><Input value={value.preparation_instructions ?? ""} onChange={e => setValue({ ...value, preparation_instructions: e.target.value })} /></Field>
          <Field label="Método padrão"><Input value={value.default_method ?? ""} onChange={e => setValue({ ...value, default_method: e.target.value })} placeholder="Ex: Colorimétrico, Enzimático..." /></Field>
          <Field label="Observações padrão do laudo"><Textarea rows={2} value={value.standard_notes ?? ""} onChange={e => setValue({ ...value, standard_notes: e.target.value })} /></Field>
          <Field label="Código TUSS (TISS)"><Input value={value.tiss_codigo_procedimento ?? ""} onChange={e => setValue({ ...value, tiss_codigo_procedimento: e.target.value })} /></Field>
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={value.is_urgent_allowed ?? true} onCheckedChange={v => setValue({ ...value, is_urgent_allowed: !!v })} /> Permite urgência</label>
          <label className="flex items-start gap-2 text-sm">
            <Checkbox className="mt-0.5" checked={value.is_text ?? false} onCheckedChange={v => setValue({ ...value, is_text: !!v })} />
            <span>
              <b>Exame tipo texto</b> — o resultado é escrito em texto livre (ex.: diagnóstico por imagem), com apoio dos textos-modelo.
              <span className="block text-xs text-muted-foreground">Vale para exames sem parâmetros. Em exames com parâmetros esta opção é ignorada.</span>
            </span>
          </label>

          <LegacyImportPrompt code={value.code} examId={value.id} createdAt={(value as { created_at?: string }).created_at} />

          {value.id && (
            <>
              <LegacyPricesSection examId={value.id} code={value.code} />
              <ParametersSection examId={value.id} />
              <ReferenceRangesSection examId={value.id} />
            </>
          )}
        </>
      )}
      />
    </div>
  );
}

function PendingReviewBanner() {
  const { data } = useQuery({
    queryKey: ["reference-ranges-pending"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reference_ranges")
        .select("id, exam_id, exam_parameter_id, exam_parameters(exam_id, exams(code, name)), exams(code, name)")
        .eq("needs_review", true);
      if (error) throw error;
      const byExam = new Map<string, { code: string; name: string; count: number }>();
      for (const r of (data ?? []) as any[]) {
        const exam = r.exams ?? r.exam_parameters?.exams;
        if (!exam) continue;
        const key = exam.code;
        const cur = byExam.get(key) ?? { code: exam.code, name: exam.name, count: 0 };
        cur.count += 1;
        byExam.set(key, cur);
      }
      return Array.from(byExam.values()).sort((a, b) => a.code.localeCompare(b.code));
    },
  });
  if (!data || data.length === 0) return null;
  const total = data.reduce((s, e) => s + e.count, 0);
  return (
    <div className="border border-amber-300 bg-amber-50 text-amber-900 rounded-md px-3 py-2 text-sm">
      <div className="font-medium">Referências pendentes de revisão ({total})</div>
      <div className="text-xs text-amber-800 mt-1">
        Importado do sistema legado — abra cada exame para revisar e, se necessário, quebrar em faixas por idade/sexo:
        {" "}
        {data.map(e => `${e.code} (${e.count})`).join(", ")}
      </div>
    </div>
  );
}

const FORMULA_HELP =
  "Use o CÓDIGO de outros parâmetros deste exame. Operações: + − * / ^ e parênteses. Funções: sqrt( ), ln( ), log( ), exp( ), abs( ), min(a; b), max(a; b). " +
  "O campo calculado fica verde e não aceita digitação; só calcula quando os campos usados estiverem preenchidos.";

function parseDecimals(v: unknown): number | null {
  if (v === "" || v == null) return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > 6) throw new Error("Casas decimais: informe um número inteiro de 0 a 6");
  return n;
}

// Valida a fórmula contra os códigos já cadastrados e barra ciclos (A usa B e B usa A).
function checkFormula(formula: string, code: string | null, selfId: string | null, existing: any[]) {
  const others = existing.filter(p => p.id !== selfId);
  const err = validateFormula(formula, others.map(p => p.code).filter(Boolean), code);
  if (err) throw new Error(err);
  const cyc = findFormulaCycle([...others.map(p => ({ code: p.code, formula: p.formula })), { code, formula }]);
  if (cyc) throw new Error(`Fórmulas em ciclo: ${cyc.join(" → ")}`);
}

function ParametersSection({ examId }: { examId: string }) {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState<any>({ name: "", unit: "", display_order: 0, value_type: "numeric", group_label: "", code: "", formula: "", decimals: "", counts_as_result: true, extra_line_before: "", extra_line_after: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFormula, setEditFormula] = useState("");
  const [editDecimals, setEditDecimals] = useState("");
  const [editCounts, setEditCounts] = useState(true);
  const [editBefore, setEditBefore] = useState("");
  const [editAfter, setEditAfter] = useState("");

  const { data = [] } = useQuery({
    queryKey: ["exam-parameters", examId],
    queryFn: async () => {
      const { data, error } = await supabase.from("exam_parameters").select("*").eq("exam_id", examId).order("display_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!draft.name?.trim()) throw new Error("Nome é obrigatório");
      const formula = draft.formula?.trim() || null;
      const decimals = parseDecimals(draft.decimals);
      if (formula) {
        if (draft.value_type !== "numeric") throw new Error("Só parâmetros numéricos podem ter fórmula");
        checkFormula(formula, draft.code?.trim() || null, null, data as any[]);
      }
      const { error } = await supabase.from("exam_parameters").insert({
        exam_id: examId,
        name: draft.name.trim(),
        code: draft.code?.trim() || null,
        unit: draft.unit?.trim() || null,
        display_order: Number(draft.display_order) || 0,
        value_type: draft.value_type,
        group_label: draft.group_label?.trim() || null,
        formula,
        decimals: formula ? decimals : null,
        counts_as_result: draft.counts_as_result !== false,
        extra_line_before: draft.extra_line_before?.trim() || null,
        extra_line_after: draft.extra_line_after?.trim() || null,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exam-parameters", examId] });
      setDraft({ name: "", unit: "", display_order: 0, value_type: "numeric", group_label: "", code: "", formula: "", decimals: "", counts_as_result: true, extra_line_before: "", extra_line_after: "" });
      setShowAdd(false);
      toast.success("Parâmetro adicionado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveOptions = useMutation({
    mutationFn: async (p: any) => {
      const formula = editFormula.trim() || null;
      if (formula) {
        if (p.value_type !== "numeric") throw new Error("Só parâmetros numéricos podem ter fórmula");
        checkFormula(formula, p.code, p.id, data as any[]);
      }
      const { error } = await supabase
        .from("exam_parameters")
        .update({
          formula,
          decimals: formula ? parseDecimals(editDecimals) : null,
          counts_as_result: editCounts,
          extra_line_before: editBefore.trim() || null,
          extra_line_after: editAfter.trim() || null,
        } as never)
        .eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exam-parameters", examId] });
      setEditingId(null);
      toast.success("Opções do campo salvas");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("exam_parameters").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["exam-parameters", examId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="border rounded-md p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">Parâmetros</div>
        <Button type="button" size="sm" variant="outline" onClick={() => setShowAdd(v => !v)}><Plus className="size-3 mr-1" />Adicionar</Button>
      </div>
      {data.length === 0 && !showAdd && <div className="text-xs text-muted-foreground">Exame simples (sem parâmetros). Adicione parâmetros para transformar em exame composto.</div>}
      {data.length > 0 && (
        <div className="space-y-1">
          {(data as any[]).map((p) => (
            <div key={p.id} className="bg-muted/40 rounded px-2 py-1 space-y-1">
              <div className="grid grid-cols-[40px_1fr_100px_80px_120px_auto] gap-2 items-center text-xs">
                <div className="tabular-nums">{p.display_order}</div>
                <div>{p.name}{p.code ? ` (${p.code})` : ""}</div>
                <div className="text-muted-foreground">{p.unit ?? "—"}</div>
                <div className="text-muted-foreground">{p.value_type}</div>
                <div className="text-muted-foreground truncate">{p.group_label ?? ""}</div>
                <div className="flex">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    title="Opções do campo: fórmula, conta como resultado e linhas extras do laudo"
                    className={p.formula || p.counts_as_result === false || p.extra_line_before || p.extra_line_after ? "text-emerald-700" : "text-muted-foreground"}
                    onClick={() => {
                      setEditingId(editingId === p.id ? null : p.id);
                      setEditFormula(p.formula ?? "");
                      setEditDecimals(p.decimals != null ? String(p.decimals) : "");
                      setEditCounts(p.counts_as_result !== false);
                      setEditBefore(p.extra_line_before ?? "");
                      setEditAfter(p.extra_line_after ?? "");
                    }}
                  >
                    <SlidersHorizontal className="size-3.5" />
                  </Button>
                  <Button type="button" size="icon" variant="ghost" onClick={() => del.mutate(p.id)}><Trash2 className="size-3 text-destructive" /></Button>
                </div>
              </div>
              {editingId !== p.id && (p.formula || p.counts_as_result === false || p.extra_line_before || p.extra_line_after) && (
                <div className="text-[11px] pl-[48px] space-y-0.5">
                  {p.formula && (
                    <div className="text-emerald-800">
                      Calculado: <span className="font-mono">{p.formula}</span>{p.decimals != null ? ` · ${p.decimals} casa(s) decimal(is)` : ""}
                    </div>
                  )}
                  {p.counts_as_result === false && <div className="text-amber-800">Não conta como resultado (sozinho, não completa o exame)</div>}
                  {p.extra_line_before && <div className="text-muted-foreground">Linha antes no laudo: “{p.extra_line_before}”</div>}
                  {p.extra_line_after && <div className="text-muted-foreground">Linha depois no laudo: “{p.extra_line_after}”</div>}
                </div>
              )}
              {editingId === p.id && (
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_130px] gap-2 pl-[48px] pb-1">
                  {p.value_type === "numeric" && (
                    <>
                      <Input className="h-8 font-mono text-xs" placeholder="Fórmula, ex.: TOTAL - DIRETA (vazio = digitado)" value={editFormula} onChange={e => setEditFormula(e.target.value)} />
                      <Input className="h-8 text-xs" type="number" min={0} max={6} placeholder="Casas decimais" value={editDecimals} onChange={e => setEditDecimals(e.target.value)} />
                      <div className="sm:col-span-2 text-[11px] text-muted-foreground">{FORMULA_HELP}</div>
                    </>
                  )}
                  <label className="sm:col-span-2 flex items-start gap-2 text-xs">
                    <Checkbox checked={editCounts} onCheckedChange={v => setEditCounts(!!v)} className="mt-0.5" />
                    <span>
                      <b>Conta como resultado.</b> Desmarque para campos que só complementam (ex.: observação antes do resultado): se o único campo
                      preenchido for deste tipo, o exame ainda não é considerado com resultado.
                    </span>
                  </label>
                  <Input className="h-8 text-xs" placeholder="Linha extra ANTES do campo no laudo (opcional)" value={editBefore} onChange={e => setEditBefore(e.target.value)} />
                  <div className="hidden sm:block" />
                  <Input className="h-8 text-xs" placeholder="Linha extra DEPOIS do campo no laudo (opcional)" value={editAfter} onChange={e => setEditAfter(e.target.value)} />
                  <div className="hidden sm:block" />
                  <div className="sm:col-span-2 flex gap-1 justify-end">
                    <Button type="button" size="sm" variant="outline" onClick={() => setEditingId(null)}>Cancelar</Button>
                    <Button type="button" size="sm" onClick={() => saveOptions.mutate(p)} disabled={saveOptions.isPending}>Salvar</Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {showAdd && (
        <div className="grid grid-cols-2 gap-2 pt-2 border-t">
          <Input placeholder="Nome*" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} />
          <Input placeholder="Código (opcional)" value={draft.code} onChange={e => setDraft({ ...draft, code: e.target.value })} />
          <Input placeholder="Unidade" value={draft.unit} onChange={e => setDraft({ ...draft, unit: e.target.value })} />
          <Input type="number" placeholder="Ordem" value={draft.display_order} onChange={e => setDraft({ ...draft, display_order: e.target.value })} />
          <Select value={draft.value_type} onValueChange={v => setDraft({ ...draft, value_type: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="numeric">Numérico</SelectItem>
              <SelectItem value="qualitative">Qualitativo</SelectItem>
              <SelectItem value="text">Texto</SelectItem>
            </SelectContent>
          </Select>
          <Input placeholder="Grupo (opcional)" value={draft.group_label} onChange={e => setDraft({ ...draft, group_label: e.target.value })} />
          {draft.value_type === "numeric" && (
            <>
              <Input className="font-mono" placeholder="Fórmula (opcional) — ex.: TOTAL - DIRETA" value={draft.formula} onChange={e => setDraft({ ...draft, formula: e.target.value })} />
              <Input type="number" min={0} max={6} placeholder="Casas decimais do resultado" value={draft.decimals} onChange={e => setDraft({ ...draft, decimals: e.target.value })} />
              {draft.formula?.trim() && <div className="col-span-2 text-[11px] text-muted-foreground">{FORMULA_HELP}</div>}
            </>
          )}
          <Input placeholder="Linha extra ANTES no laudo (opcional)" value={draft.extra_line_before} onChange={e => setDraft({ ...draft, extra_line_before: e.target.value })} />
          <Input placeholder="Linha extra DEPOIS no laudo (opcional)" value={draft.extra_line_after} onChange={e => setDraft({ ...draft, extra_line_after: e.target.value })} />
          <label className="col-span-2 flex items-center gap-2 text-xs">
            <Checkbox checked={draft.counts_as_result !== false} onCheckedChange={v => setDraft({ ...draft, counts_as_result: !!v })} />
            Conta como resultado (desmarque para campos que só complementam o exame)
          </label>
          <div className="col-span-2 flex gap-2 justify-end">
            <Button type="button" size="sm" variant="outline" onClick={() => setShowAdd(false)}>Cancelar</Button>
            <Button type="button" size="sm" onClick={() => add.mutate()} disabled={add.isPending}>Salvar parâmetro</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ReferenceRangesSection({ examId }: { examId: string }) {
  const qc = useQueryClient();
  const companyId = useCompanyId();
  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState<any>({ target: "exam", exam_parameter_id: "", sex: "any", age_min_y: "", age_min_m: "", age_max_y: "", age_max_m: "", range_min: "", range_max: "", panic_min: "", panic_max: "", category_label: "", display_text: "" });

  const { data: params = [] } = useQuery({
    queryKey: ["exam-parameters", examId],
    queryFn: async () => {
      const { data } = await supabase.from("exam_parameters").select("id,name").eq("exam_id", examId).order("display_order");
      return data ?? [];
    },
  });

  const paramIds = (params as any[]).map(p => p.id);
  const { data = [] } = useQuery({
    queryKey: ["reference-ranges", examId, paramIds.join(",")],
    queryFn: async () => {
      const orExpr = paramIds.length ? `exam_id.eq.${examId},exam_parameter_id.in.(${paramIds.join(",")})` : `exam_id.eq.${examId}`;
      const { data, error } = await supabase.from("reference_ranges").select("*").or(orExpr).order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const toMonths = (y: string, m: string) => {
    const yy = Number(y) || 0;
    const mm = Number(m) || 0;
    if (!y && !m) return null;
    return yy * 12 + mm;
  };

  const add = useMutation({
    mutationFn: async () => {
      if (!draft.display_text?.trim()) throw new Error("Texto de referência é obrigatório");
      if (!companyId) throw new Error("Sem empresa");
      const payload: any = {
        company_id: companyId,
        exam_id: draft.target === "exam" ? examId : null,
        exam_parameter_id: draft.target === "param" ? draft.exam_parameter_id : null,
        sex: draft.sex === "any" ? null : draft.sex,
        age_min_months: toMonths(draft.age_min_y, draft.age_min_m),
        age_max_months: toMonths(draft.age_max_y, draft.age_max_m),
        range_min: draft.range_min === "" ? null : Number(draft.range_min),
        range_max: draft.range_max === "" ? null : Number(draft.range_max),
        panic_min: draft.panic_min === "" ? null : Number(String(draft.panic_min).replace(",", ".")),
        panic_max: draft.panic_max === "" ? null : Number(String(draft.panic_max).replace(",", ".")),
        category_label: draft.category_label?.trim() || null,
        display_text: draft.display_text.trim(),
      };
      if (draft.target === "param" && !payload.exam_parameter_id) throw new Error("Selecione o parâmetro");
      if ((payload.panic_min != null && Number.isNaN(payload.panic_min)) || (payload.panic_max != null && Number.isNaN(payload.panic_max))) throw new Error("Valores de pânico devem ser números");
      if (payload.panic_min != null && payload.range_min != null && payload.panic_min > payload.range_min) throw new Error("Pânico mínimo deve ser menor ou igual ao mínimo da faixa");
      if (payload.panic_max != null && payload.range_max != null && payload.panic_max < payload.range_max) throw new Error("Pânico máximo deve ser maior ou igual ao máximo da faixa");
      const { error } = await supabase.from("reference_ranges").insert(payload as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reference-ranges", examId] });
      setDraft({ target: "exam", exam_parameter_id: "", sex: "any", age_min_y: "", age_min_m: "", age_max_y: "", age_max_m: "", range_min: "", range_max: "", panic_min: "", panic_max: "", category_label: "", display_text: "" });
      setShowAdd(false);
      toast.success("Referência adicionada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("reference_ranges").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reference-ranges", examId] });
      qc.invalidateQueries({ queryKey: ["reference-ranges-pending"] });
    },
  });

  const markReviewed = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("reference_ranges").update({ needs_review: false } as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reference-ranges", examId] });
      qc.invalidateQueries({ queryKey: ["reference-ranges-pending"] });
      toast.success("Referência marcada como revisada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const paramNameById = new Map((params as any[]).map(p => [p.id, p.name]));
  const [onlyPending, setOnlyPending] = useState(false);
  const rows = (data as any[]).filter(r => !onlyPending || r.needs_review);
  const pendingCount = (data as any[]).filter(r => r.needs_review).length;

  return (
    <div className="border rounded-md p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-medium">Referências por idade/sexo{pendingCount > 0 && <span className="ml-2 text-xs text-amber-800">({pendingCount} a revisar)</span>}</div>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <label className="flex items-center gap-1 text-xs text-amber-800">
              <Checkbox checked={onlyPending} onCheckedChange={v => setOnlyPending(!!v)} />
              Apenas pendentes
            </label>
          )}
          <Button type="button" size="sm" variant="outline" onClick={() => setShowAdd(v => !v)}><Plus className="size-3 mr-1" />Adicionar</Button>
        </div>
      </div>
      {rows.length === 0 && !showAdd && <div className="text-xs text-muted-foreground">Sem referências {onlyPending ? "pendentes" : "cadastradas"}.</div>}
      {rows.map((r) => (
        <div key={r.id} className={`grid grid-cols-[1fr_60px_120px_100px_1fr_auto] gap-2 items-center text-xs rounded px-2 py-1 ${r.needs_review ? "bg-amber-50 border border-amber-200" : "bg-muted/40"}`}>
          <div className="truncate flex items-center gap-1">
            {r.needs_review && <span className="inline-block bg-amber-200 text-amber-900 rounded px-1 text-[10px] font-medium">REVISAR</span>}
            {r.exam_parameter_id ? `[${paramNameById.get(r.exam_parameter_id) ?? "?"}]` : "[exame]"} {r.category_label ?? ""}
          </div>
          <div>{r.sex ?? "M/F"}</div>
          <div>{formatAgeMonths(r.age_min_months)} — {formatAgeMonths(r.age_max_months)}</div>
          <div className="tabular-nums">
            {r.range_min ?? "—"}/{r.range_max ?? "—"}
            {(r.panic_min != null || r.panic_max != null) && (
              <div className="text-[10px] text-red-700">pânico &lt;{r.panic_min ?? "—"} / &gt;{r.panic_max ?? "—"}</div>
            )}
          </div>
          <div className="truncate text-muted-foreground">{r.display_text}</div>
          <div className="flex gap-1">
            {r.needs_review && (
              <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => markReviewed.mutate(r.id)}>Revisada</Button>
            )}
            <Button type="button" size="icon" variant="ghost" onClick={() => del.mutate(r.id)}><Trash2 className="size-3 text-destructive" /></Button>
          </div>
        </div>
      ))}
      {showAdd && (
        <div className="grid grid-cols-2 gap-2 pt-2 border-t">
          <Select value={draft.target} onValueChange={v => setDraft({ ...draft, target: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="exam">Aplica ao exame</SelectItem>
              <SelectItem value="param" disabled={params.length === 0}>Aplica a parâmetro</SelectItem>
            </SelectContent>
          </Select>
          {draft.target === "param" ? (
            <Select value={draft.exam_parameter_id} onValueChange={v => setDraft({ ...draft, exam_parameter_id: v })}>
              <SelectTrigger><SelectValue placeholder="Parâmetro" /></SelectTrigger>
              <SelectContent>
                {(params as any[]).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : <div />}
          <Select value={draft.sex} onValueChange={v => setDraft({ ...draft, sex: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Ambos os sexos</SelectItem>
              <SelectItem value="M">Masculino</SelectItem>
              <SelectItem value="F">Feminino</SelectItem>
            </SelectContent>
          </Select>
          <Input placeholder="Categoria (opcional)" value={draft.category_label} onChange={e => setDraft({ ...draft, category_label: e.target.value })} />
          <div className="grid grid-cols-2 gap-1">
            <Input placeholder="Idade mín anos" value={draft.age_min_y} onChange={e => setDraft({ ...draft, age_min_y: e.target.value })} />
            <Input placeholder="meses" value={draft.age_min_m} onChange={e => setDraft({ ...draft, age_min_m: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-1">
            <Input placeholder="Idade máx anos" value={draft.age_max_y} onChange={e => setDraft({ ...draft, age_max_y: e.target.value })} />
            <Input placeholder="meses" value={draft.age_max_m} onChange={e => setDraft({ ...draft, age_max_m: e.target.value })} />
          </div>
          <Input placeholder="Mínimo (num)" value={draft.range_min} onChange={e => setDraft({ ...draft, range_min: e.target.value })} />
          <Input placeholder="Máximo (num)" value={draft.range_max} onChange={e => setDraft({ ...draft, range_max: e.target.value })} />
          <Input className="border-red-300" placeholder="Pânico: abaixo de (num)" value={draft.panic_min} onChange={e => setDraft({ ...draft, panic_min: e.target.value })} />
          <Input className="border-red-300" placeholder="Pânico: acima de (num)" value={draft.panic_max} onChange={e => setDraft({ ...draft, panic_max: e.target.value })} />
          <div className="col-span-2 text-[11px] text-muted-foreground">Pânico = valor com risco de vida. O sistema alerta quem lança o resultado quando ele fica abaixo/acima destes limites (opcional).</div>
          <div className="col-span-2"><Input placeholder="Texto exibido no laudo*" value={draft.display_text} onChange={e => setDraft({ ...draft, display_text: e.target.value })} /></div>
          <div className="col-span-2 flex gap-2 justify-end">
            <Button type="button" size="sm" variant="outline" onClick={() => setShowAdd(false)}>Cancelar</Button>
            <Button type="button" size="sm" onClick={() => add.mutate()} disabled={add.isPending}>Salvar referência</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// A importação do legado só vale logo depois de criar o exame. Sem esta trava, abrir qualquer exame
// existente reimportava parâmetros e referências, desfazendo o que a pessoa tinha apagado ou editado.
const IMPORT_WINDOW_MS = 10 * 60 * 1000;
const importedKey = (examId: string) => `labis-legacy-imported:${examId}`;
function alreadyImported(examId: string) {
  try { return localStorage.getItem(importedKey(examId)) === "1"; } catch { return false; }
}
function markImported(examId: string) {
  try { localStorage.setItem(importedKey(examId), "1"); } catch { /* sem armazenamento: a janela de tempo ainda protege */ }
}

function LegacyImportPrompt({ code, examId, createdAt }: { code?: string; examId?: string; createdAt?: string }) {
  const qc = useQueryClient();
  const companyId = useCompanyId();
  const [enabled, setEnabled] = useState(true);
  const [debounced, setDebounced] = useState((code ?? "").trim());
  const firedRef = useRef<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced((code ?? "").trim()), 300);
    return () => clearTimeout(t);
  }, [code]);

  const { data } = useQuery({
    queryKey: ["xlab-legacy-count", debounced],
    enabled: debounced.length >= 2,
    staleTime: 60000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("xlab_legacy_reference_staging")
        .select("source")
        .eq("exam_code", debounced);
      if (error) throw error;
      const rows = (data ?? []) as { source: string }[];
      return {
        params: rows.filter(r => r.source === "param").length,
        refs: rows.filter(r => r.source === "reference").length,
      };
    },
  });

  useEffect(() => {
    if (!examId || !enabled || !companyId || !debounced) return;
    if (firedRef.current === examId) return;
    if (!data || data.params + data.refs === 0) return;
    const age = createdAt ? Date.now() - new Date(createdAt).getTime() : Infinity;
    if (!(age >= 0 && age < IMPORT_WINDOW_MS) || alreadyImported(examId)) return;
    firedRef.current = examId;
    markImported(examId);
    (async () => {
      try {
        const { data: rows, error } = await supabase
          .from("xlab_legacy_reference_staging").select("*").eq("exam_code", debounced);
        if (error) throw error;
        const all = (rows ?? []) as any[];
        const paramRows = all.filter(r => r.source === "param");
        const refRows = all.filter(r => r.source === "reference");

        const paramInserts = paramRows.map(r => ({
          exam_id: examId,
          code: r.param_code,
          name: r.label || r.param_code || "Parâmetro",
          unit: r.unit,
          display_order: r.param_order ?? 0,
          value_type: "numeric",
        }));
        let inserted: any[] = [];
        if (paramInserts.length) {
          const { data: ip, error: pe } = await supabase.from("exam_parameters").insert(paramInserts as never).select();
          if (pe) throw pe;
          inserted = ip ?? [];
        }
        const paramByCode = new Map<string, string>();
        for (const p of inserted) if (p.code) paramByCode.set(p.code, p.id);

        const numericRefs = paramRows
          .filter(r => (r.range_min != null && r.range_min !== 0) || (r.range_max != null && r.range_max !== 0))
          .map(r => {
            const pid = r.param_code ? paramByCode.get(r.param_code) ?? null : null;
            return {
              company_id: companyId,
              exam_id: pid ? null : examId,
              exam_parameter_id: pid,
              range_min: r.range_min,
              range_max: r.range_max,
              display_text: `${r.range_min ?? ""} - ${r.range_max ?? ""}`.trim(),
              needs_review: false,
            };
          });

        const textRefs = refRows
          .filter(r => (r.reference_text ?? "").trim())
          .map(r => {
            const pid = r.param_code ? paramByCode.get(r.param_code) ?? null : null;
            return {
              company_id: companyId,
              exam_id: pid ? null : examId,
              exam_parameter_id: pid,
              sex: r.sex,
              effective_from: r.effective_from,
              display_text: r.reference_text,
              needs_review: true,
            };
          });

        const allRefs = [...numericRefs, ...textRefs];
        if (allRefs.length) {
          const { error: re } = await supabase.from("reference_ranges").insert(allRefs as never);
          if (re) throw re;
        }

        toast.success(`Importado do legado: ${inserted.length} parâmetros, ${allRefs.length} referências`);
        qc.invalidateQueries({ queryKey: ["exam-parameters", examId] });
        qc.invalidateQueries({ queryKey: ["reference-ranges", examId] });
        qc.invalidateQueries({ queryKey: ["reference-ranges-pending"] });
      } catch (e: any) {
        toast.error(`Falha ao importar legado: ${e.message ?? e}`);
      }
    })();
  }, [examId, enabled, data, debounced, companyId, createdAt, qc]);

  if (examId) return null;
  if (!debounced || debounced.length < 2) return null;
  if (!data || data.params + data.refs === 0) return null;

  return (
    <div className="border border-blue-300 bg-blue-50 text-blue-900 rounded-md px-3 py-2 text-sm">
      <div className="font-medium">Dados legados encontrados para "{debounced}"</div>
      <div className="text-xs mt-0.5">{data.params} parâmetro(s) e {data.refs} referência(s) do sistema X-LAB.</div>
      <label className="flex items-center gap-2 mt-1 text-xs">
        <Checkbox checked={enabled} onCheckedChange={v => setEnabled(!!v)} />
        Importar automaticamente após salvar
      </label>
    </div>
  );
}
