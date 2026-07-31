'use client';

import { computeFlag, type TestParameter } from '@/mock/result-entry.mock';
import { cn } from '@/lib/utils';

const FLAG_STYLES: Record<string, string> = {
    NORMAL:        'bg-slate-100 text-slate-600',
    LOW:           'bg-amber-100 text-amber-700',
    HIGH:          'bg-amber-100 text-amber-700',
    CRITICAL_HIGH: 'bg-red-600 text-white',
    CRITICAL_LOW:  'bg-red-600 text-white',
};

const FLAG_LABELS: Record<string, string> = {
    NORMAL:        'NORMAL',
    LOW:           'LOW',
    HIGH:          'HIGH',
    CRITICAL_HIGH: 'CRITICAL HIGH',
    CRITICAL_LOW:  'CRITICAL LOW',
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
        <tr className={cn(
            'border-b border-slate-50 last:border-0 transition-colors',
            isCritical ? 'bg-red-50/40' : 'hover:bg-slate-50/50'
        )}>
            <td className="px-4 py-3 text-sm font-semibold text-slate-700">{param.parameterName}</td>
            <td className="px-4 py-3">
                <div className="flex justify-center">
                    <input
                        type="text"
                        value={param.result}
                        onChange={(e) => onChange(param.id, e.target.value)}
                        disabled={disabled}
                        className={cn(
                            'w-24 px-3 py-1.5 text-sm font-bold text-center border rounded-lg focus:outline-none focus:ring-2 transition-all',
                            disabled && 'bg-slate-50 cursor-not-allowed text-slate-400',
                            !disabled && isCritical && 'border-red-300 bg-red-50 text-red-700 focus:ring-red-200',
                            !disabled && !isCritical && isAbnormal && 'border-amber-200 bg-amber-50/50 text-amber-700 focus:ring-amber-200',
                            !disabled && !isCritical && !isAbnormal && 'border-slate-200 bg-white text-slate-800 focus:ring-primary/20',
                        )}
                    />
                </div>
            </td>
            <td className="px-4 py-3 text-xs text-slate-400 text-center">{param.unit}</td>
            <td className={cn('px-4 py-3 text-xs text-center', isAbnormal ? 'text-primary font-semibold' : 'text-slate-400')}>
                {param.referenceRangeLow} – {param.referenceRangeHigh}
            </td>
            <td className="px-4 py-3">
                <div className="flex justify-end">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-wide ${FLAG_STYLES[flag]}`}>
                        {FLAG_LABELS[flag]}
                    </span>
                </div>
            </td>
        </tr>
    );
}
