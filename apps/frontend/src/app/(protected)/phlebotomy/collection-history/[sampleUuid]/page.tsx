'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { PRIORITY_COLORS, formatStatusLabel } from '@/constants/sample-lifecycle';
import { getPhlebotomySampleDetail, printSampleLabel } from '@/lib/api';
import { getBarcodeBars, getTubeHexColor, openPhlebotomySpecimenLabelPrint } from '@/lib/phlebotomy-label-print';

type SampleDetail = {
    id?: string;
    sampleId?: string;
    orderId?: string | null;
    status?: string;
    priority?: string;
    testType?: string | null;
    testCodes?: string[];
    tubeTypes?: string[];
    tubeColor?: string | null;
    collectedAt?: string | null;
    collectedBy?: string | null;
    rejectionReason?: string | null;
    rejectionNotes?: string | null;
    printCount?: number;
    patient?: {
        pid?: string | null;
        name?: string | null;
        age?: number | null;
        gender?: string | null;
    };
};

function formatTs(iso?: string | null) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('en-LK', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export default function CollectionSampleDetailPage() {
    const params = useParams();
    const router = useRouter();
    const sampleUuid = typeof params.sampleUuid === 'string' ? params.sampleUuid : '';

    const [detail, setDetail] = useState<SampleDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [printing, setPrinting] = useState(false);

    const load = useCallback(async () => {
        if (!sampleUuid) return;
        try {
            setLoading(true);
            setError(null);
            const data = await getPhlebotomySampleDetail(sampleUuid);
            setDetail(data as SampleDetail);
        } catch (e) {
            console.error(e);
            setError('Unable to load this sample. It may have been removed or you may not have access.');
            setDetail(null);
        } finally {
            setLoading(false);
        }
    }, [sampleUuid]);

    useEffect(() => {
        void load();
    }, [load]);

    const handlePrintLabel = async () => {
        if (!detail?.sampleId || detail.status !== 'COLLECTED') {
            return;
        }
        try {
            setPrinting(true);
            const updated = await printSampleLabel(sampleUuid);
            const tubeCode = detail.tubeTypes?.[0] ?? 'OTHER';
            const opened = openPhlebotomySpecimenLabelPrint({
                sampleId: detail.sampleId,
                patientName: detail.patient?.name ?? '—',
                pid: detail.patient?.pid ?? '—',
                testCodes: Array.isArray(detail.testCodes) ? detail.testCodes : [],
                tubeTypeLabel: String(tubeCode),
                tubeColor: detail.tubeColor,
            });
            if (!opened) {
                toast.error('Print window was blocked. Allow pop-ups for this site and try again.');
            }
            const next = updated as SampleDetail | undefined;
            if (next && typeof next.printCount === 'number') {
                setDetail((prev) => (prev ? { ...prev, printCount: next.printCount } : prev));
            }
        } catch (e) {
            console.error(e);
            toast.error('Could not record label print. Please try again.');
        } finally {
            setPrinting(false);
        }
    };

    if (!sampleUuid) {
        return (
            <div className="text-center py-16 text-slate-500">
                <p>Missing sample reference.</p>
                <Link href="/phlebotomy/collection-history" className="text-primary font-semibold mt-2 inline-block">
                    Back to history
                </Link>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
                <span className="material-icons text-5xl text-slate-300 animate-spin">progress_activity</span>
                <p className="text-sm text-slate-400 font-medium">Loading sample…</p>
            </div>
        );
    }

    if (error || !detail) {
        return (
            <div className="max-w-lg mx-auto text-center py-16">
                <p className="text-slate-600 mb-4">{error ?? 'Sample not found.'}</p>
                <button
                    type="button"
                    onClick={() => router.push('/phlebotomy/collection-history')}
                    className="px-4 py-2 bg-primary text-white text-sm font-bold rounded-xl"
                >
                    Back to history
                </button>
            </div>
        );
    }

    const tubeCode = detail.tubeTypes?.[0] ?? 'OTHER';
    const tubeColor = getTubeHexColor(detail.tubeColor);
    const priorityKey = (detail.priority ?? 'NORMAL') as keyof typeof PRIORITY_COLORS;

    return (
        <div>
            <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
                <div>
                    <button
                        type="button"
                        onClick={() => router.push('/phlebotomy/collection-history')}
                        className="text-sm text-slate-500 hover:text-primary flex items-center gap-1 mb-2"
                    >
                        <span className="material-icons text-base">arrow_back</span>
                        Collection history
                    </button>
                    <h1 className="text-2xl font-bold text-slate-800 flex flex-wrap items-center gap-2">
                        {detail.sampleId ?? sampleUuid}
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${PRIORITY_COLORS[priorityKey] ?? PRIORITY_COLORS.NORMAL}`}>
                            {detail.priority ?? 'NORMAL'}
                        </span>
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Specimen detail — bedside labels should match container type and test panel (ISO 15189 traceability).
                    </p>
                </div>
                {detail.status === 'COLLECTED' && (
                    <button
                        type="button"
                        disabled={printing}
                        onClick={() => void handlePrintLabel()}
                        className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary/90 disabled:opacity-60"
                    >
                        <span className="material-icons text-lg">{printing ? 'hourglass_top' : 'print'}</span>
                        {printing ? 'Printing…' : 'Print specimen label'}
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <div className="lg:col-span-2 space-y-5">
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-5">
                        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Patient & order</h2>
                        <div className="grid sm:grid-cols-2 gap-4 text-sm">
                            <div>
                                <p className="text-xs text-slate-400">Patient</p>
                                <p className="font-semibold text-slate-800">{detail.patient?.name ?? '—'}</p>
                                <p className="text-slate-500 text-xs mt-0.5">{detail.patient?.pid ?? '—'}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-400">Order</p>
                                <p className="font-semibold text-slate-800">{detail.orderId ?? '—'}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-400">Demographics</p>
                                <p className="text-slate-700">
                                    {detail.patient?.age != null ? `${detail.patient.age} yrs` : '—'}
                                    {detail.patient?.gender ? ` · ${detail.patient.gender}` : ''}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-400">Status</p>
                                <span className="inline-flex px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-700">
                                    {formatStatusLabel(detail.status ?? '')}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-5">
                        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Tests & container</h2>
                        <div className="flex flex-wrap gap-2 mb-4">
                            {(detail.testCodes ?? []).map((c) => (
                                <span key={c} className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-lg font-semibold">
                                    {c}
                                </span>
                            ))}
                            {(!detail.testCodes || detail.testCodes.length === 0) && (
                                <span className="text-sm text-slate-400">No test codes linked.</span>
                            )}
                        </div>
                        <p className="text-sm text-slate-600 mb-1">
                            <span className="font-semibold text-slate-800">{detail.testType ?? '—'}</span>
                        </p>
                        <div className="flex items-center gap-2 mt-3">
                            <div className="w-4 h-10 rounded-full" style={{ backgroundColor: tubeColor }} />
                            <div>
                                <p className="text-xs text-slate-400">Required tube</p>
                                <p className="text-sm font-semibold text-slate-700">{String(tubeCode).replace(/_/g, ' ')}</p>
                            </div>
                        </div>
                    </div>

                    {detail.status === 'REJECTED' && (
                        <div className="bg-red-50 rounded-2xl border border-red-100 p-5">
                            <h2 className="text-sm font-bold text-red-800 uppercase tracking-wider mb-2">Rejection</h2>
                            <p className="text-xs text-red-700 mb-1">
                                Reason: <span className="font-semibold">{detail.rejectionReason ?? '—'}</span>
                            </p>
                            <p className="text-sm text-red-800 whitespace-pre-wrap">{detail.rejectionNotes ?? 'No notes recorded.'}</p>
                        </div>
                    )}
                </div>

                <div className="space-y-5">
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-5">
                        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Collection event</h2>
                        <dl className="space-y-3 text-sm">
                            <div>
                                <dt className="text-xs text-slate-400">Collected at</dt>
                                <dd className="font-medium text-slate-800">{formatTs(detail.collectedAt)}</dd>
                            </div>
                            <div>
                                <dt className="text-xs text-slate-400">Collected by</dt>
                                <dd className="font-medium text-slate-800">{detail.collectedBy ?? '—'}</dd>
                            </div>
                            <div>
                                <dt className="text-xs text-slate-400">Label prints recorded</dt>
                                <dd className="font-medium text-slate-800">{detail.printCount ?? 0}×</dd>
                            </div>
                        </dl>
                    </div>

                    <div className="bg-slate-50 border border-dashed border-slate-300 rounded-2xl p-4">
                        <p className="text-xs font-bold text-slate-500 uppercase mb-3">Label preview</p>
                        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
                            <div className="w-3 h-12 rounded-full" style={{ backgroundColor: tubeColor }} />
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-slate-800 truncate">{detail.sampleId}</p>
                                <p className="text-[10px] text-slate-500 truncate">{detail.patient?.name}</p>
                                <div className="flex gap-1 mt-1 flex-wrap">
                                    {(detail.testCodes ?? []).slice(0, 4).map((c) => (
                                        <span key={c} className="text-[9px] bg-slate-100 px-1 py-0.5 rounded">
                                            {c}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <div className="flex gap-[1px] shrink-0">
                                {getBarcodeBars(detail.sampleId ?? '', 18).map((width, i) => (
                                    <div key={i} className="bg-slate-800 rounded-[0.5px]" style={{ width, height: 26 }} />
                                ))}
                            </div>
                        </div>
                        {detail.status !== 'COLLECTED' && (
                            <p className="text-[11px] text-amber-700 mt-3">
                                Labels are only issued for collected specimens. Rejected tubes follow your laboratory&apos;s discard / documentation SOP.
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
