import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, PageBody } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useCompanyId } from "@/hooks/useCompanyId";

export const Route = createFileRoute("/_authenticated/cadastros/tabelas-preco")({
  head: () => ({ meta: [{ title: "Tabelas de preço — DFLAB" }] }),
  component: PriceTablesPage,
});

function PriceTablesPage() {
  const qc = useQueryClient();
  const companyId = useCompanyId();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [addExamOpen, setAddExamOpen] = useState(false);
  const [examId, setExamId] = useState<string>("");
  const [price, setPrice] = useState("");

  const { data: tables = [] } = useQuery({
    queryKey: ["price_tables"],
    queryFn: async () => (await supabase.from("price_tables").select("id,name").order("name")).data ?? [],
  });

  const current = tables.find(t => t.id === selectedId) ?? tables[0];

  const { data: items = [] } = useQuery({
    queryKey: ["price_items", current?.id],
    enabled: !!current,
    queryFn: async () => (await supabase.from("price_table_items").select("id,price,exam:exams(id,code,name)").eq("price_table_id", current!.id)).data ?? [],
  });

  const { data: exams = [] } = useQuery({
    queryKey: ["exams-all-for-price"],
    queryFn: async () => (await supabase.from("exams").select("id,code,name").order("name")).data ?? [],
  });

  const createTable = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("Sem empresa");
      const { error } = await supabase.from("price_tables").insert({ name: newName, company_id: companyId });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Tabela criada"); setNewDialogOpen(false); setNewName(""); qc.invalidateQueries({ queryKey: ["price_tables"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const addItem = useMutation({
    mutationFn: async () => {
      if (!current || !examId || !companyId) return;
      const { error } = await supabase.from("price_table_items").insert({ price_table_id: current.id, exam_id: examId, price: Number(price) || 0, company_id: companyId });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Preço adicionado"); setAddExamOpen(false); setExamId(""); setPrice(""); qc.invalidateQueries({ queryKey: ["price_items"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("price_table_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["price_items"] }),
  });

  return (
    <>
      <PageHeader title="Tabelas de preço" description="Preços por exame para cada tabela" actions={
        <Button onClick={() => setNewDialogOpen(true)}><Plus className="size-4 mr-1" />Nova tabela</Button>
      } />
      <PageBody>
        <div className="flex gap-4 mb-4 items-end">
          <div className="min-w-64">
            <Label className="mb-1.5 block">Tabela</Label>
            <Select value={current?.id ?? ""} onValueChange={setSelectedId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{tables.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {current && <Button variant="outline" onClick={() => setAddExamOpen(true)}><Plus className="size-4 mr-1" />Adicionar exame</Button>}
        </div>

        <div className="rounded-md border bg-card overflow-hidden">
          <Table>
            <TableHeader><TableRow><TableHead>Código</TableHead><TableHead>Exame</TableHead><TableHead className="text-right">Preço</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
            <TableBody>
              {items.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Nenhum preço cadastrado.</TableCell></TableRow>}
              {items.map(i => {
                const ex = i.exam as { code: string; name: string } | null;
                return (
                  <TableRow key={i.id}>
                    <TableCell className="tabular-nums">{ex?.code}</TableCell>
                    <TableCell>{ex?.name}</TableCell>
                    <TableCell className="text-right tabular-nums">R$ {Number(i.price).toFixed(2)}</TableCell>
                    <TableCell><Button size="icon" variant="ghost" onClick={() => removeItem.mutate(i.id)}><Trash2 className="size-4 text-destructive" /></Button></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </PageBody>

      <Dialog open={newDialogOpen} onOpenChange={setNewDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova tabela de preço</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); createTable.mutate(); }} className="space-y-3">
            <div className="space-y-1.5"><Label>Nome*</Label><Input autoFocus required value={newName} onChange={e => setNewName(e.target.value)} /></div>
            <DialogFooter><Button type="submit">Criar</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={addExamOpen} onOpenChange={setAddExamOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adicionar exame a {current?.name}</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); addItem.mutate(); }} className="space-y-3">
            <div className="space-y-1.5"><Label>Exame*</Label>
              <Select value={examId} onValueChange={setExamId}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent className="max-h-72">{exams.map(e => <SelectItem key={e.id} value={e.id}>{e.code} — {e.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Preço (R$)*</Label><Input type="number" step="0.01" min="0" required value={price} onChange={e => setPrice(e.target.value)} /></div>
            <DialogFooter><Button type="submit">Adicionar</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
