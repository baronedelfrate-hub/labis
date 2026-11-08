import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { BRAND, LOGIN_BG } from "@/lib/brand";
import { LogoFull } from "@/components/Logo";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Acesso — DFLAB" }, { name: "description", content: "Acesso ao sistema laboratorial." }] }),
  // ?aba=criar abre direto a aba "Criar conta" (usado pelo botão "Criar conta e testar" da página inicial)
  validateSearch: (s: Record<string, unknown>): { aba?: "criar" } => ({ aba: s.aba === "criar" ? "criar" : undefined }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { aba } = Route.useSearch();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    navigate({ to: "/dashboard", replace: true });
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: window.location.origin, data: { full_name: fullName } },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Conta criada. Você pode entrar agora.");
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="relative isolate hidden lg:flex flex-col overflow-hidden bg-sidebar text-sidebar-foreground p-12">
        <img src={LOGIN_BG} alt="" aria-hidden="true" className="absolute inset-0 -z-20 h-full w-full object-cover object-right-bottom" />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-br from-[#04232c]/95 via-[#04232c]/45 to-transparent" />
        <div className="flex items-center gap-3">
          <LogoFull dark height={60} />
        </div>
        <div className="mt-14 max-w-md space-y-3">
          <h1 className="text-3xl font-semibold leading-tight">Sistema de informação para laboratórios de análises clínicas</h1>
          <p className="text-sm text-sidebar-foreground/70 max-w-md">Gestão de pedidos, coletas, convênios e catálogo de exames — tudo em um só lugar.</p>
        </div>
        <p className="mt-auto text-xs text-sidebar-foreground/50">© {new Date().getFullYear()} {BRAND}</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8 flex items-center gap-2">
            <LogoFull height={48} />
          </div>
          <Tabs defaultValue={aba === "criar" ? "signup" : "login"}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Criar conta</TabsTrigger>
            </TabsList>
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4 mt-6">
                <div className="space-y-2"><Label htmlFor="l-email">E-mail</Label><Input id="l-email" type="email" autoFocus required value={email} onChange={e => setEmail(e.target.value)} /></div>
                <div className="space-y-2"><Label htmlFor="l-pass">Senha</Label><Input id="l-pass" type="password" required value={password} onChange={e => setPassword(e.target.value)} /></div>
                <Button type="submit" className="w-full" disabled={loading}>{loading ? "Entrando..." : "Entrar"}</Button>
              </form>
            </TabsContent>
            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4 mt-6">
                <div className="space-y-2"><Label htmlFor="s-name">Nome completo</Label><Input id="s-name" required value={fullName} onChange={e => setFullName(e.target.value)} /></div>
                <div className="space-y-2"><Label htmlFor="s-email">E-mail</Label><Input id="s-email" type="email" required value={email} onChange={e => setEmail(e.target.value)} /></div>
                <div className="space-y-2"><Label htmlFor="s-pass">Senha</Label><Input id="s-pass" type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} /></div>
                <Button type="submit" className="w-full" disabled={loading}>{loading ? "Criando..." : "Criar conta"}</Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
