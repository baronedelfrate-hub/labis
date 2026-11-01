import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listCompanyUsers, inviteUser, resendInvitation, revokeInvitation,
  changeUserRole, setUserActive,
} from "@/lib/users.functions";
import { PageHeader, PageBody } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Send, X, UserX, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { useIsAdmin } from "@/hooks/useIsAdmin";

type Role = "admin" | "recepcao" | "tecnico" | "bioquimico";
const ROLES: Role[] = ["admin", "recepcao", "tecnico", "bioquimico"];
const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrador", recepcao: "Recepção", tecnico: "Técnico", bioquimico: "Bioquímico",
};

export const Route = createFileRoute("/_authenticated/cadastros/usuarios")({
  head: () => ({ meta: [{ title: "Usuários — LIS" }] }),
  component: UsersPage,
});

function UsersPage() {
  const isAdmin = useIsAdmin();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const listFn = useServerFn(listCompanyUsers);
  const inviteFn = useServerFn(inviteUser);
  const resendFn = useServerFn(resendInvitation);
  const revokeFn = useServerFn(revokeInvitation);
  const changeRoleFn = useServerFn(changeUserRole);
  const setActiveFn = useServerFn(setUserActive);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("recepcao");

  useEffect(() => {
    // Redirect non-admins away
    // (isAdmin defaults to false while loading; we allow the query to try and gate the UI)
  }, [isAdmin]);

  const { data, isLoading } = useQuery({
    queryKey: ["company-users"],
    queryFn: () => listFn(),
    enabled: isAdmin,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["company-users"] });

  const invite = useMutation({
    mutationFn: () => inviteFn({ data: { email: inviteEmail, role: inviteRole } }),
    onSuccess: () => {
      toast.success("Convite enviado");
      setInviteOpen(false); setInviteEmail(""); setInviteRole("recepcao");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resend = useMutation({
    mutationFn: (id: string) => resendFn({ data: { invitationId: id } }),
    onSuccess: () => { toast.success("Convite reenviado"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const revoke = useMutation({
    mutationFn: (id: string) => revokeFn({ data: { invitationId: id } }),
    onSuccess: () => { toast.success("Convite revogado"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const changeRole = useMutation({
    mutationFn: (v: { userId: string; role: Role }) => changeRoleFn({ data: v }),
    onSuccess: () => { toast.success("Papel atualizado"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const setActive = useMutation({
    mutationFn: (v: { userId: string; active: boolean }) => setActiveFn({ data: v }),
    onSuccess: (_d, v) => { toast.success(v.active ? "Usuário reativado" : "Usuário desativado"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!isAdmin) {
    return (
      <>
        <PageHeader title="Usuários" />
        <PageBody>
          <div className="rounded-md border bg-card p-8 text-center text-sm text-muted-foreground">
            Somente administradores podem gerenciar usuários.
            <div className="mt-4">
              <Button variant="outline" onClick={() => navigate({ to: "/dashboard" })}>Voltar</Button>
            </div>
          </div>
        </PageBody>
      </>
    );
  }

  const pendingInvites = (data?.invitations ?? []).filter((i: any) => i.status === "pending");

  return (
    <>
      <PageHeader
        title="Usuários"
        description="Gestão de acesso da empresa"
        actions={
          <Button onClick={() => setInviteOpen(true)}>
            <Plus className="size-4 mr-1" />Convidar usuário
          </Button>
        }
      />
      <PageBody>
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">Usuários ativos</h2>
          <div className="rounded-md border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead className="w-48">Papel</TableHead>
                  <TableHead className="w-24">Status</TableHead>
                  <TableHead className="w-32 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Carregando...</TableCell></TableRow>}
                {data?.users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>{u.full_name || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell>
                      <Select
                        value={u.role ?? undefined}
                        onValueChange={(role) => changeRole.mutate({ userId: u.id, role: role as Role })}
                      >
                        <SelectTrigger className="h-8"><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          {ROLES.map(r => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {u.active
                        ? <Badge variant="secondary">Ativo</Badge>
                        : <Badge variant="outline" className="text-muted-foreground">Inativo</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      {u.active ? (
                        <Button variant="ghost" size="sm" onClick={() => setActive.mutate({ userId: u.id, active: false })}>
                          <UserX className="size-4 mr-1" />Desativar
                        </Button>
                      ) : (
                        <Button variant="ghost" size="sm" onClick={() => setActive.mutate({ userId: u.id, active: true })}>
                          <UserCheck className="size-4 mr-1" />Reativar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {!isLoading && (data?.users.length ?? 0) === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Nenhum usuário.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </section>

        <section className="space-y-3 mt-8">
          <h2 className="text-sm font-semibold text-muted-foreground">Convites pendentes</h2>
          <div className="rounded-md border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>E-mail</TableHead>
                  <TableHead className="w-48">Papel</TableHead>
                  <TableHead className="w-40">Expira em</TableHead>
                  <TableHead className="w-48 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingInvites.map((i: any) => (
                  <TableRow key={i.id}>
                    <TableCell>{i.email}</TableCell>
                    <TableCell>{ROLE_LABEL[i.role as Role]}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(i.expires_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => resend.mutate(i.id)}>
                        <Send className="size-4 mr-1" />Reenviar
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => revoke.mutate(i.id)}>
                        <X className="size-4 mr-1" />Revogar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {pendingInvites.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">Sem convites pendentes.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </section>
      </PageBody>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convidar usuário</DialogTitle>
            <DialogDescription>Enviaremos um e-mail para o convidado definir a senha.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); invite.mutate(); }} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="inv-email">E-mail</Label>
              <Input id="inv-email" type="email" required autoFocus value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Papel</Label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as Role)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map(r => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={invite.isPending}>Enviar convite</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
