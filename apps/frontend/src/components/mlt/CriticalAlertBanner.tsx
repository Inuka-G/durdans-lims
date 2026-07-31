'use client';

import { cn } from '@/lib/utils';

interface CriticalAlertBannerProps {
    parameterName: string;
    value: string;
    unit: string;
}

export default function CriticalAlertBanner({ parameterName, value, unit }: CriticalAlertBannerProps) {
    return (
        <div className={cn(
            'flex items-start gap-3 px-4 py-3 rounded-xl border',
            'bg-red-50 border-red-200'
        )}>
            <span className="material-icons text-red-600 text-lg mt-0.5 flex-shrink-0">warning</span>
            <div>
                <p className="text-sm font-bold text-red-700">Critical Value: {parameterName}</p>
                <p className="text-xs text-red-600 mt-0.5">
                    Reported value: <span className="font-bold">{value} {unit}</span> — Physician notification required.
                </p>
            </div>
        </div>
    );
}
