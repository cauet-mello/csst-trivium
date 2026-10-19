import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Role } from "@/lib/domain";

export type Me = {
  id: string;
  username: string;
  full_name: string;
  registration: string | null;
  department: string | null;
  roles: Role[];
  isStaff: boolean;
  isDev: boolean;
};

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async (): Promise<Me | null> => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const [{ data: p }, { data: r }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", u.user.id),
      ]);
      const roles = (r ?? []).map((x) => x.role as Role);
      return {
        id: u.user.id,
        username: p?.username ?? u.user.email?.split("@")[0] ?? "",
        full_name: p?.full_name ?? "",
        registration: p?.registration ?? null,
        department: p?.department ?? null,
        roles,
        isStaff: roles.includes("admin") || roles.includes("developer"),
        isDev: roles.includes("developer"),
      };
    },
    staleTime: 60_000,
  });
}
