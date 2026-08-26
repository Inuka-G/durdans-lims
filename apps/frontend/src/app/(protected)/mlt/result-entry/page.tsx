'use client';

import { Suspense, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AxiosError } from 'axios';
import {
    AlertTriangle,
    ArrowLeftRight,
    ChevronLeft,
    FlaskConical,
    History,
    Save,
    Search,
    Send,
} from 'lucide-react';
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
    getInstrumentRegistry,
    type InstrumentOption,
    type SubmitResultsRequest,
} from '@/lib/api';
import { cn } from '@/lib/utils';
import Button from '@/components/ui/Button';
import PageHeader from '@/components/ui/PageHeader';
import SectionCard from '@/components/ui/SectionCard';
import EmptyState from '@/components/ui/EmptyState';
import SegmentedControl, { type SegmentOption } from '@/components/ui/SegmentedControl';
import StatusChip, { type ChipTone } from '@/components/ui/StatusChip';
import { CONTROL_CLASS, FormSection, InputField, SelectField } from '@/components/ui/Field';
import StatusBadge from '@/components/shared/StatusBadge';
import PriorityBadge from '@/components/shared/PriorityBadge';
import { formatAuditTime, formatRegistered } from '@/components/patient-dashboard/dashboard-data';

const FLAG_TONES: Record<string, ChipTone> = {
    NORMAL: 'neutral',
    LOW: 'pending',
    HIGH: 'pending',
    CRITICAL_HIGH: 'danger',
    CRITICAL_LOW: 'danger',
};

const FLAG_LABELS: Record<string, string> = {
    NORMAL: 'Normal',
    LOW: 'Low',
    HIGH: 'High',
    CRITICAL_HIGH: 'Critical high',
    CRITICAL_LOW: 'Critical low',
};

/** Typical LIS delta-check warning when change vs prior authoritative result exceeds this percent. */
const DELTA_CHECK_THRESHOLD_PCT = 40;

const SKELETON_ROWS = 6;

type EditableParameter = ResultParameter & {
    result: string;
    flag: string;
};

type DisplayResultFlag = 'NORMAL' | 'LOW' | 'HIGH' | 'CRITICAL_HIGH' | 'CRITICAL_LOW';

type MainTab = 'entry' | 'details' | 'history';

const MAIN_TABS: SegmentOption<MainTab>[] = [
    { value: 'entry', label: 'Results' },
    { value: 'details', label: 'Specimen & order' },
    { value: 'history', label: 'Activity' },
];

const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function ResultEntryPage() {
    // useSearchParams needs a Suspense boundary for static prerendering.
    return (
        <Suspense fallback={null}>
            <ResultEntryContent />
        </Suspense>
    );
}

function ResultEntryContent() {
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

    // Which analyser produced these values. The QC release gate uses it to find
    // the control governing the result; without it the result is neither held nor
    // vouched for, and verification will refuse it. BENCH-MANUAL is the honest
    // answer for a method that has no analyser.
    const [instruments, setInstruments] = useState<InstrumentOption[]>([]);
    const [instrumentCode, setInstrumentCode] = useState('');

    useEffect(() => {
        let cancelled = false;
        getInstrumentRegistry()
            .then((list) => {
                if (!cancelled) setInstruments(list);
            })
            .catch(() => {
                /* selector stays empty; submit will surface the requirement */
            });
        return () => {
            cancelled = true;
        };
    }, []);

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
            instrumentCode: instrumentCode || undefined,
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

    /* ------------------------------------------------------------------ */
    /*  Loading                                                            */
    /* ------------------------------------------------------------------ */

    if (loading && sampleId) {
        return (
            <div className="mx-auto max-w-[1400px]">
                <PageHeader
                    crumbs={[{ label: 'MLT worklist', href: '/mlt/worklist' }, { label: 'Result entry' }]}
                    title="Result entry"
                    meta={<span>Loading specimen…</span>}
                />
                <p role="status" aria-live="polite" className="sr-only">
                    Loading result entry details
                </p>
                <div aria-hidden="true" className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
                    <div className="space-y-4">
                        <div className="space-y-3 rounded-lg border border-edge bg-surface p-4">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <div key={i} className="space-y-1.5">
                                    <span className="block h-2.5 w-16 rounded bg-skeleton" />
                                    <span className="block h-3.5 w-32 rounded bg-skeleton" />
                                </div>
                            ))}
                        </div>
                        <div className="space-y-3 rounded-lg border border-edge bg-surface p-4">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <div key={i} className="space-y-1.5">
                                    <span className="block h-2.5 w-16 rounded bg-skeleton" />
                                    <span className="block h-3.5 w-36 rounded bg-skeleton" />
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="rounded-lg border border-edge bg-surface">
                        <div className="border-b border-edge px-4 py-3">
                            <span className="block h-4 w-40 rounded bg-skeleton" />
                        </div>
                        <ul className="divide-y divide-edge">
                            {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
                                <li key={i} className="flex items-center gap-3 px-4 py-2.5">
                                    <span className="h-3 w-32 rounded bg-skeleton" />
                                    <span className="ml-auto h-3 w-12 rounded bg-skeleton" />
                                    <span className="h-8 w-24 rounded bg-skeleton" />
                                    <span className="hidden h-3 w-16 rounded bg-skeleton md:block" />
                                    <span className="hidden h-5 w-20 rounded bg-skeleton md:block" />
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
        );
    }

    /* ------------------------------------------------------------------ */
    /*  Specimen picker                                                    */
    /* ------------------------------------------------------------------ */

    if (!sampleId) {
        const hasQuery = pickerQuery.trim().length > 0;
        return (
            <div className="mx-auto max-w-5xl">
                <PageHeader
                    crumbs={[{ label: 'MLT worklist', href: '/mlt/worklist' }, { label: 'Result entry' }]}
                    title="Select a specimen"
                    meta={
                        <span>
                            Choose a sample below or open one from the worklist so priority, stability and repeat
                            context travel with the specimen.
                        </span>
                    }
                    actions={
                        <Button href="/mlt/worklist" icon={ChevronLeft}>
                            Open worklist
                        </Button>
                    }
                />

                <p role="status" aria-live="polite" className="sr-only">
                    {pickerLoading
                        ? 'Loading samples'
                        : `Showing ${filteredPickerRows.length} of ${pickerRows.length} samples.`}
                </p>

                <SectionCard
                    title="MLT worklist samples"
                    count={pickerLoading ? undefined : filteredPickerRows.length}
                    flush
                >
                    <div className="border-b border-edge bg-surface-muted px-3 py-2">
                        <InputField
                            label="Search barcode, patient, test or order"
                            hideLabel
                            type="search"
                            value={pickerQuery}
                            onChange={(e) => setPickerQuery(e.target.value)}
                            placeholder="Search barcode, patient, test or order"
                            autoComplete="off"
                            className="max-w-md"
                        />
                    </div>

                    {pickerLoading ? (
                        <ul aria-hidden="true" className="divide-y divide-edge">
                            {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
                                <li key={i} className="flex items-center gap-3 px-4 py-2.5">
                                    <span className="h-3 w-24 shrink-0 rounded bg-skeleton" />
                                    <span className="h-3 w-32 rounded bg-skeleton" />
                                    <span className="hidden h-3 w-28 rounded bg-skeleton md:block" />
                                    <span className="hidden h-4 w-14 rounded bg-skeleton md:block" />
                                    <span className="ml-auto h-7 w-14 rounded bg-skeleton" />
                                </li>
                            ))}
                        </ul>
                    ) : filteredPickerRows.length === 0 ? (
                        hasQuery ? (
                            <EmptyState
                                icon={Search}
                                title="No samples match"
                                description="Try a different barcode, patient, test or order."
                                action={
                                    <Button size="sm" onClick={() => setPickerQuery('')}>
                                        Clear search
                                    </Button>
                                }
                            />
                        ) : (
                            <EmptyState
                                icon={FlaskConical}
                                title="No samples on the worklist"
                                description="Specimens accepted for testing will appear here."
                            />
                        )
                    ) : (
                        <div className="overflow-x-auto">
                            {/* table-fixed: 144+96+160+80 = 480px of fixed columns, so the table needs
                                480 + 2*160 = 800px before Patient and Test clear a 160px floor. */}
                            <table className="w-full min-w-[800px] table-fixed text-left text-sm">
                                <caption className="sr-only">MLT worklist samples</caption>
                                <thead>
                                    <tr className="whitespace-nowrap border-b border-edge text-xs font-semibold text-fg-muted">
                                        <th scope="col" className="w-36 py-2 pl-4 pr-3 font-semibold">
                                            Barcode
                                        </th>
                                        <th scope="col" className="px-3 py-2 font-semibold">
                                            Patient
                                        </th>
                                        <th scope="col" className="px-3 py-2 font-semibold">
                                            Test
                                        </th>
                                        <th scope="col" className="w-24 px-3 py-2 font-semibold">
                                            Priority
                                        </th>
                                        <th scope="col" className="w-40 px-3 py-2 font-semibold">
                                            Status
                                        </th>
                                        <th scope="col" className="w-20 py-2 pl-3 pr-4 text-right font-semibold">
                                            <span className="sr-only">Action</span>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-edge whitespace-nowrap">
                                    {filteredPickerRows.map((row) => (
                                        <tr key={row.sampleId} className="transition-colors hover:bg-surface-hover">
                                            <td
                                                className="truncate py-2 pl-4 pr-3 font-medium text-primary-strong"
                                                title={row.barcode}
                                            >
                                                {row.barcode}
                                            </td>
                                            <td className="truncate px-3 py-2 text-fg" title={row.patientName}>
                                                {row.patientName}
                                            </td>
                                            <td className="truncate px-3 py-2 text-fg-secondary" title={row.testName}>
                                                {row.testName}
                                            </td>
                                            <td className="px-3 py-2">
                                                <PriorityBadge priority={row.priority} />
                                            </td>
                                            <td className="px-3 py-2">
                                                <StatusBadge status={row.status} />
                                            </td>
                                            <td className="py-2 pl-3 pr-4 text-right">
                                                <Button
                                                    size="sm"
                                                    onClick={() =>
                                                        router.push(`/mlt/result-entry?sampleId=${row.sampleId}`)
                                                    }
                                                    aria-label={`Open result entry for ${row.barcode}`}
                                                >
                                                    Open
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </SectionCard>
            </div>
        );
    }

    /* ------------------------------------------------------------------ */
    /*  Sample unavailable                                                 */
    /* ------------------------------------------------------------------ */

    if (!sample) {
        return (
            <div className="mx-auto max-w-5xl">
                <PageHeader
                    crumbs={[{ label: 'MLT worklist', href: '/mlt/worklist' }, { label: 'Result entry' }]}
                    title="Result entry"
                />
                <div role="alert" className="rounded-lg border border-edge bg-surface">
                    <EmptyState
                        icon={AlertTriangle}
                        title="Result entry unavailable"
                        description={error ?? 'Sample details could not be loaded.'}
                        action={
                            <div className="flex flex-wrap items-center justify-center gap-2">
                                <Button href="/mlt/worklist" icon={ChevronLeft}>
                                    Back to worklist
                                </Button>
                                <Button
                                    variant="ghost"
                                    icon={ArrowLeftRight}
                                    onClick={() => router.push('/mlt/result-entry')}
                                >
                                    Choose another specimen
                                </Button>
                            </div>
                        }
                    />
                </div>
            </div>
        );
    }

    /* ------------------------------------------------------------------ */
    /*  Result entry                                                       */
    /* ------------------------------------------------------------------ */

    const alertTone = hasCritical ? 'danger' : 'pending';

    return (
        <div className="mx-auto max-w-[1400px]">
            <PageHeader
                crumbs={[{ label: 'MLT worklist', href: '/mlt/worklist' }, { label: 'Result entry' }]}
                title="Result entry"
                meta={
                    <>
                        <span className="font-medium text-fg-secondary">{sample.barcode}</span>
                        <span aria-hidden="true">·</span>
                        <span>{sample.testName}</span>
                        <span aria-hidden="true">·</span>
                        <span>{sample.patientName}</span>
                        <StatusBadge status={sample.status} />
                    </>
                }
                actions={
                    <>
                        <Button variant="ghost" href="/mlt/worklist" icon={ChevronLeft}>
                            Worklist
                        </Button>
                        <Button icon={ArrowLeftRight} onClick={() => router.push('/mlt/result-entry')}>
                            Change specimen
                        </Button>
                    </>
                }
            />

            {(hasCritical || hasDeltaAlert) && (
                <div
                    role="alert"
                    className={cn(
                        'mb-4 flex items-start gap-3 rounded-lg border p-3 text-sm',
                        alertTone === 'danger'
                            ? 'border-status-danger-edge bg-status-danger-bg text-status-danger-fg'
                            : 'border-status-pending-edge bg-status-pending-bg text-status-pending-fg'
                    )}
                >
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <div className="min-w-0 space-y-1">
                        {hasCritical && <p className="font-medium">Critical result detected. Confirm the result before submission.</p>}
                        {hasDeltaAlert && (
                            <p>
                                Delta-check: one or more analytes changed ≥ {DELTA_CHECK_THRESHOLD_PCT}% vs the prior
                                authoritative result. Confirm before releasing.
                            </p>
                        )}
                    </div>
                </div>
            )}

            <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
                {/* Context column */}
                <aside aria-label="Specimen context" className="space-y-4 lg:sticky lg:top-20 lg:self-start">
                    <SectionCard title="Patient">
                        <dl className="space-y-3">
                            <ContextRow label="Patient name" value={sample.patientName} />
                            <ContextRow label="Patient ID" value={sample.patientId} />
                            <ContextRow label="Status" value={<StatusBadge status={sample.status} />} />
                            <ContextRow label="Order" value={sample.orderNo ?? sample.orderId} />
                        </dl>
                    </SectionCard>
                    <SectionCard title="Specimen">
                        <dl className="space-y-3">
                            <ContextRow
                                label="Barcode"
                                value={<span className="font-medium text-primary-strong">{sample.barcode}</span>}
                            />
                            <ContextRow label="Test" value={sample.testName} />
                            <ContextRow
                                label="Tube / priority"
                                value={
                                    <span className="flex flex-wrap items-center gap-1.5">
                                        {sample.tubeType ? <span>{sample.tubeType}</span> : !sample.priority ? '—' : null}
                                        {sample.priority && <PriorityBadge priority={sample.priority} />}
                                    </span>
                                }
                            />
                            <ContextRow label="Collected" value={formatCollected(sample.collectedAt, sample.collectedBy)} />
                            <ContextRow
                                label="Progress"
                                value={
                                    <span className="tabular-nums">
                                        {enteredParameters.length} / {parameters.length} parameters
                                    </span>
                                }
                            />
                        </dl>
                    </SectionCard>
                </aside>

                {/* Main column */}
                <div className="min-w-0">
                    <div className="mb-4">
                        <SegmentedControl
                            value={mainTab}
                            onChange={setMainTab}
                            options={MAIN_TABS}
                            ariaLabel="Result entry sections"
                        />
                    </div>

                    {mainTab === 'details' && (
                        <div className="max-w-3xl space-y-4">
                            <SectionCard title="Order & identifiers">
                                <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <DetailRow label="Order number" value={sample.orderNo ?? sample.orderId} />
                                    <DetailRow label="Order UUID" value={sample.orderId} mono />
                                    <DetailRow label="Patient ID" value={sample.patientId} />
                                    <DetailRow label="Sample UUID" value={sample.sampleId} mono />
                                </dl>
                            </SectionCard>
                            <SectionCard title="Specimen handling context">
                                <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <DetailRow label="Barcode" value={sample.barcode} />
                                    <DetailRow label="Tube type" value={sample.tubeType ?? '—'} />
                                    <DetailRow label="Clinical priority" value={sample.priority ?? '—'} />
                                    <DetailRow
                                        label="Collection"
                                        value={formatCollected(sample.collectedAt, sample.collectedBy)}
                                    />
                                </dl>
                                <p className="mt-4 text-xs leading-relaxed text-fg-muted">
                                    Pre-analytical data supports correct processing (e.g. additive compatibility,
                                    centrifugation rules). Final validation remains with the pathologist or authorised
                                    verifier per your policy.
                                </p>
                            </SectionCard>
                        </div>
                    )}

                    {mainTab === 'history' && (
                        <div className="max-w-4xl">
                            <p role="status" aria-live="polite" className="sr-only">
                                {activityLoading ? 'Loading activity' : `${activity.length} activity entries.`}
                            </p>
                            <SectionCard
                                title="Result entry audit trail"
                                count={activityLoading ? undefined : activity.length}
                                flush
                            >
                                {activityLoading ? (
                                    <ul aria-hidden="true" className="divide-y divide-edge">
                                        {Array.from({ length: 3 }).map((_, i) => (
                                            <li key={i} className="space-y-2 px-4 py-3">
                                                <div className="flex items-center justify-between gap-3">
                                                    <span className="h-3.5 w-40 rounded bg-skeleton" />
                                                    <span className="h-3 w-16 rounded bg-skeleton" />
                                                </div>
                                                <span className="block h-3 w-24 rounded bg-skeleton" />
                                            </li>
                                        ))}
                                    </ul>
                                ) : activity.length === 0 ? (
                                    <EmptyState
                                        icon={History}
                                        title="No recorded saves yet"
                                        description="Draft and final submissions create immutable audit rows for accreditation traceability."
                                    />
                                ) : (
                                    <ul className="divide-y divide-edge">
                                        {activity.map((item) => (
                                            <li key={item.id} className="px-4 py-3 transition-colors hover:bg-surface-hover">
                                                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                                                    <p className="text-sm font-medium text-fg">
                                                        {formatActivityAction(item.action)}
                                                    </p>
                                                    <time
                                                        dateTime={item.timestamp}
                                                        title={formatDateTime(item.timestamp)}
                                                        className="text-xs tabular-nums text-fg-muted"
                                                    >
                                                        {formatAuditTime(item.timestamp)}
                                                    </time>
                                                </div>
                                                <p className="mt-0.5 text-xs text-fg-muted">By {item.performedBy}</p>
                                                {item.details && (
                                                    <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-md border border-edge bg-surface-muted p-3 font-mono text-[12px] text-fg-secondary">
                                                        {formatActivityDetails(item.details)}
                                                    </pre>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </SectionCard>
                        </div>
                    )}

                    {mainTab === 'entry' && (
                        <>
                            <div aria-live="assertive" role="alert">
                                {error && (
                                    <div className="mb-4 flex items-start gap-3 rounded-lg border border-status-danger-edge bg-status-danger-bg p-3 text-sm text-status-danger-fg">
                                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                                        <p className="min-w-0 break-words">{error}</p>
                                    </div>
                                )}
                            </div>

                            {/* The supervisor sent this case back — show why before the bench re-enters it. */}
                            {sample.returnedToMlt && (
                                <div
                                    role="note"
                                    className="mb-4 flex items-start gap-3 rounded-lg border border-status-danger-edge bg-status-danger-bg p-3 text-sm text-status-danger-fg"
                                >
                                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                                    <div className="min-w-0">
                                        <p className="font-semibold">
                                            Returned by supervisor for re-run / re-entry
                                            {sample.returnedBy && <span className="font-normal"> · {sample.returnedBy}</span>}
                                            {sample.returnedAt && (
                                                <span className="font-normal"> · {formatAuditTime(sample.returnedAt)}</span>
                                            )}
                                        </p>
                                        <p className="mt-1 break-words">{sample.returnReason || 'No reason was recorded.'}</p>
                                    </div>
                                </div>
                            )}

                            <div aria-live="polite" role="status">
                                {isReadOnly && (
                                    <div className="mb-4 rounded-lg border border-status-pending-edge bg-status-pending-bg p-3 text-sm text-status-pending-fg">
                                        {readOnlyMessage}
                                    </div>
                                )}
                                {successMessage && (
                                    <div className="mb-4 rounded-lg border border-status-verified-edge bg-status-verified-bg p-3 text-sm text-status-verified-fg">
                                        {successMessage}
                                    </div>
                                )}
                            </div>

                            <SectionCard
                                title={sample.testName}
                                count={parameters.length}
                                actions={
                                    <span className="hidden text-xs text-fg-muted sm:inline">
                                        Delta-check vs prior verified or dispatched results
                                    </span>
                                }
                                flush
                            >
                                {parameters.length === 0 ? (
                                    <EmptyState
                                        icon={FlaskConical}
                                        title="No parameters configured"
                                        description="This test has no result parameters to enter."
                                    />
                                ) : (
                                    <div className="overflow-x-auto">
                                        {/* table-fixed: 96+80+128+80+112+128 = 624px of fixed columns, so the
                                            table needs 624 + 160 = 784px before Parameter clears a 160px floor. */}
                                        <table className="w-full min-w-[790px] table-fixed text-left text-sm">
                                            <caption className="sr-only">Result parameters for {sample.testName}</caption>
                                            <thead>
                                                <tr className="whitespace-nowrap border-b border-edge text-xs font-semibold text-fg-muted">
                                                    <th scope="col" className="py-2 pl-4 pr-3 font-semibold">
                                                        Parameter
                                                    </th>
                                                    <th scope="col" className="w-24 px-3 py-2 text-right font-semibold">
                                                        Previous
                                                    </th>
                                                    <th scope="col" className="w-20 px-3 py-2 text-right font-semibold">
                                                        Δ %
                                                    </th>
                                                    <th scope="col" className="w-32 px-3 py-2 font-semibold">
                                                        Result
                                                    </th>
                                                    <th scope="col" className="w-20 px-3 py-2 font-semibold">
                                                        Unit
                                                    </th>
                                                    <th scope="col" className="w-28 px-3 py-2 font-semibold">
                                                        Reference
                                                    </th>
                                                    <th scope="col" className="w-32 py-2 pl-3 pr-4 font-semibold">
                                                        Flag
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-edge whitespace-nowrap">
                                                {parameters.map((parameter) => {
                                                    const displayFlag = getDisplayFlag(parameter);
                                                    const isCritical = displayFlag?.startsWith('CRITICAL');
                                                    const isAbnormal = displayFlag && displayFlag !== 'NORMAL';
                                                    const flagTone: ChipTone = displayFlag
                                                        ? FLAG_TONES[displayFlag] ?? 'neutral'
                                                        : 'neutral';
                                                    const flagLabel = displayFlag
                                                        ? FLAG_LABELS[displayFlag] ?? displayFlag
                                                        : 'No flag';
                                                    const prevVal = parameter.previousValue?.result;
                                                    const delta = computeDeltaPercent(prevVal ?? '', parameter.result);
                                                    const deltaWarn =
                                                        delta !== null &&
                                                        prevVal &&
                                                        parameter.result.trim() &&
                                                        Math.abs(delta) >= DELTA_CHECK_THRESHOLD_PCT;

                                                    return (
                                                        <tr
                                                            key={parameter.parameterId}
                                                            className={cn(
                                                                'transition-colors',
                                                                isCritical
                                                                    ? 'bg-status-danger-bg'
                                                                    : deltaWarn
                                                                      ? 'bg-status-pending-bg'
                                                                      : 'hover:bg-surface-hover'
                                                            )}
                                                        >
                                                            <td className="truncate py-2 pl-4 pr-3 font-medium text-fg" title={parameter.parameterName}>
                                                                {parameter.parameterName}
                                                            </td>
                                                            <td className="px-3 py-2 text-right font-mono text-xs tabular-nums text-fg-secondary">
                                                                {prevVal ?? '—'}
                                                            </td>
                                                            <td
                                                                className={cn(
                                                                    'px-3 py-2 text-right text-xs tabular-nums',
                                                                    deltaWarn ? 'font-semibold text-status-pending-fg' : 'text-fg-muted'
                                                                )}
                                                            >
                                                                {delta !== null ? `${delta > 0 ? '+' : ''}${delta.toFixed(0)}%` : '—'}
                                                            </td>
                                                            <td className="px-3 py-1.5">
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
                                                                    aria-label={`${parameter.parameterName} result`}
                                                                    className={cn(
                                                                        CONTROL_CLASS,
                                                                        'h-8 max-w-[7rem] px-2 text-center font-semibold tabular-nums',
                                                                        isCritical
                                                                            ? 'border-status-danger-edge bg-status-danger-bg text-status-danger-fg focus:border-status-danger focus:ring-status-danger/30'
                                                                            : isAbnormal
                                                                              ? 'border-status-pending-edge bg-status-pending-bg text-status-pending-fg focus:border-status-pending focus:ring-status-pending/30'
                                                                              : ''
                                                                    )}
                                                                />
                                                            </td>
                                                            <td
                                                                className="truncate px-3 py-2 text-xs text-fg-muted"
                                                                title={parameter.unit || undefined}
                                                            >
                                                                {parameter.unit || '—'}
                                                            </td>
                                                            <td
                                                                className={cn(
                                                                    'px-3 py-2 text-xs tabular-nums',
                                                                    isAbnormal ? 'font-medium text-primary-strong' : 'text-fg-muted'
                                                                )}
                                                            >
                                                                {formatReferenceRange(parameter)}
                                                            </td>
                                                            <td className="py-2 pl-3 pr-4">
                                                                <StatusChip
                                                                    tone={flagTone}
                                                                    size="sm"
                                                                    title={
                                                                        displayFlag
                                                                            ? 'Automatically calculated from reference range'
                                                                            : 'Enter a result to calculate the flag'
                                                                    }
                                                                    className={cn(!displayFlag && 'text-fg-muted')}
                                                                >
                                                                    {flagLabel}
                                                                </StatusChip>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </SectionCard>

                            <FormSection
                                title="Method and notes"
                                description="Name the analyser that produced these values and add any technical comments."
                                className="mt-4"
                            >
                                <SelectField
                                    id="instrumentCode"
                                    label="Instrument"
                                    value={instrumentCode}
                                    onChange={(event) => setInstrumentCode(event.target.value)}
                                    disabled={isReadOnly}
                                    hint="Quality control is matched to the result through the analyser, so a specimen submitted without one is held at verification until a supervisor resolves it."
                                >
                                    <option value="">Select the analyser…</option>
                                    {instruments.map((option) => (
                                        <option key={option.code} value={option.code}>
                                            {option.name}
                                            {option.qcRequired ? '' : ' — no analyser QC'}
                                        </option>
                                    ))}
                                </SelectField>
                                <div className="min-w-0 sm:col-span-2">
                                    <label htmlFor="mltNotes" className="mb-1 block text-xs font-medium text-fg-secondary">
                                        MLT notes
                                    </label>
                                    <textarea
                                        id="mltNotes"
                                        rows={4}
                                        value={mltNotes}
                                        onChange={(event) => setMltNotes(event.target.value)}
                                        disabled={isReadOnly}
                                        placeholder="Technical comments (hemolysis, instrument flags, repeat patterns, etc.)"
                                        className={cn(CONTROL_CLASS, 'resize-none py-2')}
                                    />
                                </div>
                            </FormSection>

                            <div className="sticky bottom-0 z-10 mt-4 flex items-center justify-between gap-3 border-t border-edge bg-canvas py-3">
                                <p className="min-w-0 truncate text-xs tabular-nums text-fg-muted">
                                    {enteredParameters.length} of {parameters.length} results entered
                                </p>
                                <div className="ml-auto flex shrink-0 items-center gap-2">
                                    <Button
                                        icon={Save}
                                        loading={savingDraft}
                                        disabled={savingDraft || submitting || isReadOnly}
                                        onClick={() => void handleSaveDraft()}
                                    >
                                        {savingDraft ? 'Saving…' : 'Save draft'}
                                    </Button>
                                    <Button
                                        variant="primary"
                                        icon={Send}
                                        loading={submitting}
                                        disabled={submitting || savingDraft || isReadOnly}
                                        onClick={() => void handleSubmit()}
                                    >
                                        {submitting ? 'Submitting…' : 'Submit for verification'}
                                    </Button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

function ContextRow({ label, value }: { label: string; value: ReactNode }) {
    return (
        <div className="min-w-0">
            <dt className="text-xs text-fg-muted">{label}</dt>
            <dd className="mt-0.5 break-words text-sm font-medium text-fg">{value}</dd>
        </div>
    );
}

function DetailRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
    return (
        <div className="min-w-0">
            <dt className="text-xs text-fg-muted">{label}</dt>
            <dd className={cn('mt-0.5 break-all text-sm font-medium text-fg', mono && 'font-mono text-xs')}>{value}</dd>
        </div>
    );
}

function formatCollected(collectedAt?: string | null, collectedBy?: string | null) {
    if (!collectedAt && !collectedBy) {
        return '—';
    }
    const parts = [collectedAt ? formatDateTime(collectedAt) : null, collectedBy ? `by ${collectedBy}` : null].filter(
        Boolean
    );
    return parts.join(' · ');
}

/** `Today 09:12` / `Yesterday 14:02` / `16 Aug 2026 09:12` (design-system date + 24h time). */
function formatDateTime(iso: string) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
        return iso;
    }
    const label = formatRegistered(d);
    if (label.startsWith('Today') || label.startsWith('Yesterday')) {
        return label;
    }
    const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
    return `${label} ${time}`;
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
