'use client';

const STATUS_STYLES: Record<string, string> = {
    COLLECTED:   'bg-emerald-100 text-emerald-700',
    REJECTED:    'bg-red-100 text-red-700',
    IN_TRANSIT:  'bg-cyan-100 text-cyan-700',
    PENDING:     'bg-amber-100 text-amber-700',
    RECEIVED:    'bg-blue-100 text-blue-700',
    VERIFIED:    'bg-emerald-100 text-emerald-700',
    DISPATCHED:  'bg-purple-100 text-purple-700',
};

const STATUS_LABELS: Record<string, string> = {
    COLLECTED:  'Collected',
    REJECTED:   'Rejected',
    IN_TRANSIT: 'In Transit',
    PENDING:    'Pending',
    RECEIVED:   'Received',
    VERIFIED:   'Verified',
    DISPATCHED: 'Dispatched',
};

interface StatusBadgeProps {
    status: string;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
    const style = STATUS_STYLES[status] ?? 'bg-slate-100 text-slate-600';
    const label = STATUS_LABELS[status] ?? status.replace(/_/g, ' ');
    return (
        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${style}`}>
            {label}
        </span>
    );
}
