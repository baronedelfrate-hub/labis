import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Role = "admin" | "recepcao" | "tecnico" | "bioquimico";

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Apenas administradores podem executar esta ação");
}

async function getCompanyId(ctx: { supabase: any; userId: string }): Promise<string> {
  const { data, error } = await ctx.supabase
    .from("profiles")
    .select("company_id")
    .eq("id", ctx.userId)
    .single();
  if (error) throw new Error(error.message);
  return data.company_id as string;
}

// List users of current company (profiles + roles) and pending invitations
export const listCompanyUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const companyId = await getCompanyId(context);

    const { data: profiles, error: pe } = await context.supabase
      .from("profiles")
      .select("id, full_name, active, company_id")
      .eq("company_id", companyId);
    if (pe) throw new Error(pe.message);

    const { data: roles, error: re } = await context.supabase
      .from("user_roles")
      .select("user_id, role");
    if (re) throw new Error(re.message);

    const { data: invites, error: ie } = await context.supabase
      .from("invitations")
      .select("id, email, role, status, expires_at, created_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    if (ie) throw new Error(ie.message);

    // Get emails via admin client
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const emails: Record<string, string> = {};
    for (const p of profiles ?? []) {
      const { data } = await supabaseAdmin.auth.admin.getUserById(p.id);
      if (data?.user?.email) emails[p.id] = data.user.email;
    }

    const rolesByUser: Record<string, Role> = {};
    for (const r of roles ?? []) rolesByUser[r.user_id] = r.role as Role;

    return {
      users: (profiles ?? []).map((p: any) => ({
        id: p.id,
        full_name: p.full_name,
        email: emails[p.id] ?? "",
        role: rolesByUser[p.id] ?? null,
        active: p.active,
      })),
      invitations: invites ?? [],
    };
  });

export const inviteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { email: string; role: Role }) => {
    if (!d?.email || !/.+@.+\..+/.test(d.email)) throw new Error("E-mail inválido");
    if (!["admin", "recepcao", "tecnico", "bioquimico"].includes(d.role)) throw new Error("Papel inválido");
    return { email: d.email.trim().toLowerCase(), role: d.role };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const companyId = await getCompanyId(context);

    // Prevent inviting an email that already belongs to a user of any company (basic check by auth)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Upsert-like: revoke any existing pending invite for same email in this company, then insert
    await context.supabase
      .from("invitations")
      .update({ status: "revoked" })
      .eq("company_id", companyId)
      .eq("status", "pending")
      .ilike("email", data.email);

    const { data: inv, error } = await context.supabase
      .from("invitations")
      .insert({
        company_id: companyId,
        email: data.email,
        role: data.role,
        invited_by: context.userId,
      })
      .select("id, token")
      .single();
    if (error) throw new Error(error.message);

    // Send Supabase Auth invite email
    const origin = process.env.SITE_URL || process.env.VITE_SITE_URL || "";
    const redirectTo = origin ? `${origin}/auth` : undefined;
    const { error: mailErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
      data: { invitation_token: inv.token, company_id: companyId, role: data.role },
      redirectTo,
    });
    if (mailErr) {
      // If email already registered, Supabase returns error. Keep invitation record for the trigger.
      console.warn("[inviteUser] inviteUserByEmail:", mailErr.message);
    }
    return { ok: true, invitationId: inv.id };
  });

export const resendInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { invitationId: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const companyId = await getCompanyId(context);
    const { data: inv, error } = await context.supabase
      .from("invitations")
      .select("id, email, role, token, status, company_id")
      .eq("id", data.invitationId)
      .single();
    if (error) throw new Error(error.message);
    if (inv.company_id !== companyId) throw new Error("Convite de outra empresa");
    if (inv.status !== "pending") throw new Error("Convite não está pendente");

    // Extend expiration
    await context.supabase
      .from("invitations")
      .update({ expires_at: new Date(Date.now() + 7 * 86400_000).toISOString() })
      .eq("id", inv.id);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const origin = process.env.SITE_URL || process.env.VITE_SITE_URL || "";
    const redirectTo = origin ? `${origin}/auth` : undefined;
    const { error: mailErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(inv.email, {
      data: { invitation_token: inv.token, company_id: companyId, role: inv.role },
      redirectTo,
    });
    if (mailErr) console.warn("[resendInvitation]", mailErr.message);
    return { ok: true };
  });

export const revokeInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { invitationId: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const companyId = await getCompanyId(context);
    const { error } = await context.supabase
      .from("invitations")
      .update({ status: "revoked" })
      .eq("id", data.invitationId)
      .eq("company_id", companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const changeUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { userId: string; role: Role }) => {
    if (!["admin", "recepcao", "tecnico", "bioquimico"].includes(d.role)) throw new Error("Papel inválido");
    return d;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const companyId = await getCompanyId(context);

    // Target must be in same company
    const { data: target, error: te } = await context.supabase
      .from("profiles")
      .select("id, company_id")
      .eq("id", data.userId)
      .single();
    if (te) throw new Error(te.message);
    if (target.company_id !== companyId) throw new Error("Usuário de outra empresa");

    // If demoting the only admin, block
    if (data.role !== "admin") {
      const { data: current } = await context.supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.userId)
        .maybeSingle();
      if (current?.role === "admin") {
        const { data: admins, error: ae } = await context.supabase
          .from("user_roles")
          .select("user_id, profiles!inner(company_id, active)")
          .eq("role", "admin")
          .eq("profiles.company_id", companyId)
          .eq("profiles.active", true);
        if (ae) throw new Error(ae.message);
        if ((admins?.length ?? 0) <= 1) {
          throw new Error("Não é possível remover o único administrador da empresa");
        }
      }
    }

    // Replace role (one role per user in this app)
    const { error: de } = await context.supabase.from("user_roles").delete().eq("user_id", data.userId);
    if (de) throw new Error(de.message);
    const { error: ie } = await context.supabase.from("user_roles").insert({ user_id: data.userId, role: data.role });
    if (ie) throw new Error(ie.message);
    return { ok: true };
  });

export const setUserActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { userId: string; active: boolean }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const companyId = await getCompanyId(context);
    if (data.userId === context.userId && !data.active) {
      throw new Error("Você não pode desativar a si mesmo");
    }

    const { data: target, error: te } = await context.supabase
      .from("profiles")
      .select("id, company_id, active")
      .eq("id", data.userId)
      .single();
    if (te) throw new Error(te.message);
    if (target.company_id !== companyId) throw new Error("Usuário de outra empresa");

    // Block deactivating the last active admin
    if (!data.active) {
      const { data: current } = await context.supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.userId)
        .maybeSingle();
      if (current?.role === "admin") {
        const { data: admins } = await context.supabase
          .from("user_roles")
          .select("user_id, profiles!inner(company_id, active)")
          .eq("role", "admin")
          .eq("profiles.company_id", companyId)
          .eq("profiles.active", true);
        if ((admins?.length ?? 0) <= 1) {
          throw new Error("Não é possível desativar o único administrador da empresa");
        }
      }
    }

    const { error } = await context.supabase
      .from("profiles")
      .update({ active: data.active })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);

    // Also ban/unban the auth user so sessions can't operate
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      ban_duration: data.active ? "none" : "876000h",
    });

    return { ok: true };
  });
