import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { downloadCsv } from './export-csv';

// jsdom implements neither object URLs nor anchor-triggered downloads, so both are stubbed
// and the generated file is asserted by reading the Blob back.
const BOM = '\uFEFF';

let lastBlob: Blob | null = null;
let lastDownload = '';

const createObjectURL = vi.fn((obj: Blob | MediaSource): string => {
  lastBlob = obj as Blob;
  return 'blob:csv-test';
});
const revokeObjectURL = vi.fn();
const click = vi.fn(function (this: HTMLAnchorElement): void {
  lastDownload = this.download;
});

beforeEach(() => {
  lastBlob = null;
  lastDownload = '';
  createObjectURL.mockClear();
  revokeObjectURL.mockClear();
  click.mockClear();
  URL.createObjectURL = createObjectURL;
  URL.revokeObjectURL = revokeObjectURL;
  HTMLAnchorElement.prototype.click = click;
});

afterEach(() => {
  Reflect.deleteProperty(HTMLAnchorElement.prototype, 'click');
});

// jsdom's Blob has no text(); FileReader plus ignoreBOM keeps the leading BOM observable,
// which the spec-mandated UTF-8 decode would otherwise swallow.
function csvText(): Promise<string> {
  if (!lastBlob) {
    throw new Error('downloadCsv did not create a Blob');
  }

  const blob = lastBlob;
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const bytes = new Uint8Array(reader.result as ArrayBuffer);
      resolve(new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes));
    };
    reader.readAsArrayBuffer(blob);
  });
}

describe('downloadCsv', () => {
  it('writes a BOM, the header row and plain values', async () => {
    downloadCsv('audit', ['Id', 'Name'], [['A1', 'Alice']]);

    expect(await csvText()).toBe(BOM + 'Id,Name\r\nA1,Alice');
  });

  it('quotes a value containing a comma', async () => {
    downloadCsv('audit', ['Name'], [['Perera, Nimal']]);

    expect(await csvText()).toBe(BOM + 'Name\r\n"Perera, Nimal"');
  });

  it('doubles an embedded double quote', async () => {
    downloadCsv('audit', ['Note'], [['said "ok"']]);

    expect(await csvText()).toBe(BOM + 'Note\r\n"said ""ok"""');
  });

  it('quotes a value containing a newline', async () => {
    downloadCsv('audit', ['Note'], [['line one\nline two']]);

    expect(await csvText()).toBe(BOM + 'Note\r\n"line one\nline two"');
  });

  it('renders null and undefined as empty cells', async () => {
    downloadCsv('audit', ['A', 'B', 'C'], [[null, undefined, 'x']]);

    expect(await csvText()).toBe(BOM + 'A,B,C\r\n,,x');
  });

  it('coerces numbers', async () => {
    downloadCsv('audit', ['Count'], [[42], [0]]);

    expect(await csvText()).toBe(BOM + 'Count\r\n42\r\n0');
  });

  it('neutralises spreadsheet formulas', async () => {
    downloadCsv('audit', ['Value'], [['=1+1'], ['+A1'], ['-cmd'], ['@SUM(A1)']]);

    expect(await csvText()).toBe(BOM + 'Value\r\n"\'=1+1"\r\n"\'+A1"\r\n"\'-cmd"\r\n"\'@SUM(A1)"');
  });

  it('appends the .csv extension, then cleans up the anchor and the url', () => {
    downloadCsv('verification-history', ['Id'], [['A1']]);

    expect(click).toHaveBeenCalledTimes(1);
    expect(lastDownload).toBe('verification-history.csv');
    expect(lastDownload.endsWith('.csv')).toBe(true);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:csv-test');
    expect(document.querySelector('a')).toBeNull();
  });

  it('does nothing without a window', () => {
    const original = globalThis.window;
    Reflect.deleteProperty(globalThis, 'window');

    try {
      downloadCsv('audit', ['Id'], [['A1']]);
      expect(createObjectURL).not.toHaveBeenCalled();
    } finally {
      globalThis.window = original;
    }
  });
});
