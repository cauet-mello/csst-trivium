import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { ensureStaff } from '@/lib/staff-access';
const lookup = vi.fn(), ready = vi.fn();
const client = { rpc: ready, from: () => ({ select: () => ({ eq: lookup }) }) } as unknown as SupabaseClient<Database>;
describe('administrator account protection', () => {
  beforeEach(() => { vi.resetAllMocks(); ready.mockResolvedValue({ data: true, error: null }); });
  it('denies ordinary users account management', async () => { lookup.mockResolvedValue({ data: [{ role: 'requester' }], error: null }); await expect(ensureStaff(client, 'user')).rejects.toThrow(); });
  it('denies legacy developer administrative access', async () => { lookup.mockResolvedValue({ data: [{ role: 'developer' }], error: null }); await expect(ensureStaff(client, 'legacy')).rejects.toThrow(); });
  it('allows ready administrators to manage users', async () => { lookup.mockResolvedValueOnce({ data: [{ role: 'admin' }], error: null }).mockResolvedValueOnce({ data: [{ role: 'requester' }], error: null }); expect(await ensureStaff(client, 'admin', 'user')).toEqual(['admin']); });
  it('denies administrators with a temporary password or inactive account', async () => { ready.mockResolvedValue({ data: false, error: null }); await expect(ensureStaff(client, 'admin')).rejects.toThrow(); expect(lookup).not.toHaveBeenCalled(); });
  it('fails closed when readiness lookup fails', async () => { ready.mockResolvedValue({ data: null, error: { message: 'offline' } }); await expect(ensureStaff(client, 'admin')).rejects.toThrow(); });
  it('fails closed when role lookup fails', async () => { lookup.mockResolvedValue({ data: null, error: { message: 'offline' } }); await expect(ensureStaff(client, 'admin')).rejects.toThrow(); });
});
