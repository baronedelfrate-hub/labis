import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ChevronsUpDown, X } from "lucide-react";

type Row = { code: string; name: string };

// Busca no CID-10 (14 mil códigos): consulta no servidor conforme se digita, sem baixar a tabela inteira.
export function Cid10Combobox({ value, onChange }: { value: string | null; onChange: (code: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(text.trim()), 250);
    return () => clearTimeout(t);
  }, [text]);

  const { data: results = [], isFetching } = useQuery({
    queryKey: ["cid10-search", debounced],
    enabled: open && debounced.length >= 2,
    staleTime: 60_000,
    queryFn: async (): Promise<Row[]> => {
      // tira caracteres que têm significado no filtro do PostgREST
      const q = debounced.replace(/[%,()*:]/g, " ").trim();
      const { data, error } = await supabase
        .from("cid10")
        .select("code, name")
        .or(`code.ilike.${q}%,name.ilike.%${q}%`)
        .order("code")
        .limit(30);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const { data: selected } = useQuery({
    queryKey: ["cid10-one", value],
    enabled: !!value,
    staleTime: 3_600_000,
    queryFn: async (): Promise<Row | null> => {
      const { data } = await supabase.from("cid10").select("code, name").eq("code", value!).maybeSingle();
      return (data as Row | null) ?? { code: value!, name: "" };
    },
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
          <span className="truncate text-left">
            {value ? (
              <>
                <span className="font-mono tabular-nums">{selected?.code ?? value}</span>
                {selected?.name ? ` — ${selected.name}` : ""}
              </>
            ) : (
              <span className="text-muted-foreground">Buscar CID-10 por código ou nome…</span>
            )}
          </span>
          <div className="flex items-center gap-1 ml-2">
            {value && <X className="size-4 opacity-60 hover:opacity-100" onClick={(e) => { e.stopPropagation(); onChange(null); }} />}
            <ChevronsUpDown className="size-4 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Digite ao menos 2 letras ou o código (ex.: E11)…" value={text} onValueChange={setText} />
          <CommandList>
            {debounced.length < 2 && <div className="py-6 text-center text-sm text-muted-foreground">Digite para buscar.</div>}
            {debounced.length >= 2 && !isFetching && results.length === 0 && <CommandEmpty>Nenhum CID encontrado.</CommandEmpty>}
            <CommandGroup>
              {results.map((r) => (
                <CommandItem key={r.code} value={r.code} onSelect={() => { onChange(r.code); setOpen(false); setText(""); }}>
                  <span className="font-mono tabular-nums mr-2 shrink-0">{r.code}</span>
                  <span className="truncate">{r.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
