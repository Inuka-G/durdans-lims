'use client';

import StatusChip, { humanizeStatus, toneForStatus } from '@/components/ui/StatusChip';

/** Lifecycle status chip (sample / order / result). Thin wrapper over StatusChip. */
const STATUS_LABELS: Record<string, string> = {
    IN_TRANSIT: 'In transit',
};

export default function StatusBadge({ status, dot = true }: { status: string; dot?: boolean }) {
    const key = (status || '').toUpperCase();
    const label = STATUS_LABELS[key] ?? humanizeStatus(status || '—');
    return (
        <StatusChip tone={toneForStatus(key)} dot={dot}>
            {label}
        </StatusChip>
    );
}
