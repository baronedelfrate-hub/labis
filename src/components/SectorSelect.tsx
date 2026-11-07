import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type SectorKind = "tecnico" | "preco";
type SectorRow = { code: string; name: string };

const NONE = "__none__";

// Setores do XLAB7 (biblioteca de consulta). tecnico = quem executa o exame (inclui laboratórios de apoio);
// preco = setor de preço. Um código que não está na lista (digitação antiga do XLAB7) continua aparecendo como está.
export function useSectors(kind: SectorKind) {
  return useQuery({
    queryKey: ["xlab-sectors", kind],
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<SectorRow[]> => {
      const { data, error } = await supabase.from("xlab_legacy_sectors").select("code, name").eq("kind", kind).order("name");
      if (error) throw error;
      return (data ?? []) as SectorRow[];
    },
  });
}

export function sectorLabel(rows: SectorRow[], code: string | null | undefined) {
  if (!code) return "";
  const hit = rows.find((r) => r.code === code);
  return hit ? `${hit.name} (${hit.code})` : code;
}

export function SectorSelect({ kind, value, onChange, placeholder }: {
  kind: SectorKind; value: string | null | undefined; onChange: (v: string | null) => void; placeholder?: string;
}) {
  const { data: rows = [] } = useSectors(kind);
  const known = !value || rows.some((r) => r.code === value);
  return (
    <Select value={value || NONE} onValueChange={(v) => onChange(v === NONE ? null : v)}>
      <SelectTrigger><SelectValue placeholder={placeholder ?? "Escolher setor"} /></SelectTrigger>
      <SelectContent className="max-h-72">
        <SelectItem value={NONE}>Não definido</SelectItem>
        {!known && value && <SelectItem value={value}>{value} (fora da lista)</SelectItem>}
        {rows.map((r) => <SelectItem key={r.code} value={r.code}>{r.name} ({r.code})</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
