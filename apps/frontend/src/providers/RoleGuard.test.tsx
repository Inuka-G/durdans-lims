import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  usePathname: () => '/mlt/worklist',
  useRouter: () => ({ replace }),
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
    replace.mockClear();
    useMetadataMock.mockReset();
  });

  it('shows a spinner while loading and does not redirect or render children', () => {
    useMetadataMock.mockReturnValue({ metadata: null, loading: true, error: null });
    render(<RoleGuard><div>secret</div></RoleGuard>);
    expect(screen.queryByText('secret')).toBeNull();
    expect(replace).not.toHaveBeenCalled();
  });

  it('redirects to /login when metadata errors', async () => {
    useMetadataMock.mockReturnValue({ metadata: null, loading: false, error: new Error('boom') });
    render(<RoleGuard><div>secret</div></RoleGuard>);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
    expect(screen.queryByText('secret')).toBeNull();
  });

  it('redirects to /login when there are no nav items', async () => {
    useMetadataMock.mockReturnValue({ metadata: { navItems: [] }, loading: false, error: null });
    render(<RoleGuard><div>secret</div></RoleGuard>);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
  });

  it('renders children when the current path is granted', async () => {
    // linkUrl '/lab-testing' grants the '/mlt' prefix, which covers '/mlt/worklist'.
    useMetadataMock.mockReturnValue({ metadata: { navItems: [{ linkUrl: '/lab-testing' }] }, loading: false, error: null });
    render(<RoleGuard><div>secret</div></RoleGuard>);
    await waitFor(() => expect(screen.getByText('secret')).toBeInTheDocument());
    expect(replace).not.toHaveBeenCalled();
  });

  it('redirects to the first nav destination when the path is NOT granted', async () => {
    // '/phlebotomy' grants only '/phlebotomy' — '/mlt/worklist' is not allowed.
    useMetadataMock.mockReturnValue({ metadata: { navItems: [{ linkUrl: '/phlebotomy' }] }, loading: false, error: null });
    render(<RoleGuard><div>secret</div></RoleGuard>);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/phlebotomy/worklist'));
    expect(screen.queryByText('secret')).toBeNull();
  });
});
