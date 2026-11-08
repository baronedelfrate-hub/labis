import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CrudPage, Field } from "@/components/CrudPage";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

type Template = { id: string; title: string; body: string; exam_id: string | null };

export const Route = createFileRoute("/_authenticated/cadastros/textos-modelo")({
  head: () => ({ meta: [{ title: "Textos-modelo — DFLAB" }] }),
  component: TextosModeloPage,
});

function useTextExams() {
  return useQuery({
    queryKey: ["text-exams-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("exams").select("id, code, name, is_text").order("name");
      if (error) throw error;
      return (data ?? []) as { id: string; code: string; name: string; is_text: boolean }[];
    },
  });
}

function ExamName({ id }: { id: string | null }) {
  const { data = [] } = useTextExams();
  if (!id) return <span className="text-muted-foreground">Qualquer exame tipo texto</span>;
  const e = data.find((x) => x.id === id);
  return <>{e ? `${e.code} — ${e.name}` : "—"}</>;
}

const ANY = "__any__";

function TextosModeloPage() {
  const { data: exams = [] } = useTextExams();
  return (
    <CrudPage<Template>
      title="Textos-modelo"
      description="Textos prontos para inserir no resultado de exames tipo texto (ex.: diagnóstico por imagem)"
      table="result_templates"
      orderBy={{ column: "title" }}
      searchColumn="title"
      searchPlaceholder="Buscar por título..."
      emptyValue={{ title: "", body: "", exam_id: null }}
      itemLabel={(r) => r.title}
      columns={[
        { key: "title", label: "Título" },
        { key: "exam_id", label: "Vale para", render: (r) => <ExamName id={r.exam_id} /> },
      ]}
      renderForm={({ value, setValue }) => (
        <>
          <Field label="Título*">
            <Input required autoFocus value={value.title ?? ""} onChange={(e) => setValue({ ...value, title: e.target.value })} placeholder="Ex.: Radiografia de tórax — normal" />
          </Field>
          <Field label="Vale para">
            <Select value={value.exam_id ?? ANY} onValueChange={(v) => setValue({ ...value, exam_id: v === ANY ? null : v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Qualquer exame tipo texto</SelectItem>
                {exams.filter((e) => e.is_text || e.id === value.exam_id).map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.code} — {e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Texto*">
            <Textarea required rows={10} value={value.body ?? ""} onChange={(e) => setValue({ ...value, body: e.target.value })} placeholder="Escreva o texto que será inserido no resultado. Quebras de linha são mantidas no laudo." />
          </Field>
        </>
      )}
    />
  );
}
