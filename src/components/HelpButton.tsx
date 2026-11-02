import { useState } from "react";
import { useLocation } from "@tanstack/react-router";
import { CircleHelp, ChevronRight } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { helpFor, helpTopics, workflowSteps, type HelpTopic } from "@/lib/help-content";

function Topic({ t }: { t: HelpTopic }) {
  return (
    <div className="space-y-3 text-sm">
      <p className="text-muted-foreground">{t.summary}</p>
      <ol className="list-decimal space-y-1.5 pl-5">{t.steps.map(s => <li key={s}>{s}</li>)}</ol>
      {t.tips && (
        <div className="rounded-md border bg-muted/50 p-3">
          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Dicas</div>
          <ul className="list-disc space-y-1 pl-4">{t.tips.map(s => <li key={s}>{s}</li>)}</ul>
        </div>
      )}
    </div>
  );
}

export function HelpButton() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const current = helpFor(pathname);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ajuda"
        className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 z-40 flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-2.5 text-sm font-medium text-primary-foreground shadow-lg transition hover:opacity-90 print:hidden"
      >
        <CircleHelp className="size-5" /><span className="hidden sm:inline">Ajuda</span>
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md print:hidden">
          <SheetHeader>
            <SheetTitle>{current ? `Ajuda: ${current.title}` : "Ajuda"}</SheetTitle>
            <SheetDescription>Como usar esta tela e o passo a passo do dia a dia.</SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-6">
            {current && <Topic t={current} />}
            <div>
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Fluxo do dia a dia</div>
              <div className="flex flex-wrap items-center gap-1 text-xs">
                {workflowSteps.map((s, i) => (
                  <span key={s} className="flex items-center gap-1">
                    <span className="rounded-full border bg-card px-2 py-0.5">{s}</span>
                    {i < workflowSteps.length - 1 && <ChevronRight className="size-3 text-muted-foreground" />}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Outros assuntos</div>
              <Accordion type="single" collapsible>
                {helpTopics.filter(h => h.topic.key !== current?.key).map(({ topic }) => (
                  <AccordionItem key={topic.key} value={topic.key}>
                    <AccordionTrigger className="text-sm">{topic.title}</AccordionTrigger>
                    <AccordionContent><Topic t={topic} /></AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
