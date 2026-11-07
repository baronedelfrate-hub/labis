import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setPortalToken } from "@/lib/portal-session";
import { FlaskConical, KeyRound, Lock, FileText, ShieldCheck, Clock, HelpCircle, Eye, EyeOff, AlertCircle } from "lucide-react";

// Mantém só letras e números (sem I/O/0/1 confundíveis não é garantido aqui) e coloca o traço depois de 4 caracteres.
function formatCode(v: string) {
  const c = v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  return c.length > 4 ? `${c.slice(0, 4)}-${c.slice(4)}` : c;
}

export const Route = createFileRoute("/portal")({
  ssr: false,
  // ?lab=<endereço do laboratório>: mostra o nome e a logo do laboratório antes do login
  validateSearch: (s: Record<string, unknown>): { lab?: string } => ({
    lab: typeof s.lab === "string" && /^[a-z0-9-]{3,40}$/i.test(s.lab) ? s.lab.toLowerCase() : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Portal do paciente — LIS" },
      { name: "description", content: "Acesse seu laudo com código e senha fornecidos pelo laboratório." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PortalLoginPage,
});

function PortalLoginPage() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const { lab } = Route.useSearch();
  const { data: brand, isLoading: brandLoading } = useQuery({
    queryKey: ["portal-brand", lab],
    enabled: !!lab,
    retry: false,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const r = await fetch(`/api/public/portal-brand?lab=${encodeURIComponent(lab!)}`);
      if (!r.ok) return null;
      return (await r.json()) as { name: string; logoUrl: string | null };
    },
  });
  useEffect(() => {
    if (brand?.name) document.title = `Portal do paciente — ${brand.name}`;
  }, [brand?.name]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/public/portal-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public_code: code.trim().toUpperCase(), pin: pin.trim() }),
      });
      if (res.status === 423) {
        const j = await res.json().catch(() => ({}));
        const until = j.locked_until ? new Date(j.locked_until).toLocaleTimeString("pt-BR") : "";
        setError(`Acesso temporariamente bloqueado por muitas tentativas. Tente novamente${until ? ` após ${until}` : " em alguns minutos"}.`);
        return;
      }
      if (res.status === 410) {
        setError("Este acesso expirou. Solicite um novo ao laboratório.");
        return;
      }
      if (res.status >= 500) {
        // Erro do servidor (ex.: configuração do portal), não é senha errada.
        const j = await res.json().catch(() => ({}));
        setError(`O portal está indisponível no momento. Avise o laboratório${j.stage ? ` (código: ${j.stage})` : ""}.`);
        return;
      }
      if (!res.ok) {
        setError("Código ou senha incorretos.");
        return;
      }
      const { token } = (await res.json()) as { token: string };
      setPortalToken(token);
      await navigate({ to: "/portal/laudo" });
    } catch {
      setError("Não foi possível conectar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/10 to-background flex flex-col">
      <header className="mx-auto flex w-full max-w-md items-center gap-3 px-4 pt-6" data-testid="portal-header">
        {lab && brandLoading ? (
          <div className="h-10 w-48 animate-pulse rounded-md bg-muted" aria-hidden />
        ) : brand ? (
          <>
            {brand.logoUrl ? (
              <img src={brand.logoUrl} alt={`Logo de ${brand.name}`} className="h-10 max-w-[140px] shrink-0 object-contain" />
            ) : (
              <span className="grid size-10 shrink-0 place-items-center rounded-md bg-primary text-lg font-semibold text-primary-foreground" aria-hidden>{brand.name.trim().charAt(0).toUpperCase()}</span>
            )}
            <div className="min-w-0 leading-tight">
              <div className="truncate font-semibold">{brand.name}</div>
              <div className="text-xs text-muted-foreground">Portal do paciente</div>
            </div>
          </>
        ) : (
          <>
            <span className="grid size-9 place-items-center rounded-md bg-primary text-primary-foreground"><FlaskConical className="size-5" /></span>
            <div className="leading-tight">
              <div className="font-semibold">LabIS</div>
              <div className="text-xs text-muted-foreground">Portal do paciente</div>
            </div>
          </>
        )}
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-4 py-6 space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Acesse seu laudo</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Veja e imprima os resultados dos seus exames, com segurança, a qualquer hora.
          </p>
        </div>

        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="code">Código de acesso</Label>
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(formatCode(e.target.value))}
                placeholder="XXXX-XXXX"
                autoComplete="off"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                className="uppercase tracking-widest tabular-nums"
                aria-describedby="code-help"
                required
              />
              <p id="code-help" className="text-xs text-muted-foreground">Está na folha entregue pelo laboratório. Pode digitar sem o traço.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pin">Senha (6 números)</Label>
              <div className="relative">
                <Input
                  id="pin"
                  type={showPin ? "text" : "password"}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  className="pr-10 tabular-nums tracking-widest"
                  aria-describedby="pin-help"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPin(v => !v)}
                  aria-label={showPin ? "Ocultar senha" : "Mostrar senha"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                >
                  {showPin ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              <p id="pin-help" className="text-xs text-muted-foreground">Informada pelo laboratório, separada do código.</p>
            </div>
            {error && (
              <div role="alert" className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="mt-0.5 size-4 shrink-0" /><span>{error}</span>
              </div>
            )}
            <Button type="submit" className="w-full" size="lg" disabled={loading || code.length < 9 || pin.length < 6}>
              {loading ? "Verificando..." : "Acessar laudo"}
            </Button>
          </form>
        </div>

        <section aria-labelledby="como" className="rounded-xl border bg-card p-5">
          <h2 id="como" className="text-sm font-medium">Como acessar</h2>
          <ol className="mt-3 space-y-3 text-sm">
            {[
              { icon: KeyRound, t: "Digite o código", d: "Está na folha que o laboratório entregou." },
              { icon: Lock, t: "Digite a senha de 6 números", d: "O laboratório informa a senha separadamente." },
              { icon: FileText, t: "Veja e imprima o laudo", d: "O laudo fica disponível quando todos os exames estiverem liberados." },
            ].map((s, i) => (
              <li key={s.t} className="flex gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><s.icon className="size-4" /></span>
                <div><div className="font-medium">{i + 1}. {s.t}</div><div className="text-muted-foreground">{s.d}</div></div>
              </li>
            ))}
          </ol>
        </section>

        <section className="rounded-xl border bg-card p-5 text-sm space-y-2">
          <div className="flex items-start gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" /><span>Seus dados são protegidos. Não compartilhe o código nem a senha.</span></div>
          <div className="flex items-start gap-2"><Clock className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><span>Por segurança, a sessão termina após 20 minutos e, depois de 5 tentativas erradas, o acesso fica bloqueado por 15 minutos.</span></div>
          <div className="flex items-start gap-2"><HelpCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><span>Perdeu o código ou a senha, ou o laudo ainda não aparece? Procure {brand ? brand.name : "o laboratório"}, que gera um novo acesso.</span></div>
        </section>
      </main>

      <footer className="px-4 pb-6 text-center text-xs text-muted-foreground">{brand ? "Tecnologia LabIS" : "Portal do paciente · LabIS"}</footer>
    </div>
  );
}
