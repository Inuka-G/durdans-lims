'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AxiosError } from 'axios';
import { getReceptionSampleDetail, type SpecimenSampleDetail } from '@/lib/api';
import { PRIORITY_COLORS, SAMPLE_STATUS_COLORS, formatStatusLabel } from '@/constants/sample-lifecycle';

function formatTs(iso?: string | null) {
    if (!iso) {
        return '—';
    }
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
        return '—';
    }
    return d.toLocaleString('en-LK', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export default function ReceptionSampleDetailPage() {
    const params = useParams();
    const sampleUuid = typeof params.sampleId === 'string' ? params.sampleId : '';

    const [detail, setDetail] = useState<SpecimenSampleDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!sampleUuid) {
            setLoading(false);
            setError('Missing sample identifier.');
            return;
        }

        let cancelled = false;

        const load = async () => {
            setLoading(true);
            setError(null);

            try {
                const data = await getReceptionSampleDetail(sampleUuid);
                if (!cancelled) {
                    setDetail(data);
                }
            } catch (err) {
                console.error('Failed to load reception sample detail', err);
                if (!cancelled) {
                    setDetail(null);
                    setError(getApiErrorMessage(err, 'Unable to load this sample. It may have been removed or you may lack access.'));
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        void load();

        return () => {
            cancelled = true;
        };
    }, [sampleUuid]);

    const isCollected = detail?.status === 'COLLECTED';
    const isRejected = detail?.status === 'REJECTED';

    return (
        <div className="max-w-3xl mx-auto">
            <div className="mb-6 flex flex-wrap items-center gap-3 justify-between">
                <Link
                    href="/reception/accessioning"
                    className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-primary transition-colors"
                >
                    <span className="material-icons text-base">chevron_left</span>
                    Back to reception worklist
                </Link>
                {detail && isCollected && (
                    <Link
                        href={`/reception/quality-verification?sampleId=${sampleUuid}`}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 transition-colors shadow-sm"
                    >
                        <span className="material-icons text-base">verified</span>
                        Verify sample
                    </Link>
                )}
            </div>

            <h1 className="text-2xl font-bold text-slate-800 mb-1">Sample details</h1>
            <p className="text-sm text-slate-500 mb-6">
                Chain-of-custody summary for specimens handled at lab reception.
            </p>

            {error && (
                <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                </div>
            )}

            {loading ? (
                <div className="bg-white rounded-2xl border border-slate-200/60 p-12 text-center">
                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-primary" />
                    <p className="mt-3 text-sm text-slate-500">Loading sample…</p>
                </div>
            ) : detail ? (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
                    <div className="p-6 border-b border-slate-100 flex flex-wrap gap-3 items-start justify-between">
                        <div>
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Barcode</p>
                            <p className="text-xl font-bold text-primary font-mono">{detail.sampleId}</p>
                            <p className="text-xs text-slate-400 mt-1">Internal ID: {detail.id}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <span
                                className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${SAMPLE_STATUS_COLORS[detail.status] ?? 'bg-slate-100 text-slate-600'}`}
                            >
                                {formatStatusLabel(detail.status)}
                            </span>
                            <span
                                className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${PRIORITY_COLORS[detail.priority as keyof typeof PRIORITY_COLORS] ?? 'bg-slate-100 text-slate-600'}`}
                            >
                                {formatStatusLabel(detail.priority)}
                            </span>
                        </div>
                    </div>

                    <div className="p-6 space-y-6">
                        <section>
                            <p className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mb-3">Patient</p>
                            <p className="font-bold text-slate-800">{detail.patient?.name ?? '—'}</p>
                            <p className="text-sm text-slate-500 mt-1">
                                {[detail.patient?.pid, detail.patient?.gender, detail.patient?.age != null ? `${detail.patient.age} yrs` : null]
                                    .filter(Boolean)
                                    .join(' · ') || '—'}
                            </p>
                        </section>

                        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Order</p>
                                <p className="text-sm font-medium text-slate-700">{detail.orderId ?? '—'}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Test</p>
                                <p className="text-sm font-medium text-slate-700">{detail.testType ?? '—'}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Collected</p>
                                <p className="text-sm font-medium text-slate-700">{formatTs(detail.collectedAt)}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Collected by</p>
                                <p className="text-sm font-medium text-slate-700">{detail.collectedBy ?? '—'}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Label prints recorded</p>
                                <p className="text-sm font-medium text-slate-700">{detail.printCount}</p>
                            </div>
                        </section>

                        {detail.tubeTypes && detail.tubeTypes.length > 0 && (
                            <section>
                                <p className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">Container</p>
                                <p className="text-sm text-slate-700">{detail.tubeTypes.join(', ')}</p>
                            </section>
                        )}

                        {isCollected && (
                            <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-600">
                                This specimen is awaiting pre-analytical verification. Use{' '}
                                <Link href={`/reception/quality-verification?sampleId=${sampleUuid}`} className="font-semibold text-primary hover:underline">
                                    Verify sample
                                </Link>{' '}
                                to complete checks before accepting or rejecting.
                                {' '}Damaged labels can be addressed from{' '}
                                <Link
                                    href={`/reception/barcode-print?query=${encodeURIComponent(detail.sampleId)}&returnTo=/reception/samples/${sampleUuid}`}
                                    className="font-semibold text-primary hover:underline"
                                >
                                    Barcode print
                                </Link>
                                .
                            </div>
                        )}

                        {isRejected && (
                            <section className="rounded-xl border border-red-200 bg-red-50/60 px-4 py-4">
                                <p className="text-[11px] font-extrabold text-red-800 uppercase tracking-wider mb-2">
                                    Rejection details
                                </p>
                                <p className="text-sm font-semibold text-slate-800">
                                    Reason:{' '}
                                    <span className="text-red-700">
                                        {detail.rejectionReason ? formatStatusLabel(detail.rejectionReason) : 'Not recorded'}
                                    </span>
                                </p>
                                {detail.rejectionNotes ? (
                                    <p className="text-sm text-slate-700 mt-2 whitespace-pre-wrap">{detail.rejectionNotes}</p>
                                ) : (
                                    <p className="text-xs text-slate-500 mt-2">No additional notes were captured.</p>
                                )}
                            </section>
                        )}
                    </div>
                </div>
            ) : !error ? (
                <p className="text-sm text-slate-500">No data.</p>
            ) : null}
        </div>
    );
}

function getApiErrorMessage(error: unknown, fallback: string) {
    if (error instanceof AxiosError) {
        const msg = error.response?.data?.message;
        if (typeof msg === 'string' && msg.trim()) {
            return msg;
        }
    }
    if (error instanceof Error && error.message.trim()) {
        return error.message;
    }
    return fallback;
}
