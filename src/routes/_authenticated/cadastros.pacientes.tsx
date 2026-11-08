import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CrudPage, Field } from "@/components/CrudPage";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

type Patient = { id: string; code: string; name: string; birth_date: string | null; sex: "M" | "F" | "O" | null; cpf: string | null; phone: string | null; email: string | null };

export const Route = createFileRoute("/_authenticated/cadastros/pacientes")({
  head: () => ({ meta: [{ title: "Pacientes — DFLAB" }] }),
  component: () => (
    <CrudPage<Patient>
      title="Pacientes" description="Cadastro de pacientes" table="patients"
      orderBy={{ column: "name", ascending: true }}
      searchColumn="name" searchPlaceholder="Buscar por nome..."
      emptyValue={{ name: "", cpf: "", phone: "", email: "", birth_date: null, sex: null }}
      itemLabel={(r) => r.name}
      columns={[
        { key: "code", label: "Código", className: "tabular-nums w-24" },
        { key: "name", label: "Nome" },
        { key: "cpf", label: "CPF", className: "w-40 tabular-nums" },
        { key: "phone", label: "Telefone", className: "w-40" },
      ]}
      renderForm={({ value, setValue }) => (
        <>
          <Field label="Nome*"><Input required autoFocus value={value.name ?? ""} onChange={e => setValue({ ...value, name: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nascimento"><Input type="date" value={value.birth_date ?? ""} onChange={e => setValue({ ...value, birth_date: e.target.value || null })} /></Field>
            <Field label="Sexo">
              <Select value={value.sex ?? ""} onValueChange={v => setValue({ ...value, sex: (v || null) as "M" | "F" | "O" | null })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent><SelectItem value="M">Masculino</SelectItem><SelectItem value="F">Feminino</SelectItem><SelectItem value="O">Outro</SelectItem></SelectContent>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="CPF"><Input value={value.cpf ?? ""} onChange={e => setValue({ ...value, cpf: e.target.value })} /></Field>
            <Field label="Telefone"><Input value={value.phone ?? ""} onChange={e => setValue({ ...value, phone: e.target.value })} /></Field>
          </div>
          <Field label="E-mail"><Input type="email" value={value.email ?? ""} onChange={e => setValue({ ...value, email: e.target.value })} /></Field>
          {value.id && <PatientHistory patientId={value.id} />}
        </>
      )}
    />
  ),
});

function PatientHistory({ patientId }: { patientId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["patient-history", patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, order_date, status, order_items(exam:exams(code,name))")
        .eq("patient_id", patientId)
        .order("order_date", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="pt-2 border-t">
      <div className="text-sm font-medium mb-2">Histórico de Pedidos</div>
      {isLoading && <div className="text-xs text-muted-foreground">Carregando...</div>}
      {!isLoading && (data?.length ?? 0) === 0 && <div className="text-xs text-muted-foreground">Nenhum pedido.</div>}
      <div className="max-h-64 overflow-y-auto space-y-1.5">
        {data?.map((o: any) => (
          <Link
            key={o.id}
            to="/pedidos/$orderId"
            params={{ orderId: o.id }}
            className="block rounded border bg-card px-3 py-2 hover:bg-accent transition-colors"
          >
            <div className="flex items-center gap-2 text-xs">
              <span className="font-mono font-medium">#{o.order_number}</span>
              <span className="text-muted-foreground">{o.order_date ? new Date(o.order_date).toLocaleDateString("pt-BR") : "—"}</span>
              <Badge variant="outline" className="ml-auto text-[10px]">{o.status}</Badge>
            </div>
            <div className="text-xs text-muted-foreground mt-1 line-clamp-1">
              {(o.order_items ?? []).map((i: any) => i.exam?.name).filter(Boolean).join(", ") || "—"}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
