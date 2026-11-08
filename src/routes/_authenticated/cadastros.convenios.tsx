import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CrudPage, Field } from "@/components/CrudPage";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { TissTabelaCombobox } from "@/components/TissTabelaCombobox";
import { LegacyInsurancePicker } from "@/components/LegacyExamCatalog";

type Insurance = { id: string; code: string; name: string; price_table_id: string; active: boolean; tiss_codigo_ans: string | null; tiss_tabela: string | null };

export const Route = createFileRoute("/_authenticated/cadastros/convenios")({
  head: () => ({ meta: [{ title: "Convênios — DFLAB" }] }),
  component: InsurancePage,
});

function InsurancePage() {
  const { data: tables = [] } = useQuery({
    queryKey: ["price_tables-all"],
    queryFn: async () => (await supabase.from("price_tables").select("id,name").order("name")).data ?? [],
  });
  return (
    <CrudPage<Insurance>
      title="Convênios" description="Convênios e planos vinculados a tabelas de preço" table="insurance_plans"
      orderBy={{ column: "name" }}
      searchColumn="name" searchPlaceholder="Buscar por nome..."
      emptyValue={{ code: "", name: "", price_table_id: "", active: true, tiss_codigo_ans: "", tiss_tabela: "" }}
      itemLabel={(r) => r.name}
      columns={[
        { key: "code", label: "Código", className: "w-32" },
        { key: "name", label: "Nome" },
        { key: "active", label: "Ativo", render: r => r.active ? "Sim" : "Não", className: "w-20" },
      ]}
      renderForm={({ value, setValue }) => (
        <>
          {!value.id && (
            <LegacyInsurancePicker
              onPick={(i) => setValue({ ...value, code: i.code, name: i.name, tiss_codigo_ans: i.ans_code ?? "", tiss_tabela: i.tiss_table ?? "" })}
            />
          )}
          <div className="grid grid-cols-3 gap-3">
            <Field label="Código*"><Input required autoFocus value={value.code ?? ""} onChange={e => setValue({ ...value, code: e.target.value })} /></Field>
            <div className="col-span-2"><Field label="Nome*"><Input required value={value.name ?? ""} onChange={e => setValue({ ...value, name: e.target.value })} /></Field></div>
          </div>
          <Field label="Tabela de preço*">
            <Select value={value.price_table_id ?? ""} onValueChange={v => setValue({ ...value, price_table_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>{tables.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Código ANS (TISS)"><Input value={value.tiss_codigo_ans ?? ""} onChange={e => setValue({ ...value, tiss_codigo_ans: e.target.value })} /></Field>
            <Field label="Tabela TISS"><TissTabelaCombobox value={value.tiss_tabela ?? null} onChange={v => setValue({ ...value, tiss_tabela: v ?? "" })} /></Field>
          </div>
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={value.active ?? true} onCheckedChange={v => setValue({ ...value, active: !!v })} /> Ativo</label>
        </>
      )}
    />
  );
}
