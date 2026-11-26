import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ signIn: vi.fn(), signOut: vi.fn(), roles: vi.fn(), profile: vi.fn(), from: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: { signInWithPassword: mocks.signIn, signOut: mocks.signOut }, from: mocks.from } }));
import { signInToApp } from '@/lib/login';
describe('Centralized password access', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.signIn.mockResolvedValue({ data: { user: { id: 'user-id' } }, error: null });
    mocks.signOut.mockResolvedValue({ error: null });
    mocks.profile.mockResolvedValue({ data: { active: true, must_change_password: false }, error: null });
    mocks.roles.mockResolvedValue({ data: [{ role: 'requester' }], error: null });
    mocks.from.mockImplementation((name: string) => name === 'profiles' ? { select: () => ({ eq: () => ({ maybeSingle: mocks.profile }) }) } : { select: () => ({ eq: mocks.roles }) });
  });
  it('maps Administrador to the centralized account and dashboard', async () => {
    mocks.roles.mockResolvedValue({ data: [{ role: 'admin' }], error: null });
    expect(await signInToApp(' Administrador ', 'example-password')).toBe('/dashboard');
    expect(mocks.signIn).toHaveBeenCalledWith({ email: 'administrador@trivium.local', password: 'example-password' });
  });
  it('routes ordinary users to /painel without a selectable admin mode', async () => {
    expect(await signInToApp('operador', 'example-password')).toBe('/painel');
  });
  it('forces temporary passwords to be changed before operational access', async () => {
    mocks.profile.mockResolvedValue({ data: { active: true, must_change_password: true }, error: null });
    expect(await signInToApp('operador', 'example-password')).toBe('/alterar-senha');
  });
  it('denies disabled accounts even if Auth returns a session', async () => {
    mocks.profile.mockResolvedValue({ data: { active: false, must_change_password: false }, error: null });
    await expect(signInToApp('operador', 'example-password')).rejects.toThrow();
    expect(mocks.signOut).toHaveBeenCalledOnce();
  });
  it('fails closed when permissions cannot be read', async () => {
    mocks.roles.mockResolvedValue({ data: null, error: { message: 'lookup failed' } });
    await expect(signInToApp('operador', 'example-password')).rejects.toThrow();
    expect(mocks.signOut).toHaveBeenCalledOnce();
  });
  it('rejects invalid credentials before reading data', async () => {
    mocks.signIn.mockResolvedValue({ data: { user: null }, error: { message: 'invalid credentials' } });
    await expect(signInToApp('operador', 'wrong-password')).rejects.toThrow();
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it('reports provider throttling without bypassing it', async () => {
    mocks.signIn.mockResolvedValue({ data: { user: null }, error: { status: 429 } });
    await expect(signInToApp('operador', 'wrong-password')).rejects.toThrow('Muitas tentativas');
  });
});
