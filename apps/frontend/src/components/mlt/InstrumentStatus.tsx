'use client';

import { Instrument } from '@/mock/mlt.mock';

const STATUS_CONFIG = {
    online:  { label: 'ONLINE',  dot: 'bg-emerald-500 animate-pulse', badge: 'bg-emerald-100 text-emerald-700' },
    offline: { label: 'OFFLINE', dot: 'bg-red-500',                   badge: 'bg-red-100 text-red-700'         },
    busy:    { label: 'BUSY',    dot: 'bg-amber-500',                  badge: 'bg-amber-100 text-amber-700'     },
};

interface InstrumentStatusProps {
    instruments: Instrument[];
}

export default function InstrumentStatus({ instruments }: InstrumentStatusProps) {
    return (
        <>
            <p className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider px-1">Instruments</p>
            {instruments.map((inst) => {
                const cfg = STATUS_CONFIG[inst.status];
                return (
                    <div key={inst.id} className="bg-white rounded-xl border border-slate-200/60 p-3 shadow-sm">
                        <div className="flex items-center gap-2 mb-1.5">
                            <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${cfg.badge}`}>{cfg.label}</span>
                        </div>
                        <p className="text-xs font-semibold text-slate-700 truncate">{inst.name}</p>
                        <p className="text-[10px] text-slate-400">{inst.testsToday} tests today</p>
                    </div>
                );
            })}
        </>
    );
}
