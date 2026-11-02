import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Printer, AlertTriangle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Barcode } from "@/components/Barcode";
import { buildLabels, sectorCodeFor, sectorLine, type LabelData } from "@/lib/sample-barcode";

export const Route = createFileRoute("/_authenticated/pedidos/$orderId_/etiquetas")({
  ssr: false,
  head: () => ({ meta: [{ title: "Etiquetas — LIS" }] }),
  component: EtiquetasPage,
});

// O tamanho da etiqueta é por computador (cada posto tem a sua impressora), por isso fica no navegador.
const SIZE_KEY = "labis.label-size";
const DEFAULT_SIZE = { w: 60, h: 32 }; // mm — mesmo tamanho padrão do XLAB7

function loadSize() {
  try {
    const raw = localStorage.getItem(SIZE_KEY);
    if (raw) {
      const v = JSON.parse(raw);
      if (v && v.w >= 20 && v.w <= 150 && v.h >= 15 && v.h <= 150) return { w: Number(v.w), h: Number(v.h) };
    }
  } catch {
    /* sem armazenamento: usa o padrão */
  }
  return DEFAULT_SIZE;
}

const fmtDate = (d: string | null) => {
  if (!d) return "";
  const [y, m, day] = d.slice(0, 10).split("-");
  return y && m && day ? `${day}/${m}/${y.slice(2)}` : d;
};

function EtiquetasPage() {
  const { orderId } = Route.useParams();
  const [size, setSize] = useState(DEFAULT_SIZE);
  const [copies, setCopies] = useState(1);

  useEffect(() => setSize(loadSize()), []);
  const saveSize = (next: { w: number; h: number }) => {
    setSize(next);
    try {
      localStorage.setItem(SIZE_KEY, JSON.stringify(next));
    } catch {
      /* ignora */
    }
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ["etiquetas", orderId],
    staleTime: 0,
    queryFn: async () => {
      const { data: order, error } = await supabase
        .from("orders")
        .select("id, order_number, order_date, is_urgent, patient:patients(name, birth_date)")
        .eq("id", orderId)
        .single();
      if (error) throw error;
      const { data: samples, error: se } = await supabase
        .from("samples")
        .select("id, sample_number, sector, material, status, material_seq")
        .eq("order_id", orderId);
      if (se) throw se;
      const { data: items, error: ie } = await supabase
        .from("order_items")
        .select("sample_id, exam:exams(code, samples_count, labels_per_sample), links:order_item_samples(sample_id)")
        .eq("order_id", orderId)
        .order("created_at");
      if (ie) throw ie;
      const { data: sectors, error: be } = await supabase.from("barcode_sectors").select("sector, code");
      if (be) throw be;
      const codes = new Map<string, number>((sectors ?? []).map((s: any) => [s.sector as string, s.code as number]));
      // um exame pode precisar de mais de uma amostra: usa todas as vinculadas (ou a principal, em pedidos antigos)
      const itemsWithSamples = ((items ?? []) as any[]).map((i) => ({
        exam: i.exam,
        sample_ids: (i.links?.length ? i.links.map((l: any) => l.sample_id) : i.sample_id ? [i.sample_id] : []) as string[],
      }));
      return { order: order as any, samples: (samples ?? []) as any[], items: itemsWithSamples, codes };
    },
  });

  const labels = useMemo<LabelData[]>(
    () => (data ? buildLabels(data.order, data.samples, data.items, data.codes) : []),
    [data],
  );
  const printList = useMemo(() => labels.flatMap((l) => Array.from({ length: Math.max(1, copies) }, () => l)), [labels, copies]);
  const noCode = useMemo(() => {
    if (!data) return [] as string[];
    const out = new Set<string>();
    for (const s of data.samples) if (s.status !== "rejeitada" && s.sector && sectorCodeFor(s.sector, data.codes) === 0) out.add(s.sector);
    return Array.from(out);
  }, [data]);

  return (
    <div className="etiquetas-root bg-muted/30 min-h-screen">
      <style>{`
        .label { box-sizing: border-box; background: #fff; color: #000; overflow: hidden; display: flex; flex-direction: column;
                 padding: 1.2mm 1.8mm; font-family: Arial, Helvetica, sans-serif; line-height: 1.12; }
        .label .l-name { font-size: 7.5pt; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .label .l-meta { font-size: 6pt; white-space: nowrap; overflow: hidden; }
        .label .l-bars { width: 100%; flex: 1 1 auto; min-height: 6mm; margin: 0.6mm 0 0; }
        .label .l-digits { font-size: 6.5pt; text-align: center; letter-spacing: 0.25em; font-variant-numeric: tabular-nums; }
        .label .l-exams { font-size: 6pt; font-weight: 600; white-space: nowrap; overflow: hidden; min-height: 2.6mm; }
        .label .l-exams > div { overflow: hidden; }
        .label .l-sector { font-size: 6pt; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .label-sheet .label { zoom: 2.2; box-shadow: 0 1px 4px rgba(0,0,0,.25); margin: 0 0 10px; }
        @media print {
          @page { size: ${size.w}mm ${size.h}mm; margin: 0; }
          html, body { background: #fff !important; margin: 0 !important; padding: 0 !important; }
          .label-toolbar, aside, header { display: none !important; }
          .etiquetas-root { background: #fff !important; min-height: auto !important; padding: 0 !important; }
          .label-sheet { padding: 0 !important; }
          .label-sheet .label { zoom: 1; box-shadow: none; margin: 0; break-after: page; page-break-after: always; }
          .label-sheet .label:last-child { break-after: auto; page-break-after: auto; }
        }
      `}</style>

      <div className="label-toolbar max-w-4xl mx-auto p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/pedidos/$orderId" params={{ orderId }}><ArrowLeft className="size-4 mr-1" />Voltar ao pedido</Link>
          </Button>
          <div className="text-sm text-muted-foreground">
            {data ? `Pedido #${data.order.order_number} — ${printList.length} etiqueta(s)` : ""}
          </div>
          <Button size="sm" className="ml-auto" onClick={() => window.print()} disabled={printList.length === 0}>
            <Printer className="size-4 mr-1" />Imprimir etiquetas
          </Button>
        </div>

        <div className="rounded-md border bg-card p-3 flex flex-wrap items-end gap-4 text-sm">
          <label className="space-y-1">
            <div className="text-xs text-muted-foreground">Largura (mm)</div>
            <Input type="number" min={20} max={150} className="w-24 h-8" value={size.w} onChange={(e) => saveSize({ ...size, w: Number(e.target.value) || DEFAULT_SIZE.w })} />
          </label>
          <label className="space-y-1">
            <div className="text-xs text-muted-foreground">Altura (mm)</div>
            <Input type="number" min={15} max={150} className="w-24 h-8" value={size.h} onChange={(e) => saveSize({ ...size, h: Number(e.target.value) || DEFAULT_SIZE.h })} />
          </label>
          <label className="space-y-1">
            <div className="text-xs text-muted-foreground">Cópias de cada</div>
            <Input type="number" min={1} max={5} className="w-20 h-8" value={copies} onChange={(e) => setCopies(Math.min(5, Math.max(1, Number(e.target.value) || 1)))} />
          </label>
          <div className="text-xs text-muted-foreground max-w-xs">
            O tamanho fica salvo neste computador. Na janela de impressão, escolha a impressora de etiquetas, sem margens e escala 100%.
          </div>
        </div>

        {noCode.length > 0 && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 flex items-start gap-2">
            <AlertTriangle className="size-4 shrink-0 mt-0.5" />
            <div>
              Setor sem código de barras: <b>{noCode.join(", ")}</b>. As etiquetas usam <b>00</b> nesses casos. O administrador define os códigos em Configurações → Setores.
            </div>
          </div>
        )}
        {isLoading && <div className="text-sm text-muted-foreground">Carregando…</div>}
        {error && <div className="text-sm text-destructive">Não foi possível carregar o pedido.</div>}
        {data && labels.length === 0 && (
          <div className="text-sm text-muted-foreground">Este pedido não tem amostras para etiquetar (ou todas foram rejeitadas).</div>
        )}
      </div>

      <div className="label-sheet px-4 pb-8 flex flex-col items-center">
        {printList.map((l, i) => (
          <div key={i} className="label" style={{ width: `${size.w}mm`, height: `${size.h}mm` }}>
            <div className="l-name">{l.patientName}</div>
            <div className="l-meta">
              #{l.orderNumber} · {fmtDate(l.orderDate)}
              {l.birthDate ? ` · DN ${fmtDate(l.birthDate)}` : ""}
              {l.urgent ? " · URGENTE" : ""}
            </div>
            <Barcode value={l.barcode} className="l-bars" />
            <div className="l-digits">{l.barcode}</div>
            <div className="l-exams">{l.lines.map((ln, k) => <div key={k}>{ln}</div>)}</div>
            <div className="l-sector">{sectorLine(l)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
