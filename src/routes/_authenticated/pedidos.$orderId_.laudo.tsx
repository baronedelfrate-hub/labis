import { createFileRoute, Link } from "@tanstack/react-router";
import { formatDateBR } from "@/lib/dates";
import { orderRef } from "@/lib/order-ref";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { getPortalAccessInfo } from "@/lib/portal.functions";
import { formatPatientAge } from "@/lib/age";
import { FlaggedValue, limitsOf } from "@/components/FlaggedValue";
import { TextExamBlock } from "@/components/TextExamBlock";
import { useCompanyBranding } from "@/hooks/useCompanyBranding";

export const Route = createFileRoute("/_authenticated/pedidos/$orderId_/laudo")({
  ssr: false,
  head: () => ({ meta: [{ title: "Laudo — DFLAB" }] }),
  component: LaudoPage,
});

function LaudoPage() {
  const { orderId } = Route.useParams();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const fetchPortalInfo = useServerFn(getPortalAccessInfo);
  const { data: branding } = useCompanyBranding();

  const { data: portal } = useQuery({
    queryKey: ["laudo-portal", orderId],
    queryFn: () => fetchPortalInfo({ data: { orderId } }),
  });

  const { data, isLoading, error: loadError, refetch: reload } = useQuery({
    queryKey: ["laudo", orderId],
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    queryFn: async () => {
      const { data: order, error } = await supabase.from("orders").select(`
        id, order_number, daily_code, order_date, collection_date, status, company_id, patient_id,
        patient:patients(name,code,cpf,birth_date,sex),
        doctor:doctors(name,crm,crm_uf),
        insurance:insurance_plans(name),
        unit:units(name)
      `).eq("id", orderId).single();
      if (error) throw error;

      const { data: items } = await supabase.from("order_items")
        .select("id,status,exam_id,exam:exams(code,name,material,sector,default_method,standard_notes,is_text,support_lab:support_labs(name))")
        .eq("order_id", orderId);
      const itemIds = (items ?? []).map(i => i.id);
      const { data: results } = itemIds.length
        ? await supabase.from("results")
            .select("*, reviewer:profiles!results_reviewed_by_fkey(full_name,professional_council,professional_registration)")
            .in("order_item_id", itemIds).eq("released", true)
        : { data: [] as any[] };
      const resultIds = ((results ?? []) as any[]).map((r: any) => r.id);
      const { data: resultValues } = resultIds.length
        ? await supabase.from("result_values")
            .select("*, parameter:exam_parameters(id,name,unit,display_order,group_label)")
            .in("result_id", resultIds)
        : { data: [] as any[] };
      const { data: settings } = await supabase.from("company_settings")
        .select("*").eq("company_id", order.company_id).maybeSingle();

      // resultados anteriores (para exames simples)
      const examIds = Array.from(new Set((items ?? []).map((i: any) => i.exam_id).filter(Boolean)));
      const previousByExam = new Map<string, { value: string; unit: string | null; released_at: string }>();
      if (examIds.length && (order as any).patient_id) {
        const patientId = (order as any).patient_id;
        const { data: prev } = await supabase
          .from("results")
          .select("value, unit, released_at, order_item:order_items!inner(exam_id, order:orders!inner(id, patient_id))")
          .eq("released", true)
          .in("order_item.exam_id", examIds)
          .eq("order_item.order.patient_id", patientId)
          .neq("order_item.order.id", orderId)
          .order("released_at", { ascending: false });
        for (const r of (prev ?? []) as any[]) {
          const exId = r.order_item?.exam_id;
          if (exId && !previousByExam.has(exId)) {
            previousByExam.set(exId, { value: r.value, unit: r.unit, released_at: r.released_at });
          }
        }
      }
      return { order, items: items ?? [], results: results ?? [], resultValues: resultValues ?? [], settings, previousByExam };
    },
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const path = data?.settings?.logo_url;
      if (!path) { setLogoUrl(null); return; }
      const { data: signed } = await supabase.storage.from("company-logos").createSignedUrl(path, 3600);
      if (!cancelled) setLogoUrl(signed?.signedUrl ?? null);
    }
    load();
    return () => { cancelled = true; };
  }, [data?.settings?.logo_url]);

  // O navegador usa o título da página como nome do arquivo ao salvar em PDF
  const patientName = (data?.order as any)?.patient?.name as string | undefined;
  useEffect(() => {
    if (!patientName) return;
    const prev = document.title;
    document.title = `Laudo - ${patientName}`;
    return () => { document.title = prev; };
  }, [patientName]);

  if (loadError) {
    return (
      <div className="p-6">
        <div role="alert" className="max-w-xl rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
          <div className="font-medium">Não foi possível carregar o laudo.</div>
          <div className="mt-1 break-words text-xs">{String((loadError as Error)?.message ?? "Erro desconhecido")}</div>
          <div className="mt-1 text-xs">Se o erro continuar, envie este texto ao suporte.</div>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="outline" onClick={() => reload()}>Tentar de novo</Button>
            <Button size="sm" variant="ghost" asChild><Link to="/pedidos/$orderId" params={{ orderId }}>Voltar ao pedido</Link></Button>
          </div>
        </div>
      </div>
    );
  }
  if (isLoading || !data) return <div className="p-6 text-muted-foreground">Carregando...</div>;

  const normalizedStatus = String((data.order as any)?.status ?? "").trim().toLowerCase();
  if (normalizedStatus !== "finalizado") {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <div className="rounded-md border bg-card p-6 space-y-3">
          <div className="text-lg font-semibold">Laudo indisponível</div>
          <div className="text-sm text-muted-foreground">Este pedido ainda não foi finalizado.</div>
          <Button asChild variant="outline"><Link to="/pedidos/$orderId" params={{ orderId }}><ArrowLeft className="size-4 mr-1" />Voltar ao pedido</Link></Button>
        </div>
      </div>
    );
  }

  const o = data.order as any;
  const s = data.settings ?? ({} as any);
  const resultByItem = new Map((data.results as any[]).map(r => [r.order_item_id, r]));
  const valuesByResult = new Map<string, any[]>();
  for (const v of data.resultValues as any[]) {
    const arr = valuesByResult.get(v.result_id) ?? [];
    arr.push(v);
    valuesByResult.set(v.result_id, arr);
  }
  const releasedItems = (data.items as any[]).filter(i => resultByItem.has(i.id));
  const isTextItem = (i: any) => !!i.exam?.is_text && !(valuesByResult.get(resultByItem.get(i.id).id)?.length);
  const textItems = releasedItems.filter(isTextItem);
  const simpleItems = releasedItems.filter(i => !isTextItem(i) && !(valuesByResult.get(resultByItem.get(i.id).id)?.length));
  const composedItems = releasedItems.filter(i => (valuesByResult.get(resultByItem.get(i.id).id)?.length ?? 0) > 0);
  // Quem liberou (revisão) e exames feitos por laboratório de apoio, para o rodapé e as notas
  const reviewers = Array.from(
    new Map(
      (data.results as any[]).map((r) => r.reviewer).filter((p: any) => p?.full_name).map((p: any) => [p.full_name, p] as const),
    ).values(),
  ) as { full_name: string; professional_council?: string | null; professional_registration?: string | null }[];
  const reviewerText = (p: (typeof reviewers)[number]) => `${p.full_name}${p.professional_council ? ` — ${p.professional_council} ${p.professional_registration ?? ""}`.trimEnd() : ""}`;
  const apoioByLab = new Map<string, string[]>();
  for (const i of [...simpleItems, ...textItems]) {
    const lab = (i as any).exam?.support_lab?.name;
    if (lab) apoioByLab.set(lab, [...(apoioByLab.get(lab) ?? []), (i as any).exam?.code]);
  }
  const showPrev = simpleItems.some((i: any) => data.previousByExam.get(i.exam_id));
  const showObs = simpleItems.some((i: any) => resultByItem.get(i.id)?.observation);
  const labName = s.legal_name || branding?.name || "—";
  const portalBase = typeof window !== "undefined" ? `${window.location.origin}/portal` : "/portal";
  const portalLink = branding?.slug ? `${portalBase}?lab=${branding.slug}` : portalBase;
  const releasedAt = data.results.length
    ? new Date(Math.max(...data.results.map((r: any) => new Date(r.released_at).getTime())))
    : new Date();

  return (
    <div className="laudo-root bg-muted/30 min-h-screen">
      <style>{`
        @media print {
          @page { size: A4; margin: 0; }
          html, body, main, body * { --tw-bg-opacity: 1; }
          html, body, main, #root, .laudo-root { background: white !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .laudo-toolbar, aside, nav { display: none !important; }
          .laudo-root { background: white !important; padding: 0 !important; min-height: auto !important; }
          .laudo-sheet { box-shadow: none !important; border: none !important; margin: 0 !important; max-width: none !important; width: 100% !important; padding: 0 12mm !important; }
          .laudo-spacer { height: 11mm; }
          .laudo-pagefoot { display: block !important; }
        }
        .laudo-pagefoot { display: none; position: fixed; left: 12mm; right: 12mm; bottom: 4mm; font-size: 8px; color: #64748b; border-top: 1px solid #cbd5e1; padding-top: 2px; }
        .laudo-sheet { font-family: Inter, system-ui, sans-serif; color: #111; font-size: 11px; }
        .laudo-sheet table { border-collapse: collapse; width: 100%; }
        .laudo-sheet .lx th, .laudo-sheet .lx td { padding: 2px 6px; border-bottom: 1px solid #eef0f3; text-align: left; font-size: 11px; line-height: 1.3; vertical-align: top; }
        .laudo-sheet .lx th { font-weight: 600; font-size: 10px; color: #475569; border-bottom: 1px solid #94a3b8; }
        .laudo-sheet thead { display: table-header-group; }
        .laudo-sheet tfoot { display: table-footer-group; }
        .laudo-sheet .lx tr { break-inside: avoid; page-break-inside: avoid; }
        .laudo-sheet footer, .laudo-sheet .lx-block-head { break-inside: avoid; page-break-inside: avoid; }
        .laudo-sheet .lx-block-head { break-after: avoid; }
      `}</style>
      <div className="laudo-toolbar sticky top-0 z-10 border-b bg-background/95 backdrop-blur px-6 py-3 flex items-center gap-2">
        <Button variant="outline" size="sm" asChild><Link to="/pedidos/$orderId" params={{ orderId }}><ArrowLeft className="size-4 mr-1" />Voltar</Link></Button>
        <div className="ml-auto">
          <Button size="sm" onClick={() => window.print()}><Printer className="size-4 mr-1" />Imprimir / Salvar como PDF</Button>
        </div>
      </div>
      <div className="laudo-sheet mx-auto my-6 bg-white shadow-sm border max-w-[210mm] px-8 py-6">
        <table><thead><tr><td className="laudo-spacer" style={{ padding: 0, border: 0 }} /></tr></thead><tfoot><tr><td className="laudo-spacer" style={{ padding: 0, border: 0, height: "11mm" }} /></tr></tfoot><tbody><tr><td style={{ padding: 0, border: 0 }}>
        <header className="flex items-start gap-3 border-b-2 border-slate-700 pb-2">
          {logoUrl && <img src={logoUrl} alt="Logo" className="max-h-14 max-w-[110px] object-contain" />}
          <div className="flex-1">
            <div className="text-base font-bold uppercase tracking-wide">{labName}</div>
            <div className="text-xs text-muted-foreground mt-0.5 space-y-0.5">
              {s.address && <div>{s.address}{s.city ? ` — ${s.city}` : ""}{s.state ? `/${s.state}` : ""}{s.zip_code ? ` — CEP ${s.zip_code}` : ""}</div>}
              <div>{s.phone && <span>Tel: {s.phone}</span>}{s.phone && s.email && " · "}{s.email && <span>{s.email}</span>}</div>
              <div>{s.cnpj && <span>CNPJ: {s.cnpj}</span>}{s.cnpj && s.cnes && " · "}{s.cnes && <span>CNES: {s.cnes}</span>}</div>
            </div>
          </div>
          <div className="text-right text-xs shrink-0">
            <div className="font-semibold text-sm">LAUDO</div>
            <div className="mt-0.5">Pedido <span className="font-semibold">{orderRef(o)}</span></div>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-x-6 gap-y-1 py-2 text-xs border-b">
          <div className="col-span-2 text-sm"><span className="text-[10px] uppercase tracking-wide text-muted-foreground mr-2">Paciente</span><span className="font-bold">{o.patient?.name || "—"}</span></div>
          <Info k="Código" v={o.patient?.code} />
          <Info k="CPF" v={o.patient?.cpf} />
          <Info k="Nascimento" v={formatDateBR(o.patient?.birth_date)} />
          <Info k="Idade" v={formatPatientAge(o.patient?.birth_date, o.order_date)} />
          <Info k="Médico solicitante" v={o.doctor?.name ? `${o.doctor.name} — CRM ${o.doctor.crm}/${o.doctor.crm_uf}` : "—"} />
          <Info k="Convênio" v={o.insurance?.name ?? "Particular"} />
          <Info k="Data de coleta" v={formatDateBR(o.collection_date)} />
          <Info k="Data de emissão" v={releasedAt.toLocaleString("pt-BR")} />
        </section>

        {simpleItems.length > 0 && (
          <section className="pt-2">
            <table className="lx">
              <thead>
                <tr>
                  <th style={{ width: "70px" }}>Código</th>
                  <th>Exame</th>
                  <th style={{ width: "110px" }}>Resultado</th>
                  <th style={{ width: "80px" }}>Unidade</th>
                  <th style={{ width: "130px" }}>Referência</th>
                  {showPrev && <th style={{ width: "130px" }}>Anterior</th>}
                  {showObs && <th>Observação</th>}
                </tr>
              </thead>
              <tbody>
                {simpleItems.map((i: any) => {
                  const r = resultByItem.get(i.id);
                  const ref = r.reference_min != null || r.reference_max != null
                    ? `${r.reference_min ?? "—"} — ${r.reference_max ?? "—"}` : "—";
                  const prev = data.previousByExam.get(i.exam_id);
                  return (
                    <tr key={i.id}>
                      <td className="tabular-nums">{i.exam?.code}</td>
                      <td>{i.exam?.name}</td>
                      <td className="tabular-nums font-medium"><FlaggedValue value={r.value} limits={limitsOf(r)} /></td>
                      <td>{r.unit ?? "—"}</td>
                      <td className="tabular-nums">{ref}</td>
                      {showPrev && <td className="tabular-nums text-muted-foreground">
                        {prev ? (<><div>{prev.value}{prev.unit ? ` ${prev.unit}` : ""}</div><div className="text-[10px]">{new Date(prev.released_at).toLocaleDateString("pt-BR")}</div></>) : "—"}
                      </td>}
                      {showObs && <td>{r.observation ?? ""}</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        )}

        {apoioByLab.size > 0 && (
          <section className="mt-2 text-xs text-muted-foreground">
            {Array.from(apoioByLab.entries()).map(([lab, codes]) => (
              <div key={lab}>Exame(s) realizado(s) pelo laboratório de apoio <span className="font-medium text-foreground">{lab}</span>: {codes.join(", ")}.</div>
            ))}
          </section>
        )}

        {textItems.map((i: any) => (
          <TextExamBlock key={i.id} item={i} result={resultByItem.get(i.id)} collectionDate={o.collection_date} />
        ))}

        {composedItems.map((i: any) => {
          const r = resultByItem.get(i.id);
          const values = (valuesByResult.get(r.id) ?? []).slice().sort((a, b) => (a.parameter?.display_order ?? 0) - (b.parameter?.display_order ?? 0));
          const groups = new Map<string, any[]>();
          for (const v of values) {
            const key = v.parameter?.group_label ?? "";
            const arr = groups.get(key) ?? [];
            arr.push(v);
            groups.set(key, arr);
          }
          return <ExamBlock key={i.id} item={i} result={r} groups={Array.from(groups.entries())} releasedAt={releasedAt} collectionDate={o.collection_date} />;
        })}

        {portal?.public_code && (
          <section className="mt-6 rounded border border-dashed p-3 text-xs">
            <div className="font-medium">Acesso digital ao laudo</div>
            <div className="text-muted-foreground mt-1">
              Consulte este laudo online em{" "}
              <span className="font-mono">{portalLink}</span>
              {" "}informando o código{" "}
              <span className="font-mono font-semibold tracking-widest">{portal.public_code}</span>.
              A senha de 6 dígitos é entregue separadamente pelo laboratório.
            </div>
          </section>
        )}

        <footer className="mt-6 pt-3 border-t text-xs">
          <div className="flex items-end justify-between gap-4">
            <div>
              {s.footer_note && <div className="text-muted-foreground whitespace-pre-line mb-2">{s.footer_note}</div>}
              <div>Emitido em {releasedAt.toLocaleString("pt-BR")}</div>
            </div>
            <div className="text-center min-w-[240px]">
              <div className="border-t pt-1">
                <div className="font-medium">{s.responsible_tech_name || reviewers[0]?.full_name || "—"}</div>
                <div className="text-muted-foreground">{s.responsible_tech_name ? (s.responsible_tech_council || "") : (reviewers[0] ? `${reviewers[0].professional_council ?? ""} ${reviewers[0].professional_registration ?? ""}`.trim() : "")}</div>
              </div>
              {reviewers.length > 0 && (
                <div className="mt-1 text-[11px] text-muted-foreground">Liberado por: {reviewers.map(reviewerText).join("; ")}</div>
              )}
            </div>
          </div>
        </footer>
        </td></tr></tbody></table>
      </div>
      <div className="laudo-pagefoot">{labName} · Laudo do pedido {orderRef(o)} · Impresso em {new Date().toLocaleString("pt-BR")}</div>
    </div>
  );
}

// Linha extra do campo (cadastrada no exame): pequena, em itálico, ocupando a largura da tabela
const EXTRA_LINE_STYLE = { fontStyle: "italic", fontSize: "11px", color: "#475569", whiteSpace: "pre-line" } as const;

export function ExamBlock({ item, result, groups, releasedAt, collectionDate }: { item: any; result: any; groups: [string, any[]][]; releasedAt: Date; collectionDate: string | null }) {
  const reviewer = result.reviewer;
  return (
    <section className="mt-4">
      <div className="lx-block-head border-b-2 border-slate-700 px-1 pb-1 flex flex-wrap items-baseline gap-x-5 gap-y-0.5 text-[11px]">
        <div className="text-[13px] font-bold uppercase">{item.exam?.name} <span className="text-[10px] font-normal text-muted-foreground">({item.exam?.code})</span></div>
        {item.exam?.material && <div><span className="text-muted-foreground">Material:</span> {item.exam.material}</div>}
        {item.exam?.support_lab?.name && <div className="text-xs"><span className="text-muted-foreground">Exame realizado pelo laboratório de apoio:</span> {item.exam.support_lab.name}</div>}
        {result.method && <div><span className="text-muted-foreground">Método:</span> {result.method}</div>}
        {collectionDate && <div><span className="text-muted-foreground">Coleta:</span> {new Date(collectionDate).toLocaleDateString("pt-BR")}</div>}
        <div><span className="text-muted-foreground">Liberação:</span> {new Date(result.released_at).toLocaleDateString("pt-BR")}</div>
      </div>
      <table className="lx">
        <thead>
          <tr>
            <th>Parâmetro</th>
            <th style={{ width: "110px" }}>Resultado</th>
            <th style={{ width: "80px" }}>Unidade</th>
            <th style={{ width: "36%" }}>Valor de referência</th>
          </tr>
        </thead>
        <tbody>
          {groups.flatMap(([groupLabel, values]) => [
            ...(groupLabel ? [<tr key={`g-${groupLabel}`}><td colSpan={4} style={{ fontStyle: "italic", fontWeight: 600, paddingTop: 6 }}>{groupLabel}</td></tr>] : []),
            ...values.flatMap((v: any) => [
              ...(v.extra_before ? [<tr key={`${v.id}-b`}><td colSpan={4} style={EXTRA_LINE_STYLE}>{v.extra_before}</td></tr>] : []),
              <tr key={v.id}>
                <td>{v.parameter?.name ?? "—"}</td>
                <td className="tabular-nums font-bold"><FlaggedValue value={v.value} limits={limitsOf(v)} /></td>
                <td>{v.unit ?? v.parameter?.unit ?? "—"}</td>
                <td>{v.reference_display_text ?? "—"}</td>
              </tr>,
              ...(v.extra_after ? [<tr key={`${v.id}-a`}><td colSpan={4} style={EXTRA_LINE_STYLE}>{v.extra_after}</td></tr>] : []),
            ]),
          ])}
        </tbody>
      </table>
      {item.exam?.standard_notes && (
        <div className="mt-2 text-xs text-muted-foreground whitespace-pre-line">{item.exam.standard_notes}</div>
      )}
      {result.observation && (
        <div className="mt-2 text-xs"><span className="text-muted-foreground">Obs:</span> {result.observation}</div>
      )}
      {reviewer && (
        <div className="mt-2 text-xs text-muted-foreground">
          Revisão: {reviewer.full_name}
          {reviewer.professional_council ? ` — ${reviewer.professional_council} ${reviewer.professional_registration ?? ""}` : ""}
        </div>
      )}
    </section>
  );
}

function Info({ k, v }: { k: string; v?: string | null }) {
  return (
    <div>
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground mr-1.5">{k}</span>
      <span className="font-medium">{v || "—"}</span>
    </div>
  );
}
