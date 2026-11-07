import { createFileRoute } from "@tanstack/react-router";
import { verifyPortalJwt } from "@/lib/portal-jwt.server";

export const Route = createFileRoute("/api/public/portal-laudo")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
        if (!token) return Response.json({ error: "unauthorized" }, { status: 401 });
        const payload = await verifyPortalJwt(token);
        if (!payload) return Response.json({ error: "unauthorized" }, { status: 401 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: order, error: oe } = await supabaseAdmin
          .from("orders")
          .select(`
            id, order_number, order_date, collection_date, status, company_id, patient_id,
            patient:patients(name,code,cpf,birth_date,sex),
            doctor:doctors(name,crm,crm_uf),
            insurance:insurance_plans(name),
            unit:units(name)
          `)
          .eq("id", payload.order_id)
          .eq("company_id", payload.company_id)
          .single();
        if (oe || !order) return Response.json({ error: "not_found" }, { status: 404 });
        if ((order as { status: string }).status !== "finalizado") {
          return Response.json({ error: "not_available" }, { status: 409 });
        }

        const { data: items } = await supabaseAdmin
          .from("order_items")
          .select("id,status,exam_id,exam:exams(code,name,material,sector,default_method,standard_notes,is_text,support_lab:support_labs(name))")
          .eq("order_id", payload.order_id);
        const itemIds = (items ?? []).map((i: { id: string }) => i.id);
        const { data: results } = itemIds.length
          ? await supabaseAdmin
              .from("results")
              .select("*, reviewer:profiles!results_reviewed_by_fkey(full_name,professional_council,professional_registration)")
              .in("order_item_id", itemIds)
              .eq("released", true)
          : { data: [] };
        const resultIds = ((results ?? []) as any[]).map((r) => r.id);
        const { data: resultValues } = resultIds.length
          ? await supabaseAdmin
              .from("result_values")
              .select("*, parameter:exam_parameters(id,name,unit,display_order,group_label)")
              .in("result_id", resultIds)
          : { data: [] };
        const { data: settings } = await supabaseAdmin
          .from("company_settings")
          .select("*")
          .eq("company_id", (order as { company_id: string }).company_id)
          .maybeSingle();

        let logoUrl: string | null = null;
        const logoPath = (settings as { logo_url?: string | null } | null)?.logo_url;
        if (logoPath) {
          const { data: signed } = await supabaseAdmin.storage
            .from("company-logos")
            .createSignedUrl(logoPath, 3600);
          logoUrl = signed?.signedUrl ?? null;
        }

        return Response.json({ order, items: items ?? [], results: results ?? [], resultValues: resultValues ?? [], settings, logoUrl });
      },
    },
  },
});
