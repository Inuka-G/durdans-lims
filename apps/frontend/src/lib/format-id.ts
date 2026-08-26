const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const formatDisplayId = (value?: string | null, prefix = 'ID') => {
    if (!value) {
        return 'N/A';
    }

    const trimmed = value.trim();

    if (prefix.toUpperCase() === 'RES' || trimmed.toUpperCase().startsWith('RES')) {
        const currentYear = new Date().getFullYear();
        if (/^RES\d{4}-\d{5}$/i.test(trimmed)) {
            return trimmed.toUpperCase();
        }
        const hexMatch = trimmed.replace(/^RES-?/i, '').replaceAll('-', '');
        const hex = hexMatch.slice(-8);
        const numeric = parseInt(hex, 16);
        const sequence = !isNaN(numeric) ? (numeric % 90000) + 10000 : 10001;
        return `RES${currentYear}-${sequence}`;
    }

    if (!UUID_PATTERN.test(trimmed)) {
        return trimmed.toUpperCase();
    }

    return `${prefix}-${trimmed.replaceAll('-', '').slice(-8).toUpperCase()}`;
};
