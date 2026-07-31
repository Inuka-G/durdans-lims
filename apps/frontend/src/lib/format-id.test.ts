import { describe, it, expect } from 'vitest';
import { formatDisplayId } from './format-id';

// Simplest unit — no mocks — also validates the toolchain end-to-end.
describe('formatDisplayId', () => {
  it('returns N/A for empty values', () => {
    expect(formatDisplayId(undefined)).toBe('N/A');
    expect(formatDisplayId(null)).toBe('N/A');
    expect(formatDisplayId('')).toBe('N/A');
  });

  it('uppercases a non-UUID value verbatim', () => {
    expect(formatDisplayId('p-abc')).toBe('P-ABC');
  });

  it('formats a UUID as <prefix>-<last 8 hex, upper>', () => {
    expect(formatDisplayId('12345678-1234-1234-1234-1234567890ab', 'PT')).toBe('PT-567890AB');
  });
});
