import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "recepcao" | "tecnico" | "bioquimico";

export function useMyRoles() {
  const { data } = useQuery({
    queryKey: ["my-roles"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [] as AppRole[];
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", u.user.id);
      if (error) return [] as AppRole[];
      return (data ?? []).map((r) => r.role as AppRole);
    },
  });
  const roles = data ?? [];
  return {
    roles,
    isAdmin: roles.includes("admin"),
    isBioquimico: roles.includes("bioquimico"),
    isTecnico: roles.includes("tecnico"),
    isRecepcao: roles.includes("recepcao"),
    canEnterResults: roles.some((r) => r === "admin" || r === "bioquimico" || r === "tecnico"),
    canRelease: roles.some((r) => r === "admin" || r === "bioquimico"),
  };
}
