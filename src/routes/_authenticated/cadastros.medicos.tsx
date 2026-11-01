import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CrudPage, Field } from "@/components/CrudPage";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

type Doctor = { id: string; crm: string; crm_uf: string; name: string; phone: string | null; email: string | null; tiss_cbos: string | null; tiss_conselho: string | null };

function ConselhoSelect({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const { data } = useQuery({
    queryKey: ["tiss_conselhos_profissionais"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tiss_conselhos_profissionais").select("codigo,descricao").order("descricao");
      if (error) throw error;
      return data ?? [];
    },
  });
  return (
    <Select value={value ?? "__none"} onValueChange={(v) => onChange(v === "__none" ? null : v)}>
      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
      <SelectContent>
        <SelectItem value="__none">— Nenhum —</SelectItem>
        {(data ?? []).map((c) => (
          <SelectItem key={c.codigo} value={c.codigo}>{c.codigo} — {c.descricao}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export const Route = createFileRoute("/_authenticated/cadastros/medicos")({
  head: () => ({ meta: [{ title: "Médicos — LIS" }] }),
  component: () => (
    <CrudPage<Doctor>
      title="Médicos" description="Cadastro de médicos solicitantes" table="doctors"
      orderBy={{ column: "name" }}
      searchColumn="name" searchPlaceholder="Buscar por nome..."
      emptyValue={{ name: "", crm: "", crm_uf: "", phone: "", email: "", tiss_cbos: "", tiss_conselho: null }}
      itemLabel={(r) => r.name}
      columns={[
        { key: "name", label: "Nome" },
        { key: "crm", label: "CRM", className: "w-32 tabular-nums" },
        { key: "crm_uf", label: "UF", className: "w-16" },
        { key: "phone", label: "Telefone", className: "w-40" },
      ]}
      renderForm={({ value, setValue }) => (
        <>
          <Field label="Nome*"><Input required autoFocus value={value.name ?? ""} onChange={e => setValue({ ...value, name: e.target.value })} /></Field>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2"><Field label="CRM*"><Input required value={value.crm ?? ""} onChange={e => setValue({ ...value, crm: e.target.value })} /></Field></div>
            <Field label="UF*"><Input required maxLength={2} value={value.crm_uf ?? ""} onChange={e => setValue({ ...value, crm_uf: e.target.value.toUpperCase() })} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Telefone"><Input value={value.phone ?? ""} onChange={e => setValue({ ...value, phone: e.target.value })} /></Field>
            <Field label="E-mail"><Input type="email" value={value.email ?? ""} onChange={e => setValue({ ...value, email: e.target.value })} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="TISS CBO-S"><Input value={value.tiss_cbos ?? ""} onChange={e => setValue({ ...value, tiss_cbos: e.target.value })} /></Field>
            <Field label="Conselho profissional (TISS)">
              <ConselhoSelect value={value.tiss_conselho ?? null} onChange={(v) => setValue({ ...value, tiss_conselho: v })} />
            </Field>
          </div>
        </>
      )}
    />
  ),
});
