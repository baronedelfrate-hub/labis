import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, PageBody } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, ChevronDown, ChevronRight, FileText, DollarSign, Printer, KeyRound, Copy } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, Fragment } from "react";
import { useServerFn } from "@tanstack/react-start";
import { createPortalAccess, getPortalAccessInfo } from "@/lib/portal.functions";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/pedidos/$orderId")({
  head: () => ({ meta: [{ title: "Pedido — LIS" }] }),
  component: OrderDetail,
});

const statusStyles: Record<string, string> = {
  pendente: "bg-muted text-muted-foreground",
  coletado: "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200",
  com_resultado: "bg-sky-100 text-sky-900 dark:bg-sky-900/30 dark:text-sky-200",
  liberado: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200",
};

const statusLabels: Record<string, string> = {
  pendente: "Pendente",
  coletado: "Coletado",
  com_resultado: "Com resultado",
  liberado: "Liberado",
};

const paymentStatusStyles: Record<string, string> = {
  pendente: "bg-muted text-muted-foreground",
  parcial: "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200",
  pago: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200",
};

function OrderDetail() {
  const { orderId } = Route.useParams();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [payOpen, setPayOpen] = useState(false);
  const [portalOpen, setPortalOpen] = useState(false);
  const [portalCreds, setPortalCreds] = useState<{ public_code: string; pin: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["order", orderId],
    queryFn: async () => {
      const { data: order, error } = await supabase
        .from("orders")
        .select(
          `
        id, order_number, order_date, collection_date, status, is_urgent, total_value, notes, company_id,
        payment_status, billing_batch_id, insurance_plan_id,
        patient:patients(id,code,name,cpf,birth_date),
        doctor:doctors(id,name,crm,crm_uf),
        insurance:insurance_plans(id,name,is_particular),
        unit:units(id,name)
      `,
        )
        .eq("id", orderId)
        .single();
      if (error) throw error;
      const { data: items } = await supabase
        .from("order_items")
        .select(
          "id,status,price,exam:exams(code,name,material,sector),sample:samples(id,sample_number,material,status)",
        )
        .eq("order_id", orderId);
      const itemIds = (items ?? []).map((i) => i.id);
      const { data: results } = itemIds.length
        ? await supabase.from("results").select("*").in("order_item_id", itemIds)
        : { data: [] as any[] };
      const { data: payments } = await supabase
        .from("payments")
        .select("*")
        .eq("order_id", orderId)
        .order("paid_at", { ascending: true });
      return { order, items: items ?? [], results: results ?? [], payments: payments ?? [] };
    },
  });

  if (isLoading || !data) return <div className="p-6 text-muted-foreground">Carregando...</div>;
  const o = data.order as any;
  const patient = o.patient as { name: string; code: string; cpf: string | null } | null;
  const doctor = o.doctor as { name: string; crm: string; crm_uf: string } | null;
  const insurance = o.insurance as { name: string } | null;
  const unit = o.unit as { name: string } | null;
  const resultByItem = new Map((data.results as any[]).map((r) => [r.order_item_id, r]));
  const isParticular = (o.insurance as { is_particular?: boolean } | null)?.is_particular === true;
  const paid = (data.payments as any[]).reduce((s, p) => s + Number(p.amount || 0), 0);
  const balance = Math.max(0, Number(o.total_value) - paid);

  const isFinalized = o.status === "finalizado";

  return (
    <>
      <PageHeader
        title={`Pedido #${o.order_number}`}
        description={`Aberto em ${new Date(o.order_date).toLocaleDateString("pt-BR")}`}
        actions={
          <div className="flex items-center gap-2">
            {isParticular && (
              <Button variant="secondary" onClick={() => setPayOpen(true)} disabled={balance <= 0}>
                <DollarSign className="size-4 mr-1" />
                Registrar pagamento
              </Button>
            )}
            {isFinalized && (
              <Button variant="outline" onClick={() => setPortalOpen(true)}>
                <KeyRound className="size-4 mr-1" />
                Acesso ao portal
              </Button>
            )}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button asChild={isFinalized} disabled={!isFinalized} variant="default">
                      {isFinalized ? (
                        <Link to="/pedidos/$orderId/laudo" params={{ orderId: o.id }}>
                          <FileText className="size-4 mr-1" />
                          Gerar laudo
                        </Link>
                      ) : (
                        <span>
                          <FileText className="size-4 mr-1" />
                          Gerar laudo
                        </span>
                      )}
                    </Button>
                  </span>
                </TooltipTrigger>
                {!isFinalized && (
                  <TooltipContent>
                    O laudo só pode ser gerado quando o pedido estiver finalizado (todos os exames liberados).
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
            <Button variant="outline" asChild>
              <Link to="/pedidos">
                <ArrowLeft className="size-4 mr-1" />
                Voltar
              </Link>
            </Button>
          </div>
        }
      />
      <PageBody>
        <div className="grid gap-4 md:grid-cols-2 mb-6">
          <Info title="Paciente" main={patient?.name} sub={`${patient?.code} · ${patient?.cpf ?? "sem CPF"}`} />
          <Info title="Médico" main={doctor?.name ?? "—"} sub={doctor ? `CRM ${doctor.crm}/${doctor.crm_uf}` : ""} />
          <Info title="Convênio" main={insurance?.name ?? "Particular"} />
          <Info
            title="Unidade"
            main={unit?.name ?? "—"}
            sub={o.collection_date ? `Coleta: ${new Date(o.collection_date).toLocaleDateString("pt-BR")}` : ""}
          />
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          <Badge variant="outline">{o.status}</Badge>
          {o.is_urgent && <Badge className="bg-warning text-warning-foreground">Urgente</Badge>}
          <Badge className={cn("font-medium", paymentStatusStyles[o.payment_status] ?? "")} variant="outline">
            Pagamento: {o.payment_status}
          </Badge>
          {o.billing_batch_id && <Badge variant="outline">Em lote de convênio</Badge>}
        </div>
        <div className="rounded-md border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Código</TableHead>
                <TableHead>Exame</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Amostra</TableHead>
                <TableHead className="text-right">Preço</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((i: any) => {
                const ex = i.exam as { code: string; name: string } | null;
                const sample = i.sample as { sample_number: number; material: string; status: string } | null;
                const result = resultByItem.get(i.id);
                const hasDetail = !!result;
                const isOpen = !!expanded[i.id];
                return (
                  <Fragment key={i.id}>
                    <TableRow
                      className={hasDetail ? "cursor-pointer" : ""}
                      onClick={() => hasDetail && setExpanded((s) => ({ ...s, [i.id]: !s[i.id] }))}
                    >
                      <TableCell>
                        {hasDetail ? (
                          isOpen ? (
                            <ChevronDown className="size-4" />
                          ) : (
                            <ChevronRight className="size-4" />
                          )
                        ) : null}
                      </TableCell>
                      <TableCell className="tabular-nums">{ex?.code}</TableCell>
                      <TableCell>{ex?.name}</TableCell>
                      <TableCell>
                        <Badge className={cn("font-medium", statusStyles[i.status] ?? "")} variant="outline">
                          {statusLabels[i.status] ?? i.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="tabular-nums text-xs">
                        {sample ? `#${sample.sample_number} · ${sample.material}` : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">R$ {Number(i.price).toFixed(2)}</TableCell>
                    </TableRow>
                    {hasDetail && isOpen && (
                      <TableRow>
                        <TableCell colSpan={6} className="bg-muted/30">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm py-2">
                            <div>
                              <div className="text-xs text-muted-foreground">Valor</div>
                              <div className="font-medium">
                                {result.value} {result.unit ?? ""}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground">Referência</div>
                              <div>
                                {result.reference_min ?? "—"} — {result.reference_max ?? "—"}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground">Lançado em</div>
                              <div>{new Date(result.entered_at).toLocaleString("pt-BR")}</div>
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground">Liberado</div>
                              <div>{result.released ? new Date(result.released_at).toLocaleString("pt-BR") : "—"}</div>
                            </div>
                            {result.observation && (
                              <div className="col-span-full">
                                <div className="text-xs text-muted-foreground">Observação</div>
                                <div>{result.observation}</div>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-col items-end gap-1 pt-4">
          <div className="flex items-baseline gap-3">
            <span className="text-sm text-muted-foreground">Total do pedido</span>
            <span className="text-2xl font-semibold tabular-nums">R$ {Number(o.total_value).toFixed(2)}</span>
          </div>
          {isParticular && (
            <>
              <div className="flex items-baseline gap-3 text-sm">
                <span className="text-muted-foreground">Pago</span>
                <span className="tabular-nums font-medium">R$ {paid.toFixed(2)}</span>
              </div>
              <div className="flex items-baseline gap-3 text-sm">
                <span className="text-muted-foreground">Saldo devedor</span>
                <span
                  className={cn(
                    "tabular-nums font-medium",
                    balance > 0 ? "text-warning-foreground" : "text-emerald-600",
                  )}
                >
                  R$ {balance.toFixed(2)}
                </span>
              </div>
            </>
          )}
        </div>

        {isParticular && data.payments.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">Pagamentos</h3>
              <Button size="sm" variant="outline" asChild>
                <Link to="/pedidos/$orderId/comprovante" params={{ orderId: o.id }}>
                  <Printer className="size-4 mr-1" />
                  Comprovante
                </Link>
              </Button>
            </div>
            <div className="rounded-md border bg-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Forma</TableHead>
                    <TableHead>Parcela</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data.payments as any[]).map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="tabular-nums text-xs">
                        {new Date(p.paid_at).toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell>{p.method}</TableCell>
                      <TableCell className="tabular-nums">{p.installment_number}</TableCell>
                      <TableCell className="text-right tabular-nums">R$ {Number(p.amount).toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </PageBody>

      <PaymentDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        orderId={o.id}
        companyId={o.company_id}
        suggested={balance}
        nextInstallment={(data.payments as any[]).length + 1}
      />
      <PortalAccessDialog
        open={portalOpen}
        onOpenChange={(v) => {
          setPortalOpen(v);
          if (!v) setPortalCreds(null);
        }}
        orderId={o.id}
        orderNumber={o.order_number}
        patientName={patient?.name}
        creds={portalCreds}
        setCreds={setPortalCreds}
      />
    </>
  );
}

function printAccessVoucher(opts: { code: string; orderNumber: number; patientName?: string; portalUrl: string }) {
  const win = window.open("", "_blank", "width=420,height=560");
  if (!win) return;
  win.document.write(`
    <html>
      <head>
        <title>Acesso ao portal — Pedido #${opts.orderNumber}</title>
        <style>
          body { font-family: Inter, system-ui, sans-serif; padding: 24px; color: #111; }
          h1 { font-size: 14px; margin: 0 0 4px; }
          .sub { font-size: 11px; color: #666; margin-bottom: 20px; }
          .code { font-family: monospace; font-size: 22px; font-weight: 700; letter-spacing: 0.15em;
                   border: 1px solid #ccc; border-radius: 8px; padding: 12px 16px; text-align: center; margin: 12px 0; }
          .url { font-family: monospace; font-size: 12px; text-align: center; margin-bottom: 16px; }
          .note { font-size: 11px; color: #666; margin-top: 16px; line-height: 1.5; }
        </style>
      </head>
      <body>
        <h1>Acesso ao laudo online</h1>
        <div class="sub">Pedido #${opts.orderNumber}${opts.patientName ? " — " + opts.patientName : ""}</div>
        <div class="url">${opts.portalUrl}</div>
        <div class="code">${opts.code}</div>
        <div class="note">
          Acesse o endereço acima e informe este código junto com a senha numérica
          fornecida separadamente pelo laboratório para visualizar e imprimir seu laudo.
        </div>
      </body>
    </html>
  `);
  win.document.close();
  win.focus();
  win.print();
}

function PortalAccessDialog({
  open,
  onOpenChange,
  orderId,
  orderNumber,
  patientName,
  creds,
  setCreds,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  orderId: string;
  orderNumber: number;
  patientName?: string;
  creds: { public_code: string; pin: string } | null;
  setCreds: (v: { public_code: string; pin: string } | null) => void;
}) {
  const generate = useServerFn(createPortalAccess);
  const fetchInfo = useServerFn(getPortalAccessInfo);
  const { data: existing, refetch } = useQuery({
    queryKey: ["portal-access", orderId],
    enabled: open,
    queryFn: () => fetchInfo({ data: { orderId } }),
  });

  const mut = useMutation({
    mutationFn: () => generate({ data: { orderId } }),
    onSuccess: (res) => {
      setCreds(res);
      refetch();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao gerar acesso"),
  });

  const portalUrl = typeof window !== "undefined" ? `${window.location.origin}/portal` : "/portal";
  const hasExisting = !!existing?.public_code;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Acesso ao portal do paciente</DialogTitle>
          <DialogDescription>
            O paciente acessa o laudo em <span className="font-mono">{portalUrl}</span> com o código de acesso e uma
            senha numérica.
          </DialogDescription>
        </DialogHeader>

        {creds ? (
          <div className="space-y-4">
            <div className="rounded-md border bg-warning/10 p-3 text-xs">
              <strong>Anote a senha agora.</strong> Por segurança, ela não fica visível depois — se for perdida, gere um
              novo acesso. Entregue o código e a senha ao paciente por canais separados.
            </div>
            <div className="grid grid-cols-2 gap-3">
              <CredField label="Código de acesso" value={creds.public_code} />
              <CredField label="Senha (6 dígitos)" value={creds.pin} />
            </div>
            <div className="text-xs text-muted-foreground">
              Link: <span className="font-mono">{portalUrl}</span>
            </div>
          </div>
        ) : hasExisting ? (
          <div className="space-y-3">
            <div className="text-sm">Já existe um acesso ativo para este pedido.</div>
            <div className="rounded-md border bg-card p-3 text-xs space-y-1">
              <div>
                Código: <span className="font-mono font-medium">{existing!.public_code}</span>
              </div>
              {existing?.expires_at && (
                <div>Válido até: {new Date(existing.expires_at).toLocaleDateString("pt-BR")}</div>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              A senha atual não pode ser recuperada. Gerar um novo acesso invalida o anterior.
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">Ainda não há acesso gerado para este pedido.</div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          {(creds || hasExisting) && (
            <Button
              variant="outline"
              onClick={() =>
                printAccessVoucher({
                  code: creds?.public_code ?? existing!.public_code,
                  orderNumber,
                  patientName,
                  portalUrl,
                })
              }
            >
              <Printer className="size-4 mr-1" />
              Imprimir código
            </Button>
          )}
          {!creds && (
            <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
              {mut.isPending ? "Gerando..." : hasExisting ? "Gerar novo acesso" : "Gerar acesso"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CredField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/40 p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-center gap-2">
        <div className="font-mono text-lg font-semibold tabular-nums tracking-widest">{value}</div>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={() => {
            navigator.clipboard?.writeText(value);
            toast.success(`${label} copiado`);
          }}
        >
          <Copy className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

function PaymentDialog({
  open,
  onOpenChange,
  orderId,
  companyId,
  suggested,
  nextInstallment,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  orderId: string;
  companyId: string;
  suggested: number;
  nextInstallment: number;
}) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState<string>(suggested.toFixed(2));
  const [method, setMethod] = useState<string>("dinheiro");
  const [installment, setInstallment] = useState<string>(String(nextInstallment));

  const mut = useMutation({
    mutationFn: async () => {
      const val = Number(amount.replace(",", "."));
      if (!val || val <= 0) throw new Error("Valor inválido");
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("payments").insert({
        company_id: companyId,
        order_id: orderId,
        amount: val,
        method: method as any,
        received_by: u.user?.id ?? null,
        installment_number: Number(installment) || 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pagamento registrado");
      qc.invalidateQueries({ queryKey: ["order", orderId] });
      qc.invalidateQueries({ queryKey: ["financeiro-dashboard"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao registrar pagamento"),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (v) {
          setAmount(suggested.toFixed(2));
          setInstallment(String(nextInstallment));
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar pagamento</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">
            Saldo devedor: <span className="font-medium text-foreground tabular-nums">R$ {suggested.toFixed(2)}</span>
          </div>
          <div className="grid gap-1.5">
            <Label>Valor (R$)</Label>
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
          </div>
          <div className="grid gap-1.5">
            <Label>Forma de pagamento</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dinheiro">Dinheiro</SelectItem>
                <SelectItem value="pix">PIX</SelectItem>
                <SelectItem value="cartao_debito">Cartão débito</SelectItem>
                <SelectItem value="cartao_credito">Cartão crédito</SelectItem>
                <SelectItem value="boleto">Boleto</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Parcela</Label>
            <Input value={installment} onChange={(e) => setInstallment(e.target.value)} type="number" min={1} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending ? "Salvando..." : "Registrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Info({ title, main, sub }: { title: string; main?: string; sub?: string }) {
  return (
    <div className="rounded-md border bg-card p-4">
      <div className="text-xs text-muted-foreground">{title}</div>
      <div className="mt-1 font-medium">{main}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}
