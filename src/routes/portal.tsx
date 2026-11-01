import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setPortalToken } from "@/lib/portal-session";

export const Route = createFileRoute("/portal")({
  ssr: false,
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
    <div className="min-h-screen bg-muted/30 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-lg border bg-card shadow-sm p-6">
        <h1 className="text-lg font-semibold">Portal do paciente</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Informe o código de acesso e a senha fornecidos pelo laboratório.
        </p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="code">Código de acesso</Label>
            <Input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="XXXX-XXXX"
              autoComplete="off"
              className="uppercase tracking-widest tabular-nums"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pin">Senha (6 dígitos)</Label>
            <Input
              id="pin"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              className="tabular-nums tracking-widest"
              maxLength={6}
              required
            />
          </div>
          {error && <div className="text-sm text-destructive">{error}</div>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Verificando..." : "Acessar laudo"}
          </Button>
        </form>
      </div>
    </div>
  );
}
