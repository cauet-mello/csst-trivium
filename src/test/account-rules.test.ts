import { describe, expect, it } from 'vitest';
import { accountDestination, accountPassword, generateTemporaryPassword, userInput } from '@/lib/account-rules';
describe('User management rules', () => {
  it('has exactly admin and ordinary user roles', () => {
    const base = { username: 'operador', full_name: 'Operador Teste', password: generateTemporaryPassword() };
    expect(userInput.safeParse({ ...base, role: 'admin' }).success).toBe(true);
    expect(userInput.safeParse({ ...base, role: 'requester' }).success).toBe(true);
    expect(userInput.safeParse({ ...base, role: 'developer' }).success).toBe(false);
  });
  it('does not silently normalize invalid or duplicate-looking logins', () => { expect(userInput.safeParse({ username: 'op erador', full_name: 'Operador', role: 'requester', password: generateTemporaryPassword() }).success).toBe(false); });
  it('generates strong temporary passwords', () => { const a = generateTemporaryPassword(), b = generateTemporaryPassword(); expect(accountPassword.safeParse(a).success).toBe(true); expect(a).not.toBe(b); });
  it('requires at least 10 characters with four character classes', () => { expect(accountPassword.safeParse('Ab1!xxxxx').success).toBe(false); expect(accountPassword.safeParse('aaaaaaaaaa').success).toBe(false); });
  it('blocks disabled users rather than opening a page', () => { expect(() => accountDestination({ active: false, must_change_password: false }, ['admin'])).toThrow(); });
  it('forces even administrators to replace temporary passwords', () => { expect(accountDestination({ active: true, must_change_password: true }, ['admin'])).toBe('/alterar-senha'); });
});
