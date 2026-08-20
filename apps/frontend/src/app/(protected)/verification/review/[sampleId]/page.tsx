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
    getVerificationResultDetails,
    rejectTechnically,
    TestResultDetail,
} from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { formatDisplayId } from '@/lib/format-id';
import Button from '@/components/ui/Button';
import PageHeader, { type Crumb } from '@/components/ui/PageHeader';
import SectionCard from '@/components/ui/SectionCard';
import EmptyState from '@/components/ui/EmptyState';
import KpiTile from '@/components/ui/KpiTile';
import Modal from '@/components/ui/Modal';
import StatusChip, { humanizeStatus, toneForStatus, type ChipTone } from '@/components/ui/StatusChip';
import { TextareaField } from '@/components/ui/Field';
import PriorityBadge from '@/components/shared/PriorityBadge';
import { formatAuditTime, formatRegistered } from '@/components/patient-dashboard/dashboard-data';

const REVIEW_CRUMBS: Crumb[] = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Verification', href: '/verification' },
    { label: 'Pending', href: '/verification/pending' },
];

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

/** Verification workflow status → chip tone. */
const WORKFLOW_TONE: Record<string, ChipTone> = {
    ENTERED: 'pending',
    RETURNED_FOR_RECHECK: 'pending',
    TECHNICALLY_VERIFIED: 'success',
    CLINICALLY_AUTHORIZED: 'success',
    REJECTED: 'danger',
};

const toneForWorkflowStatus = (status?: string | null): ChipTone => {
    if (!status) {
        return 'pending';
    }

    return WORKFLOW_TONE[status.toUpperCase()] ?? toneForStatus(status);
};

const formatWorkflowStatusLabel = (status?: string | null) => {
    if (!status) {
        return 'Pending verification';
    }

    if (status === 'RETURNED_FOR_RECHECK') {
        return 'Returned to supervisor';
    }

    return humanizeStatus(status);
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

/** "2h ago" / "Today 09:12" / "16 Aug 2026" — for activity-style meta lines. */
const formatRelative = (value?: string | null) => (value ? formatAuditTime(value) : '—');

const initialsFor = (name: string | null | undefined, fallback: string) =>
    (name ?? fallback)
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((segment) => segment.charAt(0).toUpperCase())
        .join('') || fallback;

const REVIEWED_NOTICE =
    'This case has already been processed. Actions reopen only after a clinical return for recheck.';

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
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [requiresQcOverride, setRequiresQcOverride] = useState(false);

    const loadResultDetails = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await getVerificationResultDetails(resultId);
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
            };
        });
    }, [resultDetail]);

    const abnormalCount = labResults.filter((row) => row.isAbnormal).length;
    const criticalCount = labResults.filter((row) => row.isCritical).length;

    const mltNotesAuthor =
        resultDetail?.mltName?.trim() ||
        resultDetail?.technicianName?.trim() ||
        'Unknown technician';
    const patientDemographics = [
        resultDetail?.patientAge != null ? `${resultDetail.patientAge} y` : null,
        formatGenderLabel(resultDetail?.patientGender),
    ]
        .filter(Boolean)
        .join(' · ');
    const reviewerName = user?.name || user?.preferred_username || 'Current user';
    const reviewerRole = 'Lab Supervisor';
    const canReviewActions =
        resultDetail?.status === 'ENTERED' || resultDetail?.status === 'RETURNED_FOR_RECHECK';
    const displayId = formatDisplayId(resultId, 'RES');

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
        setRequiresQcOverride(false);
        setSubmitError(null);
    }, []);

    const openReturnModal = () => {
        if (!canReviewActions) {
            setSubmitError(REVIEWED_NOTICE);
            return;
        }
        setShowReturnModal(true);
        setReturnError(null);
        setSubmitError(null);
    };

    const openApproveModal = () => {
        if (!canReviewActions) {
            setSubmitError(REVIEWED_NOTICE);
            return;
        }
        setShowApproveModal(true);
        setSubmitError(null);
    };

    const handleApprove = async () => {
        if (!canReviewActions) {
            setSubmitError(REVIEWED_NOTICE);
            return;
        }
        const trimmedSupervisorNote = approveNote.trim();

        if (requiresQcOverride && trimmedSupervisorNote.length < 20) {
            setSubmitError('A QC override reason of at least 20 characters is required.');
            return;
        }

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
            setRequiresQcOverride(false);
            router.push('/verification/pending');
        } catch (submitError) {
            console.error('Failed to approve result', submitError);
            const message = resolveSubmitErrorMessage('approve', submitError);
            if (message.startsWith('QC hold')) {
                setRequiresQcOverride(true);
            }
            setSubmitError(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleReturn = async () => {
        if (!canReviewActions) {
            setReturnError('This case has already been processed. Return is available again only after a clinical recheck request.');
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
            await rejectTechnically(resultId, {
                status: 'REJECTED',
                mltNotes: `Returned by ${reviewerName} (${reviewerRole}): ${trimmedReason}`,
            });
            setShowReturnModal(false);
            setReturnReason('');
            router.push('/verification/pending');
        } catch (submitError) {
            console.error('Failed to reject result', submitError);
            setReturnError(resolveSubmitErrorMessage('return', submitError));
        } finally {
            setIsSubmitting(false);
        }
    };

    // ── Loading state ─────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="mx-auto max-w-5xl">
                <PageHeader title="Result review" crumbs={[...REVIEW_CRUMBS, { label: 'Loading…' }]} />
                <p role="status" aria-live="polite" className="sr-only">
                    Loading verification result
                </p>
                <div aria-hidden="true">
                    <div className="mb-4 rounded-lg border border-edge bg-surface px-4 py-3">
                        <span className="block h-4 w-48 rounded bg-skeleton" />
                    </div>
                    <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                        {Array.from({ length: 3 }).map((_, i) => (
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
                                <span className="block h-4 w-28 rounded bg-skeleton" />
                                <div className="mt-4 space-y-2">
                                    {Array.from({ length: 3 }).map((_, i) => (
                                        <span key={i} className="block h-12 rounded bg-skeleton" />
                                    ))}
                                </div>
                            </div>
                            <div className="rounded-lg border border-edge bg-surface p-4">
                                <span className="block h-4 w-20 rounded bg-skeleton" />
                                <span className="mt-4 block h-16 rounded bg-skeleton" />
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
            <div className="mx-auto max-w-5xl">
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
        <StatusChip tone={toneForWorkflowStatus(resultDetail.status)} dot>
            {formatWorkflowStatusLabel(resultDetail.status)}
        </StatusChip>
    );

    return (
        <div className="mx-auto max-w-5xl">
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
                            disabled={isSubmitting || !canReviewActions}
                        >
                            Approve and release
                        </Button>
                    </>
                }
            />

            {/* Sample context banner */}
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

            {!canReviewActions && (
                <p
                    role="status"
                    className="mb-4 rounded-lg border border-edge bg-surface-muted px-4 py-2.5 text-xs text-fg-secondary"
                >
                    This case is already reviewed. Actions reopen only when clinical sends it back for recheck.
                </p>
            )}

            {/* Review summary */}
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
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
                            <table className="w-full min-w-[640px] table-fixed text-left text-[13px]">
                                <thead>
                                    <tr className="border-b border-edge text-xs font-medium text-fg-muted">
                                        <th scope="col" className="py-2 pl-4 pr-3 font-medium">
                                            Parameter
                                        </th>
                                        <th scope="col" className="w-28 px-3 py-2 font-medium">
                                            Result
                                        </th>
                                        <th scope="col" className="w-20 px-3 py-2 font-medium">
                                            Unit
                                        </th>
                                        <th scope="col" className="w-32 px-3 py-2 font-medium">
                                            Flag
                                        </th>
                                        <th scope="col" className="w-36 px-3 py-2 font-medium">
                                            Reference range
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-edge whitespace-nowrap">
                                    {labResults.map((row) => (
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
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </SectionCard>

                {/* Side panels */}
                <div className="flex min-w-0 flex-col gap-4">
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
                                                <span className="mt-0.5 block text-xs tabular-nums text-fg-muted">
                                                    {visit.parameterCount ?? 0} parameters · {visit.abnormalCount ?? 0} abnormal ·{' '}
                                                    {visit.criticalCount ?? 0} critical
                                                </span>
                                            </span>
                                            <span className="flex shrink-0 flex-col items-end gap-1">
                                                {visit.priorityLevel && <PriorityBadge priority={visit.priorityLevel} />}
                                                <StatusChip tone={toneForWorkflowStatus(visit.status)} size="sm">
                                                    {visit.status ? formatWorkflowStatusLabel(visit.status) : '—'}
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
                                    <span className="truncate text-xs font-semibold text-fg">{mltNotesAuthor}</span>
                                    <span className="shrink-0 text-[11px] text-fg-muted">
                                        {formatRelative(resultDetail.updatedAt)}
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
                description="Add the reason this case should be sent back."
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
                    placeholder="Enter the reason for return."
                    error={returnError}
                    hint="The MLT will see this note with the returned case."
                />
            </Modal>

            {/* Approve dialog */}
            <Modal
                open={showApproveModal}
                onClose={closeApproveModal}
                dismissible={!isSubmitting}
                title="Approve for clinical review"
                description={
                    requiresQcOverride
                        ? 'QC is on hold. Add a documented release reason of at least 20 characters.'
                        : 'Add an optional handoff note for the pathologist.'
                }
                footer={
                    <>
                        <Button onClick={closeApproveModal} disabled={isSubmitting}>
                            Cancel
                        </Button>
                        <Button variant="primary" icon={CheckCircle2} onClick={handleApprove} loading={isSubmitting}>
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
                    <TextareaField
                        id="approve-note"
                        label="Lab supervisor note"
                        required={requiresQcOverride}
                        rows={5}
                        value={approveNote}
                        minLength={requiresQcOverride ? 20 : undefined}
                        onChange={(event) => {
                            setApproveNote(event.target.value);
                            if (submitError) {
                                setSubmitError(null);
                            }
                        }}
                        placeholder={
                            requiresQcOverride
                                ? 'Explain why this result is being released over the QC hold.'
                                : 'Add a note for the pathologist.'
                        }
                        error={
                            submitError
                                ? requiresQcOverride
                                    ? `${submitError} (${approveNote.trim().length}/20)`
                                    : submitError
                                : undefined
                        }
                        hint={
                            requiresQcOverride
                                ? `${approveNote.trim().length}/20 characters minimum`
                                : 'Optional. Shown to the pathologist with the case.'
                        }
                    />
                </div>
            </Modal>
        </div>
    );
}
