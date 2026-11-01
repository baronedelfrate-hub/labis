import { createFileRoute, Outlet, redirect, Link, useNavigate, useLocation } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import {
  FlaskConical, LayoutDashboard, ClipboardList, Plus, Users, Stethoscope,
  ShieldCheck, Building2, Tags, TestTubes, Layers, LogOut, ChevronRight, UserCog,
  Beaker, ClipboardCheck, CheckCheck, Settings, Wallet, Landmark, Receipt,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useMyRoles } from "@/hooks/useMyRoles";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthedLayout,
});

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/pedidos", label: "Pedidos", icon: ClipboardList },
  { to: "/pedidos/novo", label: "Novo pedido", icon: Plus, highlight: true },
];

const workflow = [
  { to: "/coleta", label: "Coleta", icon: Beaker },
  { to: "/resultados", label: "Resultados", icon: ClipboardCheck, requires: "canEnterResults" as const },
  { to: "/liberacao", label: "Liberação", icon: CheckCheck, requires: "canRelease" as const },
];

const cadastros = [
  { to: "/cadastros/pacientes", label: "Pacientes", icon: Users },
  { to: "/cadastros/medicos", label: "Médicos", icon: Stethoscope },
  { to: "/cadastros/convenios", label: "Convênios", icon: ShieldCheck },
  { to: "/cadastros/unidades", label: "Unidades", icon: Building2 },
  { to: "/cadastros/tabelas-preco", label: "Tabelas de preço", icon: Tags },
  { to: "/cadastros/exames", label: "Exames", icon: TestTubes },
  { to: "/cadastros/grupos-exames", label: "Grupos de exames", icon: Layers },
];

function AuthedLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const [email, setEmail] = useState<string>("");
  const isAdmin = useIsAdmin();
  const myRoles = useMyRoles();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const isActive = (to: string) => location.pathname === to || (to !== "/dashboard" && location.pathname.startsWith(to));

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="w-60 shrink-0 bg-sidebar text-sidebar-foreground flex flex-col">
        <div className="px-4 py-4 flex items-center gap-2 border-b border-sidebar-border">
          <div className="rounded-md bg-sidebar-primary p-1.5"><FlaskConical className="size-4" /></div>
          <span className="font-semibold">LabIS</span>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1 text-sm">
          {nav.map(item => (
            <Link key={item.to} to={item.to} className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-md transition-colors",
              isActive(item.to) ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/60",
              item.highlight && !isActive(item.to) && "text-sidebar-primary",
            )}>
              <item.icon className="size-4" />{item.label}
            </Link>
          ))}
          <div className="pt-4 pb-1 px-3 text-[11px] uppercase tracking-wider text-sidebar-foreground/50">Fluxo</div>
          {workflow.map(item => {
            if (item.requires && !myRoles[item.requires]) return null;
            return (
              <Link key={item.to} to={item.to} className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-md transition-colors",
                isActive(item.to) ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/60",
              )}>
                <item.icon className="size-4" />{item.label}
                {isActive(item.to) && <ChevronRight className="ml-auto size-3.5 opacity-60" />}
              </Link>
            );
          })}
          {(myRoles.isAdmin || myRoles.isRecepcao) && (
            <>
              <div className="pt-4 pb-1 px-3 text-[11px] uppercase tracking-wider text-sidebar-foreground/50">Financeiro</div>
              {[
                { to: "/financeiro", label: "Dashboard", icon: Wallet, show: myRoles.isAdmin || myRoles.isRecepcao },
                { to: "/financeiro/convenios", label: "Convênios", icon: Landmark, show: myRoles.isAdmin },
                { to: "/financeiro/lotes", label: "Lotes", icon: Receipt, show: myRoles.isAdmin },
              ].filter(i => i.show).map(item => (
                <Link key={item.to} to={item.to} className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-md transition-colors",
                  isActive(item.to) ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/60",
                )}>
                  <item.icon className="size-4" />{item.label}
                  {isActive(item.to) && <ChevronRight className="ml-auto size-3.5 opacity-60" />}
                </Link>
              ))}
            </>
          )}
          <div className="pt-4 pb-1 px-3 text-[11px] uppercase tracking-wider text-sidebar-foreground/50">Cadastros</div>

          {cadastros.map(item => (
            <Link key={item.to} to={item.to} className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-md transition-colors",
              isActive(item.to) ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/60",
            )}>
              <item.icon className="size-4" />{item.label}
              {isActive(item.to) && <ChevronRight className="ml-auto size-3.5 opacity-60" />}
            </Link>
          ))}
          {isAdmin && (
            <>
              <Link to="/cadastros/usuarios" className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-md transition-colors",
                isActive("/cadastros/usuarios") ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/60",
              )}>
                <UserCog className="size-4" />Usuários
                {isActive("/cadastros/usuarios") && <ChevronRight className="ml-auto size-3.5 opacity-60" />}
              </Link>
              <Link to="/configuracoes" className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-md transition-colors",
                isActive("/configuracoes") ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/60",
              )}>
                <Settings className="size-4" />Configurações
                {isActive("/configuracoes") && <ChevronRight className="ml-auto size-3.5 opacity-60" />}
              </Link>
            </>
          )}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <div className="text-xs text-sidebar-foreground/70 mb-2 truncate">{email}</div>
          <Button variant="secondary" size="sm" className="w-full justify-start" onClick={signOut}>
            <LogOut className="size-4 mr-2" />Sair
          </Button>
        </div>
      </aside>
      <main className="flex-1 min-w-0 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}
