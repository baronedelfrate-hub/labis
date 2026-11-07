import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  FlaskConical, ClipboardList, TestTube2, Barcode, Calculator, ShieldCheck, FileText, Wallet,
  Smartphone, Building2, Users, Check, ArrowRight, Share2, Library, Printer, Truck, Layers, CircleHelp,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LabIS — Sistema para laboratório de análises clínicas" },
      { name: "description", content: "Do pedido ao laudo: coleta com código de barras, resultados com valores de pânico e campos calculados, liberação, portal do paciente, faturamento de convênios e app no celular." },
      { property: "og:title", content: "LabIS — Sistema para laboratório de análises clínicas" },
      { property: "og:description", content: "Pedidos, coleta, resultados, laudos, portal do paciente e financeiro em um só lugar. Funciona no computador e no celular." },
      { property: "og:image", content: "/landing/dashboard-d.webp" },
    ],
  }),
  component: Landing,
});

const features: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: ClipboardList, title: "Pedidos e cadastros", text: "Pacientes, médicos, convênios, unidades e exames. Pedido com urgência, convênio e tabela de preço aplicada automaticamente." },
  { icon: Barcode, title: "Código de barras e etiquetas", text: "Etiqueta por amostra com código padrão de laboratório, vários tubos por exame e impressão no tamanho da sua impressora." },
  { icon: TestTube2, title: "Coleta e recebimento", text: "Leitura do código na bancada confirma a coleta e o recebimento. Amostras rejeitadas pedem nova coleta com motivo registrado." },
  { icon: Calculator, title: "Resultados inteligentes", text: "Valores de referência por sexo e idade, destaque de fora da faixa, alerta de pânico com confirmação e campos calculados por fórmula. Lance pela fila ou direto do pedido do paciente." },
  { icon: FileText, title: "Textos-modelo e histórico", text: "Exames descritivos com textos-modelo prontos e histórico do paciente para comparar resultados anteriores." },
  { icon: ShieldCheck, title: "Liberação e laudo", text: "Conferência antes da liberação, laudo pronto para imprimir e comprovante de entrada para o paciente." },
  { icon: Share2, title: "Portal do paciente", text: "O paciente consulta e imprime o laudo com código e senha, em uma tela com o nome e a logo do seu laboratório." },
  { icon: Wallet, title: "Financeiro e convênios", text: "Valores a receber, lotes de faturamento por convênio e mês de referência e registro de pagamentos." },
  { icon: Library, title: "Biblioteca de referência", text: "Catálogo de exames, tabelas de preço AMB e CID-10 prontos para consulta. Menos digitação, menos erro." },
  { icon: Building2, title: "Multiempresa e unidades", text: "Cada laboratório tem seus dados isolados. Ao criar a conta, você já começa com uma base pronta: exames de rotina, perfis, preços e textos-modelo." },
  { icon: Users, title: "Equipe e permissões", text: "Convide a equipe e defina o perfil de cada pessoa: administrador, coleta, bancada, liberação ou financeiro." },
  { icon: Truck, title: "Laboratórios de apoio", text: "Envie exames terceirizados em remessas com romaneio para imprimir, acompanhe o retorno e veja os atrasos no painel e no menu." },
  { icon: Layers, title: "Perfis e check-ups", text: "Grupos de exames prontos, como perfil lipídico, hepático, pré-natal e check-up geral, para lançar vários exames de uma vez." },
  { icon: CircleHelp, title: "Ajuda em cada tela", text: "Um botão de ajuda mostra o passo a passo da tela em que você está, para a equipe aprender usando." },
  { icon: Smartphone, title: "App no celular", text: "Instale na tela inicial como aplicativo. Menu adaptado para o celular, funciona na recepção, na coleta e em casa." },
];

const shots = [
  { src: "/landing/dashboard-d.webp", title: "Painel do dia", text: "Movimento de pedidos, em aberto, finalizados e urgentes." },
  { src: "/landing/pedidos-d.webp", title: "Pedidos", text: "Busca por paciente ou número e status de cada pedido." },
  { src: "/landing/resultados-d.webp", title: "Lançamento de resultados", text: "Pânico, fora da faixa e campos calculados na hora." },
  { src: "/landing/coleta-d.webp", title: "Coleta com leitor", text: "Passe o código de barras e a amostra é confirmada." },
  { src: "/landing/etiquetas-d.webp", title: "Etiquetas", text: "Etiqueta com código de barras, exames e setor." },
  { src: "/landing/financeiro-d.webp", title: "Financeiro", text: "Particular, convênios e recebido no mês." },
  { src: "/landing/apoio-d.webp", title: "Envio ao apoio", text: "Exames terceirizados, previsão de retorno e atrasos em destaque." },
];

const plans = [
  {
    name: "Essencial", price: "R$ 149", tag: "Para começar",
    items: [
      "Pedidos, coleta e resultados",
      "Código de barras e etiquetas",
      "Pânico, referências e campos calculados",
      "Laudo para imprimir e comprovante",
      "Base inicial pronta: exames, perfis e preços",
      "App no celular e ajuda em cada tela",
    ],
  },
  {
    name: "Profissional", price: "R$ 349", tag: "Mais escolhido", highlight: true,
    items: [
      "Tudo do Essencial",
      "Portal do paciente com a marca do laboratório",
      "Convênios, tabelas de preço e lotes de faturamento",
      "Laboratórios de apoio: remessa, romaneio e alertas",
      "Biblioteca do XLAB7: catálogo, tabelas AMB e CID-10",
      "Várias unidades e equipe com perfis de acesso",
    ],
  },
  {
    name: "Rede", price: "Sob consulta", tag: "Para laboratórios maiores",
    items: [
      "Tudo do Profissional",
      "Implantação e migração de dados",
      "Treinamento da equipe",
      "Suporte prioritário",
      "Ajustes sob medida",
    ],
  },
];

function useHasSession() {
  const [has, setHas] = useState(false);
  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => { if (alive) setHas(!!data.session); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  return has;
}

function Landing() {
  const hasSession = useHasSession();
  const enter = hasSession ? "/dashboard" : "/auth";
  const enterLabel = hasSession ? "Abrir o sistema" : "Entrar";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <a href="#topo" className="flex items-center gap-2 font-semibold">
            <span className="grid size-8 place-items-center rounded-md bg-primary text-primary-foreground"><FlaskConical className="size-4" /></span>
            LabIS
          </a>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#recursos" className="hover:text-foreground">Recursos</a>
            <a href="#telas" className="hover:text-foreground">Telas</a>
            <a href="#planos" className="hover:text-foreground">Planos</a>
          </nav>
          <Button asChild size="sm"><Link to={enter}>{enterLabel}</Link></Button>
        </div>
      </header>

      <main id="topo">
        <section className="border-b bg-gradient-to-b from-primary/10 to-background">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 md:grid-cols-2 md:py-20">
            <div>
              <p className="mb-3 inline-block rounded-full border bg-card px-3 py-1 text-xs font-medium text-primary">Sistema para laboratórios de análises clínicas</p>
              <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl lg:text-5xl">Do pedido ao laudo, tudo em um só lugar.</h1>
              <p className="mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
                Cadastro, coleta com código de barras, resultados com alerta de pânico, liberação, portal do paciente e faturamento de convênios.
                Funciona no computador e no celular.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button asChild size="lg"><Link to={enter}>{enterLabel}<ArrowRight className="ml-1 size-4" /></Link></Button>
                <Button asChild size="lg" variant="outline"><a href="#planos">Ver planos</a></Button>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">Novo por aqui? <Link to="/auth" search={{ aba: "criar" }} className="underline">Crie a conta e teste</Link> com a base inicial já pronta.</p>
            </div>
            <Shot src="/landing/dashboard-d.webp" alt="Painel do dia do LabIS" priority />
          </div>
        </section>

        <section id="recursos" className="mx-auto max-w-6xl scroll-mt-16 px-4 py-14">
          <h2 className="text-2xl font-semibold sm:text-3xl">Tudo o que o laboratório usa no dia a dia</h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">Cada etapa do fluxo, da recepção à entrega do laudo, num sistema só.</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(f => (
              <div key={f.title} className="rounded-lg border bg-card p-5">
                <div className="mb-3 grid size-9 place-items-center rounded-md bg-primary/10 text-primary"><f.icon className="size-5" /></div>
                <h3 className="font-medium">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="telas" className="scroll-mt-16 border-y bg-muted/40">
          <div className="mx-auto max-w-6xl px-4 py-14">
            <h2 className="text-2xl font-semibold sm:text-3xl">Veja o sistema por dentro</h2>
            <p className="mt-2 max-w-2xl text-muted-foreground">Telas reais do LabIS. Os nomes e valores nas imagens são fictícios.</p>
            <div className="mt-8 grid gap-6 md:grid-cols-2">
              {shots.map(s => (
                <figure key={s.src}>
                  <Shot src={s.src} alt={s.title} />
                  <figcaption className="mt-2 text-sm"><span className="font-medium">{s.title}</span> <span className="text-muted-foreground">— {s.text}</span></figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-14">
          <div className="grid items-center gap-8 md:grid-cols-2">
            <div>
              <div className="mb-3 grid size-10 place-items-center rounded-md bg-primary/10 text-primary"><Smartphone className="size-5" /></div>
              <h2 className="text-2xl font-semibold sm:text-3xl">Feito para o celular também</h2>
              <p className="mt-2 text-muted-foreground">
                Abra no navegador do celular e use “Adicionar à tela inicial”. O LabIS vira um aplicativo, com menu lateral que se adapta à tela pequena.
                Ideal para a coleta, para conferir resultados e acompanhar o movimento fora do laboratório.
              </p>
              <ul className="mt-4 space-y-2 text-sm">
                {["Instalável como aplicativo (PWA)", "Telas ajustadas para o toque", "Leitura do código de barras na coleta"].map(t => (
                  <li key={t} className="flex items-center gap-2"><Check className="size-4 text-success" />{t}</li>
                ))}
              </ul>
            </div>
            <div className="flex justify-center gap-4">
              <img src="/landing/dashboard-m.webp" alt="Painel no celular" loading="lazy" className="w-36 rounded-2xl border shadow-lg sm:w-44" />
              <img src="/landing/resultados-m.webp" alt="Resultados no celular" loading="lazy" className="mt-8 w-36 rounded-2xl border shadow-lg sm:w-44" />
            </div>
          </div>
        </section>

        <section id="planos" className="scroll-mt-16 border-t bg-muted/40">
          <div className="mx-auto max-w-6xl px-4 py-14">
            <h2 className="text-2xl font-semibold sm:text-3xl">Planos</h2>
            <p className="mt-2 max-w-2xl text-muted-foreground">Valores de referência, por mês. Os planos se diferenciam pelos recursos. Crie a conta, teste com a base inicial pronta e combine o plano depois do teste.</p>
            <div className="mt-8 grid gap-6 md:grid-cols-3">
              {plans.map(p => (
                <div key={p.name} className={`flex flex-col rounded-xl border bg-card p-6 ${p.highlight ? "border-primary ring-2 ring-primary/30" : ""}`}>
                  <span className={`w-fit rounded-full px-2.5 py-0.5 text-xs font-medium ${p.highlight ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{p.tag}</span>
                  <h3 className="mt-3 text-xl font-semibold">{p.name}</h3>
                  <div className="mt-1 text-3xl font-semibold tabular-nums">{p.price}{p.price.startsWith("R$") && <span className="text-sm font-normal text-muted-foreground"> /mês</span>}</div>
                  <ul className="mt-5 flex-1 space-y-2 text-sm">
                    {p.items.map(i => <li key={i} className="flex items-start gap-2"><Check className="mt-0.5 size-4 shrink-0 text-success" />{i}</li>)}
                  </ul>
                  <Button asChild className="mt-6" variant={p.highlight ? "default" : "outline"}><Link to="/auth" search={{ aba: "criar" }}>Criar conta e testar</Link></Button>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-14 text-center">
          <Printer className="mx-auto size-8 text-primary" />
          <h2 className="mt-3 text-2xl font-semibold sm:text-3xl">Pronto para organizar o seu laboratório?</h2>
          <p className="mx-auto mt-2 max-w-xl text-muted-foreground">Crie a conta, convide a equipe e comece a cadastrar pedidos hoje.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {!hasSession && <Button asChild size="lg"><Link to="/auth" search={{ aba: "criar" }}>Criar conta e testar</Link></Button>}
            <Button asChild size="lg" variant={hasSession ? "default" : "outline"}><Link to={enter}>{enterLabel}</Link></Button>
          </div>
        </section>
      </main>

      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} LabIS — Sistema de informação laboratorial
      </footer>
    </div>
  );
}

function Shot({ src, alt, priority }: { src: string; alt: string; priority?: boolean }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-lg">
      <div className="flex gap-1.5 border-b bg-muted px-3 py-2">
        <span className="size-2.5 rounded-full bg-destructive/60" /><span className="size-2.5 rounded-full bg-warning/70" /><span className="size-2.5 rounded-full bg-success/70" />
      </div>
      <img src={src} alt={alt} width={1280} height={800} loading={priority ? "eager" : "lazy"} className="block h-auto w-full" />
    </div>
  );
}
