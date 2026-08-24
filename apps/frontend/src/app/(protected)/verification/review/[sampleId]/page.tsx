'use client';

import axios from 'axios';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    Activity,
    AlertOctagon,
    AlertTriangle,
    ArrowLeft,
    CheckCircle2,
    FlaskConical,
    History,
    ListChecks,
    MessageSquare,
    SearchX,
    Stethoscope,
    Undo2,
    User,
} from 'lucide-react';
import {
    approveTechnically,
    getBulkVerificationWorklist,
    getPendingVerificationResults,
    getVerificationResultDetails,
    rejectTechnically,
    TestResultDetail,
} from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import {
    deltaTone,
    displayResultNo,
    formatDeltaPercent,
    resultStatusLabel,
    resultStatusTone,
} from '@/lib/result-display';
import { cn } from '@/lib/utils';
import Button from '@/components/ui/Button';
import PageHeader, { type Crumb } from '@/components/ui/PageHeader';
import SectionCard from '@/components/ui/SectionCard';
import EmptyState from '@/components/ui/EmptyState';
import KpiTile from '@/components/ui/KpiTile';
import Modal from '@/components/ui/Modal';
import StatusChip, { humanizeStatus, type ChipTone } from '@/components/ui/StatusChip';
import { TextareaField } from '@/components/ui/Field';
import PriorityBadge from '@/components/shared/PriorityBadge';
import { formatAuditTime, formatRegistered } from '@/components/patient-dashboard/dashboard-data';

const REVIEW_CRUMBS: Crumb[] = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Verification', href: '/verification' },
    { label: 'Pending', href: '/verification/pending' },
];

/** Same control anatomy as the pending / bulk-approval worklists. */
const CHECKBOX_CLASS =
    'h-4 w-4 shrink-0 rounded border-edge-strong accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-50';

/**
 * Supervisor quality gate — every check must be confirmed before a case can be
 * approved and released to the pathologist. The five checks are the lab's own
 * technical-verification standard (pre-analytical, delta, calibration, MLT
 * remarks, critical notification).
 */
const SUPERVISOR_CHECKLIST = [
    {
        id: 'patientAndTestMatch',
        label: 'Patient and test group match confirmed',
    },
    {
        id: 'allRequiredParams',
        label: 'All required parameters are entered',
    },
    {
        id: 'abnormalCriticalReviewed',
        label: 'Abnormal and critical flags have been reviewed',
    },
    {
        id: 'qcAndInstrumentReviewed',
        label: 'QC status and instrument output reviewed',
    },
    {
        id: 'mltNotesReviewed',
        label: 'MLT notes and any return/recheck context reviewed',
    },
] as const;

const createEmptyChecklist = (): Record<string, boolean> =>
    Object.fromEntries(SUPERVISOR_CHECKLIST.map((item) => [item.id, false]));

const formatReferenceRange = (low?: number | null, high?: number | null) => {
    if (low == null || high == null) {
        return '—';
    }

    return `${low} – ${high}`;
};

/** Result flag → chip tone (colour = meaning; unknown flags stay neutral). */
const FLAG_TONE: Record<string, ChipTone> = {
    NORMAL: 'neutral',
    LOW: 'pending',
    HIGH: 'pending',
    CRITICAL_LOW: 'danger',
    CRITICAL_HIGH: 'danger',
};

const toneForFlag = (flag?: string | null): ChipTone => {
    if (!flag) {
        return 'neutral';
    }

    return FLAG_TONE[flag.toUpperCase()] ?? 'neutral';
};

const isCriticalFlag = (flag?: string | null) => {
    const normalized = flag?.toUpperCase();
    return normalized === 'CRITICAL_HIGH' || normalized === 'CRITICAL_LOW';
};

const formatGenderLabel = (gender?: string | null) => {
    if (!gender) {
        return null;
    }

    return humanizeStatus(gender);
};

const toDate = (value?: string | null): Date | null => {
    if (!value) {
        return null;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

/** "Today 09:12" / "Yesterday 14:02" / "16 Aug 2026" */
const formatWhen = (value?: string | null) => formatRegistered(toDate(value));

/** Full date and time, for the specimen timeline where the exact clock matters. */
const formatExact = (value?: string | null) => {
    const date = toDate(value);
    if (!date) {
        return '—';
    }
    return date.toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });
};

/** "2h ago" / "Today 09:12" / "16 Aug 2026" — for activity-style meta lines. */
const formatRelative = (value?: string | null) => (value ? formatAuditTime(value) : '—');

const initialsFor = (name: string | null | undefined, fallback: string) =>
    (name ?? fallback)
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((segment) => segment.charAt(0).toUpperCase())
        .join('') || fallback;

const DELTA_CHIP_TONE: Record<ReturnType<typeof deltaTone>, ChipTone> = {
    neutral: 'neutral',
    pending: 'pending',
    danger: 'danger',
};

const REVIEWED_NOTICE =
    'This case has already been processed. Actions reopen only after a clinical return for recheck.';

const WITH_MLT_NOTICE =
    'This case was returned to the MLT and is awaiting re-entry. It comes back to the queue when they resubmit.';

const CHECKLIST_NOTICE = 'Complete all checklist items before approving and releasing this case.';

export default function ReviewCasePage() {
    const router = useRouter();
    const { user } = useAuth();
    const params = useParams<{ sampleId: string }>();
    const resultId = Array.isArray(params.sampleId) ? params.sampleId[0] : params.sampleId;
    const [resultDetail, setResultDetail] = useState<TestResultDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showReturnModal, setShowReturnModal] = useState(false);
    const [showApproveModal, setShowApproveModal] = useState(false);
    const [returnReason, setReturnReason] = useState('');
    const [returnError, setReturnError] = useState<string | null>(null);
    const [approveNote, setApproveNote] = useState('');
    const [reviewChecklist, setReviewChecklist] = useState<Record<string, boolean>>(createEmptyChecklist);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [requiresQcOverride, setRequiresQcOverride] = useState(false);

    const loadResultDetails = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            let targetId = resultId;
            const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

            // If resultId in URL is not a UUID (e.g. human-readable RES2026-XXXXX), resolve its real UUID
            if (!UUID_PATTERN.test(targetId)) {
                try {
                    const pendingList = await getPendingVerificationResults(0, 100);
                    const matched = pendingList.content?.find(
                        (item) =>
                            item.resultNo === targetId ||
                            displayResultNo(item.resultNo, item.resultId) === targetId ||
                            item.resultId === targetId
                    );
                    if (matched?.resultId) {
                        targetId = matched.resultId;
                    } else {
                        const bulkBatches = await getBulkVerificationWorklist();
                        for (const b of bulkBatches) {
                            const foundCase = b.cases?.find(
                                (c) =>
                                    c.resultNo === targetId ||
                                    displayResultNo(c.resultNo, c.resultId) === targetId ||
                                    c.resultId === targetId
                            );
                            if (foundCase?.resultId) {
                                targetId = foundCase.resultId;
                                break;
                            }
                        }
                    }
                } catch (resolveErr) {
                    console.warn('Could not resolve non-UUID result identifier', resolveErr);
                }
            }

            const response = await getVerificationResultDetails(targetId);
            setResultDetail(response);
        } catch (loadError) {
            console.error('Failed to load verification result details', loadError);
            setError("Couldn't load the verification result. Please try again.");
        } finally {
            setLoading(false);
        }
    }, [resultId]);

    useEffect(() => {
        if (resultId) {
            void loadResultDetails();
        }
    }, [resultId, loadResultDetails]);

    // Each case must be confirmed on its own evidence, never on the previous case's ticks.
    useEffect(() => {
        setReviewChecklist(createEmptyChecklist());
    }, [resultId]);

    const labResults = useMemo(() => {
        return (resultDetail?.parameters ?? []).map((parameter) => {
            const numericValue =
                typeof parameter.resultValue === 'number'
                    ? parameter.resultValue
                    : Number(parameter.resultText ?? '');
            const referenceLow = parameter.referenceRangeLow ?? null;
            const referenceHigh = parameter.referenceRangeHigh ?? null;
            const isAbnormal =
                parameter.flag != null
                    ? parameter.flag !== 'NORMAL'
                    : (referenceLow != null && !Number.isNaN(numericValue) && numericValue < referenceLow) ||
                      (referenceHigh != null && !Number.isNaN(numericValue) && numericValue > referenceHigh);

            return {
                key: `${parameter.parameterCode}-${parameter.parameterName}`,
                parameter: parameter.parameterName,
                result: parameter.resultText ?? parameter.resultValue ?? '—',
                unit: parameter.unit ?? '—',
                rawFlag: parameter.flag,
                referenceRange: formatReferenceRange(parameter.referenceRangeLow, parameter.referenceRangeHigh),
                isAbnormal,
                isCritical: isCriticalFlag(parameter.flag),
                previousValue: parameter.previousValue ?? null,
                previousVisitedAt: parameter.previousVisitedAt ?? null,
                previousSampleBarcode: parameter.previousSampleBarcode ?? null,
                deltaPercent: parameter.deltaPercent ?? null,
                deltaSignificant: parameter.deltaSignificant ?? null,
            };
        });
    }, [resultDetail]);

    const abnormalCount = labResults.filter((row) => row.isAbnormal).length;
    const criticalCount = labResults.filter((row) => row.isCritical).length;
    const significantDeltaCount = labResults.filter((row) => row.deltaSignificant).length;

    const mltNotesAuthor =
        resultDetail?.mltName?.trim() ||
        'Unknown technician';
    const patientDemographics = [
        resultDetail?.patientAge != null ? `${resultDetail.patientAge} y` : null,
        formatGenderLabel(resultDetail?.patientGender),
    ]
        .filter(Boolean)
        .join(' · ');
    const reviewerName = user?.name || user?.preferred_username || 'Current user';
    const reviewerRole = 'Lab Supervisor';
    const isWithMlt = resultDetail?.status === 'RETURNED_TO_MLT';
    const canReviewActions =
        resultDetail?.status === 'ENTERED' || resultDetail?.status === 'RETURNED_FOR_RECHECK';
    const lockedNotice = isWithMlt ? WITH_MLT_NOTICE : REVIEWED_NOTICE;
    const completedChecklistCount = SUPERVISOR_CHECKLIST.filter((item) => reviewChecklist[item.id]).length;
    const isChecklistComplete = completedChecklistCount === SUPERVISOR_CHECKLIST.length;
    const displayId = displayResultNo(resultDetail?.resultNo, resultId);

    const resolveSubmitErrorMessage = (
        action: 'approve' | 'return',
        submitError: unknown
    ) => {
        if (axios.isAxiosError(submitError)) {
            const message =
                typeof submitError.response?.data?.message === 'string'
                    ? submitError.response.data.message
                    : null;

            if (message) {
                return message;
            }
        }

        return action === 'approve'
            ? 'Failed to approve result. Please try again.'
            : 'Failed to return result. Please try again.';
    };

    const handleBack = () => {
        if (typeof window !== 'undefined' && window.history.length > 1) {
            router.back();
            return;
        }
        router.push('/verification/pending');
    };

    const toggleChecklistItem = (itemId: string) => {
        setReviewChecklist((current) => ({
            ...current,
            [itemId]: !current[itemId],
        }));
        if (submitError) {
            setSubmitError(null);
        }
    };

    // Stable references so the Modal's focus/keyboard effect doesn't re-run every render.
    const closeReturnModal = useCallback(() => {
        setShowReturnModal(false);
        setReturnReason('');
        setReturnError(null);
        setSubmitError(null);
    }, []);

    const closeApproveModal = useCallback(() => {
        setShowApproveModal(false);
        setApproveNote('');
        setReviewChecklist(createEmptyChecklist());
        setRequiresQcOverride(false);
        setSubmitError(null);
    }, []);

    const openReturnModal = () => {
        if (!canReviewActions) {
            setSubmitError(lockedNotice);
            return;
        }
        setShowReturnModal(true);
        setReturnError(null);
        setSubmitError(null);
    };

    const openApproveModal = () => {
        if (!canReviewActions) {
            setSubmitError(lockedNotice);
            return;
        }
        if (!isChecklistComplete) {
            setSubmitError(CHECKLIST_NOTICE);
            return;
        }
        setShowApproveModal(true);
        setSubmitError(null);
    };

    const handleApprove = async () => {
        if (!canReviewActions) {
            setSubmitError(lockedNotice);
            return;
        }
        if (!isChecklistComplete) {
            setSubmitError(CHECKLIST_NOTICE);
            return;
        }
        const trimmedSupervisorNote = approveNote.trim();

        const supervisorNote = trimmedSupervisorNote
            ? `Added by ${reviewerName} (${reviewerRole}): ${trimmedSupervisorNote}`
            : undefined;

        try {
            setIsSubmitting(true);
            setSubmitError(null);
            await approveTechnically(resultId, {
                status: 'TECHNICALLY_VERIFIED',
                mltNotes: resultDetail?.mltNotes ?? undefined,
                supervisorNote,
                qcOverrideReason: trimmedSupervisorNote || undefined,
            });
            setShowApproveModal(false);
            setApproveNote('');
            setReviewChecklist(createEmptyChecklist());
            setRequiresQcOverride(false);
            router.push('/verification/pending');
        } catch (submitError) {
            console.error('Failed to approve result', submitError);
            const message = resolveSubmitErrorMessage('approve', submitError);
            setSubmitError(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleReturn = async () => {
        if (!canReviewActions) {
            setReturnError(lockedNotice);
            return;
        }
        const trimmedReason = returnReason.trim();

        if (!trimmedReason) {
            setReturnError('A return reason is required.');
            return;
        }

        try {
            setIsSubmitting(true);
            setReturnError(null);
            setSubmitError(null);
            // The reason travels as the supervisor note; the MLT's own notes go back
            // untouched so the bench's account of the run is not overwritten.
            await rejectTechnically(resultId, {
                mltNotes: resultDetail?.mltNotes ?? undefined,
                supervisorNote: trimmedReason,
            });
            setShowReturnModal(false);
            setReturnReason('');
            router.push('/verification/pending');
        } catch (submitError) {
            console.error('Failed to return result to MLT', submitError);
            setReturnError(resolveSubmitErrorMessage('return', submitError));
        } finally {
            setIsSubmitting(false);
        }
    };

    // ── Loading state ─────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="mx-auto max-w-6xl">
                <PageHeader title="Result review" crumbs={[...REVIEW_CRUMBS, { label: 'Loading…' }]} />
                <p role="status" aria-live="polite" className="sr-only">
                    Loading verification result
                </p>
                <div aria-hidden="true">
                    <div className="mb-4 rounded-lg border border-edge bg-surface px-4 py-3">
                        <span className="block h-4 w-48 rounded bg-skeleton" />
                        <span className="mt-2 block h-3 w-80 max-w-full rounded bg-skeleton" />
                    </div>
                    <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <span key={i} className="block h-[86px] rounded-lg border border-edge bg-surface" />
                        ))}
                    </div>
                    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
                        <div className="rounded-lg border border-edge bg-surface p-4">
                            <span className="block h-4 w-32 rounded bg-skeleton" />
                            <div className="mt-4 space-y-2">
                                {Array.from({ length: 6 }).map((_, i) => (
                                    <span key={i} className="block h-8 rounded bg-skeleton" />
                                ))}
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div className="rounded-lg border border-edge bg-surface p-4">
                                <span className="block h-4 w-36 rounded bg-skeleton" />
                                <div className="mt-4 space-y-2">
                                    {Array.from({ length: 5 }).map((_, i) => (
                                        <span key={i} className="block h-9 rounded bg-skeleton" />
                                    ))}
                                </div>
                            </div>
                            <div className="rounded-lg border border-edge bg-surface p-4">
                                <span className="block h-4 w-28 rounded bg-skeleton" />
                                <div className="mt-4 space-y-2">
                                    {Array.from({ length: 3 }).map((_, i) => (
                                        <span key={i} className="block h-12 rounded bg-skeleton" />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ── Error / not found state ───────────────────────────────────────────────
    if (error || !resultDetail) {
        return (
            <div className="mx-auto max-w-6xl">
                <PageHeader title="Result review" crumbs={[...REVIEW_CRUMBS, { label: displayId }]} />
                <div role={error ? 'alert' : undefined} className="rounded-lg border border-edge bg-surface">
                    <EmptyState
                        icon={error ? AlertTriangle : SearchX}
                        title={error ? "Couldn't load result" : 'Result not found'}
                        description={error ?? `No verification result matches ${displayId}.`}
                        action={
                            <div className="flex flex-wrap items-center justify-center gap-2">
                                {error && (
                                    <Button size="sm" onClick={() => void loadResultDetails()}>
                                        Retry
                                    </Button>
                                )}
                                <Button size="sm" icon={ArrowLeft} href="/verification/pending">
                                    Back to pending list
                                </Button>
                            </div>
                        }
                    />
                </div>
            </div>
        );
    }

    const workflowChip = (
        <StatusChip tone={resultStatusTone(resultDetail.status)} dot>
            {resultStatusLabel(resultDetail.status)}
        </StatusChip>
    );

    const specimenFacts: { label: string; value: string; mono?: boolean }[] = [
        { label: 'Patient ID', value: resultDetail.patientCode ?? '—', mono: true },
        { label: 'Specimen type', value: resultDetail.tubeType ? humanizeStatus(resultDetail.tubeType) : '—' },
        { label: 'Tube barcode', value: resultDetail.sampleBarcode ?? '—', mono: true },
        { label: 'Collected', value: formatExact(resultDetail.collectedAt) },
        { label: 'Received', value: formatExact(resultDetail.receivedAt) },
    ];

    const hasReturnContext = Boolean(resultDetail.returnReason) &&
        (resultDetail.status === 'RETURNED_FOR_RECHECK' || resultDetail.status === 'RETURNED_TO_MLT');

    return (
        <div className="mx-auto max-w-6xl">
            <PageHeader
                title="Result review"
                crumbs={[...REVIEW_CRUMBS, { label: displayId }]}
                meta={
                    <>
                        <span className="font-mono text-fg-secondary">{displayId}</span>
                        <span aria-hidden="true">·</span>
                        <span>Updated {formatRelative(resultDetail.updatedAt)}</span>
                    </>
                }
                actions={
                    <>
                        <Button variant="ghost" icon={ArrowLeft} onClick={handleBack}>
                            Back
                        </Button>
                        <Button
                            icon={Undo2}
                            onClick={openReturnModal}
                            disabled={isSubmitting || !canReviewActions}
                        >
                            Return to MLT
                        </Button>
                        <Button
                            variant="primary"
                            icon={CheckCircle2}
                            onClick={openApproveModal}
                            disabled={isSubmitting || !canReviewActions || !isChecklistComplete}
                        >
                            Approve and release
                        </Button>
                    </>
                }
            />

            {/* Sample & patient demographics header */}
            <section
                aria-label="Case context"
                className="sticky top-16 z-20 mb-4 rounded-lg border border-edge bg-surface px-4 py-3"
            >
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <div className="flex min-w-0 items-center gap-2">
                        <User className="h-5 w-5 shrink-0 text-fg-faint" aria-hidden="true" />
                        <span className="truncate text-sm font-semibold text-fg">
                            {resultDetail.patientName ?? 'Unknown patient'}
                        </span>
                        {patientDemographics && (
                            <span className="whitespace-nowrap text-sm text-fg-muted">{patientDemographics}</span>
                        )}
                    </div>
                    <div className="flex min-w-0 items-center gap-1.5 text-sm text-fg-secondary">
                        <FlaskConical className="h-4 w-4 shrink-0 text-fg-faint" aria-hidden="true" />
                        <span className="truncate">{resultDetail.testType ?? 'Lab result review'}</span>
                    </div>
                    <div className="flex items-center gap-2 sm:ml-auto">
                        {workflowChip}
                        {resultDetail.priority && <PriorityBadge priority={resultDetail.priority} />}
                    </div>
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-edge pt-2 text-xs sm:grid-cols-5">
                    {specimenFacts.map((fact) => (
                        <div key={fact.label} className="min-w-0">
                            <dt className="text-fg-muted">{fact.label}</dt>
                            <dd className={cn('truncate text-fg', fact.mono && 'font-mono')} title={fact.value}>
                                {fact.value}
                            </dd>
                        </div>
                    ))}
                </dl>
            </section>

            {submitError && !showApproveModal && !showReturnModal && (
                <div
                    role="alert"
                    className="mb-4 flex items-start gap-2 rounded-lg border border-status-danger-edge bg-status-danger-bg px-4 py-3 text-sm text-status-danger-fg"
                >
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{submitError}</span>
                </div>
            )}

            {hasReturnContext && (
                <div
                    role="note"
                    className="mb-4 rounded-lg border border-status-pending-edge bg-status-pending-bg px-4 py-3 text-sm text-status-pending-fg"
                >
                    <p className="font-semibold">
                        {resultStatusLabel(resultDetail.status)}
                        {resultDetail.returnedBy && <span className="font-normal"> · by {resultDetail.returnedBy}</span>}
                        {resultDetail.returnedAt && (
                            <span className="font-normal"> · {formatWhen(resultDetail.returnedAt)}</span>
                        )}
                    </p>
                    <p className="mt-1 break-words text-fg">{resultDetail.returnReason}</p>
                </div>
            )}

            {!canReviewActions && (
                <p
                    role="status"
                    className="mb-4 rounded-lg border border-edge bg-surface-muted px-4 py-2.5 text-xs text-fg-secondary"
                >
                    {isWithMlt
                        ? WITH_MLT_NOTICE
                        : 'This case is already reviewed. Actions reopen only when clinical sends it back for recheck.'}
                </p>
            )}

            {/* Review summary */}
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <KpiTile label="Parameters" value={labResults.length} icon={ListChecks} note="In this test group" />
                <KpiTile
                    label="Abnormal"
                    value={abnormalCount}
                    icon={AlertTriangle}
                    tone={abnormalCount > 0 ? 'warning' : 'neutral'}
                    note={abnormalCount > 0 ? 'Outside reference range' : 'All within range'}
                />
                <KpiTile
                    label="Critical"
                    value={criticalCount}
                    icon={AlertOctagon}
                    tone={criticalCount > 0 ? 'danger' : 'neutral'}
                    note={criticalCount > 0 ? 'Needs immediate attention' : 'No critical values'}
                />
                <KpiTile
                    label="Delta alerts"
                    value={significantDeltaCount}
                    icon={Activity}
                    tone={significantDeltaCount > 0 ? 'warning' : 'neutral'}
                    note={significantDeltaCount > 0 ? 'Large change vs previous visit' : 'No significant change'}
                />
            </div>

            <div className="grid gap-4 pb-12 lg:grid-cols-[1fr_320px]">
                {/* Results table */}
                <SectionCard
                    title={resultDetail.testType ?? 'Selected test group'}
                    count={labResults.length}
                    flush
                    className="min-w-0 self-start"
                >
                    {labResults.length === 0 ? (
                        <EmptyState
                            compact
                            icon={Activity}
                            title="No parameters recorded"
                            description="This result has no parameter values to review yet."
                        />
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[820px] table-fixed text-left text-[13px]">
                                <thead>
                                    <tr className="border-b border-edge text-xs font-medium text-fg-muted">
                                        <th scope="col" className="py-2 pl-4 pr-3 font-medium">
                                            Parameter
                                        </th>
                                        <th scope="col" className="w-24 px-3 py-2 font-medium">
                                            Result
                                        </th>
                                        <th scope="col" className="w-20 px-3 py-2 font-medium">
                                            Unit
                                        </th>
                                        <th scope="col" className="w-32 px-3 py-2 font-medium">
                                            Flag
                                        </th>
                                        <th scope="col" className="w-32 px-3 py-2 font-medium">
                                            Reference range
                                        </th>
                                        <th scope="col" className="w-48 px-3 py-2 font-medium">
                                            Delta / previous visit
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-edge whitespace-nowrap">
                                    {labResults.map((row) => {
                                        const delta = formatDeltaPercent(row.deltaPercent);
                                        const tone = DELTA_CHIP_TONE[deltaTone(row.deltaPercent, row.deltaSignificant)];
                                        return (
                                            <tr key={row.key} className="hover:bg-surface-hover">
                                                <td className="truncate py-2 pl-4 pr-3 font-medium text-fg" title={row.parameter}>
                                                    {row.parameter}
                                                </td>
                                                <td
                                                    className={`px-3 py-2 font-semibold tabular-nums ${
                                                        row.isCritical
                                                            ? 'text-status-danger-fg'
                                                            : row.isAbnormal
                                                              ? 'text-status-pending-fg'
                                                              : 'text-fg'
                                                    }`}
                                                >
                                                    {row.result}
                                                </td>
                                                <td className="px-3 py-2 text-xs text-fg-muted">{row.unit}</td>
                                                <td className="px-3 py-2">
                                                    {row.rawFlag ? (
                                                        <StatusChip tone={toneForFlag(row.rawFlag)} size="sm" dot>
                                                            {humanizeStatus(row.rawFlag)}
                                                        </StatusChip>
                                                    ) : (
                                                        <span className="text-fg-faint">—</span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2 text-xs tabular-nums text-fg-muted">
                                                    {row.referenceRange}
                                                </td>
                                                <td className="px-3 py-2">
                                                    {row.previousValue != null ? (
                                                        <div
                                                            className="flex items-center gap-1.5"
                                                            title={
                                                                row.previousSampleBarcode
                                                                    ? `Previous specimen ${row.previousSampleBarcode}`
                                                                    : undefined
                                                            }
                                                        >
                                                            <span className="tabular-nums text-fg-secondary">{row.previousValue}</span>
                                                            {delta ? (
                                                                <StatusChip tone={tone} size="sm" className="tabular-nums">
                                                                    Δ {delta}
                                                                </StatusChip>
                                                            ) : null}
                                                            <span className="truncate text-xs text-fg-muted">
                                                                {formatWhen(row.previousVisitedAt)}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-fg-faint">No previous visit</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </SectionCard>

                {/* Side panels */}
                <div className="flex min-w-0 flex-col gap-4">
                    {/* Supervisor checklist — gates the approve action */}
                    <SectionCard
                        title="Supervisor checklist"
                        actions={
                            <StatusChip tone={isChecklistComplete ? 'success' : 'pending'} size="sm">
                                {completedChecklistCount}/{SUPERVISOR_CHECKLIST.length} checked
                            </StatusChip>
                        }
                        flush
                    >
                        <ul className="divide-y divide-edge">
                            {SUPERVISOR_CHECKLIST.map((item) => {
                                const checked = reviewChecklist[item.id] ?? false;
                                const checkboxId = `checklist-${item.id}`;

                                return (
                                    <li
                                        key={item.id}
                                        className={`flex items-start gap-3 px-4 py-2.5 transition-colors ${
                                            checked ? 'bg-status-verified-bg' : ''
                                        } ${canReviewActions ? 'hover:bg-surface-hover' : 'opacity-60'}`}
                                    >
                                        <input
                                            id={checkboxId}
                                            type="checkbox"
                                            checked={checked}
                                            disabled={!canReviewActions}
                                            onChange={() => toggleChecklistItem(item.id)}
                                            className={`mt-0.5 ${CHECKBOX_CLASS} ${
                                                canReviewActions ? 'cursor-pointer' : ''
                                            }`}
                                        />
                                        <label
                                            htmlFor={checkboxId}
                                            className={`min-w-0 flex-1 break-words leading-5 ${
                                                canReviewActions ? 'cursor-pointer' : 'cursor-not-allowed'
                                            }`}
                                        >
                                            <span
                                                className={`block text-[13px] font-medium ${
                                                    checked ? 'text-status-verified-fg' : 'text-fg'
                                                }`}
                                            >
                                                {item.label}
                                            </span>
                                        </label>
                                    </li>
                                );
                            })}
                        </ul>
                        {!isChecklistComplete && canReviewActions && (
                            <p
                                role="status"
                                className="border-t border-edge bg-surface-muted px-4 py-2.5 text-xs font-medium text-amber-700"
                            >
                                Complete all checklist items before approving and releasing this case.
                            </p>
                        )}
                    </SectionCard>

                    <SectionCard title="Previous visits" count={resultDetail.previousVisits?.length ?? 0} flush>
                        {resultDetail.previousVisits && resultDetail.previousVisits.length > 0 ? (
                            <ul className="divide-y divide-edge">
                                {resultDetail.previousVisits.map((visit) => (
                                    <li key={visit.sampleId}>
                                        <button
                                            type="button"
                                            onClick={() => router.push(`/verification/review/${visit.resultId}`)}
                                            className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                                        >
                                            <span className="min-w-0">
                                                <span className="block text-sm font-medium text-fg">
                                                    {formatWhen(visit.visitedAt)}
                                                </span>
                                                <span className="mt-0.5 block truncate font-mono text-xs text-fg-muted">
                                                    {displayResultNo(visit.resultNo, visit.resultId)}
                                                </span>
                                                <span className="mt-0.5 block text-xs tabular-nums text-fg-muted">
                                                    {visit.parameterCount ?? 0} parameters · {visit.abnormalCount ?? 0} abnormal ·{' '}
                                                    {visit.criticalCount ?? 0} critical
                                                </span>
                                            </span>
                                            <span className="flex shrink-0 flex-col items-end gap-1">
                                                {visit.priorityLevel && <PriorityBadge priority={visit.priorityLevel} />}
                                                <StatusChip tone={resultStatusTone(visit.status)} size="sm">
                                                    {visit.status ? resultStatusLabel(visit.status) : '—'}
                                                </StatusChip>
                                            </span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <EmptyState
                                compact
                                icon={History}
                                title="No previous visits"
                                description="No earlier results for this test group."
                            />
                        )}
                    </SectionCard>

                    <SectionCard title="MLT notes">
                        <div className="flex gap-3">
                            <span
                                aria-hidden="true"
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[11px] font-semibold text-primary-strong"
                            >
                                {initialsFor(mltNotesAuthor, 'ML')}
                            </span>
                            <div className="min-w-0 flex-1">
                                <div className="mb-1 flex items-center justify-between gap-3">
                                    <span className="truncate text-xs font-semibold text-fg">
                                        {mltNotesAuthor}
                                        <span className="ml-1 font-normal text-fg-muted">Performed by</span>
                                    </span>
                                    <span
                                        className="shrink-0 text-[11px] text-fg-muted"
                                        title={formatExact(resultDetail.measuredAt ?? resultDetail.updatedAt)}
                                    >
                                        {formatRelative(resultDetail.measuredAt ?? resultDetail.updatedAt)}
                                    </span>
                                </div>
                                <p className="whitespace-pre-wrap break-words rounded-md border border-edge bg-surface-muted p-3 text-xs leading-relaxed text-fg-secondary">
                                    {resultDetail.mltNotes || 'No MLT notes available.'}
                                </p>
                            </div>
                        </div>
                    </SectionCard>

                    {resultDetail.clinicalNote && (
                        <SectionCard title="Clinical note">
                            <div className="flex gap-3">
                                <span
                                    aria-hidden="true"
                                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-status-pending-bg text-[11px] font-semibold text-status-pending-fg"
                                >
                                    {initialsFor(resultDetail.pathologistName, 'CL')}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <div className="mb-1 flex items-center justify-between gap-3">
                                        <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-fg">
                                            <Stethoscope className="h-4 w-4 shrink-0 text-fg-faint" aria-hidden="true" />
                                            <span className="truncate">{resultDetail.pathologistName ?? 'Pathologist'}</span>
                                        </span>
                                        <span className="shrink-0 text-[11px] text-fg-muted">
                                            {formatRelative(resultDetail.updatedAt)}
                                        </span>
                                    </div>
                                    <p className="whitespace-pre-wrap break-words rounded-md border border-edge bg-surface-muted p-3 text-xs leading-relaxed text-fg-secondary">
                                        {resultDetail.clinicalNote}
                                    </p>
                                </div>
                            </div>
                        </SectionCard>
                    )}
                </div>
            </div>

            {/* Return to MLT dialog */}
            <Modal
                open={showReturnModal}
                onClose={closeReturnModal}
                dismissible={!isSubmitting}
                title="Return to MLT"
                description="Send this case back to the bench for re-run, re-entry or recollection. The reason is recorded on the case and shown to the MLT."
                footer={
                    <>
                        <Button onClick={closeReturnModal} disabled={isSubmitting}>
                            Cancel
                        </Button>
                        <Button variant="danger" icon={Undo2} onClick={handleReturn} loading={isSubmitting}>
                            Return to MLT
                        </Button>
                    </>
                }
            >
                <TextareaField
                    id="return-reason"
                    label="Return reason"
                    required
                    rows={5}
                    value={returnReason}
                    onChange={(event) => {
                        setReturnReason(event.target.value);
                        if (returnError) {
                            setReturnError(null);
                        }
                        if (submitError) {
                            setSubmitError(null);
                        }
                    }}
                    placeholder="e.g. Haemolysed specimen — recollect and re-run."
                    error={returnError}
                    hint="The MLT will see this note with the returned case. Their own notes are kept."
                />
            </Modal>

            {/* Approve dialog */}
            <Modal
                open={showApproveModal}
                onClose={closeApproveModal}
                dismissible={!isSubmitting}
                title="Approve and release to the pathologist"
                description="Add an optional handoff note for the pathologist."
                footer={
                    <>
                        <Button onClick={closeApproveModal} disabled={isSubmitting}>
                            Cancel
                        </Button>
                        <Button
                            variant="primary"
                            icon={CheckCircle2}
                            onClick={handleApprove}
                            loading={isSubmitting}
                            disabled={!isChecklistComplete}
                        >
                            Confirm approval
                        </Button>
                    </>
                }
            >
                <div className="space-y-3">
                    <div className="flex items-start gap-2 text-sm">
                        <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-fg-faint" aria-hidden="true" />
                        <p className="text-fg-secondary">
                            Signing as <span className="font-medium text-fg">{reviewerName}</span> ({reviewerRole}).
                        </p>
                    </div>
                    <div className="flex items-start gap-2 rounded-md border border-edge bg-surface-muted px-3 py-2 text-xs">
                        <ListChecks className="mt-px h-4 w-4 shrink-0 text-fg-faint" aria-hidden="true" />
                        <p className="min-w-0 text-fg-secondary">
                            Supervisor checklist{' '}
                            <span className="font-medium tabular-nums text-fg">
                                {completedChecklistCount}/{SUPERVISOR_CHECKLIST.length}
                            </span>{' '}
                            confirmed.
                            {!isChecklistComplete && ' Complete every check before approving this case.'}
                        </p>
                    </div>
                    <TextareaField
                        id="approve-note"
                        label="Lab supervisor note"
                        rows={5}
                        value={approveNote}
                        onChange={(event) => {
                            setApproveNote(event.target.value);
                            if (submitError) {
                                setSubmitError(null);
                            }
                        }}
                        placeholder="Add a note for the pathologist (optional)..."
                        error={submitError ?? undefined}
                        hint="Optional. Recorded against this case release."
                    />
                </div>
            </Modal>
        </div>
    );
}
