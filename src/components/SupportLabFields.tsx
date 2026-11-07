import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Field } from "@/components/CrudPage";
import { SectorSelect } from "@/components/SectorSelect";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type SupportLab = { id: string; name: string; legacy_code: string | null; turnaround_days: number | null; active: boolean };

export function useSupportLabs() {
  return useQuery({
    queryKey: ["support-labs"],
    staleTime: 60_000,
    queryFn: async (): Promise<SupportLab[]> => {
      const { data, error } = await supabase.from("support_labs").select("id, name, legacy_code, turnaround_days, active").order("name");
      if (error) throw error;
      return (data ?? []) as SupportLab[];
    },
  });
}

const NONE = "__none__";

// Setor técnico, setor de preço e laboratório de apoio do exame. Ao escolher um setor técnico que
// corresponde a um apoio cadastrado (pelo código do XLAB7), o apoio é sugerido automaticamente.
export function SupportLabFields({ value, setValue }: {
  value: { tech_sector?: string | null; price_sector?: string | null; support_lab_id?: string | null };
  setValue: (patch: { tech_sector?: string | null; price_sector?: string | null; support_lab_id?: string | null }) => void;
}) {
  const { data: labs = [] } = useSupportLabs();
  const active = labs.filter((l) => l.active || l.id === value.support_lab_id);
  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Setor técnico (quem executa)">
          <SectorSelect
            kind="tecnico"
            value={value.tech_sector}
            onChange={(v) => {
              const match = v ? labs.find((l) => l.active && l.legacy_code === v) : undefined;
              setValue({ tech_sector: v, ...(match && !value.support_lab_id ? { support_lab_id: match.id } : {}) });
            }}
          />
          <span className="text-[11px] text-muted-foreground">Setor do laboratório ou laboratório de apoio que realiza o exame. Lista do XLAB7.</span>
        </Field>
        <Field label="Setor de preço">
          <SectorSelect kind="preco" value={value.price_sector} onChange={(v) => setValue({ price_sector: v })} />
          <span className="text-[11px] text-muted-foreground">Agrupamento usado para preço e faturamento. Lista do XLAB7.</span>
        </Field>
      </div>
      <Field label="Laboratório de apoio (exame terceirizado)">
        <Select value={value.support_lab_id || NONE} onValueChange={(v) => setValue({ support_lab_id: v === NONE ? null : v })}>
          <SelectTrigger><SelectValue placeholder="Exame interno" /></SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value={NONE}>Nenhum (exame feito aqui)</SelectItem>
            {active.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}{l.active ? "" : " (inativo)"}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-[11px] text-muted-foreground">
          Com um apoio escolhido, a amostra vai para a fila de envio e o resultado só é lançado depois do envio.{" "}
          <Link to="/cadastros/laboratorios-apoio" className="underline">Cadastrar apoios</Link>
        </span>
      </Field>
    </>
  );
}
