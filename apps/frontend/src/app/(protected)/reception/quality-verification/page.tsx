'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AxiosError } from 'axios';
import {
    AlertTriangle,
    ArrowLeft,
    Ban,
    Check,
    CheckCircle2,
    ClipboardCheck,
    Inbox,
    Printer,
    RefreshCw,
    SearchX,
} from 'lucide-react';
import {
    acceptSample,
    getPatientById,
    getReceptionSamples,
    rejectSample,
    type MltWorklistItem,
    type Patient,
    type RejectionReason,
} from '@/lib/api';
import Button from '@/components/ui/Button';
import PageHeader from '@/components/ui/PageHeader';
import { InputField, SelectField, TextareaField } from '@/components/ui/Field';
import SectionCard from '@/components/ui/SectionCard';
import EmptyState from '@/components/ui/EmptyState';
import StatusChip, { humanizeStatus } from '@/components/ui/StatusChip';
import StatusBadge from '@/components/shared/StatusBadge';
import PriorityBadge from '@/components/shared/PriorityBadge';
import { formatRegistered } from '@/components/patient-dashboard/dashboard-data';

const DEFAULT_REASON: RejectionReason = 'HEMOLYZED';
const REJECTION_REASONS: RejectionReason[] = [
    'HEMOLYZED',
    'INSUFFICIENT_VOLUME',
    'CLOTTED',
    'CONTAMINATED',
    'OTHER',
];

const TUBE_TYPE_HINTS: Record<string, string> = {
    'full blood count': 'EDTA purple top',
    fbc: 'EDTA purple top',
    esr: 'EDTA purple top',
};

const REQUIRED_CHECKS = ['barcode', 'container', 'condition', 'window'];
const CHECKS_STORAGE_PREFIX = 'reception-verification-checks';
const SKELETON_ROWS = 5;

const FOCUS_RING =
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-surface';

type ChecklistItem = {
    id: string;
    label: string;
    description: string;
    optional?: boolean;
};

export default function QualityVerificationPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const selectedSampleId = searchParams.get('sampleId');
    const barcodePrinted = searchParams.get('barcodePrinted') === 'true';

    const [samples, setSamples] = useState<MltWorklistItem[]>([]);
    const [selectedSample, setSelectedSample] = useState<MltWorklistItem | null>(null);
    const [patient, setPatient] = useState<Patient | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [checks, setChecks] = useState<Record<string, boolean>>({ window: true });
    const [notes, setNotes] = useState('');
    const [rejectDraftActive, setRejectDraftActive] = useState(false);
    const [rejectReason, setRejectReason] = useState<RejectionReason>(DEFAULT_REASON);
    const [loading, setLoading] = useState(true);
    const [patientLoading, setPatientLoading] = useState(false);
    const [submittingAction, setSubmittingAction] = useState<'accept' | 'reject' | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const loadSamples = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const data = await getReceptionSamples();
            setSamples(data);
        } catch (err) {
            console.error('Failed to load reception verification queue', err);
            setError(getApiErrorMessage(err, 'Failed to load reception samples. Please try again.'));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadSamples();
    }, [loadSamples]);

    useEffect(() => {
        if (samples.length === 0) {
            setSelectedSample(null);
            return;
        }

        const queryMatch = selectedSampleId
            ? samples.find((sample) => sample.sampleId === selectedSampleId) ?? null
            : null;

        setSelectedSample((current) => {
            if (queryMatch) {
                return queryMatch;
            }

            if (current) {
                return samples.find((sample) => sample.sampleId === current.sampleId) ?? null;
            }

            return samples[0];
        });
    }, [samples, selectedSampleId]);

    useEffect(() => {
        if (!selectedSample) {
            setPatient(null);
            return;
        }

        let cancelled = false;

        const loadPatient = async () => {
            setPatientLoading(true);

            try {
                const patientDetails = await getPatientById(selectedSample.patientId);
                if (!cancelled) {
                    setPatient(patientDetails);
                }
            } catch (err) {
                console.error('Failed to load patient details for verification', err);
                if (!cancelled) {
                    setPatient(null);
                }
            } finally {
                if (!cancelled) {
                    setPatientLoading(false);
                }
            }
        };

        void loadPatient();

        return () => {
            cancelled = true;
        };
    }, [selectedSample]);

    useEffect(() => {
        setChecks({ window: true });
        setNotes('');
        setRejectDraftActive(false);
        setRejectReason(DEFAULT_REASON);
        setError(null);
        setSuccessMessage(null);
    }, [selectedSample?.sampleId]);

    useEffect(() => {
        if (!selectedSample || !barcodePrinted) {
            return;
        }

        const storedChecks = readStoredChecks(selectedSample.sampleId);
        clearStoredChecks(selectedSample.sampleId);
        setChecks({ window: true, ...storedChecks, barcode: true });
        setSuccessMessage('Barcode print recorded. Barcode integrity has been marked as complete.');
        router.replace(`/reception/quality-verification?sampleId=${selectedSample.sampleId}`, { scroll: false });
    }, [barcodePrinted, router, selectedSample]);

    const filteredSamples = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();

        if (!query) {
            return samples;
        }

        return samples.filter((sample) => {
            return (
                sample.barcode.toLowerCase().includes(query) ||
                sample.patientId.toLowerCase().includes(query) ||
                sample.orderId.toLowerCase().includes(query) ||
                sample.testName.toLowerCase().includes(query)
            );
        });
    }, [samples, searchQuery]);

    const checklist = useMemo<ChecklistItem[]>(() => {
        const testName = selectedSample?.testName ?? 'Selected test';
        const tubeHint = resolveTubeHint(testName);
        const collectionDescription = selectedSample?.collectedAt
            ? `Collected ${formatRelativeCollectionTime(selectedSample.collectedAt)} and within the pre-analytical handling window.`
            : 'Collection timestamp is available and within the pre-analytical handling window.';

        return [
            {
                id: 'barcode',
                label: 'Barcode integrity',
                description: `Barcode ${selectedSample?.barcode ?? ''} is legible and matches the accessioning queue.`,
            },
            {
                id: 'container',
                label: 'Correct container',
                description: `Verify the specimen container against ${testName} requirements (${tubeHint}).`,
            },
            {
                id: 'volume',
                label: 'Volume sufficiency',
                description: 'Confirm the tube is adequately filled for testing before forwarding to MLT.',
                optional: true,
            },
            {
                id: 'condition',
                label: 'Sample condition',
                description: 'Visually confirm there is no clotting, leakage, hemolysis, or contamination.',
            },
            {
                id: 'window',
                label: 'Collection window',
                description: collectionDescription,
            },
        ];
    }, [selectedSample]);

    const allRequiredPassed = REQUIRED_CHECKS.every((id) => checks[id]);
    const progress = Object.values(checks).filter(Boolean).length;
    const requiresCustomMessage = rejectReason === 'OTHER';

    const patientDisplayName = patient?.firstName
        ? [patient.title, patient.firstName, patient.lastName].filter(Boolean).join(' ').trim()
        : patient?.fullName?.trim() || selectedSample?.patientId || 'Unknown patient';

    const patientInitials = buildInitials(patientDisplayName);

    const handleCheck = (id: string) => {
        setChecks((current) => ({ ...current, [id]: !current[id] }));
    };

    const handleSelectSample = (sample: MltWorklistItem) => {
        router.replace(`/reception/quality-verification?sampleId=${sample.sampleId}`);
    };

    const handleBarcodePrint = () => {
        if (!selectedSample) {
            return;
        }

        const params = new URLSearchParams({
            query: selectedSample.barcode,
            returnTo: `/reception/quality-verification?sampleId=${selectedSample.sampleId}`,
        });

        storeChecks(selectedSample.sampleId, checks);
        router.push(`/reception/barcode-print?${params.toString()}`);
    };

    const handleAccept = async () => {
        if (!selectedSample) {
            setError('Select a sample before accepting it.');
            return;
        }

        if (!allRequiredPassed) {
            setError('Complete all required verification checks before accepting the sample.');
            return;
        }

        setSubmittingAction('accept');
        setError(null);
        setSuccessMessage(null);

        try {
            await acceptSample(selectedSample.sampleId);
            clearStoredChecks(selectedSample.sampleId);
            setSuccessMessage(`Sample ${selectedSample.barcode} accepted and queued for MLT analysis.`);
            await loadSamples();
            router.replace('/reception/accessioning');
        } catch (err) {
            console.error('Failed to accept sample from quality verification', err);
            setError(getApiErrorMessage(err, 'Failed to accept the sample. Please try again.'));
        } finally {
            setSubmittingAction(null);
        }
    };

    const handleReject = async () => {
        if (!selectedSample) {
            setError('Select a sample before rejecting it.');
            return;
        }

        if (requiresCustomMessage && notes.trim().length === 0) {
            setError('A custom rejection message is required when the reason is Other.');
            return;
        }

        setSubmittingAction('reject');
        setError(null);
        setSuccessMessage(null);

        try {
            await rejectSample(selectedSample.sampleId, {
                rejectionReason: rejectReason,
                rejectionNotes: notes.trim() || undefined,
            });
            clearStoredChecks(selectedSample.sampleId);
            setRejectDraftActive(false);
            setSuccessMessage(`Sample ${selectedSample.barcode} rejected and removed from the accessioning queue.`);
            await loadSamples();
            router.replace('/reception/accessioning');
        } catch (err) {
            console.error('Failed to reject sample from quality verification', err);
            setError(getApiErrorMessage(err, 'Failed to reject the sample. Please try again.'));
        } finally {
            setSubmittingAction(null);
        }
    };

    const handleCancelRejection = () => {
        setRejectDraftActive(false);
        setNotes('');
        setRejectReason(DEFAULT_REASON);
        setError(null);
    };

    const selectedSampleIsBusy = submittingAction !== null;
    const progressPercent = checklist.length > 0 ? Math.round((progress / checklist.length) * 100) : 0;

    return (
        <div className="mx-auto max-w-[1400px]">
            <PageHeader
                title="Quality verification"
                crumbs={[
                    { label: 'Lab reception', href: '/reception/accessioning' },
                    { label: 'Reception worklist', href: '/reception/accessioning' },
                    { label: 'Quality verification' },
                ]}
                meta={
                    <>
                        <span>Complete pre-analytical checks before queuing a sample for analysis.</span>
                        <StatusChip tone="success" dot size="sm">
                            Scanner online and ready
                        </StatusChip>
                    </>
                }
                actions={
                    <>
                        <Button href="/reception/accessioning" icon={ArrowLeft}>
                            Back to worklist
                        </Button>
                        <Button
                            icon={RefreshCw}
                            loading={loading}
                            disabled={selectedSampleIsBusy}
                            onClick={() => void loadSamples()}
                        >
                            Refresh
                        </Button>
                    </>
                }
            />

            {/* Live region for async list state */}
            <p role="status" aria-live="polite" className="sr-only">
                {loading
                    ? 'Loading collected samples'
                    : `${filteredSamples.length} of ${samples.length} ${samples.length === 1 ? 'sample' : 'samples'} in the verification queue.`}
            </p>

            {error && (
                <div
                    role="alert"
                    className="mb-4 flex items-start gap-2 rounded-lg border border-status-danger-edge bg-status-danger-bg px-4 py-3 text-sm text-status-danger-fg"
                >
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="min-w-0 flex-1">{error}</span>
                </div>
            )}

            {successMessage && (
                <div
                    role="status"
                    className="mb-4 flex items-start gap-2 rounded-lg border border-status-verified-edge bg-status-verified-bg px-4 py-3 text-sm text-status-verified-fg"
                >
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="min-w-0 flex-1">{successMessage}</span>
                </div>
            )}

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
                {/* Left pane: verification queue */}
                <SectionCard
                    title="Verification queue"
                    count={loading ? undefined : filteredSamples.length}
                    flush
                    className="self-start"
                >
                    <div className="border-b border-edge bg-surface-muted px-3 py-2">
                        <InputField
                            label="Scan barcode or search samples"
                            hideLabel
                            type="search"
                            autoComplete="off"
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            placeholder="Scan barcode or search by ID"
                        />
                    </div>

                    <div aria-busy={loading}>
                        {loading ? (
                            <ul aria-hidden="true" className="divide-y divide-edge">
                                {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
                                    <li key={i} className="space-y-2 px-4 py-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="h-3 w-24 rounded bg-skeleton" />
                                            <span className="h-4 w-12 rounded bg-skeleton" />
                                        </div>
                                        <span className="block h-3 w-32 rounded bg-skeleton" />
                                        <span className="block h-3 w-40 rounded bg-skeleton" />
                                    </li>
                                ))}
                            </ul>
                        ) : error && samples.length === 0 ? (
                            <EmptyState
                                icon={AlertTriangle}
                                title="Couldn't load the verification queue"
                                description="Check your connection, then try again."
                                compact
                                action={
                                    <Button size="sm" icon={RefreshCw} onClick={() => void loadSamples()}>
                                        Retry
                                    </Button>
                                }
                            />
                        ) : filteredSamples.length === 0 ? (
                            samples.length === 0 ? (
                                <EmptyState
                                    icon={Inbox}
                                    title="No samples to verify"
                                    description="Collected samples appear here as soon as they reach reception."
                                    compact
                                />
                            ) : (
                                <EmptyState
                                    icon={SearchX}
                                    title="No samples match your search"
                                    description="Try a different barcode, patient ID, order ID or test name."
                                    compact
                                    action={
                                        <Button size="sm" onClick={() => setSearchQuery('')}>
                                            Clear search
                                        </Button>
                                    }
                                />
                            )
                        ) : (
                            <ul aria-label="Verification queue" className="divide-y divide-edge">
                                {filteredSamples.map((sample) => {
                                    const isActive = sample.sampleId === selectedSample?.sampleId;

                                    return (
                                        <li key={sample.sampleId}>
                                            <button
                                                type="button"
                                                aria-current={isActive ? 'true' : undefined}
                                                onClick={() => handleSelectSample(sample)}
                                                className={`block w-full border-l-2 px-4 py-3 text-left transition-colors ${FOCUS_RING} ${
                                                    isActive
                                                        ? 'border-primary bg-primary-soft'
                                                        : 'border-transparent hover:bg-surface-hover'
                                                }`}
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <p className="truncate font-mono text-xs font-semibold text-primary-strong">
                                                            {sample.barcode}
                                                        </p>
                                                        <p className="mt-0.5 truncate text-sm font-medium text-fg">
                                                            {sample.patientId}
                                                        </p>
                                                        <p className="truncate text-xs text-fg-muted">{sample.orderId}</p>
                                                    </div>
                                                    <PriorityBadge priority={sample.priority} />
                                                </div>
                                                <p className="mt-1.5 truncate text-xs text-fg-secondary" title={sample.testName}>
                                                    {sample.testName}
                                                </p>
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                </SectionCard>

                {/* Right pane: sample details + checks */}
                {!selectedSample ? (
                    <SectionCard title="Pre-analytical verification" className="self-start">
                        <EmptyState
                            icon={ClipboardCheck}
                            title="No sample selected"
                            description="Choose a collected sample from the verification queue to review its pre-analytical checks."
                        />
                    </SectionCard>
                ) : (
                    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-5">
                        <SectionCard
                            title="Sample details"
                            actions={<StatusBadge status={selectedSample.status} />}
                            className="lg:col-span-2"
                        >
                            <p className="break-all text-xs font-medium text-primary-strong">{selectedSample.orderId}</p>
                            <h3 className="mt-0.5 break-all font-mono text-lg font-semibold text-fg">{selectedSample.barcode}</h3>

                            <div className="mt-4 border-t border-edge pt-4">
                                <p className="mb-2 text-xs font-semibold text-fg-muted">Patient</p>
                                <div className="flex items-center gap-3">
                                    <div
                                        aria-hidden="true"
                                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary-strong"
                                    >
                                        {patientInitials}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-semibold text-fg" aria-live="polite">
                                            {patientLoading ? 'Loading patient…' : patientDisplayName}
                                        </p>
                                        <p className="truncate text-xs text-fg-muted">
                                            {formatPatientMeta(patient, selectedSample.patientId)}
                                        </p>
                                    </div>
                                </div>

                                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
                                    <div className="min-w-0">
                                        <dt className="text-xs text-fg-muted">Patient code</dt>
                                        <dd className="mt-0.5 truncate text-sm font-medium text-fg">{selectedSample.patientId}</dd>
                                    </div>
                                    <div className="min-w-0">
                                        <dt className="text-xs text-fg-muted">Collected</dt>
                                        <dd className="mt-0.5 text-sm font-medium tabular-nums text-fg">
                                            {formatCollectedAt(selectedSample.collectedAt)}
                                        </dd>
                                    </div>
                                </dl>
                            </div>

                            <div className="mt-4 border-t border-edge pt-4">
                                <p className="mb-2 text-xs font-semibold text-fg-muted">Specimen</p>
                                <div className="flex items-start gap-3">
                                    {/* Specimen tube colour is physical (cap colour) so it stays literal in both themes */}
                                    <span aria-hidden="true" className="mt-0.5 h-10 w-2.5 shrink-0 rounded-full bg-purple-500" />
                                    <dl className="grid min-w-0 flex-1 grid-cols-2 gap-x-4 gap-y-3">
                                        <div className="col-span-2 min-w-0">
                                            <dt className="text-xs text-fg-muted">Test</dt>
                                            <dd className="mt-0.5 break-words text-sm font-semibold text-fg">{selectedSample.testName}</dd>
                                        </div>
                                        <div className="min-w-0">
                                            <dt className="text-xs text-fg-muted">Container</dt>
                                            <dd className="mt-0.5 text-xs text-fg-secondary">
                                                {resolveTubeHint(selectedSample.testName)}
                                            </dd>
                                        </div>
                                        <div className="min-w-0">
                                            <dt className="text-xs text-fg-muted">Priority</dt>
                                            <dd className="mt-0.5">
                                                <PriorityBadge priority={selectedSample.priority} />
                                            </dd>
                                        </div>
                                    </dl>
                                </div>
                            </div>
                        </SectionCard>

                        <SectionCard
                            title="Pre-analytical verification"
                            actions={
                                <StatusChip tone={selectedSample.collectedAt ? 'neutral' : 'pending'} dot size="sm">
                                    {selectedSample.collectedAt
                                        ? formatRelativeCollectionTime(selectedSample.collectedAt)
                                        : 'Collection time pending'}
                                </StatusChip>
                            }
                            flush
                            className="lg:col-span-3"
                        >
                            <p className="border-b border-edge px-4 py-2.5 text-xs text-fg-muted">
                                Complete all required physical checks before queuing the sample for analysis.
                            </p>

                            <ul className="divide-y divide-edge">
                                {checklist.map((item) => {
                                    const checked = !!checks[item.id];
                                    const isBarcodeCheck = item.id === 'barcode';
                                    const checkboxId = `qv-check-${item.id}`;

                                    return (
                                        <li
                                            key={item.id}
                                            className={`flex items-start gap-3 px-4 py-3 transition-colors ${
                                                checked ? 'bg-status-verified-bg' : 'hover:bg-surface-hover'
                                            }`}
                                        >
                                            <input
                                                id={checkboxId}
                                                type="checkbox"
                                                checked={checked}
                                                onChange={() => handleCheck(item.id)}
                                                aria-describedby={`${checkboxId}-desc`}
                                                className={`mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-edge-strong accent-primary ${FOCUS_RING}`}
                                            />
                                            <div className="min-w-0 flex-1">
                                                <label htmlFor={checkboxId} className="block cursor-pointer">
                                                    <span className="flex flex-wrap items-center gap-2">
                                                        <span
                                                            className={`text-sm font-medium ${
                                                                checked ? 'text-status-verified-fg' : 'text-fg'
                                                            }`}
                                                        >
                                                            {item.label}
                                                        </span>
                                                        {item.optional && (
                                                            <StatusChip tone="neutral" size="sm">
                                                                Optional
                                                            </StatusChip>
                                                        )}
                                                    </span>
                                                    <span
                                                        id={`${checkboxId}-desc`}
                                                        className={`mt-0.5 block text-xs ${
                                                            checked ? 'text-status-verified-fg' : 'text-fg-muted'
                                                        }`}
                                                    >
                                                        {item.description}
                                                    </span>
                                                </label>
                                                {isBarcodeCheck && !checked && (
                                                    <p className="mt-1.5 text-xs text-status-pending-fg">
                                                        If the barcode is damaged but the specimen is otherwise acceptable, print the label before continuing.
                                                    </p>
                                                )}
                                            </div>
                                            {isBarcodeCheck && !checked && (
                                                <Button size="sm" icon={Printer} onClick={handleBarcodePrint}>
                                                    Print barcode
                                                </Button>
                                            )}
                                            {checked && (
                                                <Check className="mt-0.5 h-4 w-4 shrink-0 text-status-verified" aria-hidden="true" />
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>

                            {rejectDraftActive && (
                                <section
                                    aria-labelledby="qv-reject-heading"
                                    className="space-y-3 border-t border-status-danger-edge bg-status-danger-bg px-4 py-4"
                                >
                                    <h3 id="qv-reject-heading" className="text-xs font-semibold text-status-danger-fg">
                                        Documenting a rejection — complete the fields below, then confirm.
                                    </h3>
                                    <SelectField
                                        label="Rejection reason"
                                        required
                                        value={rejectReason}
                                        onChange={(event) => {
                                            setRejectReason(event.target.value as RejectionReason);
                                            setError(null);
                                        }}
                                    >
                                        {REJECTION_REASONS.map((reason) => (
                                            <option key={reason} value={reason}>
                                                {humanizeStatus(reason)}
                                            </option>
                                        ))}
                                    </SelectField>
                                    <TextareaField
                                        label={requiresCustomMessage ? 'Custom message' : 'Message'}
                                        required={requiresCustomMessage}
                                        hint={
                                            requiresCustomMessage
                                                ? 'Required when the reason is Other'
                                                : 'Optional'
                                        }
                                        rows={3}
                                        value={notes}
                                        onChange={(event) => setNotes(event.target.value)}
                                        placeholder={
                                            requiresCustomMessage
                                                ? 'Describe why this sample is being rejected…'
                                                : 'Optional notes to record with this rejection…'
                                        }
                                    />
                                </section>
                            )}

                            <div className="border-t border-edge px-4 py-3">
                                <div className="mb-3 flex items-center gap-3">
                                    <div
                                        role="progressbar"
                                        aria-label="Verification progress"
                                        aria-valuemin={0}
                                        aria-valuemax={checklist.length}
                                        aria-valuenow={progress}
                                        className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-hover"
                                    >
                                        <div
                                            className={`h-full rounded-full transition-all duration-500 ${
                                                allRequiredPassed ? 'bg-status-verified' : 'bg-primary'
                                            }`}
                                            style={{ width: `${progressPercent}%` }}
                                        />
                                    </div>
                                    <span className="text-xs tabular-nums text-fg-muted">
                                        {progress}/{checklist.length} checked
                                    </span>
                                </div>

                                <div className="flex flex-wrap items-center justify-end gap-2">
                                    {rejectDraftActive && (
                                        <Button
                                            variant="ghost"
                                            onClick={handleCancelRejection}
                                            disabled={selectedSampleIsBusy}
                                            className="mr-auto"
                                        >
                                            Cancel rejection
                                        </Button>
                                    )}
                                    {!rejectDraftActive ? (
                                        <Button
                                            icon={Ban}
                                            onClick={() => setRejectDraftActive(true)}
                                            disabled={selectedSampleIsBusy}
                                            className="border-status-danger-edge text-status-danger-fg hover:bg-status-danger-bg hover:text-status-danger-fg"
                                        >
                                            Reject sample
                                        </Button>
                                    ) : (
                                        <Button
                                            variant="danger"
                                            icon={Ban}
                                            onClick={() => void handleReject()}
                                            disabled={selectedSampleIsBusy}
                                            loading={submittingAction === 'reject'}
                                        >
                                            {submittingAction === 'reject' ? 'Rejecting…' : 'Confirm rejection'}
                                        </Button>
                                    )}
                                    <Button
                                        variant="primary"
                                        icon={CheckCircle2}
                                        onClick={() => void handleAccept()}
                                        disabled={!allRequiredPassed || selectedSampleIsBusy || rejectDraftActive}
                                        loading={submittingAction === 'accept'}
                                    >
                                        {submittingAction === 'accept' ? 'Accepting…' : 'Accept and queue for analysis'}
                                    </Button>
                                </div>
                            </div>
                        </SectionCard>
                    </div>
                )}
            </div>
        </div>
    );
}

function resolveTubeHint(testName: string) {
    const normalized = testName.trim().toLowerCase();

    for (const [key, value] of Object.entries(TUBE_TYPE_HINTS)) {
        if (normalized.includes(key)) {
            return value;
        }
    }

    return 'Match against the laboratory collection protocol';
}

function buildInitials(name: string) {
    const parts = name.split(/\s+/).filter(Boolean).slice(0, 2);
    if (parts.length === 0) {
        return 'NA';
    }

    return parts.map((part) => part[0]?.toUpperCase() ?? '').join('');
}

/** "Today 09:12", "Yesterday 14:02", otherwise "16 Aug 2026 09:12". */
function formatCollectedAt(iso?: string | null) {
    if (!iso) return 'Not available';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return 'Not available';
    const label = formatRegistered(date);
    if (label.startsWith('Today') || label.startsWith('Yesterday')) return label;
    const time = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
    return `${label} ${time}`;
}

function formatRelativeCollectionTime(collectedAt: string) {
    const collectedMs = new Date(collectedAt).getTime();
    const diffMs = Date.now() - collectedMs;

    if (!Number.isFinite(diffMs) || diffMs < 0) {
        return 'Collection time available';
    }

    const totalMinutes = Math.round(diffMs / 60000);

    if (totalMinutes < 60) {
        return `${totalMinutes}m elapsed`;
    }

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return minutes === 0 ? `${hours}h elapsed` : `${hours}h ${minutes}m elapsed`;
}

function formatPatientMeta(patient: Patient | null, fallbackPatientCode: string) {
    if (!patient) {
        return `Patient code: ${fallbackPatientCode}`;
    }

    const tokens = [
        patient.gender,
        patient.dob ? calculateAge(patient.dob) : null,
        patient.patientCode || fallbackPatientCode,
    ].filter(Boolean);

    return tokens.join(' · ');
}

function calculateAge(dateOfBirth: string) {
    const dob = new Date(dateOfBirth);
    if (Number.isNaN(dob.getTime())) {
        return null;
    }

    const now = new Date();
    let age = now.getFullYear() - dob.getFullYear();
    const monthDiff = now.getMonth() - dob.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
        age -= 1;
    }

    return `${age} years`;
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

function getChecksStorageKey(sampleId: string) {
    return `${CHECKS_STORAGE_PREFIX}:${sampleId}`;
}

function storeChecks(sampleId: string, checks: Record<string, boolean>) {
    if (typeof window === 'undefined') {
        return;
    }

    window.sessionStorage.setItem(getChecksStorageKey(sampleId), JSON.stringify(checks));
}

function readStoredChecks(sampleId: string) {
    if (typeof window === 'undefined') {
        return {};
    }

    const raw = window.sessionStorage.getItem(getChecksStorageKey(sampleId));
    if (!raw) {
        return {};
    }

    try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return {};
        }

        return Object.fromEntries(
            Object.entries(parsed).filter((entry): entry is [string, boolean] => (
                typeof entry[0] === 'string' && typeof entry[1] === 'boolean'
            ))
        );
    } catch {
        return {};
    }
}

function clearStoredChecks(sampleId: string) {
    if (typeof window === 'undefined') {
        return;
    }

    window.sessionStorage.removeItem(getChecksStorageKey(sampleId));
}
