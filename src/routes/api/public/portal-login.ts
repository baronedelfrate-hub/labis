import { createFileRoute } from "@tanstack/react-router";
import { signPortalJwt } from "@/lib/portal-jwt.server";

export const Route = createFileRoute("/api/public/portal-login")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { public_code?: unknown; pin?: unknown };
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "invalid_request" }, { status: 400 });
        }
        const code = typeof body.public_code === "string" ? body.public_code.trim().toUpperCase() : "";
        const pin = typeof body.pin === "string" ? body.pin.trim() : "";
        if (!code || !/^\d{6}$/.test(pin)) {
          return Response.json({ error: "invalid_credentials" }, { status: 401 });
        }

        let supabaseAdmin: typeof import("@/integrations/supabase/client.server").supabaseAdmin;
        try {
          ({ supabaseAdmin } = await import("@/integrations/supabase/client.server"));
          void supabaseAdmin.from;
        } catch (e) {
          console.error("[portal-login] admin client:", e instanceof Error ? e.message : e);
          return Response.json({ error: "server_error", stage: "configuracao" }, { status: 500 });
        }
        const { data, error } = await supabaseAdmin
          .rpc("portal_verify_login", { _code: code, _pin: pin })
          .single();
        if (error) {
          console.error("[portal-login] rpc:", error.code, error.message);
          // Só um código curto para diagnóstico (nunca a mensagem interna): chave recusada ou código do Postgres/PostgREST.
          const detail = /api key|jwt/i.test(error.message ?? "") ? "chave-recusada" : (error.code || "sem-codigo");
          return Response.json({ error: "server_error", stage: `verificacao/${detail}` }, { status: 500 });
        }
        const row = data as { status: string; order_id: string | null; locked_until: string | null };
        if (row.status === "locked") {
          return Response.json({ error: "locked", locked_until: row.locked_until }, { status: 423 });
        }
        if (row.status === "expired") {
          return Response.json({ error: "expired" }, { status: 410 });
        }
        if (row.status !== "ok" || !row.order_id) {
          return Response.json({ error: "invalid_credentials" }, { status: 401 });
        }

        const { data: order, error: oe } = await supabaseAdmin
          .from("orders")
          .select("company_id")
          .eq("id", row.order_id)
          .single();
        if (oe || !order) {
          console.error("[portal-login] order:", oe?.message);
          return Response.json({ error: "server_error", stage: "pedido" }, { status: 500 });
        }
        let token: string;
        try {
          token = await signPortalJwt({ order_id: row.order_id, company_id: order.company_id });
        } catch (e) {
          console.error("[portal-login] signPortalJwt failed:", e instanceof Error ? e.message : e);
          return Response.json({ error: "server_error", stage: "sessao" }, { status: 500 });
        }
        return Response.json({ token, expires_in: 20 * 60 });
      },
    },
  },
});
