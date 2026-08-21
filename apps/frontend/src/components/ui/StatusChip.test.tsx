import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatusChip, { STATUS_TONE, humanizeStatus, toneForStatus } from './StatusChip';

// StatusChip is where the per-module colour maps ended up after the design-system
// rebuild (SAMPLE_STATUS_COLORS, PRIORITY_COLORS, ORDER/PAYMENT/INVOICE_STATUS_COLORS,
// FLAG_COLORS, QC_STATUS_CONFIG, INSTRUMENT_STATUS_CONFIG). STATUS_TONE is a shared
// base map, not an exhaustive one — module-specific statuses are overridden locally
// and anything unmapped is expected to land on `neutral`.

describe('humanizeStatus', () => {
  it('turns an upper-snake status into sentence case', () => {
    expect(humanizeStatus('IN_TRANSIT')).toBe('In transit');
    expect(humanizeStatus('PENDING_COLLECTION')).toBe('Pending collection');
  });

  it('treats hyphens like underscores and collapses runs of separators', () => {
    expect(humanizeStatus('SENT-FOR__VERIFICATION')).toBe('Sent for verification');
  });

  it('handles an already-humanized string', () => {
    expect(humanizeStatus('Collected')).toBe('Collected');
  });

  it('handles an empty string', () => {
    expect(humanizeStatus('')).toBe('');
  });
});

describe('toneForStatus', () => {
  it.each([
    ['COLLECTED', 'success'],
    ['VERIFIED', 'success'],
    ['AUTHORIZED', 'success'],
    ['PAID', 'success'],
    ['DELIVERED', 'success'],
    ['PENDING', 'pending'],
    ['IN_PROGRESS', 'pending'],
    ['UNPAID', 'pending'],
    ['URGENT', 'pending'],
    ['REJECTED', 'danger'],
    ['FAILED', 'danger'],
    ['CRITICAL', 'danger'],
    ['OVERDUE', 'danger'],
    ['STAT', 'danger'],
    ['IN_TRANSIT', 'info'],
    ['DISPATCHED', 'info'],
    ['NORMAL', 'neutral'],
    ['DRAFT', 'neutral'],
  ] as const)('maps %s to the %s tone', (status, tone) => {
    expect(toneForStatus(status)).toBe(tone);
  });

  it('is case-insensitive', () => {
    expect(toneForStatus('rejected')).toBe('danger');
    expect(toneForStatus('Paid')).toBe('success');
  });

  it('falls back to neutral for an unmapped or missing status', () => {
    expect(toneForStatus('SOMETHING_ELSE')).toBe('neutral');
    expect(toneForStatus('')).toBe('neutral');
    expect(toneForStatus(null)).toBe('neutral');
    expect(toneForStatus(undefined)).toBe('neutral');
  });

  it('only ever produces one of the five defined tones', () => {
    const tones = new Set(['neutral', 'pending', 'success', 'danger', 'info']);
    for (const tone of Object.values(STATUS_TONE)) {
      expect(tones).toContain(tone);
    }
  });
});

describe('StatusChip', () => {
  it('renders its children', () => {
    render(<StatusChip>Collected</StatusChip>);
    expect(screen.getByText('Collected')).toBeInTheDocument();
  });

  it('defaults to the neutral tone', () => {
    render(<StatusChip>Queued</StatusChip>);
    const chip = screen.getByText('Queued').parentElement;
    expect(chip).toHaveClass('bg-surface-muted');
  });

  it('applies the token classes for the requested tone', () => {
    render(<StatusChip tone="danger">Rejected</StatusChip>);
    const chip = screen.getByText('Rejected').parentElement;
    expect(chip).toHaveClass('bg-status-danger-bg');
    expect(chip).toHaveClass('text-status-danger-fg');
  });

  it('omits the leading dot unless asked for it', () => {
    const { container } = render(<StatusChip>Received</StatusChip>);
    expect(container.querySelector('[aria-hidden="true"]')).toBeNull();
  });

  it('renders a tone-coloured dot when dot is set', () => {
    const { container } = render(
      <StatusChip tone="success" dot>
        Verified
      </StatusChip>
    );
    const dot = container.querySelector('[aria-hidden="true"]');
    expect(dot).not.toBeNull();
    expect(dot).toHaveClass('bg-status-verified');
  });

  it('uses the dense type scale at size="sm"', () => {
    render(<StatusChip size="sm">Pending</StatusChip>);
    expect(screen.getByText('Pending').parentElement).toHaveClass('text-[11px]');
  });

  it('passes through title and className', () => {
    render(
      <StatusChip title="Sent for verification" className="w-24">
        SFV
      </StatusChip>
    );
    const chip = screen.getByText('SFV').parentElement;
    expect(chip).toHaveAttribute('title', 'Sent for verification');
    expect(chip).toHaveClass('w-24');
  });
});
