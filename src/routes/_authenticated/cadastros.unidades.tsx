import { createFileRoute } from "@tanstack/react-router";
import { CrudPage, Field } from "@/components/CrudPage";
import { Input } from "@/components/ui/input";

type Unit = { id: string; code: string; name: string; address: string | null; phone: string | null };

export const Route = createFileRoute("/_authenticated/cadastros/unidades")({
  head: () => ({ meta: [{ title: "Unidades — LIS" }] }),
  component: () => (
    <CrudPage<Unit>
      title="Unidades" description="Unidades de atendimento" table="units"
      orderBy={{ column: "name" }}
      searchColumn="name" searchPlaceholder="Buscar..."
      emptyValue={{ code: "", name: "", address: "", phone: "" }}
      itemLabel={(r) => r.name}
      columns={[
        { key: "code", label: "Código", className: "w-24" },
        { key: "name", label: "Nome" },
        { key: "phone", label: "Telefone", className: "w-40" },
      ]}
      renderForm={({ value, setValue }) => (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Código*"><Input required autoFocus value={value.code ?? ""} onChange={e => setValue({ ...value, code: e.target.value })} /></Field>
            <div className="col-span-2"><Field label="Nome*"><Input required value={value.name ?? ""} onChange={e => setValue({ ...value, name: e.target.value })} /></Field></div>
          </div>
          <Field label="Endereço"><Input value={value.address ?? ""} onChange={e => setValue({ ...value, address: e.target.value })} /></Field>
          <Field label="Telefone"><Input value={value.phone ?? ""} onChange={e => setValue({ ...value, phone: e.target.value })} /></Field>
        </>
      )}
    />
  ),
});
