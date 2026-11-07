import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Printer, LogOut } from "lucide-react";
import { getPortalToken, setPortalToken } from "@/lib/portal-session";
import { FlaggedValue, limitsOf } from "@/components/FlaggedValue";
import { TextExamBlock } from "@/components/TextExamBlock";

export const Route = createFileRoute("/portal_/laudo")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Laudo — Portal do paciente" }, { name: "robots", content: "noindex" }],
  }),
  component: PortalLaudoPage,
});

function PortalLaudoPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getPortalToken();
    if (!token) { navigate({ to: "/portal", replace: true }); return; }
    (async () => {
      try {
        const res = await fetch("/api/public/portal-laudo", { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) { setPortalToken(null); navigate({ to: "/portal", replace: true }); return; }
        setData(await res.json());
      } finally { setLoading(false); }
    })();
  }, [navigate]);

  if (loading || !data) return <div className="p-6 text-muted-foreground">Carregando...</div>;

  const o = data.order as any;
  const s = data.settings ?? ({} as any);
  const logoUrl: string | null = data.logoUrl ?? null;
  const resultByItem = new Map((data.results as any[]).map((r) => [r.order_item_id, r]));
  const valuesByResult = new Map<string, any[]>();
  for (const v of (data.resultValues as any[]) ?? []) {
    const arr = valuesByResult.get(v.result_id) ?? [];
    arr.push(v);
    valuesByResult.set(v.result_id, arr);
  }
  const releasedItems = (data.items as any[]).filter((i) => resultByItem.has(i.id));
  const isTextItem = (i: any) => !!i.exam?.is_text && !(valuesByResult.get(resultByItem.get(i.id).id)?.length);
  const textItems = releasedItems.filter(isTextItem);
  const simpleItems = releasedItems.filter((i) => !isTextItem(i) && !(valuesByResult.get(resultByItem.get(i.id).id)?.length));
  const composedItems = releasedItems.filter((i) => (valuesByResult.get(resultByItem.get(i.id).id)?.length ?? 0) > 0);
  const releasedAt = data.results.length
    ? new Date(Math.max(...data.results.map((r: any) => new Date(r.released_at).getTime())))
    : new Date();

  return (
    <div className="laudo-root bg-muted/30 min-h-screen">
      <style>{`
        @media print {
          @page { size: A4; margin: 12mm; }
          body { background: white !important; }
          .laudo-toolbar { display: none !important; }
          .laudo-root { background: white !important; padding: 0 !important; min-height: auto !important; }
          .laudo-sheet { box-shadow: none !important; border: none !important; margin: 0 !important; max-width: none !important; padding: 0 !important; }
        }
        .laudo-sheet { font-family: Inter, system-ui, sans-serif; color: #111; }
        .laudo-sheet table { border-collapse: collapse; width: 100%; }
        .laudo-sheet th, .laudo-sheet td { padding: 6px 8px; border-bottom: 1px solid #e5e7eb; text-align: left; font-size: 12px; vertical-align: top; }
        .laudo-sheet th { font-weight: 600; background: #f8fafc; }
      `}</style>
      <div className="laudo-toolbar sticky top-0 z-10 border-b bg-background/95 backdrop-blur px-6 py-3 flex items-center gap-2">
        <div className="text-sm font-medium">Portal do paciente</div>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" onClick={() => window.print()}><Printer className="size-4 mr-1" />Imprimir / PDF</Button>
          <Button size="sm" variant="outline" onClick={() => { setPortalToken(null); navigate({ to: "/portal", replace: true }); }}>
            <LogOut className="size-4 mr-1" />Sair
          </Button>
        </div>
      </div>
      <div className="laudo-sheet mx-auto my-6 bg-white shadow-sm border max-w-[210mm] p-8">
        <header className="flex items-start gap-4 border-b pb-4">
          {logoUrl && <img src={logoUrl} alt="Logo" className="max-h-20 max-w-[140px] object-contain" />}
          <div className="flex-1">
            <div className="text-lg font-semibold">{s.legal_name || "—"}</div>
            <div className="text-xs text-muted-foreground mt-0.5 space-y-0.5">
              {s.address && <div>{s.address}{s.city ? ` — ${s.city}` : ""}{s.state ? `/${s.state}` : ""}{s.zip_code ? ` — CEP ${s.zip_code}` : ""}</div>}
              <div>{s.phone && <span>Tel: {s.phone}</span>}{s.phone && s.email && " · "}{s.email && <span>{s.email}</span>}</div>
              <div>{s.cnpj && <span>CNPJ: {s.cnpj}</span>}{s.cnpj && s.cnes && " · "}{s.cnes && <span>CNES: {s.cnes}</span>}</div>
            </div>
          </div>
          <div className="text-right text-xs">
            <div className="font-medium text-sm">Laudo</div>
            <div className="mt-1">Pedido #{o.order_number}</div>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-x-6 gap-y-2 py-4 text-xs">
          <Info k="Paciente" v={o.patient?.name} />
          <Info k="Código" v={o.patient?.code} />
          <Info k="CPF" v={o.patient?.cpf} />
          <Info k="Nascimento" v={o.patient?.birth_date ? new Date(o.patient.birth_date).toLocaleDateString("pt-BR") : "—"} />
          <Info k="Médico solicitante" v={o.doctor?.name ? `${o.doctor.name} — CRM ${o.doctor.crm}/${o.doctor.crm_uf}` : "—"} />
          <Info k="Convênio" v={o.insurance?.name ?? "Particular"} />
          <Info k="Data de coleta" v={o.collection_date ? new Date(o.collection_date).toLocaleDateString("pt-BR") : "—"} />
          <Info k="Data de emissão" v={releasedAt.toLocaleString("pt-BR")} />
        </section>

        {simpleItems.length > 0 && (
          <section className="pt-2">
            <table>
              <thead>
                <tr>
                  <th style={{ width: "70px" }}>Código</th>
                  <th>Exame</th>
                  <th style={{ width: "110px" }}>Resultado</th>
                  <th style={{ width: "80px" }}>Unidade</th>
                  <th style={{ width: "130px" }}>Referência</th>
                  <th>Observação</th>
                </tr>
              </thead>
              <tbody>
                {simpleItems.map((i: any) => {
                  const r = resultByItem.get(i.id);
                  const ref = r.reference_min != null || r.reference_max != null
                    ? `${r.reference_min ?? "—"} — ${r.reference_max ?? "—"}` : "—";
                  return (
                    <tr key={i.id}>
                      <td className="tabular-nums">{i.exam?.code}</td>
                      <td>{i.exam?.name}</td>
                      <td className="tabular-nums font-medium"><FlaggedValue value={r.value} limits={limitsOf(r)} showPanic={false} /></td>
                      <td>{r.unit ?? "—"}</td>
                      <td className="tabular-nums">{ref}</td>
                      <td>{r.observation ?? ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
          return <ExamBlock key={i.id} item={i} result={r} groups={Array.from(groups.entries())} collectionDate={o.collection_date} />;
        })}

        <footer className="mt-10 pt-4 border-t text-xs">
          <div className="flex items-end justify-between gap-4">
            <div>
              {s.footer_note && <div className="text-muted-foreground whitespace-pre-line mb-2">{s.footer_note}</div>}
              <div>Emitido em {releasedAt.toLocaleString("pt-BR")}</div>
            </div>
            <div className="text-center min-w-[240px]">
              <div className="border-t pt-1">
                <div className="font-medium">{s.responsible_tech_name || "—"}</div>
                <div className="text-muted-foreground">{s.responsible_tech_council || ""}</div>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

// Linha extra do campo (cadastrada no exame): pequena, em itálico, ocupando a largura da tabela
const EXTRA_LINE_STYLE = { fontStyle: "italic", fontSize: "11px", color: "#475569", whiteSpace: "pre-line" } as const;

function ExamBlock({ item, result, groups, collectionDate }: { item: any; result: any; groups: [string, any[]][]; collectionDate: string | null }) {
  const reviewer = result.reviewer;
  return (
    <section className="mt-6">
      <div className="border-t-2 border-b bg-slate-50 px-3 py-2 flex flex-wrap gap-x-6 gap-y-1 text-xs">
        <div><span className="font-semibold">{item.exam?.code}</span> · <span className="font-semibold">{item.exam?.name}</span></div>
        {item.exam?.material && <div><span className="text-muted-foreground">Material:</span> {item.exam.material}</div>}
        {item.exam?.support_lab?.name && <div className="text-xs"><span className="text-muted-foreground">Exame realizado pelo laboratório de apoio:</span> {item.exam.support_lab.name}</div>}
        {result.method && <div><span className="text-muted-foreground">Método:</span> {result.method}</div>}
        {collectionDate && <div><span className="text-muted-foreground">Coleta:</span> {new Date(collectionDate).toLocaleDateString("pt-BR")}</div>}
        <div><span className="text-muted-foreground">Liberação:</span> {new Date(result.released_at).toLocaleDateString("pt-BR")}</div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Parâmetro</th>
            <th style={{ width: "110px" }}>Resultado</th>
            <th style={{ width: "80px" }}>Unidade</th>
            <th>Referência</th>
          </tr>
        </thead>
        <tbody>
          {groups.flatMap(([groupLabel, values]) => [
            ...(groupLabel ? [<tr key={`g-${groupLabel}`}><td colSpan={4} style={{ background: "#f1f5f9", fontWeight: 600 }}>{groupLabel}</td></tr>] : []),
            ...values.flatMap((v: any) => [
              ...(v.extra_before ? [<tr key={`${v.id}-b`}><td colSpan={4} style={EXTRA_LINE_STYLE}>{v.extra_before}</td></tr>] : []),
              <tr key={v.id}>
                <td>{v.parameter?.name ?? "—"}</td>
                <td className="tabular-nums font-medium"><FlaggedValue value={v.value} limits={limitsOf(v)} showPanic={false} /></td>
                <td>{v.unit ?? v.parameter?.unit ?? "—"}</td>
                <td>{v.reference_display_text ?? "—"}</td>
              </tr>,
              ...(v.extra_after ? [<tr key={`${v.id}-a`}><td colSpan={4} style={EXTRA_LINE_STYLE}>{v.extra_after}</td></tr>] : []),
            ]),
          ])}
        </tbody>
      </table>
      {item.exam?.standard_notes && <div className="mt-2 text-xs text-muted-foreground whitespace-pre-line">{item.exam.standard_notes}</div>}
      {result.observation && <div className="mt-2 text-xs"><span className="text-muted-foreground">Obs:</span> {result.observation}</div>}
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
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{k}</div>
      <div className="font-medium">{v || "—"}</div>
    </div>
  );
}
