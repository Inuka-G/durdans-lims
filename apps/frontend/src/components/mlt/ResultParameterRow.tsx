'use client';

import { computeFlag, type TestParameter } from '@/mock/result-entry.mock';
import StatusChip, { type ChipTone } from '@/components/ui/StatusChip';
import { CONTROL_CLASS } from '@/components/ui/Field';
import { cn } from '@/lib/utils';

const FLAG_TONE: Record<string, ChipTone> = {
    NORMAL:        'neutral',
    LOW:           'pending',
    HIGH:          'pending',
    CRITICAL_HIGH: 'danger',
    CRITICAL_LOW:  'danger',
};

const FLAG_LABELS: Record<string, string> = {
    NORMAL:        'Normal',
    LOW:           'Low',
    HIGH:          'High',
    CRITICAL_HIGH: 'Critical high',
    CRITICAL_LOW:  'Critical low',
};

interface ResultParameterRowProps {
    param: TestParameter;
    onChange: (id: string, value: string) => void;
    disabled?: boolean;
}

export default function ResultParameterRow({ param, onChange, disabled }: ResultParameterRowProps) {
    const numVal = parseFloat(param.result);
    const flag = isNaN(numVal)
        ? param.flag
        : computeFlag(numVal, param.referenceRangeLow, param.referenceRangeHigh);

    const isCritical = flag === 'CRITICAL_HIGH' || flag === 'CRITICAL_LOW';
    const isAbnormal = flag !== 'NORMAL';

    return (
        <tr className={cn('transition-colors', isCritical ? 'bg-status-danger-bg' : 'hover:bg-surface-hover')}>
            <td className="py-2 pl-4 pr-3 font-medium text-fg">{param.parameterName}</td>
            <td className="px-3 py-2">
                <div className="flex justify-center">
                    <input
                        type="text"
                        inputMode="decimal"
                        value={param.result}
                        onChange={(e) => onChange(param.id, e.target.value)}
                        disabled={disabled}
                        aria-label={`${param.parameterName} result`}
                        className={cn(
                            CONTROL_CLASS,
                            'h-8 w-24 text-center font-semibold tabular-nums',
                            !disabled && isCritical && 'border-status-danger-edge bg-surface text-status-danger-fg',
                            !disabled && !isCritical && isAbnormal && 'border-status-pending-edge bg-status-pending-bg text-status-pending-fg',
                        )}
                    />
                </div>
            </td>
            <td className="px-3 py-2 text-center text-xs text-fg-muted">{param.unit}</td>
            <td className={cn('px-3 py-2 text-center text-xs tabular-nums', isAbnormal ? 'font-medium text-fg' : 'text-fg-muted')}>
                {param.referenceRangeLow} – {param.referenceRangeHigh}
            </td>
            <td className="py-2 pl-3 pr-4">
                <div className="flex justify-end">
                    <StatusChip tone={FLAG_TONE[flag] ?? 'neutral'} size="sm" dot={isAbnormal}>
                        {FLAG_LABELS[flag] ?? flag}
                    </StatusChip>
                </div>
            </td>
        </tr>
    );
}
