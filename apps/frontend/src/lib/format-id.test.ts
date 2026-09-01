import { describe, expect, it } from 'vitest';
import { formatDisplayId } from './format-id';

describe('formatDisplayId', () => {
  it('returns N/A for an empty value', () => {
    expect(formatDisplayId(undefined)).toBe('N/A');
    expect(formatDisplayId(null)).toBe('N/A');
    expect(formatDisplayId('')).toBe('N/A');
  });

  it('passes through a value that is already a display id', () => {
    expect(formatDisplayId('PAT2026-00002')).toBe('PAT2026-00002');
  });

  it('formats a UUID as <prefix>-<last 8 hex, upper>', () => {
    expect(formatDisplayId('12345678-1234-1234-1234-1234567890ab', 'PT')).toBe('PT-567890AB');
  });

  it('formats a UUID with sequential year prefix for RES and REP', () => {
    const uuid = '12345678-1234-1234-1234-1234567890ab';
    const currentYear = new Date().getFullYear();
    expect(formatDisplayId(uuid, 'RES')).toContain(`RES${currentYear}-`);
    expect(formatDisplayId(uuid, 'REP')).toContain(`REP${currentYear}-`);
  });

  // The display id is what the audit CSV exports and what the history search
  // boxes match on, so distinct records must not share one. A previous version
  // hashed the UUID into 90,000 buckets, which collided after ~350 rows.
  it('gives distinct ids to UUIDs that differ only in the low bits', () => {
    const a = formatDisplayId('12345678-1234-1234-1234-1234567890ab', 'RES');
    const b = formatDisplayId('12345678-1234-1234-1234-1234567890ac', 'RES');
    expect(a).not.toBe(b);
  });

  it('does not collide across a large set of random UUIDs', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 5000; i += 1) {
      const tail = i.toString(16).padStart(12, '0');
      seen.add(formatDisplayId(`12345678-1234-1234-1234-${tail}`, 'RES'));
    }
    expect(seen.size).toBe(5000);
  });
});
