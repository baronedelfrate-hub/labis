import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { computeDelay, delayRank, type Delay } from "@/lib/support-delay";

export type SupportReturn = {
  id: string;
  shipmentId: string;
  shipmentNumber: number;
  sentAt: string;
  labId: string | null;
  labName: string;
  orderItemId: string;
  orderId: string | null;
  orderNumber: number | null;
  patientName: string;
  patientCode: string;
  examCode: string;
  examName: string;
  delay: Delay;
};

const one = <T,>(x: T | T[] | null | undefined): T | null => (Array.isArray(x) ? (x[0] ?? null) : (x ?? null));

// Exames enviados a laboratórios de apoio que ainda não têm resultado, com a situação do prazo de cada um.
export function useSupportReturns() {
  return useQuery({
    queryKey: ["support-returns"],
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<SupportReturn[]> => {
      const { data, error } = await supabase
        .from("support_shipment_items")
        .select(
          "id, shipment:support_shipments!inner(id, number, sent_at, support_lab:support_labs(id, name, turnaround_days)), order_item:order_items!inner(id, status, exam:exams(code, name, deadline_days), order:orders!inner(id, order_number, status, patient:patients(name, code)))",
        )
        .eq("order_item.status", "coletado")
        .limit(2000);
      if (error) throw error;
      const now = new Date();
      const rows: SupportReturn[] = [];
      for (const r of (data ?? []) as any[]) {
        const ship = one<any>(r.shipment);
        const oi = one<any>(r.order_item);
        if (!ship || !oi) continue;
        const lab = one<any>(ship.support_lab);
        const exam = one<any>(oi.exam);
        const order = one<any>(oi.order);
        if (order?.status === "cancelado") continue; // pedido cancelado não espera retorno
        const patient = one<any>(order?.patient);
        rows.push({
          id: r.id,
          shipmentId: ship.id,
          shipmentNumber: ship.number,
          sentAt: ship.sent_at,
          labId: lab?.id ?? null,
          labName: lab?.name ?? "Laboratório de apoio",
          orderItemId: oi.id,
          orderId: order?.id ?? null,
          orderNumber: order?.order_number ?? null,
          patientName: patient?.name ?? "",
          patientCode: patient?.code ?? "",
          examCode: exam?.code ?? "",
          examName: exam?.name ?? "",
          delay: computeDelay(ship.sent_at, lab?.turnaround_days, exam?.deadline_days, now),
        });
      }
      return rows.sort((a, b) => delayRank(a.delay) - delayRank(b.delay) || a.shipmentNumber - b.shipmentNumber);
    },
  });
}

export function useSupportSummary() {
  const { data = [], isLoading } = useSupportReturns();
  return useMemo(
    () => ({
      isLoading,
      waiting: data.length,
      late: data.filter((r) => r.delay.state === "atrasado").length,
      dueToday: data.filter((r) => r.delay.state === "vence_hoje").length,
    }),
    [data, isLoading],
  );
}
