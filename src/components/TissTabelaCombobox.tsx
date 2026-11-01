import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Row = { codigo: string; descricao: string };

export function TissTabelaCombobox({ value, onChange, placeholder = "Selecione a tabela TISS..." }: {
  value: string | null;
  onChange: (codigo: string | null) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);

  const { data: rows = [] } = useQuery({
    queryKey: ["tiss_tabelas_referencia"],
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase.from("tiss_tabelas_referencia" as any).select("codigo,descricao").order("codigo");
      if (error) throw error;
      return (data ?? []) as any;
    },
    staleTime: 1000 * 60 * 60,
  });

  const selected = rows.find((r) => r.codigo === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
          <span className="truncate text-left">
            {selected ? <><span className="font-mono tabular-nums">{selected.codigo}</span> — {selected.descricao}</> : <span className="text-muted-foreground">{placeholder}</span>}
          </span>
          <div className="flex items-center gap-1 ml-2">
            {value && <X className="size-4 opacity-60 hover:opacity-100" onClick={(e) => { e.stopPropagation(); onChange(null); }} />}
            <ChevronsUpDown className="size-4 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command filter={(itemValue, search) => {
          const s = search.toLowerCase();
          return itemValue.toLowerCase().includes(s) ? 1 : 0;
        }}>
          <CommandInput placeholder="Buscar por código ou descrição..." />
          <CommandList>
            <CommandEmpty>Nenhuma tabela encontrada.</CommandEmpty>
            <CommandGroup>
              {rows.map((r) => (
                <CommandItem
                  key={r.codigo}
                  value={`${r.codigo} ${r.descricao}`}
                  onSelect={() => { onChange(r.codigo); setOpen(false); }}
                >
                  <Check className={cn("mr-2 size-4", value === r.codigo ? "opacity-100" : "opacity-0")} />
                  <span className="font-mono tabular-nums mr-2">{r.codigo}</span>
                  <span className="truncate">{r.descricao}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
