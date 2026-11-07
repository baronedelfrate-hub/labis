import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer } from "lucide-react";

export const Route = createFileRoute("/_authenticated/apoio_/romaneio/$shipmentId")({
  ssr: false,
  head: () => ({ meta: [{ title: "Romaneio de envio — LIS" }] }),
  component: ManifestPage,
});

type Row = {
  id: string;
  order_item: {
    order: { order_number: number; patient: { name: string; code: string; birth_date: string | null } | null } | null;
    exam: { code: string; name: string; material: string | null } | null;
    sample: { sample_number: number; material: string | null } | null;
  } | null;
};

function ManifestPage() {
  const { shipmentId } = Route.useParams();
  const companyId = useCompanyId();

  const { data: company } = useQuery({
    queryKey: ["company-name", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase.from("companies").select("name").eq("id", companyId!).maybeSingle();
      return data as { name: string } | null;
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["support-manifest", shipmentId],
    queryFn: async () => {
      const { data, error } = await supabase.from("support_shipments")
        .select("id, number, sent_at, notes, support_lab:support_labs(name, contact, phone), support_shipment_items(id, order_item:order_items(order:orders(order_number, patient:patients(name, code, birth_date)), exam:exams(code, name, material), sample:samples!order_items_sample_id_fkey(sample_number, material)))")
        .eq("id", shipmentId).maybeSingle();
      if (error) throw error;
      return data as unknown as {
        id: string; number: number; sent_at: string; notes: string | null;
        support_lab: { name: string; contact: string | null; phone: string | null } | null;
        support_shipment_items: Row[];
      } | null;
    },
  });

  if (isLoading) return <div className="p-6 text-muted-foreground">Carregando...</div>;
  if (!data) return <div className="p-6">Remessa não encontrada. <Link to="/apoio" className="underline">Voltar</Link></div>;

  const rows = [...data.support_shipment_items].sort((a, b) => (a.order_item?.order?.order_number ?? 0) - (b.order_item?.order?.order_number ?? 0));
  const fmtBirth = (d: string | null | undefined) => (d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "");

  return (
    <div>
      <div className="print:hidden border-b bg-card">
        <div className="max-w-4xl mx-auto flex items-center gap-2 px-6 py-3">
          <Button variant="outline" asChild><Link to="/apoio"><ArrowLeft className="size-4 mr-1" />Voltar</Link></Button>
          <Button onClick={() => window.print()}><Printer className="size-4 mr-1" />Imprimir / Salvar PDF</Button>
        </div>
      </div>
      <div className="max-w-4xl mx-auto bg-white text-black p-8 my-6 shadow print:shadow-none print:my-0 print:max-w-none text-sm">
        <div className="flex items-start justify-between border-b pb-3">
          <div>
            <div className="text-lg font-semibold">Romaneio de envio de amostras</div>
            <div className="text-gray-600">{company?.name ?? ""}</div>
          </div>
          <div className="text-right">
            <div className="text-lg font-semibold tabular-nums">Remessa nº {data.number}</div>
            <div className="text-gray-600 tabular-nums">{new Date(data.sent_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</div>
          </div>
        </div>
        <div className="mt-3">
          <span className="text-gray-600">Laboratório de apoio:</span> <b>{data.support_lab?.name}</b>
          {data.support_lab?.contact && <span className="text-gray-600"> · Contato: {data.support_lab.contact}</span>}
          {data.support_lab?.phone && <span className="text-gray-600"> · {data.support_lab.phone}</span>}
        </div>
        <table className="mt-4 w-full border-collapse text-xs">
          <thead>
            <tr className="border-y bg-gray-100 text-left">
              <th className="p-1.5 w-8">#</th><th className="p-1.5">Pedido</th><th className="p-1.5">Paciente</th>
              <th className="p-1.5">Exame</th><th className="p-1.5">Material / amostra</th><th className="p-1.5 w-16 text-center">Conferido</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const oi = r.order_item;
              return (
                <tr key={r.id} className="border-b align-top">
                  <td className="p-1.5 tabular-nums">{i + 1}</td>
                  <td className="p-1.5 tabular-nums">#{oi?.order?.order_number}</td>
                  <td className="p-1.5">{oi?.order?.patient?.name}<div className="text-gray-500">{oi?.order?.patient?.code}{oi?.order?.patient?.birth_date ? ` · nasc. ${fmtBirth(oi.order.patient.birth_date)}` : ""}</div></td>
                  <td className="p-1.5"><b>{oi?.exam?.code}</b> {oi?.exam?.name}</td>
                  <td className="p-1.5">{oi?.sample?.material ?? oi?.exam?.material ?? ""}{oi?.sample ? ` · amostra nº ${oi.sample.sample_number}` : ""}</td>
                  <td className="p-1.5 text-center"><span className="inline-block size-4 border border-black" /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="mt-3 text-xs text-gray-600">Total: {rows.length} exame(s)</div>
        {data.notes && <div className="mt-2 text-xs"><b>Observações:</b> {data.notes}</div>}
        <div className="mt-12 grid grid-cols-2 gap-10 text-xs">
          <div className="border-t pt-1 text-center">Enviado por (nome e assinatura) / data</div>
          <div className="border-t pt-1 text-center">Recebido por (nome e assinatura) / data</div>
        </div>
      </div>
      <style>{`@media print { body { background: white; } }`}</style>
    </div>
  );
}
