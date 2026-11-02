import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { BookOpen } from "lucide-react";
import { toast } from "sonner";

export type LegacyExam = {
  code: string; name: string; amb_code: string | null; sector: string | null; material: string | null;
  days: number | null; fasting_hours: number | null;
};

// No XLAB7 o "setor" do exame é quem realiza; estes não são realizados pelo laboratório.
const NOT_PERFORMED = new Set(["NAO REALIZ", "BLOQUEADO", "EXCLUIR"]);

// Busca no catálogo de exames do XLAB7 ao cadastrar um exame novo: preenche nome, material, prazo e jejum.
export function LegacyCatalogPicker({ onPick }: { onPick: (e: LegacyExam) => void }) {
  const [text, setText] = useState("");
  const [debounced, setDebounced] = useState("");
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(text.trim()), 250);
    return () => clearTimeout(t);
  }, [text]);

  const { data = [], isFetching } = useQuery({
    queryKey: ["legacy-exams-search", debounced],
    enabled: debounced.length >= 2,
    staleTime: 60_000,
    queryFn: async (): Promise<LegacyExam[]> => {
      const q = debounced.replace(/[%,()*:]/g, " ").trim();
      const { data, error } = await supabase
        .from("xlab_legacy_exams")
        .select("code, name, amb_code, sector, material, days, fasting_hours")
        .or(`code.ilike.${q}%,name.ilike.%${q}%`)
        .order("code")
        .limit(80);
      if (error) throw error;
      return (data ?? []) as LegacyExam[];
    },
  });

  const rows = useMemo(
    () => data.filter((r) => showAll || !NOT_PERFORMED.has((r.sector ?? "").trim().toUpperCase())).slice(0, 12),
    [data, showAll],
  );

  return (
    <div className="rounded-md border border-dashed bg-muted/30 p-3 space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium"><BookOpen className="size-4" />Buscar no catálogo do XLAB7</div>
      <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Digite o código ou o nome do exame (ex.: glicose, HDL)…" />
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <Checkbox checked={showAll} onCheckedChange={(v) => setShowAll(!!v)} />
        Mostrar também exames que o XLAB7 marcava como não realizados, bloqueados ou excluídos
      </label>
      {debounced.length >= 2 && !isFetching && rows.length === 0 && (
        <div className="text-xs text-muted-foreground">Nada encontrado no catálogo (ou o catálogo ainda não foi importado).</div>
      )}
      {rows.length > 0 && (
        <div className="rounded border bg-background divide-y max-h-64 overflow-y-auto">
          {rows.map((r) => (
            <button
              type="button"
              key={r.code}
              className="w-full text-left px-3 py-2 text-sm hover:bg-muted/60 focus:bg-muted/60 outline-none"
              onClick={() => { onPick(r); setText(""); }}
            >
              <div><span className="font-mono tabular-nums mr-2">{r.code}</span>{r.name}</div>
              <div className="text-[11px] text-muted-foreground">
                {[r.material, r.sector && `setor ${r.sector}`, r.days != null && `prazo ${r.days} dia(s)`, r.fasting_hours ? `jejum ${r.fasting_hours} h` : null].filter(Boolean).join(" · ")}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

type LegacyPrice = { table_code: string; price: number | null; factor: number | null };
type LegacyTable = { code: string; name: string; unit: "R$" | "CH" };

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Preços que o XLAB7 tinha para este exame, com cópia para as tabelas de preço da empresa.
export function LegacyPricesSection({ examId, code }: { examId: string; code?: string }) {
  const qc = useQueryClient();
  const companyId = useCompanyId();
  const c = (code ?? "").trim();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [ch, setCh] = useState("");

  const { data: prices = [] } = useQuery({
    queryKey: ["legacy-prices", c],
    enabled: c.length >= 1,
    staleTime: 60_000,
    queryFn: async (): Promise<LegacyPrice[]> => {
      const { data, error } = await supabase.from("xlab_legacy_prices").select("table_code, price, factor").eq("exam_code", c).order("table_code");
      if (error) throw error;
      return (data ?? []) as LegacyPrice[];
    },
  });
  const { data: tables = [] } = useQuery({
    queryKey: ["legacy-price-tables"],
    staleTime: 3_600_000,
    queryFn: async (): Promise<LegacyTable[]> => {
      const { data, error } = await supabase.from("xlab_legacy_price_tables").select("code, name, unit");
      if (error) throw error;
      return (data ?? []) as LegacyTable[];
    },
  });
  const tableOf = (cd: string) => tables.find((t) => t.code === cd);
  const chValue = Number(ch.replace(",", "."));

  const finalPrice = (p: LegacyPrice): number | null => {
    if (p.price == null || p.factor === 0) return null;
    const t = tableOf(p.table_code);
    if (t?.unit === "CH") return Number.isFinite(chValue) && chValue > 0 ? Math.round(p.price * chValue * 100) / 100 : null;
    return Math.round(p.price * 100) / 100;
  };

  const copy = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("Sem empresa");
      const chosen = prices.filter((p) => picked.has(p.table_code));
      if (chosen.length === 0) throw new Error("Marque ao menos uma tabela");
      const { data: mine, error } = await supabase.from("price_tables").select("id, name, legacy_code");
      if (error) throw error;
      let copied = 0;
      for (const p of chosen) {
        const value = finalPrice(p);
        if (value == null) continue;
        const t = tableOf(p.table_code);
        let target = (mine ?? []).find((m: any) => m.legacy_code === p.table_code) as { id: string } | undefined;
        if (!target) {
          const { data: created, error: ce } = await supabase
            .from("price_tables")
            .insert({ company_id: companyId, name: t?.name ?? p.table_code, legacy_code: p.table_code } as never)
            .select("id")
            .single();
          if (ce) throw ce;
          target = created as { id: string };
        }
        const { error: ie } = await supabase
          .from("price_table_items")
          .upsert({ company_id: companyId, price_table_id: target.id, exam_id: examId, price: value } as never, { onConflict: "price_table_id,exam_id" });
        if (ie) throw ie;
        copied++;
      }
      if (copied === 0) throw new Error("Nenhum preço válido para copiar (informe o valor do CH nas tabelas em CH)");
      return copied;
    },
    onSuccess: (n) => {
      toast.success(`${n} preço(s) copiado(s) para as tabelas de preço`);
      setPicked(new Set());
      qc.invalidateQueries({ queryKey: ["crud", "price_tables"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (prices.length === 0) return null;
  const anyCh = prices.some((p) => picked.has(p.table_code) && tableOf(p.table_code)?.unit === "CH");

  return (
    <div className="border rounded-md p-3 space-y-2">
      <div>
        <div className="text-sm font-medium">Preços do XLAB7 para este exame</div>
        <div className="text-xs text-muted-foreground">Marque as tabelas que quer copiar. Cada uma vira (ou atualiza) uma tabela de preço da empresa.</div>
      </div>
      <div className="grid gap-1">
        {prices.map((p) => {
          const t = tableOf(p.table_code);
          const v = finalPrice(p);
          return (
            <label key={p.table_code} className="grid grid-cols-[auto_1fr_auto_auto] gap-3 items-center rounded bg-muted/40 px-2 py-1 text-xs">
              <Checkbox
                checked={picked.has(p.table_code)}
                disabled={p.price == null || p.factor === 0}
                onCheckedChange={(on) => setPicked((s) => { const n = new Set(s); on ? n.add(p.table_code) : n.delete(p.table_code); return n; })}
              />
              <span className="truncate">{t?.name ?? p.table_code}</span>
              <span className="text-muted-foreground tabular-nums">{p.price == null ? "—" : t?.unit === "CH" ? `${p.price} CH` : brl(p.price)}</span>
              <span className="tabular-nums w-20 text-right">{v != null ? brl(v) : "—"}</span>
            </label>
          );
        })}
      </div>
      {anyCh && (
        <label className="flex items-center gap-2 text-xs">
          Valor do CH (R$)
          <Input className="h-8 w-28" inputMode="decimal" placeholder="ex.: 0,30" value={ch} onChange={(e) => setCh(e.target.value)} />
          <span className="text-muted-foreground">Preço = CH do exame × este valor.</span>
        </label>
      )}
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={() => copy.mutate()} disabled={copy.isPending || picked.size === 0}>Copiar preços marcados</Button>
      </div>
    </div>
  );
}
