import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getBarcodeBars, getTubeHexColor, openPhlebotomySpecimenLabelPrint } from './phlebotomy-label-print';

describe('getBarcodeBars', () => {
  it('returns an array of the requested length (default 24)', () => {
    const bars = getBarcodeBars('S-90231');
    expect(bars).toHaveLength(24);
  });

  it('returns an array of the specified count', () => {
    expect(getBarcodeBars('S-90231', 10)).toHaveLength(10);
    expect(getBarcodeBars('S-90231', 0)).toHaveLength(0);
  });

  it('produces only values 1, 2, or 3', () => {
    const bars = getBarcodeBars('S-90231', 50);
    for (const bar of bars) {
      expect([1, 2, 3]).toContain(bar);
    }
  });

  it('produces deterministic output for the same input', () => {
    const a = getBarcodeBars('XYZ-123', 32);
    const b = getBarcodeBars('XYZ-123', 32);
    expect(a).toEqual(b);
  });

  it('produces different output for different IDs', () => {
    const a = getBarcodeBars('AAA', 12);
    const b = getBarcodeBars('ZZZ', 12);
    // Extremely unlikely to be identical for different inputs
    expect(a).not.toEqual(b);
  });

  it('handles an empty string without throwing', () => {
    const bars = getBarcodeBars('', 8);
    expect(bars).toHaveLength(8);
    for (const bar of bars) {
      expect([1, 2, 3]).toContain(bar);
    }
  });
});

describe('getTubeHexColor', () => {
  it.each([
    ['EDTA_PURPLE', '#a855f7'],
    ['EDTA_LAVENDER', '#d8b4fe'],
    ['SST_GOLD', '#facc15'],
    ['SST_RED', '#ef4444'],
    ['CITRATE_BLUE', '#60a5fa'],
    ['HEPARIN_GREEN', '#22c55e'],
    ['URINE_YELLOW', '#fde047'],
    ['OTHER', '#9ca3af'],
  ])('returns %s → %s', (tube, expected) => {
    expect(getTubeHexColor(tube)).toBe(expected);
  });

  it('normalises whitespace to underscores and uppercases', () => {
    expect(getTubeHexColor('edta purple')).toBe('#a855f7');
    expect(getTubeHexColor('sst gold')).toBe('#facc15');
  });

  it('falls back to OTHER color for unrecognized tube types', () => {
    expect(getTubeHexColor('UNKNOWN_TUBE')).toBe('#9ca3af');
    expect(getTubeHexColor('')).toBe('#9ca3af');
  });
});

describe('openPhlebotomySpecimenLabelPrint', () => {
  const payload = {
    sampleId: 'S-90231',
    patientName: 'Mohamed Shafi',
    pid: 'DH-40281',
    testCodes: ['FBC', 'CRP'],
    tubeTypeLabel: 'EDTA_PURPLE',
  };

  let mockPrintWindow: {
    document: { write: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> };
  };

  beforeEach(() => {
    mockPrintWindow = {
      document: { write: vi.fn(), close: vi.fn() },
    };
  });

  it('returns false when window.open returns null (popup blocked)', () => {
    vi.spyOn(window, 'open').mockReturnValue(null);
    expect(openPhlebotomySpecimenLabelPrint(payload)).toBe(false);
    vi.restoreAllMocks();
  });

  it('returns true and writes HTML to the print window on success', () => {
    vi.spyOn(window, 'open').mockReturnValue(mockPrintWindow as unknown as Window);
    expect(openPhlebotomySpecimenLabelPrint(payload)).toBe(true);
    expect(mockPrintWindow.document.write).toHaveBeenCalledTimes(1);
    expect(mockPrintWindow.document.close).toHaveBeenCalledTimes(1);
    vi.restoreAllMocks();
  });

  it('includes patient name, sample ID, PID and test codes in the label HTML', () => {
    vi.spyOn(window, 'open').mockReturnValue(mockPrintWindow as unknown as Window);
    openPhlebotomySpecimenLabelPrint(payload);

    const html = mockPrintWindow.document.write.mock.calls[0][0] as string;
    expect(html).toContain('S-90231');
    expect(html).toContain('Mohamed Shafi');
    expect(html).toContain('DH-40281');
    expect(html).toContain('FBC');
    expect(html).toContain('CRP');
    vi.restoreAllMocks();
  });

  it('uses the tube hex color for the accent strip', () => {
    vi.spyOn(window, 'open').mockReturnValue(mockPrintWindow as unknown as Window);
    openPhlebotomySpecimenLabelPrint(payload);

    const html = mockPrintWindow.document.write.mock.calls[0][0] as string;
    expect(html).toContain('#a855f7'); // EDTA_PURPLE color
    vi.restoreAllMocks();
  });

  it('replaces underscores with spaces in the tube type label', () => {
    vi.spyOn(window, 'open').mockReturnValue(mockPrintWindow as unknown as Window);
    openPhlebotomySpecimenLabelPrint(payload);

    const html = mockPrintWindow.document.write.mock.calls[0][0] as string;
    expect(html).toContain('EDTA PURPLE');
    expect(html).not.toContain('>EDTA_PURPLE<');
    vi.restoreAllMocks();
  });
});
