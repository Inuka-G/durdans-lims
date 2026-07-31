'use client';

import { PhlebSample } from '@/mock/phlebotomy.mock';
import { PRIORITY_COLORS, TUBE_COLOR_MAP, formatStatusLabel } from '@/constants/sample-lifecycle';

interface WorklistRowProps {
    sample: PhlebSample;
    onStartCollection: (id: string) => void;
    onReject: (id: string) => void;
}

export default function WorklistRow({ sample, onStartCollection, onReject }: WorklistRowProps) {
    const waitColor =
        sample.waitTimeMinutes > 30 ? 'text-red-600' :
        sample.waitTimeMinutes > 15 ? 'text-amber-600' :
        'text-slate-600';

    return (
        <tr className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
            <td className="px-5 py-3">
                <p className="font-semibold text-slate-700">{sample.patient.name}</p>
                <p className="text-xs text-slate-400">{sample.patient.pid} • {sample.patient.age}Y {sample.patient.gender}</p>
                {sample.patient.wardRoom && <p className="text-xs text-primary mt-0.5">{sample.patient.wardRoom}</p>}
            </td>
            <td className="px-4 py-3">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${PRIORITY_COLORS[sample.priority] ?? 'bg-slate-100 text-slate-600'}`}>
                    {sample.priority}
                </span>
            </td>
            <td className="px-4 py-3">
                <p className="text-slate-700 font-medium">{sample.testType}</p>
                <div className="flex gap-1 mt-1 flex-wrap">
                    {sample.testCodes.map((c) => (
                        <span key={c} className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{c}</span>
                    ))}
                </div>
            </td>
            <td className="px-4 py-3">
                <div className="flex gap-1">
                    {sample.tubeTypes.map((t) => (
                        <div
                            key={t}
                            className={`w-4 h-4 rounded-full ${TUBE_COLOR_MAP[t] ?? 'bg-slate-400'} border border-white shadow-sm`}
                            title={formatStatusLabel(t)}
                        />
                    ))}
                </div>
            </td>
            <td className="px-4 py-3">
                <span className={`text-sm font-semibold ${waitColor}`}>{sample.waitTimeMinutes} min</span>
            </td>
            <td className="px-4 py-3 text-right">
                <div className="flex justify-end gap-2">
                    <button
                        onClick={() => onStartCollection(sample.id)}
                        className="px-3 py-1.5 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary/90 transition-colors"
                    >
                        <span className="material-icons text-sm mr-1 align-middle">play_arrow</span>Collect
                    </button>
                    <button
                        onClick={() => onReject(sample.id)}
                        className="px-3 py-1.5 border border-red-200 text-red-600 text-xs font-bold rounded-lg hover:bg-red-50 transition-colors"
                    >
                        <span className="material-icons text-sm mr-1 align-middle">cancel</span>Reject
                    </button>
                </div>
            </td>
        </tr>
    );
}
