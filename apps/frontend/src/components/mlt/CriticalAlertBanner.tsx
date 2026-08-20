'use client';

import { TriangleAlert } from 'lucide-react';

interface CriticalAlertBannerProps {
    parameterName: string;
    value: string;
    unit: string;
}

export default function CriticalAlertBanner({ parameterName, value, unit }: CriticalAlertBannerProps) {
    return (
        <div
            role="alert"
            className="flex items-start gap-3 rounded-lg border border-status-danger-edge bg-status-danger-bg px-4 py-3"
        >
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-status-danger-fg" aria-hidden="true" />
            <div className="min-w-0">
                <p className="text-sm font-semibold text-status-danger-fg">Critical value: {parameterName}</p>
                <p className="mt-0.5 text-xs text-status-danger-fg">
                    Reported value <span className="font-semibold tabular-nums">{value} {unit}</span> — physician notification required.
                </p>
            </div>
        </div>
    );
}
