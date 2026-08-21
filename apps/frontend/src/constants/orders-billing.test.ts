import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  calculateServiceCharge,
  calculateTotal,
  SERVICE_CHARGE_PERCENTAGE,
  PAGINATION,
} from './orders-billing';

// getOrderStatusColor and the ORDER/PAYMENT/PAYMENT_RECORD/INVOICE_STATUS_COLORS
// maps were removed by the design-system rebuild — order, payment and invoice
// chips now go through `components/ui/StatusChip` (covered in StatusChip.test.tsx).

// ---- formatCurrency ----

describe('formatCurrency', () => {
  it('formats a positive number with LKR prefix and two decimal places', () => {
    const result = formatCurrency(1500);
    expect(result).toMatch(/^LKR\s/);
    expect(result).toContain('1,500.00');
  });

  it('formats zero', () => {
    expect(formatCurrency(0)).toContain('0.00');
  });

  it('handles a string-typed amount', () => {
    const result = formatCurrency('2500.5');
    expect(result).toContain('2,500.50');
  });

  it('treats null as zero', () => {
    expect(formatCurrency(null)).toContain('0.00');
  });

  it('treats undefined as zero', () => {
    expect(formatCurrency(undefined)).toContain('0.00');
  });

  it('treats NaN as zero', () => {
    expect(formatCurrency(NaN)).toContain('0.00');
  });

  it('treats a non-numeric string as zero', () => {
    expect(formatCurrency('abc')).toContain('0.00');
  });
});

// ---- formatDate / formatDateTime ----

describe('formatDate', () => {
  it('formats an ISO date string to en-LK short date', () => {
    const result = formatDate('2024-03-15T10:30:00Z');
    // Output varies by TZ but should contain "Mar" and "2024"
    expect(result).toContain('Mar');
    expect(result).toContain('2024');
    expect(result).toContain('15');
  });
});

describe('formatDateTime', () => {
  it('includes both date and time components', () => {
    const result = formatDateTime('2024-03-15T14:30:00Z');
    expect(result).toContain('Mar');
    expect(result).toContain('2024');
    // Should include time
    expect(result).toMatch(/\d{1,2}:\d{2}/);
  });
});

// ---- calculateServiceCharge / calculateTotal ----

describe('calculateServiceCharge', () => {
  it('applies the configured percentage (5%) to the subtotal', () => {
    expect(calculateServiceCharge(1000)).toBe(50);
    expect(calculateServiceCharge(0)).toBe(0);
    expect(calculateServiceCharge(200)).toBe(10);
  });

  it('uses SERVICE_CHARGE_PERCENTAGE from the module', () => {
    // Ensures the function uses the exported constant
    expect(SERVICE_CHARGE_PERCENTAGE).toBe(5);
  });
});

describe('calculateTotal', () => {
  it('returns subtotal + service charge when no discount', () => {
    // 1000 + 5% = 1050
    expect(calculateTotal(1000)).toBe(1050);
  });

  it('subtracts the discount from the total', () => {
    // 1000 + 50 (5%) - 100 = 950
    expect(calculateTotal(1000, 100)).toBe(950);
  });

  it('returns zero when subtotal is zero', () => {
    expect(calculateTotal(0)).toBe(0);
  });

  it('handles a discount larger than subtotal+charge (negative total)', () => {
    // 100 + 5 - 200 = -95 — the function does not clamp
    expect(calculateTotal(100, 200)).toBe(-95);
  });
});

// ---- PAGINATION defaults ----

describe('PAGINATION defaults', () => {
  it('has sensible defaults', () => {
    expect(PAGINATION.DEFAULT_PAGE).toBe(1);
    expect(PAGINATION.DEFAULT_PAGE_SIZE).toBe(10);
    expect(PAGINATION.PAGE_SIZE_OPTIONS).toEqual(expect.arrayContaining([10, 25, 50]));
  });
});
