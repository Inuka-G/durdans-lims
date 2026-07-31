'use client';

import { MLTSample } from '@/mock/mlt.mock';
import { PRIORITY_COLORS, SAMPLE_STATUS_COLORS, formatStatusLabel } from '@/constants/sample-lifecycle';

interface MLTWorklistRowProps {
    sample: MLTSample;
    mode: 'worklist' | 'all';
    onAction: (id: string) => void;
}

export default function MLTWorklistRow({ sample, mode, onAction }: MLTWorklistRowProps) {
    return (
        <tr className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
            <td className="px-5 py-3 font-semibold text-primary">{sample.sampleId}</td>
            <td className="px-4 py-3">
                <p className="font-medium text-slate-700">{sample.patient.name}</p>
                <p className="text-xs text-slate-400">{sample.patient.pid} • {sample.patient.age}Y {sample.patient.gender}</p>
                {sample.patient.wardRoom && <p className="text-xs text-primary mt-0.5">{sample.patient.wardRoom}</p>}
            </td>
            <td className="px-4 py-3">
                <p className="text-slate-700">{sample.testType}</p>
                <p className="text-[10px] text-slate-400">{sample.department}</p>
            </td>
            <td className="px-4 py-3">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${PRIORITY_COLORS[sample.priority] ?? 'bg-slate-100 text-slate-600'}`}>
                    {sample.priority}
                </span>
            </td>
            <td className="px-4 py-3">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${SAMPLE_STATUS_COLORS[sample.status] ?? 'bg-slate-100 text-slate-600'}`}>
                    {formatStatusLabel(sample.status)}
                </span>
            </td>
            <td className="px-4 py-3 text-right">
                {mode === 'worklist' ? (
                    <button
                        onClick={() => onAction(sample.id)}
                        className="px-3 py-1.5 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary/90 transition-colors"
                    >
                        <span className="material-icons text-sm mr-1 align-middle">play_arrow</span>Start
                    </button>
                ) : (
                    <button
                        onClick={() => onAction(sample.id)}
                        className="px-3 py-1.5 border border-slate-200 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-50 transition-colors"
                    >
                        <span className="material-icons text-sm mr-1 align-middle">visibility</span>View
                    </button>
                )}
            </td>
        </tr>
    );
}
