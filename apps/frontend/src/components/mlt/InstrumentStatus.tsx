'use client';

import { Instrument } from '@/mock/mlt.mock';
import StatusChip, { type ChipTone } from '@/components/ui/StatusChip';

const STATUS_CONFIG: Record<Instrument['status'], { label: string; tone: ChipTone }> = {
    online:  { label: 'Online',  tone: 'success' },
    offline: { label: 'Offline', tone: 'danger'  },
    busy:    { label: 'Busy',    tone: 'pending' },
};

interface InstrumentStatusProps {
    instruments: Instrument[];
}

export default function InstrumentStatus({ instruments }: InstrumentStatusProps) {
    return (
        <>
            <p className="px-1 text-xs font-semibold text-fg-muted">Instruments</p>
            {instruments.map((inst) => {
                const cfg = STATUS_CONFIG[inst.status];
                return (
                    <div key={inst.id} className="rounded-lg border border-edge bg-surface p-3">
                        <div className="mb-1.5">
                            <StatusChip tone={cfg.tone} dot size="sm">
                                {cfg.label}
                            </StatusChip>
                        </div>
                        <p className="truncate text-xs font-medium text-fg" title={inst.name}>{inst.name}</p>
                        <p className="text-[12px] tabular-nums text-fg-muted">{inst.testsToday} tests today</p>
                    </div>
                );
            })}
        </>
    );
}
