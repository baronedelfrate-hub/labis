// Bloco do laudo para exame tipo texto (resultado em texto livre, ex.: diagnóstico por imagem).
// Mantém as quebras de linha e parágrafos do texto digitado.
export function TextExamBlock({
  item, result, collectionDate,
}: { item: any; result: any; collectionDate: string | null }) {
  const reviewer = result.reviewer;
  return (
    <section className="mt-6" style={{ breakInside: "avoid" }}>
      <div className="border-t-2 border-b bg-slate-50 px-3 py-2 flex flex-wrap gap-x-6 gap-y-1 text-xs">
        <div><span className="font-semibold">{item.exam?.code}</span> · <span className="font-semibold">{item.exam?.name}</span></div>
        {item.exam?.material && <div><span className="text-muted-foreground">Material:</span> {item.exam.material}</div>}
        {result.method && <div><span className="text-muted-foreground">Método:</span> {result.method}</div>}
        {collectionDate && <div><span className="text-muted-foreground">Coleta:</span> {new Date(collectionDate).toLocaleDateString("pt-BR")}</div>}
        {result.released_at && <div><span className="text-muted-foreground">Liberação:</span> {new Date(result.released_at).toLocaleDateString("pt-BR")}</div>}
      </div>
      <div className="px-3 py-3 text-sm whitespace-pre-wrap leading-relaxed">{result.value}</div>
      {item.exam?.standard_notes && (
        <div className="px-3 text-xs text-muted-foreground whitespace-pre-line">{item.exam.standard_notes}</div>
      )}
      {result.observation && (
        <div className="px-3 mt-2 text-xs"><span className="text-muted-foreground">Obs:</span> {result.observation}</div>
      )}
      {reviewer && (
        <div className="px-3 mt-2 text-xs text-muted-foreground">
          Revisão: {reviewer.full_name}
          {reviewer.professional_council ? ` — ${reviewer.professional_council} ${reviewer.professional_registration ?? ""}` : ""}
        </div>
      )}
    </section>
  );
}
