import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer } from "lucide-react";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getPortalAccessInfo } from "@/lib/portal.functions";

export const Route = createFileRoute("/_authenticated/pedidos/$orderId_/comprovante")({
  ssr: false,
  head: () => ({ meta: [{ title: "Comprovante — DFLAB" }] }),
  component: ComprovantePage,
});

const methodLabels: Record<string, string> = {
  dinheiro: "Dinheiro",
  pix: "PIX",
  cartao_debito: "Cartão débito",
  cartao_credito: "Cartão crédito",
  boleto: "Boleto",
};

function ComprovantePage() {
  const { orderId } = Route.useParams();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const fetchPortalInfo = useServerFn(getPortalAccessInfo);
  const { data: portal } = useQuery({
    queryKey: ["comprovante-portal", orderId],
    queryFn: () => fetchPortalInfo({ data: { orderId } }),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["comprovante", orderId],
    staleTime: 0,
    queryFn: async () => {
      const { data: order, error } = await supabase.from("orders").select(`
        id,order_number,order_date,total_value,payment_status,company_id,
        patient:patients(name,code,cpf),
        insurance:insurance_plans(name)
      `).eq("id", orderId).single();
      if (error) throw error;
      const { data: payments } = await supabase.from("payments").select("*").eq("order_id", orderId).order("paid_at");
      const { data: settings } = await supabase.from("company_settings").select("*").eq("company_id", order.company_id).maybeSingle();
      const { data: company } = await supabase.from("companies").select("name").eq("id", order.company_id).single();
      return { order, payments: payments ?? [], settings, company };
    },
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const path = data?.settings?.logo_url;
      if (!path) { setLogoUrl(null); return; }
      const { data: signed } = await supabase.storage.from("company-logos").createSignedUrl(path, 3600);
      if (!cancelled) setLogoUrl(signed?.signedUrl ?? null);
    }
    load();
    return () => { cancelled = true; };
  }, [data?.settings?.logo_url]);

  if (isLoading || !data) return <div className="p-6 text-muted-foreground">Carregando...</div>;
  const o = data.order as any;
  const s = data.settings as any;
  const paid = (data.payments as any[]).reduce((sum, p) => sum + Number(p.amount), 0);
  const balance = Math.max(0, Number(o.total_value) - paid);

  return (
    <div className="bg-background min-h-screen">
      <div className="print:hidden border-b bg-card">
        <div className="max-w-4xl mx-auto px-6 py-3 flex justify-between items-center">
          <Button variant="ghost" size="sm" asChild><Link to="/pedidos/$orderId" params={{ orderId }}><ArrowLeft className="size-4 mr-1" />Voltar</Link></Button>
          <Button onClick={() => window.print()}><Printer className="size-4 mr-1" />Imprimir / Salvar PDF</Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto bg-white text-black p-10 my-6 shadow print:shadow-none print:my-0 print:max-w-none">
        <header className="flex items-start justify-between border-b pb-4 mb-6">
          <div className="flex items-start gap-4">
            {logoUrl && <img src={logoUrl} alt="Logo" className="h-16 object-contain" />}
            <div>
              <div className="text-xl font-bold">{s?.legal_name ?? data.company?.name}</div>
              {s?.cnpj && <div className="text-sm">CNPJ: {s.cnpj}</div>}
              {s?.address && <div className="text-xs text-gray-600">{s.address}{s.city ? `, ${s.city}` : ""}{s.state ? ` - ${s.state}` : ""}{s.zip_code ? ` · CEP ${s.zip_code}` : ""}</div>}
              {(s?.phone || s?.email) && <div className="text-xs text-gray-600">{s?.phone}{s?.phone && s?.email ? " · " : ""}{s?.email}</div>}
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-semibold">COMPROVANTE DE PAGAMENTO</div>
            <div className="text-sm">Pedido nº {o.order_number}</div>
            <div className="text-xs text-gray-600">Emitido em {new Date().toLocaleString("pt-BR")}</div>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-4 text-sm mb-6">
          <div>
            <div className="text-xs uppercase text-gray-500">Paciente</div>
            <div className="font-medium">{o.patient?.name}</div>
            <div className="text-xs text-gray-600">{o.patient?.code}{o.patient?.cpf ? ` · CPF ${o.patient.cpf}` : ""}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-gray-500">Convênio</div>
            <div className="font-medium">{o.insurance?.name ?? "Particular"}</div>
            <div className="text-xs text-gray-600">Data do pedido: {new Date(o.order_date).toLocaleDateString("pt-BR")}</div>
          </div>
        </section>

        <section className="mb-6">
          <div className="text-xs uppercase text-gray-500 mb-2">Pagamentos</div>
          <table className="w-full text-sm">
            <thead className="border-b">
              <tr className="text-left">
                <th className="py-2">Data</th><th>Forma</th><th className="text-right">Parcela</th><th className="text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {(data.payments as any[]).map((p) => (
                <tr key={p.id} className="border-b border-gray-100">
                  <td className="py-2">{new Date(p.paid_at).toLocaleString("pt-BR")}</td>
                  <td>{methodLabels[p.method] ?? p.method}</td>
                  <td className="text-right">{p.installment_number}</td>
                  <td className="text-right tabular-nums">R$ {Number(p.amount).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="flex justify-end">
          <div className="w-72 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-gray-600">Total do pedido</span><span className="tabular-nums">R$ {Number(o.total_value).toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">Total pago</span><span className="tabular-nums font-medium">R$ {paid.toFixed(2)}</span></div>
            <div className="flex justify-between border-t pt-1"><span className="text-gray-600">Saldo devedor</span><span className="tabular-nums font-semibold">R$ {balance.toFixed(2)}</span></div>
          </div>
        </section>

        {portal?.public_code && (
          <p className="text-xs text-gray-600 mt-6 border-t pt-3">
            Acesse seu laudo em <span className="font-mono">{typeof window !== "undefined" ? `${window.location.origin}/portal` : "/portal"}</span> com o código <span className="font-mono font-semibold tracking-widest">{portal.public_code}</span>. A senha é entregue separadamente.
          </p>
        )}

        {s?.footer_note && <p className="text-xs text-gray-600 mt-8 border-t pt-3">{s.footer_note}</p>}
      </div>

      <style>{`@media print { body { background: white; } .print\\:hidden { display: none !important; } }`}</style>
    </div>
  );
}
