'use client';

import { ResultEntryData } from '@/mock/result-entry.mock';

interface ResultSampleSidebarProps {
    sample: ResultEntryData;
}

export default function ResultSampleSidebar({ sample }: ResultSampleSidebarProps) {
    const initials = sample.patientName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();

    return (
        <div className="w-[220px] flex-shrink-0 bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4 space-y-4">
            {/* Urgent Alert */}
            {sample.isUrgent && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                    <div className="flex items-start gap-2">
                        <span className="material-icons text-amber-600 text-base mt-0.5">warning</span>
                        <p className="text-[11px] text-amber-700 font-semibold leading-snug">{sample.urgentNote}</p>
                    </div>
                </div>
            )}

            {/* Patient Header */}
            <div className="bg-primary rounded-xl px-3 py-2">
                <p className="text-[10px] font-bold text-white/70 uppercase tracking-wider">Patient Information</p>
            </div>

            <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-400 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                    {initials}
                </div>
                <div>
                    <p className="text-sm font-bold text-slate-800">{sample.patientName}</p>
                    <p className="text-[11px] text-slate-400">{sample.patientAge}Y • {sample.patientGender}</p>
                </div>
            </div>

            <div className="space-y-3 text-[11px]">
                {[
                    { label: 'Patient ID', value: sample.patientPid },
                    { label: 'Ward/Room',  value: sample.wardRoom || '—' },
                    { label: 'Collection', value: sample.collectionTime },
                ].map(({ label, value }) => (
                    <div key={label}>
                        <p className="font-bold text-slate-400 uppercase tracking-wider">{label}</p>
                        <p className="font-semibold text-slate-700 mt-0.5">{value}</p>
                    </div>
                ))}
            </div>

            {/* Sample Details */}
            <div className="bg-primary rounded-xl px-3 py-2">
                <p className="text-[10px] font-bold text-white/70 uppercase tracking-wider">Sample Details</p>
            </div>
            <div className="text-[11px] space-y-1">
                <p className="font-bold text-slate-400 uppercase tracking-wider">Sample ID</p>
                <p className="font-semibold text-primary">{sample.sampleId}</p>
                <div className="mt-2 space-y-1">
                    {sample.testType.split('|').map((t) => (
                        <p key={t.trim()} className="text-[11px] font-bold text-primary">{t.trim()}</p>
                    ))}
                </div>
            </div>
        </div>
    );
}
