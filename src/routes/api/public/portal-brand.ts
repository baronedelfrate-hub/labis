import { createFileRoute } from "@tanstack/react-router";

// Nome e logo do laboratório para a tela de login do portal (pública, antes do login).
// Só devolve o que o laboratório já exibe no laudo: nome e logo. Nenhum dado de paciente.
export const Route = createFileRoute("/api/public/portal-brand")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const lab = (new URL(request.url).searchParams.get("lab") ?? "").trim().toLowerCase();
        if (lab.length < 3 || lab.length > 40 || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(lab)) {
          return Response.json({ error: "not_found" }, { status: 404 });
        }

        let supabaseAdmin: typeof import("@/integrations/supabase/client.server").supabaseAdmin;
        try {
          ({ supabaseAdmin } = await import("@/integrations/supabase/client.server"));
          void supabaseAdmin.from;
        } catch (e) {
          console.error("[portal-brand] admin client:", e instanceof Error ? e.message : e);
          return Response.json({ error: "server_error" }, { status: 500 });
        }

        const { data: company, error } = await supabaseAdmin
          .from("companies")
          .select("id, name")
          .eq("portal_slug", lab)
          .eq("active", true)
          .maybeSingle();
        if (error) {
          console.error("[portal-brand] company:", error.message);
          return Response.json({ error: "server_error" }, { status: 500 });
        }
        if (!company) return Response.json({ error: "not_found" }, { status: 404 });

        const { data: settings } = await supabaseAdmin
          .from("company_settings")
          .select("legal_name, logo_url")
          .eq("company_id", company.id)
          .maybeSingle();

        let logoUrl: string | null = null;
        const logoPath = (settings as { logo_url?: string | null } | null)?.logo_url;
        if (logoPath) {
          const { data: signed } = await supabaseAdmin.storage.from("company-logos").createSignedUrl(logoPath, 3600);
          logoUrl = signed?.signedUrl ?? null;
        }

        const legal = (settings as { legal_name?: string | null } | null)?.legal_name?.trim();
        return Response.json(
          { name: legal || company.name, logoUrl },
          { headers: { "Cache-Control": "public, max-age=300" } },
        );
      },
    },
  },
});
