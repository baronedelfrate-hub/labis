import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { PageHeader, PageBody } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandItem, CommandList, CommandEmpty, CommandGroup } from "@/components/ui/command";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, X, ChevronsUpDown, Layers } from "lucide-react";
import { toast } from "sonner";
import { useCompanyId } from "@/hooks/useCompanyId";
import { Cid10Combobox } from "@/components/Cid10Combobox";

export const Route = createFileRoute("/_authenticated/pedidos/novo")({
  head: () => ({ meta: [{ title: "Novo pedido — LIS" }] }),
  component: NewOrder,
});

type Patient = { id: string; code: string; name: string; cpf: string | null };
type Doctor = { id: string; name: string; crm: string; crm_uf: string };
type Insurance = { id: string; name: string; price_table_id: string };
type Exam = { id: string; code: string; name: string };
type Group = { id: string; name: string };

function NewOrder() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const companyId = useCompanyId();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [insurance, setInsurance] = useState<Insurance | null>(null);
  const [unitId, setUnitId] = useState<string>("");
  const [isUrgent, setIsUrgent] = useState(false);
  const [collectionDate, setCollectionDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [items, setItems] = useState<Exam[]>([]);
  const [cid10, setCid10] = useState<string | null>(null);
  const [newPatientOpen, setNewPatientOpen] = useState(false);
  const [newDoctorOpen, setNewDoctorOpen] = useState(false);

  const { data: units = [] } = useQuery({ queryKey: ["units-all"], queryFn: async () => (await supabase.from("units").select("id,name,code").order("name")).data ?? [] });
  const { data: insurances = [] } = useQuery({ queryKey: ["ins-all"], queryFn: async () => (await supabase.from("insurance_plans").select("id,name,price_table_id").eq("active", true).order("name")).data ?? [] });

  const priceTableId = insurance?.price_table_id;

  const { data: prices = [] } = useQuery({
    queryKey: ["prices", priceTableId, items.map(i => i.id).join(",")],
    enabled: !!priceTableId && items.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("price_table_items")
        .select("exam_id, price")
        .eq("price_table_id", priceTableId!)
        .in("exam_id", items.map(i => i.id));
      if (error) throw error;
      return data;
    },
  });

  const priceMap = useMemo(() => Object.fromEntries(prices.map(p => [p.exam_id, Number(p.price)])), [prices]);
  const total = items.reduce((s, i) => s + (priceMap[i.id] ?? 0), 0);

  const addExam = (e: Exam) => {
    setItems(prev => prev.find(x => x.id === e.id) ? prev : [...prev, e]);
  };
  const addGroup = async (g: Group) => {
    const { data } = await supabase.from("exam_group_items").select("exam:exams(id,code,name)").eq("exam_group_id", g.id);
    const examList: Exam[] = (data ?? []).map(r => r.exam as unknown as Exam).filter(Boolean);
    setItems(prev => {
      const seen = new Set(prev.map(x => x.id));
      const merged = [...prev];
      for (const e of examList) if (!seen.has(e.id)) { merged.push(e); seen.add(e.id); }
      return merged;
    });
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!patient) throw new Error("Selecione um paciente");
      if (!insurance) throw new Error("Selecione um convênio");
      if (items.length === 0) throw new Error("Adicione ao menos um exame");
      if (!companyId) throw new Error("Sem empresa");
      const { data: user } = await supabase.auth.getUser();
      const { data: order, error } = await supabase.from("orders").insert({
        patient_id: patient.id,
        doctor_id: doctor?.id ?? null,
        insurance_plan_id: insurance.id,
        unit_id: unitId || null,
        is_urgent: isUrgent,
        cid10_code: cid10,
        collection_date: collectionDate || null,
        total_value: total,
        created_by: user.user?.id,
        company_id: companyId,
      } as never).select("id, order_number").single();
      if (error) throw error;
      const rows = items.map(e => ({ order_id: order.id, exam_id: e.id, price: priceMap[e.id] ?? 0, company_id: companyId }));
      const { error: e2 } = await supabase.from("order_items").insert(rows);
      if (e2) throw e2;
      return order;
    },
    onSuccess: (o) => {
      toast.success(`Pedido #${o.order_number} criado`);
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      navigate({ to: "/pedidos/$orderId", params: { orderId: o.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader title="Novo pedido" description="Cadastro rápido — use Tab para avançar" actions={
        <Button onClick={() => save.mutate()} disabled={save.isPending || !patient || !insurance || items.length === 0}>Salvar pedido</Button>
      } />
      <PageBody>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1 space-y-4">
            <section className="rounded-md border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Paciente</h2>
                <Button type="button" size="sm" variant="ghost" onClick={() => setNewPatientOpen(true)}><Plus className="size-3.5 mr-1" />Novo</Button>
              </div>
              <PatientPicker value={patient} onChange={setPatient} />
            </section>

            <section className="rounded-md border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Médico solicitante</h2>
                <Button type="button" size="sm" variant="ghost" onClick={() => setNewDoctorOpen(true)}><Plus className="size-3.5 mr-1" />Novo</Button>
              </div>
              <DoctorPicker value={doctor} onChange={setDoctor} />
            </section>

            <section className="rounded-md border bg-card p-4 space-y-3">
              <h2 className="text-sm font-semibold">Convênio & coleta</h2>
              <div className="space-y-2">
                <Label>Convênio*</Label>
                <Select value={insurance?.id ?? ""} onValueChange={(v) => setInsurance(insurances.find(i => i.id === v) ?? null)}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {insurances.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Unidade</Label>
                <Select value={unitId} onValueChange={setUnitId}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {units.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Data de coleta</Label>
                <Input type="date" value={collectionDate} onChange={e => setCollectionDate(e.target.value)} />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={isUrgent} onCheckedChange={(v) => setIsUrgent(!!v)} />
                Pedido urgente
              </label>
              <div className="space-y-1">
                <Label className="text-sm">CID-10 (opcional)</Label>
                <Cid10Combobox value={cid10} onChange={setCid10} />
              </div>
            </section>
          </div>

          <div className="lg:col-span-2 rounded-md border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Exames</h2>
              <span className="text-xs text-muted-foreground">Tabela: {insurance?.name ?? "—"}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <ExamPicker onPick={addExam} />
              <GroupPicker onPick={addGroup} />
            </div>
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Exame</TableHead>
                    <TableHead className="text-right">Preço</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground text-sm">Adicione exames ou um grupo</TableCell></TableRow>}
                  {items.map(i => {
                    const price = priceMap[i.id];
                    return (
                      <TableRow key={i.id}>
                        <TableCell className="tabular-nums">{i.code}</TableCell>
                        <TableCell>{i.name}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {price === undefined ? <span className="text-warning-foreground bg-warning/20 px-1.5 py-0.5 rounded text-xs">sem preço</span> : `R$ ${price.toFixed(2)}`}
                        </TableCell>
                        <TableCell><Button size="icon" variant="ghost" onClick={() => setItems(items.filter(x => x.id !== i.id))}><X className="size-4" /></Button></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <div className="flex justify-end items-baseline gap-3 pt-2">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="text-2xl font-semibold tabular-nums">R$ {total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </PageBody>

      <NewPatientDialog open={newPatientOpen} onOpenChange={setNewPatientOpen} onCreated={setPatient} />
      <NewDoctorDialog open={newDoctorOpen} onOpenChange={setNewDoctorOpen} onCreated={setDoctor} />
    </>
  );
}

function PatientPicker({ value, onChange }: { value: Patient | null; onChange: (p: Patient | null) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const { data = [] } = useQuery({
    queryKey: ["patient-search", q],
    queryFn: async () => {
      let query = supabase.from("patients").select("id,code,name,cpf").order("name").limit(20);
      if (q) query = query.or(`name.ilike.%${q}%,cpf.ilike.%${q}%,code.ilike.%${q}%`);
      const { data } = await query;
      return data ?? [];
    },
  });
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
          {value ? <span className="truncate">{value.name} <span className="text-muted-foreground text-xs">({value.code})</span></span> : "Buscar por nome, CPF ou código..."}
          <ChevronsUpDown className="size-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[380px]" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Buscar paciente..." value={q} onValueChange={setQ} />
          <CommandList>
            <CommandEmpty>Nenhum paciente.</CommandEmpty>
            <CommandGroup>
              {data.map(p => (
                <CommandItem key={p.id} onSelect={() => { onChange(p); setOpen(false); }}>
                  <div className="flex flex-col"><span>{p.name}</span><span className="text-xs text-muted-foreground">{p.code} · {p.cpf ?? "sem CPF"}</span></div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function DoctorPicker({ value, onChange }: { value: Doctor | null; onChange: (d: Doctor | null) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const { data = [] } = useQuery({
    queryKey: ["doctor-search", q],
    queryFn: async () => {
      let query = supabase.from("doctors").select("id,name,crm,crm_uf").order("name").limit(20);
      if (q) query = query.or(`name.ilike.%${q}%,crm.ilike.%${q}%`);
      const { data } = await query;
      return data ?? [];
    },
  });
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
          {value ? <span className="truncate">{value.name} — CRM {value.crm}/{value.crm_uf}</span> : "Buscar por nome ou CRM..."}
          <ChevronsUpDown className="size-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[380px]" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Buscar médico..." value={q} onValueChange={setQ} />
          <CommandList>
            <CommandEmpty>Nenhum médico.</CommandEmpty>
            <CommandGroup>
              {data.map(d => (
                <CommandItem key={d.id} onSelect={() => { onChange(d); setOpen(false); }}>
                  <div className="flex flex-col"><span>{d.name}</span><span className="text-xs text-muted-foreground">CRM {d.crm}/{d.crm_uf}</span></div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function ExamPicker({ onPick }: { onPick: (e: Exam) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const { data = [] } = useQuery({
    queryKey: ["exam-search", q],
    queryFn: async () => {
      let query = supabase.from("exams").select("id,code,name").order("name").limit(30);
      if (q) query = query.or(`name.ilike.%${q}%,code.ilike.%${q}%`);
      const { data } = await query;
      return data ?? [];
    },
  });
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="justify-between font-normal"><Plus className="size-4 mr-1" />Adicionar exame</Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[420px]" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Buscar exame..." value={q} onValueChange={setQ} />
          <CommandList>
            <CommandEmpty>Nenhum exame.</CommandEmpty>
            <CommandGroup>
              {data.map(e => (
                <CommandItem key={e.id} onSelect={() => { onPick(e); setOpen(false); setQ(""); }}>
                  <span className="tabular-nums text-muted-foreground mr-2">{e.code}</span>{e.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function GroupPicker({ onPick }: { onPick: (g: Group) => void }) {
  const [open, setOpen] = useState(false);
  const { data = [] } = useQuery({
    queryKey: ["group-list"],
    queryFn: async () => (await supabase.from("exam_groups").select("id,name").order("name")).data ?? [],
  });
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="justify-between font-normal"><Layers className="size-4 mr-1" />Adicionar grupo</Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[380px]" align="start">
        <Command>
          <CommandInput placeholder="Buscar grupo..." />
          <CommandList>
            <CommandEmpty>Nenhum grupo.</CommandEmpty>
            <CommandGroup>
              {data.map(g => (
                <CommandItem key={g.id} onSelect={() => { onPick(g); setOpen(false); }}>{g.name}</CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function NewPatientDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: (p: Patient) => void }) {
  const [form, setForm] = useState({ name: "", birth_date: "", sex: "", cpf: "", phone: "" });
  const qc = useQueryClient();
  const companyId = useCompanyId();
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return toast.error("Sem empresa");
    const { data, error } = await supabase.from("patients").insert({
      name: form.name, birth_date: form.birth_date || null,
      sex: (form.sex || null) as "M" | "F" | "O" | null,
      cpf: form.cpf || null, phone: form.phone || null,
      company_id: companyId,
    } as never).select("id,code,name,cpf").single();
    if (error) return toast.error(error.message);
    onCreated(data);
    qc.invalidateQueries({ queryKey: ["patient-search"] });
    onOpenChange(false);
    setForm({ name: "", birth_date: "", sex: "", cpf: "", phone: "" });
    toast.success("Paciente cadastrado");
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo paciente</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5"><Label>Nome*</Label><Input autoFocus required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Nascimento</Label><Input type="date" value={form.birth_date} onChange={e => setForm({ ...form, birth_date: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Sexo</Label>
              <Select value={form.sex} onValueChange={v => setForm({ ...form, sex: v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent><SelectItem value="M">Masculino</SelectItem><SelectItem value="F">Feminino</SelectItem><SelectItem value="O">Outro</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>CPF</Label><Input value={form.cpf} onChange={e => setForm({ ...form, cpf: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Telefone</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit">Salvar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function NewDoctorDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: (d: Doctor) => void }) {
  const [form, setForm] = useState({ name: "", crm: "", crm_uf: "" });
  const qc = useQueryClient();
  const companyId = useCompanyId();
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return toast.error("Sem empresa");
    const { data, error } = await supabase.from("doctors").insert({ name: form.name, crm: form.crm, crm_uf: form.crm_uf.toUpperCase(), company_id: companyId }).select("id,name,crm,crm_uf").single();
    if (error) return toast.error(error.message);
    onCreated(data);
    qc.invalidateQueries({ queryKey: ["doctor-search"] });
    onOpenChange(false);
    setForm({ name: "", crm: "", crm_uf: "" });
    toast.success("Médico cadastrado");
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo médico</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5"><Label>Nome*</Label><Input autoFocus required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>CRM*</Label><Input required value={form.crm} onChange={e => setForm({ ...form, crm: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>UF*</Label><Input required maxLength={2} value={form.crm_uf} onChange={e => setForm({ ...form, crm_uf: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit">Salvar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
