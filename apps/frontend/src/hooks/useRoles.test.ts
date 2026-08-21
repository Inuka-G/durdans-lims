import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted fake keycloak so vi.mock factory can reference it.
const kc = vi.hoisted(() => ({
  tokenParsed: undefined as Record<string, unknown> | undefined,
}));

vi.mock('@/lib/keycloak', () => ({ default: kc }));

import { useRoles } from '@/hooks/useRoles';

describe('useRoles', () => {
  beforeEach(() => {
    kc.tokenParsed = undefined;
  });

  it('returns the roles array from tokenParsed.realm_access', () => {
    kc.tokenParsed = { realm_access: { roles: ['MLT', 'ADMIN'] } };
    const { roles } = useRoles();
    expect(roles).toEqual(['MLT', 'ADMIN']);
  });

  it('returns empty roles when tokenParsed is undefined (SSR)', () => {
    kc.tokenParsed = undefined;
    expect(useRoles().roles).toEqual([]);
  });

  it('returns empty roles when realm_access is missing', () => {
    kc.tokenParsed = { sub: 'user-1' };
    expect(useRoles().roles).toEqual([]);
  });

  describe('hasRole', () => {
    it('returns true when the role is present', () => {
      kc.tokenParsed = { realm_access: { roles: ['MLT', 'ADMIN'] } };
      expect(useRoles().hasRole('MLT')).toBe(true);
    });

    it('returns false when the role is absent', () => {
      kc.tokenParsed = { realm_access: { roles: ['MLT'] } };
      expect(useRoles().hasRole('ADMIN')).toBe(false);
    });

    it('returns false when there are no roles', () => {
      kc.tokenParsed = undefined;
      expect(useRoles().hasRole('MLT')).toBe(false);
    });
  });

  describe('hasAnyRole', () => {
    it('returns true when at least one role matches', () => {
      kc.tokenParsed = { realm_access: { roles: ['RECEPTIONIST'] } };
      expect(useRoles().hasAnyRole(['MLT', 'RECEPTIONIST'])).toBe(true);
    });

    it('returns false when no roles match', () => {
      kc.tokenParsed = { realm_access: { roles: ['MLT'] } };
      expect(useRoles().hasAnyRole(['ADMIN', 'RECEPTIONIST'])).toBe(false);
    });

    it('returns false on an empty candidate list', () => {
      kc.tokenParsed = { realm_access: { roles: ['MLT'] } };
      expect(useRoles().hasAnyRole([])).toBe(false);
    });
  });
});
