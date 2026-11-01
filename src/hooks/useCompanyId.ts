import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useCompanyId() {
  const { data } = useQuery({
    queryKey: ["my-company-id"],
    staleTime: Infinity,
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", u.user.id)
        .maybeSingle();
      if (error) throw error;
      return (data?.company_id as string | undefined) ?? null;
    },
  });
  return data ?? null;
}
