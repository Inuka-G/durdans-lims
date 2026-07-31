'use client';

import { ReceptionSample } from '@/mock/reception.mock';
import { TUBE_COLOR_MAP, formatStatusLabel, SAMPLE_STATUS_COLORS } from '@/constants/sample-lifecycle';

interface AccessioningRowProps {
    sample: ReceptionSample;
    onVerify: (id: string) => void;
    onReject: (id: string) => void;
}

export default function AccessioningRow({ sample, onVerify, onReject }: AccessioningRowProps) {
    return (
        <tr className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
            <td className="px-5 py-3 font-semibold text-primary font-mono">{sample.sampleId}</td>
            <td className="px-4 py-3">
                <p className="font-medium text-slate-700">{sample.patient.name}</p>
                <p className="text-xs text-slate-400">{sample.patient.pid} • {sample.patient.age}Y {sample.patient.gender}</p>
                {sample.patient.wardRoom && <p className="text-xs text-primary mt-0.5">{sample.patient.wardRoom}</p>}
            </td>
            <td className="px-4 py-3 text-slate-700">{sample.testType}</td>
            <td className="px-4 py-3 text-slate-500">{sample.collectionTime}</td>
            <td className="px-4 py-3">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${SAMPLE_STATUS_COLORS[sample.status] ?? 'bg-slate-100 text-slate-600'}`}>
                    {formatStatusLabel(sample.status)}
                </span>
            </td>
            <td className="px-4 py-3 text-right">
                <div className="flex justify-end gap-2">
                    <button
                        onClick={() => onVerify(sample.id)}
                        className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 transition-colors"
                    >
                        <span className="material-icons text-sm mr-1 align-middle">verified</span>Verify
                    </button>
                    <button
                        onClick={() => onReject(sample.id)}
                        className="px-3 py-1.5 border border-red-200 text-red-600 text-xs font-bold rounded-lg hover:bg-red-50 transition-colors"
                    >
                        Reject
                    </button>
                </div>
            </td>
        </tr>
    );
}
