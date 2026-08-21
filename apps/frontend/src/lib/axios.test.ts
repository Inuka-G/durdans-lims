import { describe, it, expect, vi, beforeEach } from 'vitest';

// Fake keycloak module — hoisted so vi.mock factory can reference it.
const kc = vi.hoisted(() => ({
  token: undefined as string | undefined,
  authenticated: false,
  logout: vi.fn(),
}));

vi.mock('@/lib/keycloak', () => ({ default: kc }));

// We re-import axios fresh per test by using dynamic imports after vi.mock.
// But since vitest hoists vi.mock, we can import statically below the mock.
import axiosInstance from '@/lib/axios';

describe('axios request interceptor', () => {
  beforeEach(() => {
    kc.token = undefined;
    kc.logout.mockClear();
  });

  it('attaches a Bearer token when keycloak has a token', async () => {
    kc.token = 'test-jwt-token';

    // The request interceptor modifies config — we call the interceptor manually
    // by inspecting the interceptor manager.
    const interceptors = (axiosInstance.interceptors.request as unknown as {
      handlers: Array<{ fulfilled: (config: Record<string, unknown>) => Record<string, unknown> }>;
    }).handlers;
    const requestInterceptor = interceptors[0].fulfilled;

    const config = { headers: { set: vi.fn(), get: vi.fn(), has: vi.fn(), delete: vi.fn() } } as unknown as Record<string, unknown>;
    const result = requestInterceptor(config);

    expect((result as { headers: { Authorization: string } }).headers.Authorization).toBe(
      'Bearer test-jwt-token'
    );
  });

  it('does not set Authorization when keycloak has no token', () => {
    kc.token = undefined;

    const interceptors = (axiosInstance.interceptors.request as unknown as {
      handlers: Array<{ fulfilled: (config: Record<string, unknown>) => Record<string, unknown> }>;
    }).handlers;
    const requestInterceptor = interceptors[0].fulfilled;

    const config = { headers: {} } as unknown as Record<string, unknown>;
    const result = requestInterceptor(config);

    expect((result as { headers: Record<string, unknown> }).headers).not.toHaveProperty(
      'Authorization'
    );
  });
});

describe('axios response interceptor', () => {
  beforeEach(() => {
    kc.logout.mockClear();
  });

  it('calls keycloak.logout() on a 401 response', async () => {
    const interceptors = (axiosInstance.interceptors.response as unknown as {
      handlers: Array<{ rejected: (error: unknown) => Promise<unknown> }>;
    }).handlers;
    const errorHandler = interceptors[0].rejected;

    const error = { response: { status: 401 } };
    await expect(errorHandler(error)).rejects.toEqual(error);
    expect(kc.logout).toHaveBeenCalledTimes(1);
  });

  it('does NOT logout on a 403 response (just logs)', async () => {
    const interceptors = (axiosInstance.interceptors.response as unknown as {
      handlers: Array<{ rejected: (error: unknown) => Promise<unknown> }>;
    }).handlers;
    const errorHandler = interceptors[0].rejected;

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = { response: { status: 403 } };
    await expect(errorHandler(error)).rejects.toEqual(error);
    expect(kc.logout).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('rejects errors with no response (network error) without calling logout', async () => {
    const interceptors = (axiosInstance.interceptors.response as unknown as {
      handlers: Array<{ rejected: (error: unknown) => Promise<unknown> }>;
    }).handlers;
    const errorHandler = interceptors[0].rejected;

    const error = { message: 'Network Error' };
    await expect(errorHandler(error)).rejects.toEqual(error);
    expect(kc.logout).not.toHaveBeenCalled();
  });
});
