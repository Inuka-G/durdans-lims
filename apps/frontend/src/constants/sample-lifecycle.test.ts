import { describe, it, expect } from 'vitest';
import { formatStatusLabel } from './sample-lifecycle';

// Colour lookup maps no longer live in this module — the design-system rebuild
// replaced SAMPLE_STATUS_COLORS / PRIORITY_COLORS / FLAG_COLORS /
// INSTRUMENT_STATUS_CONFIG / QC_STATUS_CONFIG with `components/ui/StatusChip`
// (covered in StatusChip.test.tsx) and TUBE_COLOR_MAP with `getTubeHexColor`
// (covered in lib/phlebotomy-label-print.test.ts). Only the label helper is left
// here, so that is all this file asserts.

describe('formatStatusLabel', () => {
  it('replaces underscores with spaces', () => {
    expect(formatStatusLabel('PENDING_COLLECTION')).toBe('PENDING COLLECTION');
    expect(formatStatusLabel('RECEIVED_AT_LAB')).toBe('RECEIVED AT LAB');
    expect(formatStatusLabel('IN_TESTING')).toBe('IN TESTING');
    expect(formatStatusLabel('SENT_FOR_VERIFICATION')).toBe('SENT FOR VERIFICATION');
  });

  it('returns a single-word status unchanged', () => {
    expect(formatStatusLabel('ACCEPTED')).toBe('ACCEPTED');
    expect(formatStatusLabel('REJECTED')).toBe('REJECTED');
    expect(formatStatusLabel('VERIFIED')).toBe('VERIFIED');
  });

  it('handles an empty string', () => {
    expect(formatStatusLabel('')).toBe('');
  });
});
