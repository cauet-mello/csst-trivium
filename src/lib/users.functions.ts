import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { usernameToEmail, normalizeUsername } from "./domain";

async function ensureStaff(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r: { role: string }) => r.role);
  if (!roles.includes("admin") && !roles.includes("developer")) throw new Error("Acesso negado");
  return roles as string[];
}

// Idempotent: creates the two fixed staff accounts once, with passwords from server secrets.
export const bootstrapAdmins = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
  await ensureStaff(context.supabase, context.userId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const seeds = [
    { username: "ederson.silveira", full_name: "Ederson Silveira", role: "admin", env: "ADMIN_EDERSON_PASSWORD" },
    { username: "cauet.mello", full_name: "Cauet Mello", role: "developer", env: "ADMIN_CAUET_PASSWORD" },
  ] as const;
  const results: string[] = [];
  for (const s of seeds) {
    const { data: existing } = await supabaseAdmin.from("profiles").select("id").eq("username", s.username).maybeSingle();
    if (existing) { results.push(`${s.username}: já existe`); continue; }
    const password = process.env[s.env];
    if (!password) { results.push(`${s.username}: senha não configurada`); continue; }
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: usernameToEmail(s.username), password, email_confirm: true,
      user_metadata: { username: s.username, full_name: s.full_name },
    });
    if (error || !data.user) {
      results.push(`${s.username}: ${error?.code === "weak_password" ? "senha rejeitada por ser fraca" : "falha na criação da conta"}`);
      continue;
    }
    const { error: profileError } = await supabaseAdmin.from("profiles").insert({ id: data.user.id, username: s.username, full_name: s.full_name, department: "Segurança do Trabalho" });
    const { error: roleError } = profileError ? { error: profileError } : await supabaseAdmin.from("user_roles").insert({ user_id: data.user.id, role: s.role });
    if (profileError || roleError) {
      await supabaseAdmin.auth.admin.deleteUser(data.user.id);
      results.push(`${s.username}: falha ao configurar o acesso`);
      continue;
    }
    results.push(`${s.username}: criado`);
  }
  return { results };
});

const createSchema = z.object({
  username: z.string().trim().min(3).max(60),
  full_name: z.string().trim().min(2).max(120),
  registration: z.string().trim().max(40).optional().default(""),
  department: z.string().trim().max(80).optional().default(""),
  role: z.enum(["admin", "developer", "requester"]),
  password: z.string().min(8).max(72),
});

export const createAppUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data, context }) => {
    const roles = await ensureStaff(context.supabase, context.userId);
    if (data.role === "developer" && !roles.includes("developer")) throw new Error("Somente Desenvolvedor pode criar Desenvolvedor");
    const username = normalizeUsername(data.username);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: dup } = await supabaseAdmin.from("profiles").select("id").eq("username", username).maybeSingle();
    if (dup) throw new Error("Login já está em uso");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: usernameToEmail(username), password: data.password, email_confirm: true,
      user_metadata: { username, full_name: data.full_name },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Falha ao criar usuário");
    const { error: pe } = await supabaseAdmin.from("profiles").insert({
      id: created.user.id, username, full_name: data.full_name, registration: data.registration || null, department: data.department || null,
    });
    if (pe) throw new Error(pe.message);
    await supabaseAdmin.from("user_roles").insert({ user_id: created.user.id, role: data.role });
    return { id: created.user.id };
  });

export const resetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid(), password: z.string().min(8).max(72) }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, { password: data.password });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setUserActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid(), active: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureStaff(context.supabase, context.userId);
    if (data.userId === context.userId) throw new Error("Você não pode desativar sua própria conta");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.auth.admin.updateUserById(data.userId, { ban_duration: data.active ? "none" : "876000h" });
    await supabaseAdmin.from("profiles").update({ active: data.active }).eq("id", data.userId);
    return { ok: true };
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid(), role: z.enum(["admin", "developer", "requester"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const roles = await ensureStaff(context.supabase, context.userId);
    if (data.role === "developer" && !roles.includes("developer")) throw new Error("Somente Desenvolvedor pode conceder esse perfil");
    if (data.userId === context.userId) throw new Error("Você não pode alterar o próprio perfil");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("user_roles").insert({ user_id: data.userId, role: data.role });
    return { ok: true };
  });
