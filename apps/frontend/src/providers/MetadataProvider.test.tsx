import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';

// Mock the API module so no real network call is made.
const mockGetMetadata = vi.fn();
vi.mock('@/lib/api', () => ({
  getMetadata: () => mockGetMetadata(),
}));

import { MetadataProvider, useMetadata } from '@/providers/MetadataProvider';

// Test consumer that renders metadata state for assertions.
function Consumer() {
  const { metadata, loading, error, refresh } = useMetadata();
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="error">{String(error)}</span>
      <span data-testid="metadata">{metadata ? JSON.stringify(metadata) : 'null'}</span>
      <button onClick={refresh}>refresh</button>
    </div>
  );
}

describe('MetadataProvider', () => {
  beforeEach(() => {
    mockGetMetadata.mockReset();
  });

  it('fetches metadata on mount and exposes it via context', async () => {
    const fakeMetadata = { navItems: [{ linkUrl: '/lab-testing' }], branchName: 'Main' };
    mockGetMetadata.mockResolvedValue(fakeMetadata);

    render(
      <MetadataProvider>
        <Consumer />
      </MetadataProvider>
    );

    // Initially loading
    expect(screen.getByTestId('loading').textContent).toBe('true');

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    expect(screen.getByTestId('error').textContent).toBe('false');
    expect(screen.getByTestId('metadata').textContent).toBe(JSON.stringify(fakeMetadata));
  });

  it('sets error to true when getMetadata rejects', async () => {
    mockGetMetadata.mockRejectedValue(new Error('network'));

    render(
      <MetadataProvider>
        <Consumer />
      </MetadataProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    expect(screen.getByTestId('error').textContent).toBe('true');
    expect(screen.getByTestId('metadata').textContent).toBe('null');
  });

  it('re-fetches metadata when refresh is called', async () => {
    const meta1 = { navItems: [{ linkUrl: '/lab-testing' }] };
    const meta2 = { navItems: [{ linkUrl: '/phlebotomy' }] };
    mockGetMetadata.mockResolvedValueOnce(meta1).mockResolvedValueOnce(meta2);

    render(
      <MetadataProvider>
        <Consumer />
      </MetadataProvider>
    );

    // Wait for first fetch
    await waitFor(() => {
      expect(screen.getByTestId('metadata').textContent).toBe(JSON.stringify(meta1));
    });

    // Trigger refresh
    await act(async () => {
      screen.getByText('refresh').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('metadata').textContent).toBe(JSON.stringify(meta2));
    });

    expect(mockGetMetadata).toHaveBeenCalledTimes(2);
  });
});
