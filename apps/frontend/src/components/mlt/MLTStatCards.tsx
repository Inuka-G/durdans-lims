'use client';

import { MOCK_MLT_STATS } from '@/mock/mlt.mock';

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
        { label: 'Pending Tests',    value: pendingTests,    icon: 'science',    color: 'blue',   sub: `Since ${pendingSince}` },
        { label: 'Rejected Tests',   value: rejectedTests,   icon: 'cancel',     color: 'red',    sub: `Since ${rejectedSince}` },
        { label: 'Critical Results', value: criticalResults, icon: 'warning',    color: 'orange', sub: 'Require notification' },
        { label: 'My Drafts',        value: myDrafts,        icon: 'edit_note',  color: 'violet', sub: 'Pending submission' },
    ];
    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            {cards.map((s) => (
                <div key={s.label} className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-5">
                    <div className={`w-10 h-10 rounded-xl bg-${s.color}-100 flex items-center justify-center mb-2`}>
                        <span className={`material-icons text-${s.color}-600`}>{s.icon}</span>
                    </div>
                    <p className="text-2xl font-bold text-slate-800">{s.value}</p>
                    <p className="text-xs text-slate-500">{s.label}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{s.sub}</p>
                </div>
            ))}
        </div>
    );
}
