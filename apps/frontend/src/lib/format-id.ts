const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const formatDisplayId = (value?: string | null, prefix = 'ID') => {
    if (!value) {
        return 'N/A';
    }

    const trimmed = value.trim();
    if (!UUID_PATTERN.test(trimmed)) {
        return trimmed.toUpperCase();
    }

    const hex = trimmed.replaceAll('-', '');
    if (prefix === 'RES') {
        const num = (parseInt(hex.slice(-7), 16) % 90000) + 10000;
        return `RES2026-${num.toString().padStart(5, '0')}`;
    }

    return `${prefix}-${hex.slice(-8).toUpperCase()}`;
};
