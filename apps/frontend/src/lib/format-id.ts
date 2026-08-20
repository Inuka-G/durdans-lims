const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const formatDisplayId = (value?: string | null, prefix = 'ID') => {
    if (!value) {
        return 'N/A';
    }

    const trimmed = value.trim();
    if (!UUID_PATTERN.test(trimmed)) {
        return trimmed.toUpperCase();
    }

    // Every prefix renders the same way: the last 8 hex digits of the real key.
    //
    // Do not fold this into a shorter pseudo-accession number. A result carries no
    // server-issued human-readable identifier, so any shorter form is invented in
    // the browser, and hashing the UUID into a small range makes two different
    // results display the same id. This string is what the audit CSVs export and
    // what the history search boxes match, so it has to stay traceable back to the
    // record it came from.
    return `${prefix}-${trimmed.replaceAll('-', '').slice(-8).toUpperCase()}`;
};
