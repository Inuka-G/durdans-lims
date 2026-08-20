import { describe, it, expect } from 'vitest';
import {
  formatStatusLabel,
  SAMPLE_STATUS_COLORS,
  PRIORITY_COLORS,
  TUBE_COLOR_MAP,
  FLAG_COLORS,
  INSTRUMENT_STATUS_CONFIG,
  QC_STATUS_CONFIG,
} from './sample-lifecycle';

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

describe('SAMPLE_STATUS_COLORS completeness', () => {
  const expectedStatuses = [
    'PENDING_COLLECTION',
    'RECOLLECTION_REQUIRED',
    'COLLECTED',
    'IN_TRANSIT',
    'RECEIVED_AT_LAB',
    'QUALITY_CHECK',
    'ACCEPTED',
    'REJECTED',
    'IN_TESTING',
    'RESULT_ENTERED',
    'SENT_FOR_VERIFICATION',
    'VERIFIED',
    'AUTHORIZED',
    'DISPATCHED',
  ];

  it.each(expectedStatuses)('has a color entry for %s', (status) => {
    expect(SAMPLE_STATUS_COLORS).toHaveProperty(status);
    expect(SAMPLE_STATUS_COLORS[status]).toBeTruthy();
  });
});

describe('PRIORITY_COLORS completeness', () => {
  it.each(['URGENT', 'NORMAL', 'STAT'] as const)('has a color entry for %s', (priority) => {
    expect(PRIORITY_COLORS[priority]).toBeTruthy();
  });
});

describe('TUBE_COLOR_MAP completeness', () => {
  const expectedTubes = [
    'EDTA_PURPLE',
    'EDTA_LAVENDER',
    'SST_GOLD',
    'SST_RED',
    'CITRATE_BLUE',
    'HEPARIN_GREEN',
    'URINE_YELLOW',
    'OTHER',
  ];

  it.each(expectedTubes)('has a color entry for %s', (tube) => {
    expect(TUBE_COLOR_MAP).toHaveProperty(tube);
  });
});

describe('FLAG_COLORS completeness', () => {
  it.each(['NORMAL', 'LOW', 'HIGH', 'CRITICAL_LOW', 'CRITICAL_HIGH'])(
    'has a color entry for %s',
    (flag) => {
      expect(FLAG_COLORS).toHaveProperty(flag);
    }
  );
});

describe('INSTRUMENT_STATUS_CONFIG', () => {
  it.each(['online', 'offline', 'busy'] as const)(
    '%s has label, dot and badge properties',
    (status) => {
      const config = INSTRUMENT_STATUS_CONFIG[status];
      expect(config).toHaveProperty('label');
      expect(config).toHaveProperty('dot');
      expect(config).toHaveProperty('badge');
    }
  );
});

describe('QC_STATUS_CONFIG', () => {
  it.each(['PASS', 'FAIL', 'WARN'] as const)(
    '%s has label and className properties',
    (status) => {
      const config = QC_STATUS_CONFIG[status];
      expect(config).toHaveProperty('label');
      expect(config).toHaveProperty('className');
    }
  );
});
