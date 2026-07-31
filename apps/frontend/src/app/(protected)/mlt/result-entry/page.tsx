'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AxiosError } from 'axios';
import {
    getMltAllWorklist,
    getMltSampleResultActivity,
    getSampleResults,
    saveDraftResults,
    submitResults,
    type MltAllWorklistItem,
    type MltResultActivityItem,
    type ResultParameter,
    type SampleResults,
    type SubmitResultsRequest,
} from '@/lib/api';
import { formatStatusLabel } from '@/constants/sample-lifecycle';

const FLAG_STYLES: Record<string, string> = {
    NORMAL: 'bg-slate-100 text-slate-600',
    LOW: 'bg-amber-100 text-amber-700',
    HIGH: 'bg-amber-100 text-amber-700',
    CRITICAL_HIGH: 'bg-red-600 text-white',
    CRITICAL_LOW: 'bg-red-600 text-white',
};

const FLAG_LABELS: Record<string, string> = {
    NORMAL: 'NORMAL',
    LOW: 'LOW',
    HIGH: 'HIGH',
    CRITICAL_HIGH: 'CRITICAL HIGH',
    CRITICAL_LOW: 'CRITICAL LOW',
};

/** Typical LIS delta-check warning when change vs prior authoritative result exceeds this percent. */
const DELTA_CHECK_THRESHOLD_PCT = 40;

type EditableParameter = ResultParameter & {
    result: string;
    flag: string;
};

type DisplayResultFlag = 'NORMAL' | 'LOW' | 'HIGH' | 'CRITICAL_HIGH' | 'CRITICAL_LOW';

type MainTab = 'entry' | 'details' | 'history';

const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function ResultEntryPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const sampleId = searchParams.get('sampleId');
    const tabParam = searchParams.get('tab');

    const [sample, setSample] = useState<SampleResults | null>(null);
    const [parameters, setParameters] = useState<EditableParameter[]>([]);
    const [mltNotes, setMltNotes] = useState('');
    const [loading, setLoading] = useState(true);
    const [pickerLoading, setPickerLoading] = useState(false);
    const [pickerRows, setPickerRows] = useState<MltAllWorklistItem[]>([]);
    const [pickerQuery, setPickerQuery] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [savingDraft, setSavingDraft] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [mainTab, setMainTab] = useState<MainTab>(tabParam === 'history' ? 'history' : 'entry');
    const [activity, setActivity] = useState<MltResultActivityItem[]>([]);
    const [activityLoading, setActivityLoading] = useState(false);

    const isReadOnly = sample ? sample.status !== 'ACCEPTED' && sample.status !== 'IN_TESTING' : false;
    const readOnlyMessage =
        sample?.status === 'SENT_FOR_VERIFICATION'
            ? 'This sample is already submitted for supervisor verification. It becomes editable again only if returned for recheck.'
            : 'This historical sample is read-only. Use the activity tab to review previous result activity.';

    useEffect(() => {
        if (tabParam === 'history' || tabParam === 'details' || tabParam === 'entry') {
            setMainTab(tabParam);
        }
    }, [tabParam]);

    const loadActivity = useCallback(async (id: string) => {
        setActivityLoading(true);
        try {
            const rows = await getMltSampleResultActivity(id);
            setActivity(rows);
        } catch (err) {
            console.warn('Failed to load MLT activity', err);
            setActivity([]);
        } finally {
            setActivityLoading(false);
        }
    }, []);

    const loadSample = useCallback(async () => {
        if (!sampleId) {
            setLoading(false);
            setError(null);
            setSample(null);
            return;
        }

        if (!UUID_PATTERN.test(sampleId)) {
            setLoading(false);
            setError('Invalid sample reference. Use a specimen UUID from the worklist.');
            setSample(null);
            return;
        }

        setLoading(true);
        setError(null);
        setSuccessMessage(null);

        try {
            const data = await getSampleResults(sampleId);
            setSample(data);
            setParameters(
                data.results.map((parameter) => ({
                    ...parameter,
                    result: parameter.result ?? '',
                    flag: resolveInitialFlag(parameter),
                }))
            );
            setMltNotes(data.mltNotes ?? '');
            void loadActivity(sampleId);
        } catch (err) {
            console.warn('Failed to load sample results', err);
            setError(getApiErrorMessage(err, 'Failed to load sample result details. Please try again.'));
            setSample(null);
        } finally {
            setLoading(false);
        }
    }, [sampleId, loadActivity]);

    useEffect(() => {
        void loadSample();
    }, [loadSample]);

    useEffect(() => {
        if (sampleId) {
            return;
        }
        let cancelled = false;
        setPickerLoading(true);
        void getMltAllWorklist()
            .then((rows) => {
                if (!cancelled) {
                    setPickerRows(rows);
                }
            })
            .catch((err) => {
                console.warn('Failed to load samples for picker', err);
                if (!cancelled) {
                    setPickerRows([]);
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setPickerLoading(false);
                }
            });
        return () => {
            cancelled = true;
        };
    }, [sampleId]);

    const filteredPickerRows = useMemo(() => {
        const q = pickerQuery.trim().toLowerCase();
        if (!q) {
            return pickerRows;
        }
        return pickerRows.filter(
            (row) =>
                row.barcode.toLowerCase().includes(q) ||
                row.patientName.toLowerCase().includes(q) ||
                row.testName.toLowerCase().includes(q) ||
                row.orderId.toLowerCase().includes(q) ||
                row.patientId.toLowerCase().includes(q)
        );
    }, [pickerRows, pickerQuery]);

    const handleResultChange = (parameterId: string, value: string) => {
        setParameters((current) =>
            current.map((parameter) =>
                parameter.parameterId === parameterId
                    ? { ...parameter, result: value, flag: resolveFlagForValue(parameter, value) ?? '' }
                    : parameter
            )
        );
    };

    const enteredParameters = useMemo(
        () => parameters.filter((parameter) => parameter.result.trim().length > 0),
        [parameters]
    );

    const hasCritical = useMemo(
        () => parameters.some((parameter) => getDisplayFlag(parameter)?.startsWith('CRITICAL')),
        [parameters]
    );

    const hasDeltaAlert = useMemo(
        () =>
            parameters.some((parameter) => {
                const prev = parameter.previousValue?.result;
                if (!prev || !parameter.result.trim()) {
                    return false;
                }
                const delta = computeDeltaPercent(prev, parameter.result);
                return delta !== null && Math.abs(delta) >= DELTA_CHECK_THRESHOLD_PCT;
            }),
        [parameters]
    );

    const buildPayload = (useAllParameters: boolean): SubmitResultsRequest | null => {
        if (!sample) {
            return null;
        }

        const source = useAllParameters ? parameters : enteredParameters;

        if (source.length === 0) {
            return null;
        }

        return {
            sampleId: sample.sampleId,
            results: source.map((parameter) => ({
                parameterId: parameter.parameterId,
                result: parameter.result.trim(),
            })),
            mltNotes: mltNotes.trim() || undefined,
        };
    };

    const handleSaveDraft = async () => {
        if (!sampleId) {
            setError('Select a specimen before saving.');
            return;
        }

        if (isReadOnly) {
            setError(readOnlyMessage);
            return;
        }

        const payload = buildPayload(false);
        if (!payload) {
            setError('Enter at least one result before saving a draft.');
            return;
        }

        setSavingDraft(true);
        setError(null);
        setSuccessMessage(null);

        try {
            await saveDraftResults(sampleId, payload);
            setSuccessMessage('Draft saved successfully.');
            await loadSample();
            if (sampleId) {
                await loadActivity(sampleId);
            }
        } catch (err) {
            console.warn('Failed to save draft results', err);
            setError(getApiErrorMessage(err, 'Failed to save draft results. Please try again.'));
        } finally {
            setSavingDraft(false);
        }
    };

    const handleSubmit = async () => {
        if (!sampleId) {
            setError('Select a specimen before submitting.');
            return;
        }

        if (isReadOnly) {
            setError(readOnlyMessage);
            return;
        }

        const hasMissingResults = parameters.some((parameter) => parameter.result.trim().length === 0);
        if (hasMissingResults) {
            setError('Enter all required parameter results before submitting.');
            return;
        }

        const payload = buildPayload(true);
        if (!payload) {
            setError('No results are available to submit.');
            return;
        }

        setSubmitting(true);
        setError(null);
        setSuccessMessage(null);

        try {
            await submitResults(sampleId, payload);
            setSuccessMessage('Results submitted for verification successfully.');
            await loadSample();
            if (sampleId) {
                await loadActivity(sampleId);
            }
        } catch (err) {
            console.warn('Failed to submit results', err);
            setError(getApiErrorMessage(err, 'Failed to submit results. Please try again.'));
        } finally {
            setSubmitting(false);
        }
    };

    if (loading && sampleId) {
        return (
            <div className="flex items-center justify-center min-h-[calc(100vh-64px)] -m-8 bg-slate-50/50">
                <div className="text-center">
                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-primary" />
                    <p className="mt-3 text-sm text-slate-500">Loading result entry details...</p>
                </div>
            </div>
        );
    }

    if (!sampleId) {
        return (
            <div className="min-h-[calc(100vh-64px)] -m-8 bg-slate-50/50 p-6">
                <div className="max-w-5xl mx-auto">
                    <div className="mb-6">
                        <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">MLT / Result entry</p>
                        <h1 className="text-2xl font-bold text-slate-800 mt-0.5">Select a specimen</h1>
                        <p className="text-sm text-slate-500 mt-1">
                            Choose a sample below or open one from the{' '}
                            <Link href="/mlt/worklist" className="text-primary font-semibold hover:underline">
                                sample worklist
                            </Link>
                            . Industry LIS workflows typically open result entry from the active worklist so context
                            (priority, stability, repeats) travels with the specimen.
                        </p>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-5 mb-6">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                            Search barcode, patient, test, or order
                        </label>
                        <input
                            type="search"
                            value={pickerQuery}
                            onChange={(e) => setPickerQuery(e.target.value)}
                            placeholder="Filter..."
                            className="w-full max-w-md px-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="text-sm font-bold text-slate-700">All MLT worklist samples</h3>
                            {pickerLoading && (
                                <span className="text-xs text-slate-400 animate-pulse">Loading...</span>
                            )}
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                                        <th className="px-5 py-3 border-b border-slate-100">Barcode</th>
                                        <th className="px-4 py-3 border-b border-slate-100">Patient</th>
                                        <th className="px-4 py-3 border-b border-slate-100">Test</th>
                                        <th className="px-4 py-3 border-b border-slate-100">Priority</th>
                                        <th className="px-4 py-3 border-b border-slate-100">Status</th>
                                        <th className="px-4 py-3 border-b border-slate-100 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {!pickerLoading && filteredPickerRows.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="px-5 py-12 text-center text-slate-500">
                                                No samples match your filter.
                                            </td>
                                        </tr>
                                    )}
                                    {filteredPickerRows.map((row) => (
                                        <tr key={row.sampleId} className="border-b border-slate-50 hover:bg-slate-50/40">
                                            <td className="px-5 py-3 font-semibold text-primary">{row.barcode}</td>
                                            <td className="px-4 py-3 text-slate-700">{row.patientName}</td>
                                            <td className="px-4 py-3 text-slate-600">{row.testName}</td>
                                            <td className="px-4 py-3 text-xs font-bold text-slate-500">{row.priority}</td>
                                            <td className="px-4 py-3 text-xs font-semibold text-slate-500">
                                                {formatStatusLabel(row.status)}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        router.push(`/mlt/result-entry?sampleId=${row.sampleId}`)
                                                    }
                                                    className="px-3 py-1.5 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary/90 transition-colors"
                                                >
                                                    Open
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (!sample) {
        return (
            <div className="flex items-center justify-center min-h-[calc(100vh-64px)] -m-8 bg-slate-50/50">
                <div className="rounded-2xl border border-slate-200 bg-white px-8 py-10 text-center shadow-sm max-w-md">
                    <p className="text-base font-semibold text-slate-800">Result entry unavailable</p>
                    <p className="text-sm text-slate-500 mt-2">{error ?? 'Sample details could not be loaded.'}</p>
                    <Link
                        href="/mlt/worklist"
                        className="inline-flex items-center gap-1 mt-5 text-sm font-semibold text-primary hover:underline"
                    >
                        <span className="material-icons text-sm">chevron_left</span>
                        Back to Worklist
                    </Link>
                    <button
                        type="button"
                        onClick={() => router.push('/mlt/result-entry')}
                        className="block mx-auto mt-4 text-sm font-semibold text-slate-600 hover:text-primary"
                    >
                        Choose another specimen
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex gap-0 min-h-[calc(100vh-64px)] -m-8">
            <div className="w-[260px] flex-shrink-0 bg-white border-r border-slate-200/80 flex flex-col">
                <div className="p-4 flex-1 overflow-y-auto">
                    <Link
                        href="/mlt/worklist"
                        className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-primary transition-colors mb-4"
                    >
                        <span className="material-icons text-sm">chevron_left</span>
                        Worklist
                    </Link>

                    <button
                        type="button"
                        onClick={() => router.push('/mlt/result-entry')}
                        className="block text-xs font-semibold text-slate-500 hover:text-primary mb-4"
                    >
                        Change specimen
                    </button>

                    {(hasCritical || hasDeltaAlert) && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 mb-5 space-y-2">
                            <div className="flex items-start gap-2">
                                <span className="material-icons text-amber-600 text-base mt-0.5">warning</span>
                                <div className="text-[11px] text-amber-800 font-semibold leading-snug space-y-1">
                                    {hasCritical && <p>Critical result detected - confirm result before submission.</p>}
                                    {hasDeltaAlert && (
                                        <p>
                                            Delta-check: one or more analytes changed ≥ {DELTA_CHECK_THRESHOLD_PCT}% vs
                                            prior authoritative result — confirm before releasing.
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="bg-primary rounded-xl px-3 py-2 mb-4">
                        <p className="text-[10px] font-bold text-white/70 uppercase tracking-wider">Patient</p>
                    </div>

                    <div className="space-y-3.5 text-[11px]">
                        <div>
                            <p className="font-bold text-slate-400 uppercase tracking-wider">Patient Name</p>
                            <p className="font-semibold text-slate-700 mt-0.5">{sample.patientName}</p>
                        </div>
                        <div>
                            <p className="font-bold text-slate-400 uppercase tracking-wider">Patient ID</p>
                            <p className="font-semibold text-slate-700 mt-0.5">{sample.patientId}</p>
                        </div>
                        <div>
                            <p className="font-bold text-slate-400 uppercase tracking-wider">Status</p>
                            <p className="font-semibold text-slate-700 mt-0.5">{formatStatusLabel(sample.status)}</p>
                        </div>
                        <div>
                            <p className="font-bold text-slate-400 uppercase tracking-wider">Order</p>
                            <p className="font-semibold text-slate-700 mt-0.5">{sample.orderNo ?? sample.orderId}</p>
                        </div>
                    </div>

                    <div className="mt-5">
                        <div className="bg-primary rounded-xl px-3 py-2 mb-3">
                            <p className="text-[10px] font-bold text-white/70 uppercase tracking-wider">Specimen</p>
                        </div>
                        <div className="space-y-3.5 text-[11px]">
                            <div>
                                <p className="font-bold text-slate-400 uppercase tracking-wider">Barcode</p>
                                <p className="font-semibold text-primary mt-0.5">{sample.barcode}</p>
                            </div>
                            <div>
                                <p className="font-bold text-slate-400 uppercase tracking-wider">Test</p>
                                <p className="font-semibold text-slate-700 mt-0.5">{sample.testName}</p>
                            </div>
                            <div>
                                <p className="font-bold text-slate-400 uppercase tracking-wider">Tube / Priority</p>
                                <p className="font-semibold text-slate-700 mt-0.5">
                                    {[sample.tubeType, sample.priority].filter(Boolean).join(' · ') || '—'}
                                </p>
                            </div>
                            <div>
                                <p className="font-bold text-slate-400 uppercase tracking-wider">Collected</p>
                                <p className="font-semibold text-slate-700 mt-0.5">
                                    {formatCollected(sample.collectedAt, sample.collectedBy)}
                                </p>
                            </div>
                            <div>
                                <p className="font-bold text-slate-400 uppercase tracking-wider">Progress</p>
                                <p className="font-semibold text-slate-700 mt-0.5">
                                    {enteredParameters.length} / {parameters.length} parameters
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-1 min-w-0 bg-slate-50/50 flex flex-col">
                <div className="border-b border-slate-200/80 bg-white px-6 py-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-bold text-slate-800">Result entry</h1>
                        <p className="text-sm text-slate-400 mt-0.5">
                            {sample.barcode} · {sample.testName}
                        </p>
                    </div>
                    <nav className="flex rounded-xl bg-slate-100 p-1 gap-1">
                        {(
                            [
                                ['entry', 'Results'],
                                ['details', 'Specimen & order'],
                                ['history', 'Activity'],
                            ] as const
                        ).map(([id, label]) => (
                            <button
                                key={id}
                                type="button"
                                onClick={() => setMainTab(id)}
                                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                                    mainTab === id ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </nav>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {mainTab === 'details' && (
                        <div className="max-w-3xl space-y-5">
                            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
                                <h3 className="text-sm font-extrabold text-slate-700 uppercase tracking-wider mb-4">
                                    Order & identifiers
                                </h3>
                                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                                    <DetailRow label="Order number" value={sample.orderNo ?? sample.orderId} />
                                    <DetailRow label="Order UUID" value={sample.orderId} />
                                    <DetailRow label="Patient ID" value={sample.patientId} />
                                    <DetailRow label="Sample UUID" value={sample.sampleId} />
                                </dl>
                            </div>
                            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
                                <h3 className="text-sm font-extrabold text-slate-700 uppercase tracking-wider mb-4">
                                    Specimen handling context
                                </h3>
                                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                                    <DetailRow label="Barcode" value={sample.barcode} />
                                    <DetailRow label="Tube type" value={sample.tubeType ?? '—'} />
                                    <DetailRow label="Clinical priority" value={sample.priority ?? '—'} />
                                    <DetailRow
                                        label="Collection"
                                        value={formatCollected(sample.collectedAt, sample.collectedBy)}
                                    />
                                </dl>
                                <p className="text-xs text-slate-400 mt-4 leading-relaxed">
                                    Pre-analytical data supports correct processing (e.g., additive compatibility,
                                    centrifugation rules). Final validation remains with pathologist / authorised
                                    verifier per your policy.
                                </p>
                            </div>
                        </div>
                    )}

                    {mainTab === 'history' && (
                        <div className="max-w-4xl">
                            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
                                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                                    <h3 className="text-sm font-extrabold text-slate-700 uppercase tracking-wider">
                                        Result entry audit trail
                                    </h3>
                                    {activityLoading && (
                                        <span className="text-xs text-slate-400">Loading activity…</span>
                                    )}
                                </div>
                                <ul className="divide-y divide-slate-50">
                                    {!activityLoading && activity.length === 0 && (
                                        <li className="px-6 py-10 text-sm text-slate-500 text-center">
                                            No recorded saves yet for this specimen. Draft and final submissions create
                                            immutable audit rows for accreditation traceability.
                                        </li>
                                    )}
                                    {activity.map((item) => (
                                        <li key={item.id} className="px-6 py-4 hover:bg-slate-50/40">
                                            <div className="flex flex-wrap justify-between gap-2">
                                                <p className="text-sm font-bold text-slate-800">
                                                    {formatActivityAction(item.action)}
                                                </p>
                                                <p className="text-xs text-slate-400">{formatTs(item.timestamp)}</p>
                                            </div>
                                            <p className="text-xs text-slate-500 mt-1">By {item.performedBy}</p>
                                            {item.details && (
                                                <pre className="mt-3 text-[11px] bg-slate-50 rounded-xl p-3 overflow-x-auto text-slate-600 whitespace-pre-wrap font-mono border border-slate-100">
                                                    {formatActivityDetails(item.details)}
                                                </pre>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    )}

                    {mainTab === 'entry' && (
                        <>
                            <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
                                <div />
                                <button
                                    type="button"
                                    onClick={() => void handleSaveDraft()}
                                    disabled={savingDraft || submitting || isReadOnly}
                                    className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 text-slate-600 text-sm font-semibold rounded-xl hover:bg-white bg-white/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                                >
                                    <span className="material-icons text-base">save</span>
                                    {savingDraft ? 'Saving...' : 'Save Draft'}
                                </button>
                            </div>

                            {error && (
                                <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                    {error}
                                </div>
                            )}

                            {isReadOnly && (
                                <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                                    {readOnlyMessage}
                                </div>
                            )}

                            {successMessage && (
                                <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                                    {successMessage}
                                </div>
                            )}

                            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 mb-5 overflow-hidden">
                                <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-100">
                                    <h3 className="text-sm font-extrabold text-slate-700 uppercase tracking-wider">
                                        {sample.testName}
                                    </h3>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                        {parameters.length} analytes · delta-check vs prior verified/dispatched results
                                    </span>
                                </div>

                                <div className="overflow-x-auto">
                                    <div className="min-w-[920px] grid grid-cols-[minmax(140px,1fr)_minmax(100px,0.9fr)_72px_minmax(72px,0.7fr)_56px_minmax(110px,1fr)_minmax(124px,0.9fr)] px-6 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-50 bg-slate-50/40 gap-2">
                                        <span>Parameter</span>
                                        <span className="text-center">Previous</span>
                                        <span className="text-center">Δ %</span>
                                        <span className="text-center">Result</span>
                                        <span className="text-center">Unit</span>
                                        <span className="text-center">Reference</span>
                                        <span className="text-center">Flag</span>
                                    </div>

                                    {parameters.map((parameter) => {
                                        const displayFlag = getDisplayFlag(parameter);
                                        const isCritical = displayFlag?.startsWith('CRITICAL');
                                        const isAbnormal = displayFlag && displayFlag !== 'NORMAL';
                                        const flagClass = displayFlag
                                            ? FLAG_STYLES[displayFlag] ?? 'bg-slate-100 text-slate-600'
                                            : 'bg-slate-100 text-slate-600';
                                        const flagLabel = displayFlag
                                            ? FLAG_LABELS[displayFlag] ?? displayFlag
                                            : '—';
                                        const prevVal = parameter.previousValue?.result;
                                        const delta = computeDeltaPercent(prevVal ?? '', parameter.result);
                                        const deltaWarn =
                                            delta !== null &&
                                            prevVal &&
                                            parameter.result.trim() &&
                                            Math.abs(delta) >= DELTA_CHECK_THRESHOLD_PCT;

                                        return (
                                            <div
                                                key={parameter.parameterId}
                                                className={`min-w-[920px] grid grid-cols-[minmax(140px,1fr)_minmax(100px,0.9fr)_72px_minmax(72px,0.7fr)_56px_minmax(110px,1fr)_minmax(124px,0.9fr)] items-center px-6 py-3.5 border-b border-slate-50 last:border-0 gap-2 transition-colors ${
                                                    isCritical
                                                        ? 'bg-red-50/40'
                                                        : deltaWarn
                                                          ? 'bg-amber-50/35'
                                                          : 'hover:bg-slate-50/50'
                                                }`}
                                            >
                                                <span className="text-sm font-semibold text-slate-700">
                                                    {parameter.parameterName}
                                                </span>
                                                <span className="text-xs text-slate-500 text-center font-mono">
                                                    {prevVal ?? '—'}
                                                </span>
                                                <span
                                                    className={`text-xs font-bold text-center ${deltaWarn ? 'text-amber-700' : 'text-slate-400'}`}
                                                >
                                                    {delta !== null ? `${delta > 0 ? '+' : ''}${delta.toFixed(0)}%` : '—'}
                                                </span>
                                                <div className="flex justify-center">
                                                    <input
                                                        type="text"
                                                        value={parameter.result}
                                                        onChange={(event) =>
                                                            handleResultChange(
                                                                parameter.parameterId,
                                                                event.target.value
                                                            )
                                                        }
                                                        disabled={isReadOnly}
                                                        className={`w-full max-w-[72px] px-2 py-1.5 text-sm font-bold text-center border rounded-lg focus:outline-none focus:ring-2 transition-all ${
                                                            isCritical
                                                                ? 'border-red-300 bg-red-50 text-red-700 focus:ring-red-200'
                                                                : isAbnormal
                                                                  ? 'border-amber-200 bg-amber-50/50 text-amber-700 focus:ring-amber-200'
                                                                  : 'border-slate-200 bg-white text-slate-800 focus:ring-primary/20'
                                                        } disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500`}
                                                    />
                                                </div>
                                                <span className="text-xs text-slate-400 text-center">
                                                    {parameter.unit || '—'}
                                                </span>
                                                <span
                                                    className={`text-xs text-center ${isAbnormal ? 'text-primary font-semibold' : 'text-slate-400'}`}
                                                >
                                                    {formatReferenceRange(parameter)}
                                                </span>
                                                <div className="flex justify-center">
                                                    <span
                                                        title={displayFlag ? 'Automatically calculated from reference range' : 'Enter a result to calculate the flag'}
                                                        className={`inline-flex min-w-[86px] items-center justify-center rounded-lg px-2 py-1 text-[10px] font-bold tracking-wide ${flagClass}`}
                                                    >
                                                        {displayFlag ? flagLabel : 'NO FLAG'}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-5">
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                                    MLT notes
                                </label>
                                <textarea
                                    rows={4}
                                    value={mltNotes}
                                    onChange={(event) => setMltNotes(event.target.value)}
                                    disabled={isReadOnly}
                                    placeholder="Technical comments (hemolysis, instrument flags, repeat patterns, etc.)"
                                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none transition-all disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                                />
                            </div>

                            <div className="flex justify-end gap-3 mt-5">
                                <button
                                    type="button"
                                    onClick={() => void handleSubmit()}
                                    disabled={submitting || savingDraft || isReadOnly}
                                    className="flex items-center gap-1.5 px-5 py-2.5 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <span className="material-icons text-sm">send</span>
                                    {submitting ? 'Submitting...' : 'Submit for verification'}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

function DetailRow({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <dt className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{label}</dt>
            <dd className="text-sm font-semibold text-slate-800 mt-1 break-all">{value}</dd>
        </div>
    );
}

function formatCollected(collectedAt?: string | null, collectedBy?: string | null) {
    if (!collectedAt && !collectedBy) {
        return '—';
    }
    const parts = [collectedAt ? formatTs(collectedAt) : null, collectedBy ? `by ${collectedBy}` : null].filter(
        Boolean
    );
    return parts.join(' · ');
}

function formatTs(iso: string) {
    try {
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) {
            return iso;
        }
        return d.toLocaleString(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short',
        });
    } catch {
        return iso;
    }
}

function formatActivityAction(action: string) {
    switch (action) {
        case 'MLT_RESULTS_DRAFT_SAVED':
            return 'Draft saved';
        case 'MLT_RESULTS_SUBMITTED':
            return 'Submitted for verification';
        default:
            return action.replace(/_/g, ' ');
    }
}

function formatActivityDetails(details: string) {
    try {
        const parsed = JSON.parse(details) as unknown;
        return JSON.stringify(parsed, null, 2);
    } catch {
        return details;
    }
}

function formatReferenceRange(parameter: ResultParameter) {
    const low = parameter.refLow ?? null;
    const high = parameter.refHigh ?? null;

    if (low === null && high === null) {
        return '—';
    }

    if (low !== null && high !== null) {
        return `${low} – ${high}`;
    }

    if (low !== null) {
        return `≥ ${low}`;
    }

    return `≤ ${high}`;
}

function getDisplayFlag(parameter: EditableParameter): DisplayResultFlag | null {
    if (!parameter.result?.trim()) {
        return null;
    }

    const calculatedFlag = resolveFlagForValue(parameter, parameter.result);
    if (calculatedFlag) {
        return calculatedFlag;
    }

    const backendFlag = parameter.flag as DisplayResultFlag | null;
    if (isDisplayResultFlag(backendFlag)) {
        return backendFlag;
    }

    return null;
}

function resolveInitialFlag(parameter: ResultParameter) {
    return resolveFlagForValue(parameter, parameter.result ?? '') ?? (isDisplayResultFlag(parameter.flag) ? parameter.flag : '');
}

function resolveFlagForValue(parameter: ResultParameter, value: string) {
    if (!value.trim()) {
        return null;
    }

    const numericResult = parseNumericValue(value);
    if (numericResult !== null) {
        const refLow = parameter.refLow ?? null;
        const refHigh = parameter.refHigh ?? null;

        if (refLow !== null && numericResult < Number(refLow)) {
            if (numericResult < Number(refLow) * 0.7) {
                return 'CRITICAL_LOW';
            }

            return 'LOW';
        }

        if (refHigh !== null && numericResult > Number(refHigh)) {
            if (numericResult > Number(refHigh) * 1.3) {
                return 'CRITICAL_HIGH';
            }

            return 'HIGH';
        }

        if (refLow !== null || refHigh !== null) {
            return 'NORMAL';
        }
    }

    return isDisplayResultFlag(parameter.flag) ? parameter.flag : null;
}

function isDisplayResultFlag(flag: string | null | undefined): flag is DisplayResultFlag {
    return flag === 'NORMAL' || flag === 'LOW' || flag === 'HIGH' || flag === 'CRITICAL_HIGH' || flag === 'CRITICAL_LOW';
}

function computeDeltaPercent(previousRaw: string, currentRaw: string): number | null {
    const prev = parseNumericValue(previousRaw);
    const curr = parseNumericValue(currentRaw);
    if (prev === null || curr === null || prev === 0) {
        return null;
    }
    return ((curr - prev) / Math.abs(prev)) * 100;
}

function parseNumericValue(value: string | null | undefined) {
    if (!value?.trim()) {
        return null;
    }

    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
}

function getApiErrorMessage(error: unknown, fallbackMessage: string) {
    if (error instanceof AxiosError) {
        const responseMessage = error.response?.data?.message;

        if (typeof responseMessage === 'string' && responseMessage.trim()) {
            return responseMessage;
        }
    }

    if (error instanceof Error && error.message.trim()) {
        return error.message;
    }

    return fallbackMessage;
}
