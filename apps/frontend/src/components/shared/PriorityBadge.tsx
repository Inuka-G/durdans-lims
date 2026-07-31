'use client';

const PRIORITY_STYLES: Record<string, string> = {
    STAT:   'bg-amber-100 text-amber-800',
    URGENT: 'bg-red-100 text-red-700',
    NORMAL: 'bg-slate-100 text-slate-600',
};

interface PriorityBadgeProps {
    priority: string;
}

export default function PriorityBadge({ priority }: PriorityBadgeProps) {
    const style = PRIORITY_STYLES[priority] ?? 'bg-slate-100 text-slate-600';
    return (
        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${style}`}>
            {priority}
        </span>
    );
}
