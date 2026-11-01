import { useState, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, PageBody } from "./PageHeader";
import { useCompanyId } from "@/hooks/useCompanyId";

export type ColumnDef<T> = { key: string; label: string; render?: (row: T) => ReactNode; className?: string };

type Props<T extends { id: string }> = {
  title: string;
  description?: string;
  table: string;
  select?: string;
  orderBy?: { column: string; ascending?: boolean };
  searchColumn?: string;
  searchPlaceholder?: string;
  columns: ColumnDef<T>[];
  renderForm: (opts: { value: Partial<T>; setValue: (v: Partial<T>) => void }) => ReactNode;
  emptyValue: Partial<T>;
  itemLabel?: (row: T) => string;
  reopenOnCreate?: boolean;
};

export function CrudPage<T extends { id: string }>({
  title, description, table, select = "*", orderBy, searchColumn, searchPlaceholder,
  columns, renderForm, emptyValue, itemLabel, reopenOnCreate,
}: Props<T>) {
  const qc = useQueryClient();
  const companyId = useCompanyId();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<T> | null>(null);
  const [deleting, setDeleting] = useState<T | null>(null);

  const key = ["crud", table, search];
  const { data, isLoading } = useQuery({
    queryKey: key,
    queryFn: async () => {
      let q = supabase.from(table as never).select(select);
      if (search && searchColumn) q = q.ilike(searchColumn, `%${search}%`);
      if (orderBy) q = q.order(orderBy.column, { ascending: orderBy.ascending ?? true });
      const { data, error } = await q;
      if (error) throw error;
      return data as unknown as T[];
    },
  });

  const save = useMutation({
    mutationFn: async (v: Partial<T>) => {
      const { id, ...rest } = v as { id?: string } & Record<string, unknown>;
      if (id) {
        const { error } = await supabase.from(table as never).update(rest as never).eq("id", id);
        if (error) throw error;
        return { row: null as T | null, created: false };
      } else {
        if (!companyId) throw new Error("Sem empresa");
        const { data, error } = await supabase.from(table as never).insert({ ...rest, company_id: companyId } as never).select().single();
        if (error) throw error;
        return { row: data as unknown as T, created: true };
      }
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["crud", table] });
      toast.success("Salvo");
      if (res.created && reopenOnCreate && res.row) {
        setEditing(res.row);
      } else {
        setDialogOpen(false);
        setEditing(null);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table as never).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crud", table] });
      setDeleting(null);
      toast.success("Excluído");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader title={title} description={description} actions={
        <Button onClick={() => { setEditing({ ...emptyValue }); setDialogOpen(true); }}>
          <Plus className="size-4 mr-1" />Novo
        </Button>
      } />
      <PageBody>
        {searchColumn && (
          <div className="mb-4 relative max-w-sm">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={searchPlaceholder ?? "Buscar..."} className="pl-9" />
          </div>
        )}
        <div className="rounded-md border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map(c => <TableHead key={c.key} className={c.className}>{c.label}</TableHead>)}
                <TableHead className="w-24 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={columns.length + 1} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>}
              {!isLoading && data?.length === 0 && <TableRow><TableCell colSpan={columns.length + 1} className="text-center text-muted-foreground py-8">Nenhum registro.</TableCell></TableRow>}
              {data?.map(row => (
                <TableRow key={row.id}>
                  {columns.map(c => <TableCell key={c.key} className={c.className}>{c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? "")}</TableCell>)}
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => { setEditing(row); setDialogOpen(true); }}><Pencil className="size-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleting(row)}><Trash2 className="size-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </PageBody>

      <Dialog open={dialogOpen} onOpenChange={o => { setDialogOpen(o); if (!o) setEditing(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col gap-0 p-0">
          <DialogHeader className="p-6 pb-4 border-b shrink-0"><DialogTitle>{editing && "id" in editing ? "Editar" : "Novo"}</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); if (editing) save.mutate(editing); }} className="flex flex-col min-h-0 flex-1">
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {editing && renderForm({ value: editing, setValue: (v) => setEditing(v) })}
            </div>
            <DialogFooter className="p-6 pt-4 border-t shrink-0">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={save.isPending}>Salvar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={o => { if (!o) setDeleting(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir registro?</AlertDialogTitle>
            <AlertDialogDescription>{deleting && itemLabel ? itemLabel(deleting) : "Esta ação não pode ser desfeita."}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleting && del.mutate(deleting.id)}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="space-y-1.5"><label className="text-sm font-medium">{label}</label>{children}</div>;
}
