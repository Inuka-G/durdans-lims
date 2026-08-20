'use client';

import { CircleX, FilePenLine, FlaskConical, TriangleAlert } from 'lucide-react';
import StatCard from '@/components/shared/StatCard';

interface MLTStatCardsProps {
    pendingTests: number;
    pendingSince: string;
    rejectedTests: number;
    rejectedSince: string;
    criticalResults: number;
    myDrafts: number;
}

export default function MLTStatCards({ pendingTests, pendingSince, rejectedTests, rejectedSince, criticalResults, myDrafts }: MLTStatCardsProps) {
    const cards = [
        { label: 'Pending tests',    value: pendingTests,    icon: FlaskConical,  color: 'blue' as const,   sub: `Since ${pendingSince}` },
        { label: 'Rejected tests',   value: rejectedTests,   icon: CircleX,       color: 'red' as const,    sub: `Since ${rejectedSince}` },
        { label: 'Critical results', value: criticalResults, icon: TriangleAlert, color: 'orange' as const, sub: 'Require notification' },
        { label: 'My drafts',        value: myDrafts,        icon: FilePenLine,   color: 'violet' as const, sub: 'Pending submission' },
    ];
    return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map((s) => (
                <StatCard key={s.label} label={s.label} value={s.value} icon={s.icon} color={s.color} sub={s.sub} />
            ))}
        </div>
    );
}
