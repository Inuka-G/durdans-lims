import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock next/server — NextRequest and NextResponse are server-only imports.
const mockRedirect = vi.fn();
const mockNext = vi.fn();

vi.mock('next/server', () => {
  class MockNextRequest {
    nextUrl: URL;
    cookies: Map<string, { value: string }>;

    constructor(url: string) {
      this.nextUrl = new URL(url);
      this.cookies = new Map();
    }

    get url() {
      return this.nextUrl.toString();
    }
  }

  return {
    NextRequest: MockNextRequest,
    NextResponse: {
      redirect: (url: URL) => {
        mockRedirect(url.toString());
        return { type: 'redirect', url: url.toString() };
      },
      next: () => {
        mockNext();
        return { type: 'next' };
      },
    },
  };
});

import { middleware } from '@/middleware';
import { NextRequest } from 'next/server';

function createRequest(pathname: string, hasSession = false): NextRequest {
  const req = new NextRequest(`http://localhost:3000${pathname}`);
  if (hasSession) {
    (req.cookies as unknown as Map<string, { value: string }>).set('kc_session', {
      value: '1',
    });
  }
  return req;
}

describe('middleware (route protection)', () => {
  beforeEach(() => {
    mockRedirect.mockClear();
    mockNext.mockClear();
  });

  // ---- Public paths pass through ----

  it('allows /login without a session', () => {
    middleware(createRequest('/login'));
    expect(mockNext).toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it('allows /login/callback without a session', () => {
    middleware(createRequest('/login/callback'));
    expect(mockNext).toHaveBeenCalled();
  });

  it('allows /_next/** without a session', () => {
    middleware(createRequest('/_next/static/chunks/main.js'));
    expect(mockNext).toHaveBeenCalled();
  });

  it('allows /api/** without a session', () => {
    middleware(createRequest('/api/health'));
    expect(mockNext).toHaveBeenCalled();
  });

  // ---- Static assets are public ----

  it('allows static asset paths (e.g. .png, .css, .js)', () => {
    for (const ext of ['.png', '.jpg', '.css', '.js', '.woff2', '.svg', '.ico']) {
      mockNext.mockClear();
      middleware(createRequest(`/assets/logo${ext}`));
      expect(mockNext).toHaveBeenCalled();
    }
  });

  // ---- Protected routes redirect when no session ----

  it('redirects /mlt/worklist to /login when no session', () => {
    middleware(createRequest('/mlt/worklist'));
    expect(mockRedirect).toHaveBeenCalledTimes(1);
    const redirectUrl = mockRedirect.mock.calls[0][0] as string;
    expect(redirectUrl).toContain('/login');
    expect(redirectUrl).toContain('from=%2Fmlt%2Fworklist');
  });

  it('redirects /reception/dashboard to /login with from param', () => {
    middleware(createRequest('/reception/dashboard'));
    expect(mockRedirect).toHaveBeenCalledTimes(1);
    const redirectUrl = mockRedirect.mock.calls[0][0] as string;
    expect(redirectUrl).toContain('/login');
    expect(redirectUrl).toContain('from=%2Freception%2Fdashboard');
  });

  it('redirects / to /login when no session', () => {
    middleware(createRequest('/'));
    expect(mockRedirect).toHaveBeenCalledTimes(1);
  });

  // ---- Protected routes pass through with session ----

  it('allows /mlt/worklist with a valid session cookie', () => {
    middleware(createRequest('/mlt/worklist', true));
    expect(mockNext).toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it('allows /superadmin/users with a valid session cookie', () => {
    middleware(createRequest('/superadmin/users', true));
    expect(mockNext).toHaveBeenCalled();
  });

  // ---- Dynamic paths with dots are NOT treated as static assets ----

  it('does NOT treat /verification/review/RES.123 as a static asset', () => {
    middleware(createRequest('/verification/review/RES.123'));
    // No known static extension → not public → should redirect
    expect(mockRedirect).toHaveBeenCalled();
  });
});
