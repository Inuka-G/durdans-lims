import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted fake keycloak so vi.mock factory can reference it.
const kc = vi.hoisted(() => ({
  token: undefined as string | undefined,
  tokenParsed: undefined as Record<string, unknown> | undefined,
  authenticated: false,
  logout: vi.fn(),
}));

vi.mock('@/lib/keycloak', () => ({ default: kc }));

import { useAuth } from '@/hooks/useAuth';

describe('useAuth', () => {
  beforeEach(() => {
    kc.token = undefined;
    kc.tokenParsed = undefined;
    kc.authenticated = false;
    kc.logout.mockClear();
  });

  it('returns token, user, roles, authenticated from keycloak', () => {
    kc.token = 'jwt-abc';
    kc.tokenParsed = {
      sub: 'user-1',
      name: 'Test User',
      realm_access: { roles: ['MLT', 'RECEPTIONIST'] },
    };
    kc.authenticated = true;

    const auth = useAuth();
    expect(auth.token).toBe('jwt-abc');
    expect(auth.user).toBe(kc.tokenParsed);
    expect(auth.roles).toEqual(['MLT', 'RECEPTIONIST']);
    expect(auth.authenticated).toBe(true);
  });

  it('returns empty roles when tokenParsed has no realm_access', () => {
    kc.tokenParsed = { sub: 'user-2' };
    const auth = useAuth();
    expect(auth.roles).toEqual([]);
  });

  it('returns empty roles when keycloak is null-like (SSR)', () => {
    kc.tokenParsed = undefined;
    const auth = useAuth();
    expect(auth.roles).toEqual([]);
  });

  it('returns authenticated as false when keycloak is not authenticated', () => {
    kc.authenticated = false;
    expect(useAuth().authenticated).toBe(false);
  });

  it('logout delegates to keycloak.logout()', () => {
    useAuth().logout();
    expect(kc.logout).toHaveBeenCalledTimes(1);
  });
});
