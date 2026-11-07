import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";

// Nome exibido e endereço (slug) do portal do paciente do laboratório logado.
export function useCompanyBranding() {
  const companyId = useCompanyId();
  return useQuery({
    queryKey: ["company-branding", companyId],
    enabled: !!companyId,
    staleTime: 60_000,
    queryFn: async () => {
      const [{ data: c }, { data: s }] = await Promise.all([
        supabase.from("companies").select("name, portal_slug").eq("id", companyId!).maybeSingle(),
        supabase.from("company_settings").select("legal_name").eq("company_id", companyId!).maybeSingle(),
      ]);
      const name = ((s as { legal_name?: string | null } | null)?.legal_name ?? "").trim() || (c as { name?: string } | null)?.name || "";
      return { name, slug: (c as { portal_slug?: string | null } | null)?.portal_slug ?? null };
    },
  });
}
