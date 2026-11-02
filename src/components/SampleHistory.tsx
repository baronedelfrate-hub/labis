import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const eventLabel: Record<string, string> = {
  pendente: "Pedido registrado",
  coletada: "Coletada",
  recebida: "Recebida no setor",
  rejeitada: "Rejeitada",
};

// Histórico da amostra: cada mudança de situação, com quem fez, quando e em que setor.
// Só busca ao abrir, para a tela de coleta continuar leve.
export function SampleHistory({ sampleId }: { sampleId: string }) {
  const [open, setOpen] = useState(false);
  const { data = [], isLoading } = useQuery({
    queryKey: ["sample-events", sampleId],
    enabled: open,
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sample_events")
        .select("id, event, sector, created_at, user:profiles(full_name)")
        .eq("sample_id", sampleId)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  return (
    <details className="text-xs text-muted-foreground" onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary className="cursor-pointer select-none">Histórico</summary>
      <div className="pl-4 pt-1 space-y-0.5">
        {isLoading && <div>Carregando…</div>}
        {!isLoading && data.length === 0 && open && <div>Sem registros.</div>}
        {data.map((ev) => (
          <div key={ev.id} className="flex flex-wrap gap-x-2">
            <span className="tabular-nums">{new Date(ev.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span>
            <span className="font-medium text-foreground">{eventLabel[ev.event] ?? ev.event}</span>
            {ev.sector && <span>· {ev.sector}</span>}
            {ev.user?.full_name && <span>· {ev.user.full_name}</span>}
          </div>
        ))}
      </div>
    </details>
  );
}
