'use client';

import { LucideIcon } from 'lucide-react';

type Color = 'blue' | 'orange' | 'green' | 'red' | 'emerald' | 'violet' | 'purple';

const COLOR_MAP: Record<Color, { icon: string; card: string }> = {
    blue:    { icon: 'text-blue-600',    card: 'bg-blue-100' },
    orange:  { icon: 'text-orange-600',  card: 'bg-orange-100' },
    green:   { icon: 'text-green-600',   card: 'bg-green-100' },
    red:     { icon: 'text-red-600',     card: 'bg-red-100' },
    emerald: { icon: 'text-emerald-600', card: 'bg-emerald-100' },
    violet:  { icon: 'text-violet-600',  card: 'bg-violet-100' },
    purple:  { icon: 'text-purple-600',  card: 'bg-purple-100' },
};

interface StatCardProps {
    label: string;
    value: string | number;
    icon: LucideIcon;
    color?: Color;
    sub?: string;
}

export default function StatCard({ label, value, icon: Icon, color = 'blue', sub }: StatCardProps) {
    const c = COLOR_MAP[color];
    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-5">
            <div className={`w-10 h-10 rounded-xl ${c.card} flex items-center justify-center mb-2`}>
                <Icon className={`w-5 h-5 ${c.icon}`} />
            </div>
            <p className="text-2xl font-bold text-slate-800">{value}</p>
            <p className="text-xs text-slate-500">{label}</p>
            {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
        </div>
    );
}
