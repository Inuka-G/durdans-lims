import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';

// Fake keycloak-js instance so no real IdP is contacted. Declared via vi.hoisted so it
// is initialized before the hoisted vi.mock factory references it.
const kc = vi.hoisted(() => ({
  init: vi.fn(),
  updateToken: vi.fn(),
  logout: vi.fn(),
  onTokenExpired: undefined as undefined | (() => void),
}));
vi.mock('@/lib/keycloak', () => ({ default: kc }));

import AuthProvider from '@/providers/AuthProvider';

const flushMicrotasks = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('AuthProvider', () => {
  beforeEach(() => {
    kc.init.mockReset();
    kc.updateToken.mockReset();
    kc.logout.mockReset();
    kc.onTokenExpired = undefined;
  });

  it('shows a spinner until init resolves, then renders children', async () => {
    let resolveInit: (v: boolean) => void = () => {};
    kc.init.mockReturnValue(new Promise<boolean>((r) => { resolveInit = r; }));

    const { queryByText, findByText } = render(<AuthProvider><div>app</div></AuthProvider>);
    expect(queryByText('app')).toBeNull(); // spinner while initializing

    await act(async () => { resolveInit(true); });
    expect(await findByText('app')).toBeInTheDocument();
  });

  it('logs out only after THREE consecutive token-refresh failures', async () => {
    kc.init.mockResolvedValue(true);
    kc.updateToken.mockRejectedValue(new Error('network'));

    render(<AuthProvider><div>app</div></AuthProvider>);
    await waitFor(() => expect(typeof kc.onTokenExpired).toBe('function'));

    kc.onTokenExpired!();
    await flushMicrotasks();
    kc.onTokenExpired!();
    await flushMicrotasks();
    // Two transient failures must NOT log the user out mid-task.
    expect(kc.logout).not.toHaveBeenCalled();

    kc.onTokenExpired!();
    await flushMicrotasks();
    expect(kc.logout).toHaveBeenCalledTimes(1);
  });

  it('resets the failure counter after a successful refresh', async () => {
    kc.init.mockResolvedValue(true);
    kc.updateToken
      .mockRejectedValueOnce(new Error('blip'))
      .mockRejectedValueOnce(new Error('blip'))
      .mockResolvedValueOnce(true)   // success resets the counter
      .mockRejectedValue(new Error('blip'));

    render(<AuthProvider><div>app</div></AuthProvider>);
    await waitFor(() => expect(typeof kc.onTokenExpired).toBe('function'));

    for (let i = 0; i < 4; i++) {
      kc.onTokenExpired!();
      await flushMicrotasks();
    }
    // fail, fail, success(reset), fail → still only 1 consecutive failure → no logout
    expect(kc.logout).not.toHaveBeenCalled();
  });
});
