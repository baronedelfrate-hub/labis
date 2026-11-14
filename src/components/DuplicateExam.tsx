import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const STRIP = ["id", "created_at", "updated_at"];
const clean = (row: Record<string, any>, extra: string[] = []) =>
  Object.fromEntries(Object.entries(row).filter(([k]) => ![...STRIP, ...extra].includes(k)));

// Cria um novo exame a partir de outro: copia os dados do exame, os parâmetros (com as fórmulas),
// as faixas de referência e os preços. Serve, por exemplo, para criar um "Hemograma infantil"
// com faixas próprias a partir do hemograma padrão, sem configurar tudo de novo.
export function DuplicateExamButton({ examId, code, name }: { examId: string; code: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const qc = useQueryClient();

  const mut = useMutation({
    mutationFn: async () => {
      const c = newCode.trim();
      const n = newName.trim();
      if (!c || !n) throw new Error("Informe o código e o nome do novo exame.");

      const { data: src, error: e0 } = await supabase.from("exams").select("*").eq("id", examId).single();
      if (e0) throw e0;
      const { data: created, error: e1 } = await supabase.from("exams")
        .insert({ ...clean(src as any), code: c, name: n } as any).select("id").single();
      if (e1) {
        if ((e1 as any).code === "23505") throw new Error(`Já existe um exame com o código ${c}.`);
        throw e1;
      }
      const newId = created!.id as string;

      try {
        // parâmetros (as fórmulas usam o código do parâmetro, que é mantido)
        const { data: params, error: e2 } = await supabase.from("exam_parameters").select("*").eq("exam_id", examId);
        if (e2) throw e2;
        const idMap = new Map<string, string>();
        for (const p of (params ?? []) as any[]) {
          const { data: np, error } = await supabase.from("exam_parameters")
            .insert({ ...clean(p), exam_id: newId } as any).select("id").single();
          if (error) throw error;
          idMap.set(p.id, np!.id);
        }

        // faixas de referência: do exame e dos parâmetros
        const ids = [...idMap.keys()];
        const { data: refsExam } = await supabase.from("reference_ranges").select("*").eq("exam_id", examId);
        const { data: refsParam } = ids.length
          ? await supabase.from("reference_ranges").select("*").in("exam_parameter_id", ids)
          : { data: [] as any[] };
        const refRows = [
          ...((refsExam ?? []) as any[]).map((r) => ({ ...clean(r), exam_id: newId })),
          ...((refsParam ?? []) as any[]).map((r) => ({ ...clean(r), exam_parameter_id: idMap.get(r.exam_parameter_id) })),
        ];
        if (refRows.length) {
          const { error } = await supabase.from("reference_ranges").insert(refRows as any);
          if (error) throw error;
        }

        // preços nas tabelas
        const { data: prices } = await supabase.from("price_table_items").select("*").eq("exam_id", examId);
        if (prices?.length) {
          const { error } = await supabase.from("price_table_items")
            .insert((prices as any[]).map((r) => ({ ...clean(r), exam_id: newId })) as any);
          if (error) throw error;
        }
      } catch (err) {
        // não deixa um exame pela metade
        await supabase.from("exams").delete().eq("id", newId);
        throw err;
      }
    },
    onSuccess: () => {
      toast.success("Exame duplicado. Abra o novo exame na lista para ajustar as faixas de referência.");
      qc.invalidateQueries();
      setOpen(false);
      setNewCode("");
      setNewName("");
    },
    onError: (e: any) => toast.error(e.message ?? "Não foi possível duplicar o exame"),
  });

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => { setNewName(`${name} INFANTIL`); setNewCode(`${code}I`); setOpen(true); }}>
        <Copy className="size-4 mr-1" />Duplicar exame
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Duplicar exame</DialogTitle>
            <DialogDescription>
              Cria um novo exame com os mesmos parâmetros, fórmulas, faixas de referência e preços de {name}.
              Útil para ter, por exemplo, um hemograma infantil com faixas próprias. Depois, ajuste as faixas no novo exame.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Código do novo exame</Label><Input value={newCode} onChange={(e) => setNewCode(e.target.value)} /></div>
            <div><Label>Nome do novo exame</Label><Input value={newName} onChange={(e) => setNewName(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="button" disabled={mut.isPending} onClick={() => mut.mutate()}>{mut.isPending ? "Duplicando..." : "Duplicar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
