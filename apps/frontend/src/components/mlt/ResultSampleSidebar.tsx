'use client';

import { useId } from 'react';
import { TriangleAlert } from 'lucide-react';
import { ResultEntryData } from '@/mock/result-entry.mock';

interface ResultSampleSidebarProps {
    sample: ResultEntryData;
}

// Layout contract: below `lg` the aside is full-width, so the parent wrapper
// must stack it in a column, e.g. `flex flex-col gap-4 lg:flex-row`.
export default function ResultSampleSidebar({ sample }: ResultSampleSidebarProps) {
    const baseId = useId();
    const initials = sample.patientName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();

    const patientFacts = [
        { label: 'Patient ID', value: sample.patientPid },
        { label: 'Ward / room', value: sample.wardRoom || '—' },
        { label: 'Collection', value: sample.collectionTime },
    ];

    return (
        <aside
            aria-label="Sample context"
            className="w-full space-y-4 rounded-lg border border-edge bg-surface p-4 lg:w-[220px] lg:shrink-0"
        >
            {sample.isUrgent && (
                <div
                    role="note"
                    className="flex items-start gap-2 rounded-md border border-status-pending-edge bg-status-pending-bg px-3 py-2.5"
                >
                    <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-status-pending-fg" aria-hidden="true" />
                    <p className="text-xs font-medium leading-snug text-status-pending-fg">{sample.urgentNote}</p>
                </div>
            )}

            <section aria-labelledby={`${baseId}-patient`} className="space-y-3">
                <h3 id={`${baseId}-patient`} className="border-b border-edge pb-1.5 text-xs font-semibold text-fg-muted">
                    Patient information
                </h3>

                <div className="flex items-center gap-2.5">
                    <div
                        aria-hidden="true"
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary-strong"
                    >
                        {initials}
                    </div>
                    <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-fg" title={sample.patientName}>{sample.patientName}</p>
                        <p className="text-xs text-fg-muted">{sample.patientAge}Y · {sample.patientGender}</p>
                    </div>
                </div>

                <dl className="space-y-2.5 text-xs">
                    {patientFacts.map(({ label, value }) => (
                        <div key={label}>
                            <dt className="text-fg-muted">{label}</dt>
                            <dd className="mt-0.5 font-medium text-fg">{value}</dd>
                        </div>
                    ))}
                </dl>
            </section>

            <section aria-labelledby={`${baseId}-sample`} className="space-y-3">
                <h3 id={`${baseId}-sample`} className="border-b border-edge pb-1.5 text-xs font-semibold text-fg-muted">
                    Sample details
                </h3>
                <dl className="space-y-2.5 text-xs">
                    <div>
                        <dt className="text-fg-muted">Sample ID</dt>
                        <dd className="mt-0.5 font-mono font-medium tabular-nums text-primary-strong">{sample.sampleId}</dd>
                    </div>
                    <div>
                        <dt className="text-fg-muted">Tests</dt>
                        <dd className="mt-0.5 space-y-0.5">
                            {sample.testType.split('|').map((t) => (
                                <p key={t.trim()} className="font-medium text-fg">{t.trim()}</p>
                            ))}
                        </dd>
                    </div>
                </dl>
            </section>
        </aside>
    );
}
