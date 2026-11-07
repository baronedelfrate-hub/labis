import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import { CrudPage, Field } from "@/components/CrudPage";
import { SectorSelect, useSectors } from "@/components/SectorSelect";
import { useSupportLabs } from "@/components/SupportLabFields";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { toast } from "sonner";

type Lab = { id: string; name: string; legacy_code: string | null; contact: string | null; phone: string | null; email: string | null; turnaround_days: number | null; notes: string | null; active: boolean };

export const Route = createFileRoute("/_authenticated/cadastros/laboratorios-apoio")({
  head: () => ({ meta: [{ title: "Laboratórios de apoio — LIS" }] }),
  component: SupportLabsPage,
});

function SupportLabsPage() {
  return (
    <div>
      <Suggestions />
      <CrudPage<Lab>
        title="Laboratórios de apoio" description="Laboratórios que realizam exames terceirizados para o seu laboratório"
        table="support_labs"
        orderBy={{ column: "name" }}
        searchColumn="name" searchPlaceholder="Buscar..."
        emptyValue={{ name: "", legacy_code: null, contact: "", phone: "", email: "", turnaround_days: null, notes: "", active: true }}
        itemLabel={(r) => r.name}
        columns={[
          { key: "name", label: "Nome" },
          { key: "phone", label: "Telefone", className: "w-36" },
          { key: "turnaround_days", label: "Prazo (dias)", className: "w-28 tabular-nums" },
          { key: "active", label: "Ativo", className: "w-20", render: (r) => (r.active ? "Sim" : "Não") },
        ]}
        renderForm={({ value, setValue }) => (
          <>
            <Field label="Nome*"><Input required autoFocus value={value.name ?? ""} onChange={(e) => setValue({ ...value, name: e.target.value })} /></Field>
            <Field label="Código no XLAB7 (setor técnico)">
              <SectorSelect kind="tecnico" value={value.legacy_code} onChange={(v) => setValue({ ...value, legacy_code: v })} />
              <span className="text-[11px] text-muted-foreground">Liga o apoio aos exames que o XLAB7 já marcava com esse setor técnico.</span>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Contato"><Input value={value.contact ?? ""} onChange={(e) => setValue({ ...value, contact: e.target.value })} /></Field>
              <Field label="Telefone"><Input value={value.phone ?? ""} onChange={(e) => setValue({ ...value, phone: e.target.value })} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="E-mail"><Input type="email" value={value.email ?? ""} onChange={(e) => setValue({ ...value, email: e.target.value })} /></Field>
              <Field label="Prazo de resultado (dias)"><Input type="number" min={0} value={value.turnaround_days ?? ""} onChange={(e) => setValue({ ...value, turnaround_days: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
            </div>
            <Field label="Observações (coleta, transporte, horários)"><Textarea rows={2} value={value.notes ?? ""} onChange={(e) => setValue({ ...value, notes: e.target.value })} /></Field>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={value.active ?? true} onCheckedChange={(v) => setValue({ ...value, active: !!v })} /> Ativo</label>
          </>
        )}
      />
    </div>
  );
}

// Atalho: cria apoios a partir da lista de setores técnicos do XLAB7 (nomes que começam com "APOIO") e já
// vincula os exames que têm esse setor técnico.
function Suggestions() {
  const qc = useQueryClient();
  const companyId = useCompanyId();
  const { data: sectors = [] } = useSectors("tecnico");
  const { data: labs = [] } = useSupportLabs();
  const have = new Set(labs.map((l) => l.legacy_code).filter(Boolean));
  const cleanName = (n: string) => n.replace(/^apoio\s+/i, "").replace(/\s*-\s*c[óo]digo\s*=?\s*\d+\s*$/i, "").trim() || n;
  const options = sectors.filter((s) => /^apoio\b/i.test(s.name) && !have.has(s.code));

  const add = useMutation({
    mutationFn: async (s: { code: string; name: string }) => {
      if (!companyId) throw new Error("Sem empresa");
      const name = cleanName(s.name);
      const { data, error } = await supabase.from("support_labs").insert({ company_id: companyId, name, legacy_code: s.code }).select("id").single();
      if (error) throw error;
      const { data: linked, error: le } = await supabase.from("exams").update({ support_lab_id: data.id }).eq("tech_sector", s.code).is("support_lab_id", null).select("id");
      if (le) throw le;
      return { name, linked: linked?.length ?? 0 };
    },
    onSuccess: (r) => {
      toast.success(`${r.name} adicionado${r.linked ? ` e ${r.linked} exame(s) vinculado(s)` : ""}`);
      qc.invalidateQueries({ queryKey: ["support-labs"] });
      qc.invalidateQueries({ queryKey: ["crud", "support_labs"] });
      qc.invalidateQueries({ queryKey: ["crud", "exams"] });
    },
    onError: (e: Error) => toast.error(e.message.includes("duplicate") ? "Já existe um apoio com esse nome." : e.message),
  });

  if (options.length === 0) return null;
  return (
    <div className="mx-6 mt-6 rounded-md border border-dashed bg-muted/30 p-3">
      <div className="text-sm font-medium">Apoios do XLAB7</div>
      <p className="text-xs text-muted-foreground">Clique para adicionar. Os exames com esse setor técnico passam a ser enviados ao apoio.</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((s) => (
          <Button key={s.code} type="button" size="sm" variant="outline" disabled={add.isPending} onClick={() => add.mutate(s)}>
            <Plus className="mr-1 size-3.5" />{cleanName(s.name)}
          </Button>
        ))}
      </div>
    </div>
  );
}
