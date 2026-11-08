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
import { Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useCompanyId } from "@/hooks/useCompanyId";

export const Route = createFileRoute("/_authenticated/cadastros/grupos-exames")({
  head: () => ({ meta: [{ title: "Grupos de exames — DFLAB" }] }),
  component: GroupsPage,
});

function GroupsPage() {
  const qc = useQueryClient();
  const companyId = useCompanyId();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [addExamOpen, setAddExamOpen] = useState(false);
  const [examId, setExamId] = useState("");

  const { data: groups = [] } = useQuery({
    queryKey: ["exam_groups"],
    queryFn: async () => (await supabase.from("exam_groups").select("id,name").order("name")).data ?? [],
  });
  const current = groups.find(g => g.id === selectedId) ?? groups[0];

  const { data: items = [] } = useQuery({
    queryKey: ["exam_group_items", current?.id],
    enabled: !!current,
    queryFn: async () => (await supabase.from("exam_group_items").select("id,exam:exams(id,code,name)").eq("exam_group_id", current!.id)).data ?? [],
  });

  const { data: exams = [] } = useQuery({
    queryKey: ["exams-all-for-group"],
    queryFn: async () => (await supabase.from("exams").select("id,code,name").order("name")).data ?? [],
  });

  const createGroup = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("Sem empresa");
      const { error } = await supabase.from("exam_groups").insert({ name: newName, company_id: companyId });
      if (error) throw error;
    },
    onSuccess: () => { setNewDialogOpen(false); setNewName(""); toast.success("Grupo criado"); qc.invalidateQueries({ queryKey: ["exam_groups"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const addItem = useMutation({
    mutationFn: async () => {
      if (!current || !examId || !companyId) return;
      const { error } = await supabase.from("exam_group_items").insert({ exam_group_id: current.id, exam_id: examId, company_id: companyId });
      if (error) throw error;
    },
    onSuccess: () => { setAddExamOpen(false); setExamId(""); qc.invalidateQueries({ queryKey: ["exam_group_items"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("exam_group_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["exam_group_items"] }),
  });

  const deleteGroup = useMutation({
    mutationFn: async () => {
      if (!current) return;
      const { error } = await supabase.from("exam_groups").delete().eq("id", current.id);
      if (error) throw error;
    },
    onSuccess: () => { setSelectedId(null); toast.success("Grupo excluído"); qc.invalidateQueries({ queryKey: ["exam_groups"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader title="Grupos de exames" description="Conjuntos rápidos de exames (ex: Check-up)" actions={
        <Button onClick={() => setNewDialogOpen(true)}><Plus className="size-4 mr-1" />Novo grupo</Button>
      } />
      <PageBody>
        <div className="flex gap-4 mb-4 items-end">
          <div className="min-w-64">
            <Label className="mb-1.5 block">Grupo</Label>
            <Select value={current?.id ?? ""} onValueChange={setSelectedId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{groups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {current && (
            <>
              <Button variant="outline" onClick={() => setAddExamOpen(true)}><Plus className="size-4 mr-1" />Adicionar exame</Button>
              <Button variant="outline" onClick={() => deleteGroup.mutate()}><Trash2 className="size-4 mr-1 text-destructive" />Excluir grupo</Button>
            </>
          )}
        </div>

        <div className="rounded-md border bg-card overflow-hidden">
          <Table>
            <TableHeader><TableRow><TableHead>Código</TableHead><TableHead>Exame</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
            <TableBody>
              {items.length === 0 && <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">Nenhum exame no grupo.</TableCell></TableRow>}
              {items.map(i => {
                const ex = i.exam as { code: string; name: string } | null;
                return (
                  <TableRow key={i.id}>
                    <TableCell className="tabular-nums">{ex?.code}</TableCell>
                    <TableCell>{ex?.name}</TableCell>
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
          <DialogHeader><DialogTitle>Novo grupo</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); createGroup.mutate(); }} className="space-y-3">
            <div className="space-y-1.5"><Label>Nome*</Label><Input autoFocus required value={newName} onChange={e => setNewName(e.target.value)} /></div>
            <DialogFooter><Button type="submit">Criar</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={addExamOpen} onOpenChange={setAddExamOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adicionar exame ao grupo</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); addItem.mutate(); }} className="space-y-3">
            <div className="space-y-1.5"><Label>Exame*</Label>
              <Select value={examId} onValueChange={setExamId}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent className="max-h-72">{exams.map(e => <SelectItem key={e.id} value={e.id}>{e.code} — {e.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <DialogFooter><Button type="submit">Adicionar</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Pencil import used to keep icon tree-shake happy */}
      <span className="hidden"><Pencil /></span>
    </>
  );
}
