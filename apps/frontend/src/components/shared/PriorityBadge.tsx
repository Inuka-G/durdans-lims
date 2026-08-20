'use client';

import StatusChip, { toneForStatus } from '@/components/ui/StatusChip';

/** STAT / URGENT / NORMAL priority chip. Kept uppercase on purpose: lab staff read "STAT" as a token. */
export default function PriorityBadge({ priority }: { priority: string }) {
    const key = (priority || '').toUpperCase();
    return (
        <StatusChip tone={toneForStatus(key)} size="sm" className="font-semibold tracking-wide">
            {key || '—'}
        </StatusChip>
    );
}
