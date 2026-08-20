'use client';

import type { LucideIcon } from 'lucide-react';
import KpiTile, { type KpiTone } from '@/components/ui/KpiTile';

/**
 * StatCard — legacy API kept for the module dashboards; renders the shared KpiTile
 * so every module's numbers share one anatomy. Decorative colours collapse to a
 * status tone: red/orange → warning/danger, green/emerald → success, rest neutral.
 */
type Color = 'blue' | 'orange' | 'green' | 'red' | 'emerald' | 'violet' | 'purple';

const TONE: Record<Color, KpiTone> = {
    blue: 'neutral',
    violet: 'neutral',
    purple: 'neutral',
    orange: 'warning',
    red: 'danger',
    green: 'success',
    emerald: 'success',
};

interface StatCardProps {
    label: string;
    value: string | number;
    icon: LucideIcon;
    color?: Color;
    sub?: string;
    loading?: boolean;
}

export default function StatCard({ label, value, icon, color = 'blue', sub, loading }: StatCardProps) {
    return <KpiTile label={label} value={value} icon={icon} tone={TONE[color]} note={sub} loading={loading} />;
}
