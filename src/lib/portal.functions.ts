import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const createPortalAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { orderId: string }) => {
    if (!d?.orderId || typeof d.orderId !== "string") throw new Error("orderId inválido");
    return d;
  })
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .rpc("portal_create_access", { _order_id: data.orderId })
      .single();
    if (error) throw new Error(error.message);
    return {
      public_code: (row as { public_code: string }).public_code,
      pin: (row as { pin: string }).pin,
    };
  });

export const getPortalAccessInfo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d: { orderId: string }) => d)
  .handler(async ({ data, context }) => {
    // Verify caller's company owns the order (RLS-scoped read).
    const { data: order, error: oe } = await context.supabase
      .from("orders")
      .select("id")
      .eq("id", data.orderId)
      .maybeSingle();
    if (oe) throw new Error(oe.message);
    if (!order) return null;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("portal_access")
      .select("public_code, expires_at, created_at")
      .eq("order_id", data.orderId)
      .maybeSingle();
    return row;
  });
