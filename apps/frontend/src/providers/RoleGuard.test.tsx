import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// Hoisted so the vi.mock factory can read them, and so each test can point the
// guard at a different route. Without a settable pathname the suite could only
// ever exercise one PREFIX_MAP entry — which is how the /admin and /branch-admin
// entries stayed broken while CI was green.
const nav = vi.hoisted(() => ({ pathname: '/mlt/worklist', replace: vi.fn() }));

vi.mock('next/navigation', () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ replace: nav.replace }),
}));

const useMetadataMock = vi.fn();
vi.mock('@/providers/MetadataProvider', () => ({
  useMetadata: () => useMetadataMock(),
}));

import RoleGuard from '@/providers/RoleGuard';

// The fail-closed authorization gate is security-critical: it must NEVER render a page
// the user is not entitled to, and must redirect rather than leak when access can't be
// determined.
describe('RoleGuard (fail-closed authorization)', () => {
  beforeEach(() => {
    nav.replace.mockClear();
    nav.pathname = '/mlt/worklist';
    useMetadataMock.mockReset();
  });

  it('shows a spinner while loading and does not redirect or render children', () => {
    useMetadataMock.mockReturnValue({ metadata: null, loading: true, error: null });
    render(<RoleGuard><div>secret</div></RoleGuard>);
    expect(screen.queryByText('secret')).toBeNull();
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it('redirects to /login when metadata errors', async () => {
    useMetadataMock.mockReturnValue({ metadata: null, loading: false, error: new Error('boom') });
    render(<RoleGuard><div>secret</div></RoleGuard>);
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/login'));
    expect(screen.queryByText('secret')).toBeNull();
  });

  it('redirects to /login when there are no nav items', async () => {
    useMetadataMock.mockReturnValue({ metadata: { navItems: [] }, loading: false, error: null });
    render(<RoleGuard><div>secret</div></RoleGuard>);
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/login'));
  });

  it('renders children when the current path is granted', async () => {
    // linkUrl '/lab-testing' grants the '/mlt' prefix, which covers '/mlt/worklist'.
    useMetadataMock.mockReturnValue({ metadata: { navItems: [{ linkUrl: '/lab-testing' }] }, loading: false, error: null });
    render(<RoleGuard><div>secret</div></RoleGuard>);
    await waitFor(() => expect(screen.getByText('secret')).toBeInTheDocument());
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it('redirects to the first nav destination when the path is NOT granted', async () => {
    // '/phlebotomy' grants only '/phlebotomy' — '/mlt/worklist' is not allowed.
    useMetadataMock.mockReturnValue({ metadata: { navItems: [{ linkUrl: '/phlebotomy' }] }, loading: false, error: null });
    render(<RoleGuard><div>secret</div></RoleGuard>);
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/phlebotomy/worklist'));
    expect(screen.queryByText('secret')).toBeNull();
  });

  // The seeded nav items are '/admin' and '/branch-admin'; the App Router segments
  // are '/superadmin' and '/branch'. When PREFIX_MAP mapped those entries to
  // themselves, every admin screen 404'd and a user holding only SUPER_ADMIN could
  // not reach any page at all. These two tests pin the mapping.
  it('grants /superadmin/** to a user whose nav item is /admin', async () => {
    nav.pathname = '/superadmin/users';
    useMetadataMock.mockReturnValue({ metadata: { navItems: [{ linkUrl: '/admin' }] }, loading: false, error: null });
    render(<RoleGuard><div>secret</div></RoleGuard>);
    await waitFor(() => expect(screen.getByText('secret')).toBeInTheDocument());
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it('grants /branch/** to a user whose nav item is /branch-admin', async () => {
    nav.pathname = '/branch/activity-logs';
    useMetadataMock.mockReturnValue({ metadata: { navItems: [{ linkUrl: '/branch-admin' }] }, loading: false, error: null });
    render(<RoleGuard><div>secret</div></RoleGuard>);
    await waitFor(() => expect(screen.getByText('secret')).toBeInTheDocument());
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it('still denies /superadmin/** to a user without the /admin nav item', async () => {
    nav.pathname = '/superadmin/users';
    useMetadataMock.mockReturnValue({ metadata: { navItems: [{ linkUrl: '/lab-testing' }] }, loading: false, error: null });
    render(<RoleGuard><div>secret</div></RoleGuard>);
    await waitFor(() => expect(nav.replace).toHaveBeenCalled());
    expect(screen.queryByText('secret')).toBeNull();
  });

  // Same /admin, /branch-admin mismatch as above, but hitting the *other* map
  // in this file — URL_MAP, which builds the redirect target once access is
  // denied. Fixing PREFIX_MAP alone (the tests above) stopped the 404 once a
  // user reached the right page, but a user whose first/only nav item is
  // /admin or /branch-admin never got there in the first place: landing
  // anywhere else in the app, RoleGuard tried to redirect them to the raw,
  // untranslated backend value and 404'd on login.
  it('redirects to /superadmin, not /admin, when the only nav item is /admin', async () => {
    nav.pathname = '/dashboard';
    useMetadataMock.mockReturnValue({ metadata: { navItems: [{ linkUrl: '/admin' }] }, loading: false, error: null });
    render(<RoleGuard><div>secret</div></RoleGuard>);
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/superadmin'));
  });

  it('redirects to /branch, not /branch-admin, when the only nav item is /branch-admin', async () => {
    nav.pathname = '/dashboard';
    useMetadataMock.mockReturnValue({ metadata: { navItems: [{ linkUrl: '/branch-admin' }] }, loading: false, error: null });
    render(<RoleGuard><div>secret</div></RoleGuard>);
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/branch'));
  });
});
