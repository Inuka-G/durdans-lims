import { describe, it, expect } from 'vitest';
import { cn } from './utils';

describe('cn (clsx + tailwind-merge)', () => {
  it('returns an empty string when called with no arguments', () => {
    expect(cn()).toBe('');
  });

  it('passes through a single class name', () => {
    expect(cn('px-4')).toBe('px-4');
  });

  it('merges multiple class names', () => {
    expect(cn('px-4', 'py-2')).toBe('px-4 py-2');
  });

  it('resolves conflicting Tailwind utilities to the last one', () => {
    // tailwind-merge should keep only the last padding-x value
    expect(cn('px-4', 'px-8')).toBe('px-8');
  });

  it('drops falsy values (undefined, null, false)', () => {
    expect(cn('text-sm', undefined, null, false, 'font-bold')).toBe('text-sm font-bold');
  });

  it('supports conditional object syntax from clsx', () => {
    const isActive = true;
    const isDisabled = false;
    expect(cn('btn', { 'btn-active': isActive, 'btn-disabled': isDisabled })).toBe(
      'btn btn-active'
    );
  });

  it('supports array syntax from clsx', () => {
    expect(cn(['flex', 'items-center'])).toBe('flex items-center');
  });

  it('merges color utilities, keeping the last variant', () => {
    expect(cn('text-red-500', 'text-blue-700')).toBe('text-blue-700');
  });
});
