/**
 * Client-side CSV download for the history screens.
 *
 * `filename` is the base name WITHOUT an extension; ".csv" is appended here so
 * a caller cannot ship a download the spreadsheet app refuses to associate.
 */
export function downloadCsv(
    filename: string,
    headers: string[],
    rows: (string | number | null | undefined)[][]
): void {
    if (typeof window === 'undefined') {
        return;
    }

    const body = [headers, ...rows].map((row) => row.map(escapeCell).join(',')).join('\r\n');
    // Leading BOM so Excel decodes the file as UTF-8 and renders non-ASCII patient names.
    const blob = new Blob(['\uFEFF', body], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${filename}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
}

function escapeCell(value: string | number | null | undefined): string {
    if (value === null || value === undefined) {
        return '';
    }

    const text = String(value);
    // CSV-injection defence: a cell opening with =, +, - or @ is evaluated as a formula
    // when an auditor opens the export, so neutralise it with a leading apostrophe.
    if (/^[=+\-@]/.test(text)) {
        return `"'${text.replaceAll('"', '""')}"`;
    }

    if (/[",\r\n]/.test(text)) {
        return `"${text.replaceAll('"', '""')}"`;
    }

    return text;
}
