import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { sectorKey } from "@/lib/sample-barcode";

// Configura o número (01 a 99) de cada setor, usado no código de barras da amostra (XLAB7: "ASSNNNNNNN").
export function BarcodeSectorsCard() {
  const companyId = useCompanyId();
  const qc = useQueryClient();
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // setores que existem nos exames (sem repetir por maiúsculas/minúsculas)
  const { data: sectors = [] } = useQuery({
    queryKey: ["exam-sectors", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase.from("exams").select("sector").not("sector", "is", null);
      if (error) throw error;
      const map = new Map<string, { key: string; label: string; exams: number }>();
      for (const r of (data ?? []) as { sector: string }[]) {
        const key = sectorKey(r.sector);
        if (!key) continue;
        const cur = map.get(key) ?? { key, label: r.sector.trim(), exams: 0 };
        cur.exams += 1;
        map.set(key, cur);
      }
      return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
    },
  });

  const { data: saved = [], isLoading } = useQuery({
    queryKey: ["barcode-sectors", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase.from("barcode_sectors").select("id, sector, code").order("code");
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const r of saved as { sector: string; code: number }[]) next[r.sector] = String(r.code);
    setCodes(next);
  }, [saved]);

  // linhas: setores dos exames + setores com código que não aparecem mais nos exames
  const rows = useMemo(() => {
    const out = [...sectors];
    for (const r of saved as { sector: string }[]) {
      if (!out.some((s) => s.key === r.sector)) out.push({ key: r.sector, label: r.sector, exams: 0 });
    }
    return out;
  }, [sectors, saved]);

  async function save() {
    if (!companyId) return;
    const entries: { sector: string; code: number }[] = [];
    const used = new Map<number, string>();
    for (const r of rows) {
      const raw = (codes[r.key] ?? "").trim();
      if (!raw) continue;
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 1 || n > 99) return void toast.error(`Setor "${r.label}": o código deve ser um número inteiro de 1 a 99`);
      if (used.has(n)) return void toast.error(`O código ${n} está repetido em "${used.get(n)}" e "${r.label}"`);
      used.set(n, r.label);
      entries.push({ sector: r.key, code: n });
    }
    setSaving(true);
    try {
      // remove os setores que ficaram sem código e depois grava os demais
      const keep = new Set(entries.map((e) => e.sector));
      const toDelete = (saved as { id: string; sector: string }[]).filter((s) => !keep.has(s.sector)).map((s) => s.id);
      if (toDelete.length) {
        const { error } = await supabase.from("barcode_sectors").delete().in("id", toDelete);
        if (error) throw error;
      }
      // códigos trocados entre setores quebrariam a regra de código único durante a gravação: libera os alterados antes
      const changed = (saved as { id: string; sector: string; code: number }[]).filter((s) => keep.has(s.sector) && entries.find((e) => e.sector === s.sector)!.code !== s.code);
      if (changed.length) {
        const { error } = await supabase.from("barcode_sectors").delete().in("id", changed.map((c) => c.id));
        if (error) throw error;
      }
      if (entries.length) {
        const { error } = await supabase.from("barcode_sectors").upsert(entries.map((e) => ({ company_id: companyId, ...e })), { onConflict: "company_id,sector" });
        if (error) throw error;
      }
      toast.success("Códigos dos setores salvos");
      qc.invalidateQueries({ queryKey: ["barcode-sectors"] });
    } catch (err: any) {
      toast.error(err.message ?? "Falha ao salvar");
      qc.invalidateQueries({ queryKey: ["barcode-sectors"] });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-md border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium">Setores — código de barras</div>
          <div className="text-xs text-muted-foreground">
            O código da amostra tem 10 dígitos: nº da amostra (1) + código do setor (2) + nº do pedido (7). Setor sem código usa 00.
          </div>
        </div>
        <Button size="sm" onClick={save} disabled={saving || isLoading}>
          {saving && <Loader2 className="size-4 mr-1 animate-spin" />}Salvar setores
        </Button>
      </div>
      {rows.length === 0 && <div className="text-xs text-muted-foreground">Nenhum exame com setor cadastrado ainda.</div>}
      <div className="grid gap-1">
        {rows.map((r) => (
          <div key={r.key} className="grid grid-cols-[1fr_90px] sm:grid-cols-[1fr_90px_120px] gap-3 items-center rounded border bg-background px-3 py-1.5">
            <div className="text-sm truncate">{r.label}</div>
            <Input
              inputMode="numeric"
              maxLength={2}
              placeholder="00"
              className="h-8 text-center tabular-nums"
              value={codes[r.key] ?? ""}
              onChange={(e) => setCodes((c) => ({ ...c, [r.key]: e.target.value.replace(/\D/g, "") }))}
              aria-label={`Código do setor ${r.label}`}
            />
            <div className="hidden sm:block text-xs text-muted-foreground">{r.exams} exame(s)</div>
          </div>
        ))}
      </div>
    </div>
  );
}
