import { z } from 'zod';
export const accountPassword = z.string().min(10, 'A senha deve ter pelo menos 10 caracteres.').max(72).regex(/[a-z]/, 'Inclua uma letra minúscula.').regex(/[A-Z]/, 'Inclua uma letra maiúscula.').regex(/[0-9]/, 'Inclua um número.').regex(/[^a-zA-Z0-9]/, 'Inclua um símbolo.');
export const userInput = z.object({ username: z.string().trim().min(3).max(60).regex(/^[a-zA-Z0-9._-]+$/, 'Use letras sem acentos, números, ponto, hífen ou sublinhado.'), full_name: z.string().trim().min(2).max(120), registration: z.string().trim().max(40).default(''), department: z.string().trim().max(80).default(''), role: z.enum(['admin', 'requester']), password: accountPassword });
export function accountDestination(profile: { active: boolean; must_change_password: boolean } | null, roles: string[]) {
  if (!profile?.active) throw new Error('Login ou senha inválidos, ou conta desativada.');
  if (profile.must_change_password) return '/alterar-senha' as const;
  return roles.includes('admin') || roles.includes('developer') ? '/dashboard' as const : '/painel' as const;
}
export function generateTemporaryPassword() {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return 'T@9a' + Array.from(bytes, b => 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'[b % 55] ?? 'x').join('');
}
