'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import axios from 'axios';
import {
    AlertCircle,
    AlertTriangle,
    ArrowLeft,
    ArrowUpRight,
    BadgeCheck,
    CheckCircle2,
    Download,
    Eye,
    FileText,
    History,
    Undo2,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useRoles } from '@/hooks/useRoles';
import {
    authorizeClinical,
    downloadPatientDocument,
    getClinicalResultDetails,
    getPatientDocuments,
    returnForRecheck,
    TestResultDetail,
} from '@/lib/api';
import type { PatientDocument } from '@/lib/api';
import {
    deltaTone,
    displayResultNo,
    formatDeltaPercent,
    resultStatusLabel,
    resultStatusTone,
} from '@/lib/result-display';
import { cn } from '@/lib/utils';
import Button from '@/components/ui/Button';
import PageHeader from '@/components/ui/PageHeader';
import SectionCard from '@/components/ui/SectionCard';
import EmptyState from '@/components/ui/EmptyState';
import Modal from '@/components/ui/Modal';
import StatusChip, { humanizeStatus, type ChipTone } from '@/components/ui/StatusChip';
import { TextareaField } from '@/components/ui/Field';
import PriorityBadge from '@/components/shared/PriorityBadge';
import { formatRegistered } from '@/components/patient-dashboard/dashboard-data';

const getInitials = (value: string) =>
    value
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('') || 'P';

const withDoctorPrefix = (value: string) => (value.startsWith('Dr.') ? value : `Dr. ${value}`);

/** The one actionError that is a validation error on the return-reason field, not a server failure. */
const RETURN_REASON_REQUIRED = 'Please enter a reason for returning.';

/** "Today 09:12" / "Yesterday 14:02" / "12 Aug 2026"; null when absent or unparseable. */
const formatDateTime = (value?: string | null) => {
    if (!value) {
        return null;
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return formatRegistered(date);
};

/** Full date and time for the encounter facts where the exact clock matters. */
const formatExact = (value?: string | null) => {
    if (!value) {
        return null;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return null;
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

const formatGender = (value?: string | null) => {
    if (!value) {
        return null;
    }

    const normalized = value.toLowerCase();
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const formatFileSize = (bytes?: number | null) => {
    if (!bytes) {
        return '0 Bytes';
    }

    const units = ['Bytes', 'KB', 'MB', 'GB'];
    const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / Math.pow(1024, unitIndex);
    return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};

const formatDocumentType = (value?: string | null) =>
    value ? value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase()) : 'Document';

const getStatusLabel = (status?: string | null) => {
    if (status === 'CLINICALLY_AUTHORIZED') {
        return 'Authorized';
    }
    if (status === 'TECHNICALLY_VERIFIED' || !status) {
        return 'Pending clinical review';
    }
    return resultStatusLabel(status);
};

const getStatusTone = (status?: string | null): ChipTone => {
    if (status === 'CLINICALLY_AUTHORIZED') {
        return 'success';
    }
    if (status === 'RETURNED_FOR_RECHECK' || status === 'RETURNED_TO_MLT') {
        return 'danger';
    }
    if (status === 'TECHNICALLY_VERIFIED' || !status) {
        return 'pending';
    }
    return resultStatusTone(status);
};

const getFlagTone = (flag: string): ChipTone =>
    flag === 'CRITICAL_HIGH' || flag === 'CRITICAL_LOW' ? 'danger' : 'pending';

const getFlagLabel = (flag: string) => {
    if (flag === 'CRITICAL_HIGH') {
        return 'Critical high';
    }
    if (flag === 'CRITICAL_LOW') {
        return 'Critical low';
    }
    if (flag === 'HIGH') {
        return 'High';
    }
    if (flag === 'LOW') {
        return 'Low';
    }
    return flag.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (char) => char.toUpperCase());
};

const DELTA_CHIP_TONE: Record<ReturnType<typeof deltaTone>, ChipTone> = {
    neutral: 'neutral',
    pending: 'pending',
    danger: 'danger',
};

export default function ClinicalReviewPage() {
    const router = useRouter();
    const { user } = useAuth();
    const { hasRole } = useRoles();
    const params = useParams<{ sampleId: string }>();
    const sampleId = Array.isArray(params.sampleId) ? params.sampleId[0] : params.sampleId;
    const resultId = sampleId;

    const [data, setData] = useState<TestResultDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [reloadToken, setReloadToken] = useState(0);
    const [interpretation, setInterpretation] = useState('');
    const [showReturnModal, setShowReturnModal] = useState(false);
    const [returnReason, setReturnReason] = useState('');
    const [showSignModal, setShowSignModal] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);
    const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);
    const [isSubmittingAuthorize, setIsSubmittingAuthorize] = useState(false);
    const [documents, setDocuments] = useState<PatientDocument[]>([]);
    const [documentsLoading, setDocumentsLoading] = useState(false);
    const [documentsError, setDocumentsError] = useState<string | null>(null);

    /** Short, human-readable case reference; the raw id stays in the title attribute. */
    const displayId = displayResultNo(data?.resultNo, sampleId);
    const rawPathologistName = user?.name || user?.preferred_username || 'Pathologist';
    const pathologistDisplayName = withDoctorPrefix(rawPathologistName);
    // Admins may read this screen for oversight; only a pathologist signs or returns.
    const isPathologist = hasRole('PATHOLOGIST');
    const isAuthorized = data?.status === 'CLINICALLY_AUTHORIZED';
    const canActOnCase = data?.status === 'TECHNICALLY_VERIFIED' && isPathologist;
    const authorizationActor = withDoctorPrefix(data?.pathologistName || rawPathologistName);
    const authorizationInitials = getInitials(data?.pathologistName || rawPathologistName);

    const handleBack = () => {
        if (typeof window !== 'undefined' && window.history.length > 1) {
            router.back();
            return;
        }
        router.push('/clinical/worklist');
    };

    // Stable close handlers: Modal re-runs its focus effect whenever onClose changes.
    const closeReturnModal = useCallback(() => {
        setShowReturnModal(false);
        setActionError(null);
    }, []);
    const closeSignModal = useCallback(() => setShowSignModal(false), []);

    useEffect(() => {
        const loadClinicalResultDetails = async () => {
            try {
                setLoading(true);
                setError(null);
                setActionError(null);
                const response = await getClinicalResultDetails(resultId);
                setData(response);
                setInterpretation(response.clinicalNote ?? '');
                setDocuments([]);
                setDocumentsError(null);
                setDocumentsLoading(false);

                if (response.patientCode) {
                    try {
                        setDocumentsLoading(true);
                        const documentPage = await getPatientDocuments(response.patientCode, {
                            page: 0,
                            size: 5,
                        });
                        setDocuments(documentPage.content ?? []);
                    } catch (documentError) {
                        console.error('Failed to load patient documents', documentError);
                        setDocumentsError('Patient documents could not be loaded.');
                    } finally {
                        setDocumentsLoading(false);
                    }
                }
            } catch (loadError) {
                console.error('Failed to load clinical result details', loadError);
                setError('Failed to load clinical result details. Please try again.');
            } finally {
                setLoading(false);
            }
        };

        if (resultId) {
            void loadClinicalResultDetails();
        }
    }, [resultId, reloadToken]);

    const labResults = (data?.parameters ?? []).map((parameter) => ({
        parameter: parameter.parameterName,
        result: parameter.resultText ?? parameter.resultValue ?? '-',
        unit: parameter.unit ?? '-',
        flag: parameter.flag ?? 'NORMAL',
        referenceRange:
            parameter.referenceRangeLow != null && parameter.referenceRangeHigh != null
                ? `${parameter.referenceRangeLow} - ${parameter.referenceRangeHigh}`
                : '-',
        isAbnormal: parameter.flag != null && parameter.flag !== 'NORMAL',
        previousValue: parameter.previousValue ?? null,
        previousVisitedAt: parameter.previousVisitedAt ?? null,
        previousSampleBarcode: parameter.previousSampleBarcode ?? null,
        deltaPercent: parameter.deltaPercent ?? null,
        deltaSignificant: parameter.deltaSignificant ?? null,
    }));

    const flaggedResults = labResults.filter((row) => row.isAbnormal);
    const criticalResults = flaggedResults.filter(
        (row) => row.flag === 'CRITICAL_HIGH' || row.flag === 'CRITICAL_LOW'
    );
    const bannerResults = (criticalResults.length > 0 ? criticalResults : flaggedResults).slice(0, 3);

    const describeFlag = (flag: string) => {
        if (flag === 'CRITICAL_HIGH') {
            return 'critically high';
        }
        if (flag === 'CRITICAL_LOW') {
            return 'critically low';
        }
        if (flag === 'HIGH') {
            return 'above normal range';
        }
        if (flag === 'LOW') {
            return 'below normal range';
        }
        return 'outside normal range';
    };

    const abnormalSummary = bannerResults
        .map((row) => `${row.parameter} ${describeFlag(row.flag)} (${row.result}${row.unit && row.unit !== '-' ? ` ${row.unit}` : ''})`)
        .join('. ');

    const hasAbnormalBanner = flaggedResults.length > 0;
    const hasCriticalBanner = criticalResults.length > 0;

    const previousVisits = data?.previousVisits ?? [];

    const describeLockedCase = (verb: 'authorized' | 'returned') => {
        if (!isPathologist) {
            return `Only a pathologist can ${verb === 'authorized' ? 'authorize' : 'return'} this case. Your access is read-only.`;
        }
        if (data?.status === 'CLINICALLY_AUTHORIZED') {
            return 'This case is already authorized.';
        }
        if (data?.status === 'RETURNED_FOR_RECHECK' && verb === 'returned') {
            return 'This case has already been returned to the lab supervisor.';
        }
        return `This case can no longer be ${verb} from its current status: ${getStatusLabel(data?.status)}.`;
    };

    const handleAuthorize = () => {
        if (!canActOnCase) {
            setActionError(describeLockedCase('authorized'));
            return;
        }
        setActionError(null);
        if (!interpretation.trim()) {
            setActionError('Please enter a clinical interpretation before authorizing.');
            return;
        }
        setShowSignModal(true);
    };

    const handleConfirmSign = async () => {
        if (isSubmittingAuthorize) {
            return;
        }
        if (!canActOnCase) {
            setShowSignModal(false);
            setActionError(describeLockedCase('authorized'));
            return;
        }
        try {
            setIsSubmittingAuthorize(true);
            setActionError(null);
            setShowSignModal(false);
            const response = await authorizeClinical(resultId, {
                status: 'CLINICALLY_AUTHORIZED',
                clinicalNote: interpretation.trim(),
                signatureConfirmed: true,
            });

            setData(response);
            setInterpretation(response.clinicalNote ?? interpretation);
            router.push('/clinical/worklist');
        } catch (error) {
            console.error('Failed to authorize clinical result', error);
            setActionError(resolveActionErrorMessage(error, 'authorize this case'));
        } finally {
            setIsSubmittingAuthorize(false);
        }
    };

    const handleReturn = async () => {
        if (isSubmittingReturn) {
            return;
        }
        if (!canActOnCase) {
            setShowReturnModal(false);
            setActionError(describeLockedCase('returned'));
            return;
        }
        if (!returnReason.trim()) {
            setActionError(RETURN_REASON_REQUIRED);
            return;
        }
        try {
            setIsSubmittingReturn(true);
            setActionError(null);
            await returnForRecheck(resultId, {
                status: 'RETURNED_FOR_RECHECK',
                returnReason: returnReason.trim(),
            });

            setShowReturnModal(false);
            router.push('/clinical/worklist');
        } catch (error) {
            console.error('Failed to return clinical case', error);
            setActionError(resolveActionErrorMessage(error, 'return this case to the lab supervisor'));
        } finally {
            setIsSubmittingReturn(false);
        }
    };

    const handleDownloadDocument = async (documentId: string, fileName: string) => {
        if (!data?.patientCode) {
            setDocumentsError('Patient code is not available for this case.');
            return;
        }

        try {
            setDocumentsError(null);
            const url = await downloadPatientDocument(data.patientCode, documentId);
            if (url) {
                const link = document.createElement('a');
                link.href = url;
                link.download = fileName;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        } catch (downloadError) {
            console.error('Failed to download patient document', downloadError);
            setDocumentsError('Document download failed. Please try again.');
        }
    };

    const resolveActionErrorMessage = (error: unknown, fallbackAction: string) => {
        if (axios.isAxiosError(error)) {
            const status = error.response?.status;
            const backendMessage = error.response?.data?.message;

            if (status === 409) {
                return backendMessage || 'This case was changed by another action. Refresh the page and try again.';
            }

            if (status === 403) {
                return 'Only a pathologist can perform this action.';
            }

            if (status === 422) {
                if (backendMessage?.includes('Current: CLINICALLY_AUTHORIZED')) {
                    return 'This case has already been authorized and can no longer be changed.';
                }
                if (backendMessage?.includes('Current: RETURNED_FOR_RECHECK')) {
                    return 'This case has already been returned to the lab supervisor.';
                }
                return backendMessage || 'This action is no longer allowed for the current case status.';
            }

            if (status === 400) {
                if (backendMessage?.includes('Could not resolve a branch for dispatch registration')) {
                    return 'This case could not be sent to dispatch because no branch could be resolved.';
                }
                return backendMessage || 'The request could not be completed.';
            }

            if (backendMessage) {
                return backendMessage;
            }
        }

        return `Failed to ${fallbackAction}. Please try again.`;
    };

    const crumbs = [
        { label: 'Clinical worklist', href: '/clinical/worklist' },
        { label: 'Review' },
    ];

    if (loading) {
        return (
            <div className="mx-auto max-w-[1400px]">
                <PageHeader crumbs={crumbs} title="Clinical review" meta={<span>Loading case details</span>} />
                <p role="status" aria-live="polite" className="sr-only">
                    Loading clinical result details
                </p>
                <div aria-hidden="true" className="space-y-4">
                    <div className="rounded-lg border border-edge bg-surface px-4 py-3">
                        <div className="flex items-center gap-3">
                            <span className="h-12 w-12 shrink-0 rounded-full bg-skeleton" />
                            <div className="flex-1 space-y-2">
                                <span className="block h-4 w-48 max-w-full rounded bg-skeleton" />
                                <span className="block h-3 w-72 max-w-full rounded bg-skeleton" />
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
                        <div className="space-y-4">
                            <div className="rounded-lg border border-edge bg-surface p-4">
                                {Array.from({ length: 5 }).map((_, index) => (
                                    <span key={index} className="my-3 block h-4 w-full rounded bg-skeleton" />
                                ))}
                            </div>
                            <div className="rounded-lg border border-edge bg-surface p-4">
                                <span className="block h-24 w-full rounded bg-skeleton" />
                            </div>
                        </div>
                        <div className="space-y-4">
                            {Array.from({ length: 3 }).map((_, index) => (
                                <div key={index} className="rounded-lg border border-edge bg-surface p-4">
                                    <span className="mb-3 block h-4 w-32 rounded bg-skeleton" />
                                    <span className="block h-12 w-full rounded bg-skeleton" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="mx-auto max-w-[1400px]">
                <PageHeader
                    crumbs={crumbs}
                    title="Clinical review"
                    meta={
                        <>
                            <span>Case</span>
                            <span className="min-w-0 break-words font-mono text-fg-secondary" title={sampleId}>
                                {displayId}
                            </span>
                        </>
                    }
                    actions={
                        <Button icon={ArrowLeft} onClick={handleBack}>
                            Back
                        </Button>
                    }
                />
                <div role="alert" className="rounded-lg border border-edge bg-surface">
                    <EmptyState
                        icon={AlertTriangle}
                        title="Couldn't load clinical result"
                        description={error ?? 'Failed to load clinical result details.'}
                        action={
                            <div className="flex flex-wrap items-center justify-center gap-2">
                                <Button size="sm" onClick={() => setReloadToken((token) => token + 1)}>
                                    Retry
                                </Button>
                                <Button size="sm" icon={ArrowLeft} href="/clinical/worklist">
                                    Back to worklist
                                </Button>
                            </div>
                        }
                    />
                </div>
            </div>
        );
    }

    const noteTimestamp = formatDateTime(data.updatedAt);
    const patientName = data.patientName ?? 'Unknown patient';
    const genderLabel = formatGender(data.patientGender);

    const encounterFacts: { label: string; value: string; mono?: boolean }[] = [
        { label: 'Patient ID', value: data.patientCode ?? '—', mono: true },
        {
            label: 'Age / sex',
            value: [data.patientAge != null ? `${data.patientAge} y` : null, genderLabel].filter(Boolean).join(' / ') || '—',
        },
        { label: 'Referring clinician', value: data.referringDoctor ?? '—' },
        { label: 'Ward / clinic', value: data.referringDepartment ?? '—' },
        { label: 'Collected', value: formatExact(data.collectedAt) ?? '—' },
        { label: 'Specimen', value: data.sampleBarcode ?? '—', mono: true },
    ];

    const hasReturnContext = Boolean(data.returnReason) &&
        (data.status === 'RETURNED_FOR_RECHECK' || data.status === 'RETURNED_TO_MLT');

    return (
        <div className="mx-auto max-w-[1400px]">
            <Modal
                open={showReturnModal}
                onClose={closeReturnModal}
                title="Return for recheck"
                description="The case goes back to the lab supervisor for recheck. Explain what needs attention."
                size="md"
                dismissible={!isSubmittingReturn}
                footer={
                    <>
                        <Button onClick={closeReturnModal} disabled={isSubmittingReturn}>
                            Cancel
                        </Button>
                        <Button variant="danger" icon={Undo2} onClick={handleReturn} loading={isSubmittingReturn}>
                            {isSubmittingReturn ? 'Returning' : 'Return to supervisor'}
                        </Button>
                    </>
                }
            >
                <TextareaField
                    label="Reason for return"
                    required
                    rows={4}
                    value={returnReason}
                    onChange={(event) => setReturnReason(event.target.value)}
                    placeholder="Describe why this case should be returned to the lab supervisor"
                    error={actionError === RETURN_REASON_REQUIRED ? actionError : undefined}
                />
                {actionError && actionError !== RETURN_REASON_REQUIRED && (
                    <div
                        role="alert"
                        className="mt-3 flex items-start gap-2 rounded-lg border border-status-danger-edge bg-status-danger-bg p-3 text-sm text-status-danger-fg"
                    >
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                        <p className="min-w-0 break-words">{actionError}</p>
                    </div>
                )}
            </Modal>

            <Modal
                open={showSignModal}
                onClose={closeSignModal}
                title="Attach signature and authorize"
                description="Your digital signature is attached to this report and the case is released for dispatch."
                size="sm"
                dismissible={!isSubmittingAuthorize}
                footer={
                    <>
                        <Button onClick={closeSignModal} disabled={isSubmittingAuthorize}>
                            Cancel
                        </Button>
                        <Button variant="primary" icon={CheckCircle2} onClick={handleConfirmSign} loading={isSubmittingAuthorize}>
                            {isSubmittingAuthorize ? 'Authorizing' : 'Confirm signature'}
                        </Button>
                    </>
                }
            >
                <div className="rounded-lg border border-edge bg-surface-muted p-4">
                    <div className="flex items-center gap-3">
                        <div
                            aria-hidden="true"
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary-strong"
                        >
                            {getInitials(rawPathologistName)}
                        </div>
                        <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-fg" title={pathologistDisplayName}>
                                {pathologistDisplayName}
                            </p>
                            <p className="text-xs text-fg-muted">Pathologist</p>
                        </div>
                    </div>
                    <div className="mt-4 rounded-md border border-edge bg-surface p-3">
                        <p className="text-xs font-semibold text-fg-muted">Digital signature</p>
                        <p className="mt-1 break-words font-serif text-lg italic text-primary-strong">{pathologistDisplayName}</p>
                    </div>
                </div>
            </Modal>

            <PageHeader
                crumbs={crumbs}
                title="Clinical review"
                meta={
                    <>
                        <span>Case</span>
                        <span className="min-w-0 break-words font-mono text-fg-secondary" title={sampleId}>
                            {displayId}
                        </span>
                        <span aria-hidden="true" className="text-fg-faint">·</span>
                        <StatusChip tone={getStatusTone(data.status)} dot size="sm">
                            {getStatusLabel(data.status)}
                        </StatusChip>
                        {!isPathologist && (
                            <>
                                <span aria-hidden="true" className="text-fg-faint">·</span>
                                <StatusChip tone="neutral" size="sm">
                                    <Eye className="mr-1 inline h-3 w-3" aria-hidden="true" />
                                    Read-only
                                </StatusChip>
                            </>
                        )}
                    </>
                }
                actions={
                    <Button icon={ArrowLeft} onClick={handleBack}>
                        Back
                    </Button>
                }
            />

            {/* Case context banner — sticks under the 64px top nav */}
            <header className="sticky top-16 z-20 mb-4 rounded-lg border border-edge bg-surface px-4 py-3">
                <div className="flex items-start gap-3 md:items-center md:gap-4">
                    <div
                        aria-hidden="true"
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-skeleton text-sm font-semibold text-fg-secondary"
                    >
                        {getInitials(patientName)}
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                            <h2 className="min-w-0 truncate text-lg font-semibold tracking-tight text-fg" title={patientName}>
                                {patientName}
                            </h2>
                            {data.priority && <PriorityBadge priority={data.priority} />}
                            {hasCriticalBanner ? (
                                <StatusChip tone="danger" dot size="sm">
                                    Critical findings
                                </StatusChip>
                            ) : hasAbnormalBanner ? (
                                <StatusChip tone="pending" dot size="sm">
                                    Flagged findings
                                </StatusChip>
                            ) : null}
                        </div>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-fg-secondary">
                            {data.testType && (
                                <span className="min-w-0 break-words">
                                    <span className="text-fg-muted">Test </span>
                                    {data.testType}
                                </span>
                            )}
                            <span aria-hidden="true" className="hidden text-fg-faint md:inline">·</span>
                            <span className="hidden min-w-0 break-words md:inline">
                                <span className="text-fg-muted">Verified by </span>
                                {data.supervisorName ?? 'Lab supervisor'}
                            </span>
                        </p>
                    </div>
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-edge pt-2 text-xs sm:grid-cols-3 lg:grid-cols-6">
                    {encounterFacts.map((fact) => (
                        <div key={fact.label} className="min-w-0">
                            <dt className="text-fg-muted">{fact.label}</dt>
                            <dd className={cn('truncate text-fg', fact.mono && 'font-mono')} title={fact.value}>
                                {fact.value}
                            </dd>
                        </div>
                    ))}
                </dl>
            </header>

            {hasAbnormalBanner && (
                <div
                    role="note"
                    className={cn(
                        'mb-4 flex items-start gap-3 rounded-lg border p-3 text-sm',
                        hasCriticalBanner
                            ? 'border-status-danger-edge bg-status-danger-bg text-status-danger-fg'
                            : 'border-status-pending-edge bg-status-pending-bg text-status-pending-fg'
                    )}
                >
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <p className="min-w-0 break-words leading-relaxed">
                        <span className="font-semibold">
                            {hasCriticalBanner ? 'Critical values detected' : 'Abnormal values detected'}
                        </span>
                        <span>
                            {' '}— {abnormalSummary}
                            {flaggedResults.length > bannerResults.length &&
                                ` and ${flaggedResults.length - bannerResults.length} more flagged value${flaggedResults.length - bannerResults.length > 1 ? 's' : ''}.`}
                        </span>
                    </p>
                </div>
            )}

            {hasReturnContext && (
                <div
                    role="note"
                    className="mb-4 rounded-lg border border-status-pending-edge bg-status-pending-bg px-4 py-3 text-sm text-status-pending-fg"
                >
                    <p className="font-semibold">
                        {resultStatusLabel(data.status)}
                        {data.returnedBy && <span className="font-normal"> · by {data.returnedBy}</span>}
                        {data.returnedAt && <span className="font-normal"> · {formatDateTime(data.returnedAt)}</span>}
                    </p>
                    <p className="mt-1 break-words text-fg">{data.returnReason}</p>
                </div>
            )}

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
                <div className="flex min-w-0 flex-col gap-4">
                    <SectionCard
                        title={data.testType ?? 'Test results'}
                        count={labResults.length}
                        flush
                        actions={
                            flaggedResults.length > 0 ? (
                                <StatusChip tone={hasCriticalBanner ? 'danger' : 'pending'} size="sm">
                                    {flaggedResults.length} flagged
                                </StatusChip>
                            ) : undefined
                        }
                    >
                        {labResults.length === 0 ? (
                            <EmptyState icon={FileText} title="No parameters recorded" description="This result has no parameter values yet." compact />
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[820px] table-fixed text-left text-sm">
                                    <thead>
                                        <tr className="border-b border-edge text-xs font-semibold text-fg-muted">
                                            <th scope="col" className="w-[22%] px-3 py-2 pl-4 font-semibold">Parameter</th>
                                            <th scope="col" className="w-[12%] px-3 py-2 font-semibold">Result</th>
                                            <th scope="col" className="w-[10%] px-3 py-2 font-semibold">Unit</th>
                                            <th scope="col" className="w-[14%] px-3 py-2 font-semibold">Flag</th>
                                            <th scope="col" className="w-[16%] px-3 py-2 font-semibold">Reference range</th>
                                            <th scope="col" className="w-[26%] px-3 py-2 font-semibold">Delta / previous visit</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-edge whitespace-nowrap">
                                        {labResults.map((row) => {
                                            const delta = formatDeltaPercent(row.deltaPercent);
                                            const tone = DELTA_CHIP_TONE[deltaTone(row.deltaPercent, row.deltaSignificant)];
                                            return (
                                                <tr key={row.parameter} className="hover:bg-surface-hover">
                                                    <td className="truncate px-3 py-2 pl-4 font-medium text-fg" title={row.parameter}>
                                                        {row.parameter}
                                                    </td>
                                                    <td
                                                        className={cn(
                                                            'truncate px-3 py-2 tabular-nums',
                                                            row.isAbnormal ? 'font-semibold text-status-danger-fg' : 'font-medium text-fg'
                                                        )}
                                                        title={String(row.result)}
                                                    >
                                                        {row.result}
                                                    </td>
                                                    <td className="truncate px-3 py-2 text-xs text-fg-muted" title={row.unit}>
                                                        {row.unit}
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        {row.flag === 'NORMAL' ? (
                                                            <span className="text-fg-faint">-</span>
                                                        ) : (
                                                            <StatusChip tone={getFlagTone(row.flag)} dot size="sm" title={getFlagLabel(row.flag)}>
                                                                {getFlagLabel(row.flag)}
                                                            </StatusChip>
                                                        )}
                                                    </td>
                                                    <td
                                                        className="truncate px-3 py-2 text-xs tabular-nums text-fg-muted"
                                                        title={row.referenceRange}
                                                    >
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
                                                                    {formatDateTime(row.previousVisitedAt) ?? ''}
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

                    <SectionCard title="Clinical interpretation">
                        <TextareaField
                            label="Clinical interpretation"
                            hideLabel
                            required
                            rows={5}
                            value={interpretation}
                            onChange={(event) => setInterpretation(event.target.value)}
                            placeholder="Enter your clinical interpretation of these results"
                            readOnly={!canActOnCase}
                            hint={
                                canActOnCase
                                    ? 'Required before the case can be authorized. Printed on the report for the referring clinician.'
                                    : !isPathologist
                                      ? 'Read-only: only a pathologist can record the interpretation.'
                                      : undefined
                            }
                        />
                        <div aria-live="assertive" role="alert">
                            {actionError && !showReturnModal && (
                                <div className="mt-3 flex items-start gap-2 rounded-lg border border-status-danger-edge bg-status-danger-bg p-3 text-sm text-status-danger-fg">
                                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                                    <p className="min-w-0 break-words">{actionError}</p>
                                </div>
                            )}
                        </div>
                    </SectionCard>
                </div>

                <div className="flex min-w-0 flex-col gap-4">
                    <SectionCard
                        title="Patient documents"
                        count={data.patientCode && !documentsLoading && !documentsError ? documents.length : undefined}
                        actions={
                            data.patientCode ? (
                                <Button size="sm" variant="ghost" icon={ArrowUpRight} href={`/patients/${data.patientCode}/documents`}>
                                    View all
                                </Button>
                            ) : undefined
                        }
                    >
                        {!data.patientCode ? (
                            <p className="text-sm text-fg-muted">Patient document access is unavailable for this case.</p>
                        ) : documentsLoading ? (
                            <>
                                <p role="status" aria-live="polite" className="sr-only">
                                    Loading documents
                                </p>
                                <div aria-hidden="true" className="space-y-2">
                                    {Array.from({ length: 2 }).map((_, index) => (
                                        <span key={index} className="block h-12 w-full rounded-md bg-skeleton" />
                                    ))}
                                </div>
                            </>
                        ) : documentsError ? (
                            <div
                                role="alert"
                                className="flex items-start gap-2 rounded-lg border border-status-pending-edge bg-status-pending-bg p-3 text-xs text-status-pending-fg"
                            >
                                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                                <p className="min-w-0 break-words">{documentsError}</p>
                            </div>
                        ) : documents.length === 0 ? (
                            <EmptyState icon={FileText} title="No documents yet" description="Nothing has been uploaded for this patient." compact />
                        ) : (
                            <ul className="divide-y divide-edge">
                                {documents.map((patientDocument) => (
                                    <li key={patientDocument.documentId} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
                                        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-fg-faint" aria-hidden="true" />
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-medium text-fg" title={patientDocument.originalFileName}>
                                                {patientDocument.originalFileName}
                                            </p>
                                            <p className="mt-0.5 break-words text-xs text-fg-muted">
                                                {formatDocumentType(patientDocument.documentType)} · {formatFileSize(patientDocument.fileSize)}
                                            </p>
                                            {patientDocument.description && (
                                                <p
                                                    className="mt-1 line-clamp-2 break-words text-xs leading-relaxed text-fg-muted"
                                                    title={patientDocument.description}
                                                >
                                                    {patientDocument.description}
                                                </p>
                                            )}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => void handleDownloadDocument(
                                                patientDocument.documentId,
                                                patientDocument.originalFileName
                                            )}
                                            aria-label={`Download ${patientDocument.originalFileName}`}
                                            title="Download document"
                                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-fg-secondary transition-colors hover:bg-surface-hover hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-surface"
                                        >
                                            <Download className="h-4 w-4" aria-hidden="true" />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </SectionCard>

                    <SectionCard
                        title="Digital authorization"
                        actions={
                            isAuthorized ? (
                                <StatusChip tone="success" dot size="sm">
                                    Signed
                                </StatusChip>
                            ) : undefined
                        }
                    >
                        <div className="flex items-center gap-3">
                            <div
                                aria-hidden="true"
                                className={cn(
                                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
                                    isAuthorized
                                        ? 'bg-status-verified-bg text-status-verified-fg'
                                        : 'bg-primary-soft text-primary-strong'
                                )}
                            >
                                {isAuthorized ? authorizationInitials : getInitials(rawPathologistName)}
                            </div>
                            <div className="min-w-0">
                                <p
                                    className="truncate text-sm font-semibold text-fg"
                                    title={isAuthorized ? authorizationActor : pathologistDisplayName}
                                >
                                    {isAuthorized ? authorizationActor : pathologistDisplayName}
                                </p>
                                <p className="text-xs text-fg-muted">
                                    {isAuthorized ? 'Authorized pathologist' : isPathologist ? 'Signature pending' : 'Viewing as administrator'}
                                </p>
                            </div>
                        </div>
                        <div
                            className={cn(
                                'mt-3 rounded-md border p-3',
                                isAuthorized
                                    ? 'border-status-verified-edge bg-status-verified-bg'
                                    : 'border-edge bg-surface-muted'
                            )}
                        >
                            <p className="text-xs font-semibold text-fg-muted">
                                {isAuthorized ? 'Digitally authorized' : 'Signature preview'}
                            </p>
                            <p
                                className={cn(
                                    'mt-1 truncate font-serif text-lg italic',
                                    isAuthorized ? 'text-status-verified-fg' : 'text-primary-strong'
                                )}
                                title={isAuthorized ? authorizationActor : pathologistDisplayName}
                            >
                                {isAuthorized ? authorizationActor : pathologistDisplayName}
                            </p>
                            {isAuthorized && (
                                <p className="mt-2 text-xs tabular-nums text-fg-muted">
                                    {`Authorized ${formatDateTime(data.authorizedAt) ?? '(time not recorded)'}`}
                                </p>
                            )}
                        </div>
                    </SectionCard>

                    <SectionCard title="Previous visits" count={previousVisits.length} flush={previousVisits.length > 0}>
                        {previousVisits.length === 0 ? (
                            <EmptyState icon={History} title="No previous visits" description="No earlier results for this test group." compact />
                        ) : (
                            <ul className="divide-y divide-edge">
                                {previousVisits.map((visit) => (
                                    <li key={visit.resultId}>
                                        <button
                                            type="button"
                                            onClick={() => router.push(`/clinical/review/${visit.resultId}`)}
                                            className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                                        >
                                            <span className="min-w-0">
                                                <span className="block break-words text-sm font-medium text-fg">
                                                    {formatDateTime(visit.visitedAt) ?? 'Previous visit'}
                                                </span>
                                                <span className="mt-0.5 block truncate font-mono text-xs text-fg-muted">
                                                    {displayResultNo(visit.resultNo, visit.resultId)}
                                                </span>
                                                <span className="mt-0.5 block break-words text-xs tabular-nums text-fg-muted">
                                                    {visit.parameterCount ?? 0} parameters · {visit.abnormalCount ?? 0} abnormal · {visit.criticalCount ?? 0} critical
                                                </span>
                                            </span>
                                            <StatusChip tone={getStatusTone(visit.status)} size="sm">
                                                {getStatusLabel(visit.status)}
                                            </StatusChip>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </SectionCard>

                    <SectionCard title="MLT notes">
                        <div className="flex gap-3">
                            <div
                                aria-hidden="true"
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[11px] font-semibold text-primary-strong"
                            >
                                ML
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="mb-1.5 flex items-center justify-between gap-3">
                                    <span
                                        className="min-w-0 truncate text-xs font-semibold text-fg"
                                        title={data.mltName ?? 'Unknown technician'}
                                    >
                                        {data.mltName ?? 'Unknown technician'}
                                        <span className="ml-1 font-normal text-fg-muted">MLT</span>
                                    </span>
                                    {noteTimestamp && (
                                        <span className="shrink-0 text-xs tabular-nums text-fg-muted">{noteTimestamp}</span>
                                    )}
                                </div>
                                <p className="whitespace-pre-wrap break-words rounded-md border border-edge bg-surface-muted p-3 text-xs italic leading-relaxed text-fg-secondary">
                                    &quot;{data.mltNotes || 'No MLT notes available.'}&quot;
                                </p>
                            </div>
                        </div>
                    </SectionCard>

                    {data.supervisorNote && (
                        <SectionCard title="Supervisor note">
                            <div className="flex gap-3">
                                <div
                                    aria-hidden="true"
                                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-status-pending-bg text-[11px] font-semibold text-status-pending-fg"
                                >
                                    LS
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="mb-1.5 flex items-center justify-between gap-3">
                                        <span
                                            className="min-w-0 truncate text-xs font-semibold text-fg"
                                            title={data.supervisorName ?? 'Lab supervisor'}
                                        >
                                            {data.supervisorName ?? 'Lab supervisor'}
                                        </span>
                                        {noteTimestamp && (
                                            <span className="shrink-0 text-xs tabular-nums text-fg-muted">{noteTimestamp}</span>
                                        )}
                                    </div>
                                    <p className="whitespace-pre-wrap break-words rounded-md border border-edge bg-surface-muted p-3 text-xs italic leading-relaxed text-fg-secondary">
                                        &quot;{data.supervisorNote}&quot;
                                    </p>
                                </div>
                            </div>
                        </SectionCard>
                    )}
                </div>
            </div>

            {/* Sticky action bar */}
            <div className="sticky bottom-0 z-10 mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-edge bg-canvas py-3">
                <p className="flex min-w-0 items-center gap-2 text-xs text-fg-muted">
                    {isAuthorized ? (
                        <>
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-status-verified-fg" aria-hidden="true" />
                            <span>Authorized for dispatch</span>
                        </>
                    ) : !isPathologist ? (
                        <span>Read-only view — only a pathologist can authorize or return this case.</span>
                    ) : canActOnCase ? (
                        <span>Add your interpretation, then attach your signature to authorize and release.</span>
                    ) : (
                        <span>{getStatusLabel(data.status)} — no further action available.</span>
                    )}
                </p>
                {isPathologist && (
                    <div className="flex flex-wrap items-center justify-end gap-2">
                        {canActOnCase && (
                            <Button
                                icon={Undo2}
                                onClick={() => {
                                    setActionError(null);
                                    setShowReturnModal(true);
                                }}
                            >
                                Return for recheck
                            </Button>
                        )}
                        <Button
                            variant="primary"
                            icon={isAuthorized ? CheckCircle2 : BadgeCheck}
                            onClick={handleAuthorize}
                            disabled={!canActOnCase}
                            loading={isSubmittingAuthorize}
                        >
                            {isAuthorized ? 'Authorized for dispatch' : 'Authorize and release'}
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
