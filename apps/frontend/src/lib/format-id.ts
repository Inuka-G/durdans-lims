const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const formatDisplayId = (value?: string | null, prefix = 'ID') => {
    if (!value) {
        return 'N/A';
    }

    const trimmed = value.trim();
    if (!UUID_PATTERN.test(trimmed)) {
        return trimmed.toUpperCase();
    }

    return `${prefix}-${trimmed.replaceAll('-', '').slice(-8).toUpperCase()}`;
};
