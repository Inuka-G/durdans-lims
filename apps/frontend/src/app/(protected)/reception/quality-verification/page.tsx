'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AxiosError } from 'axios';
import {
    acceptSample,
    getPatientById,
    getReceptionSamples,
    rejectSample,
    type MltWorklistItem,
    type Patient,
    type RejectionReason,
} from '@/lib/api';
import { PRIORITY_COLORS, SAMPLE_STATUS_COLORS, formatStatusLabel } from '@/constants/sample-lifecycle';

const DEFAULT_REASON: RejectionReason = 'HEMOLYZED';
const REJECTION_REASONS: RejectionReason[] = [
    'HEMOLYZED',
    'INSUFFICIENT_VOLUME',
    'CLOTTED',
    'CONTAMINATED',
    'OTHER',
];

const TUBE_TYPE_HINTS: Record<string, string> = {
    'full blood count': 'EDTA Purple Top',
    fbc: 'EDTA Purple Top',
    esr: 'EDTA Purple Top',
};

const REQUIRED_CHECKS = ['barcode', 'container', 'condition', 'window'];
const CHECKS_STORAGE_PREFIX = 'reception-verification-checks';

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
                label: 'Barcode Integrity',
                description: `Barcode ${selectedSample?.barcode ?? ''} is legible and matches the accessioning queue.`,
            },
            {
                id: 'container',
                label: 'Correct Container',
                description: `Verify the specimen container against ${testName} requirements (${tubeHint}).`,
            },
            {
                id: 'volume',
                label: 'Volume Sufficiency',
                description: 'Confirm the tube is adequately filled for testing before forwarding to MLT.',
                optional: true,
            },
            {
                id: 'condition',
                label: 'Sample Condition',
                description: 'Visually confirm there is no clotting, leakage, hemolysis, or contamination.',
            },
            {
                id: 'window',
                label: 'Collection Window',
                description: collectionDescription,
            },
        ];
    }, [selectedSample]);

    const allRequiredPassed = REQUIRED_CHECKS.every((id) => checks[id]);
    const progress = Object.values(checks).filter(Boolean).length;
    const requiresCustomMessage = rejectReason === 'OTHER';

    const patientDisplayName = patient?.fullName || patient?.firstName
        ? [patient?.title, patient?.firstName, patient?.lastName].filter(Boolean).join(' ').trim()
        : selectedSample?.patientId ?? 'Unknown Patient';

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

    const selectedSampleIsBusy = submittingAction !== null;

    return (
        <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-5">
                <Link
                    href="/reception/accessioning"
                    className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-primary transition-colors"
                >
                    <span className="material-icons text-base">chevron_left</span>
                    Back to Reception Worklist
                </Link>
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-sm font-semibold text-emerald-600">
                        Scanner Online &amp; Ready
                    </span>
                </div>
            </div>

            {error && (
                <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                </div>
            )}

            {successMessage && (
                <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    {successMessage}
                </div>
            )}

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 mb-6">
                <div className="flex items-center gap-3 px-5 py-3.5">
                    <span className="material-icons text-xl text-slate-300">qr_code_scanner</span>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder="Scan Sample Barcode or Search ID..."
                        className="flex-1 text-sm text-slate-700 placeholder-slate-400 bg-transparent focus:outline-none"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)] gap-6">
                <div className="space-y-4">
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-100">
                            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                                Verification Queue
                            </h2>
                            <p className="text-xs text-slate-400 mt-1">
                                Select a collected sample to complete pre-analytical checks.
                            </p>
                        </div>

                        {loading ? (
                            <div className="py-10 text-center">
                                <div className="inline-block h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-primary" />
                                <p className="mt-3 text-sm text-slate-500">Loading collected samples...</p>
                            </div>
                        ) : filteredSamples.length === 0 ? (
                            <div className="px-5 py-10 text-center text-sm text-slate-400">
                                {samples.length === 0
                                    ? 'No collected samples are available for quality verification.'
                                    : 'No samples match your current search.'}
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {filteredSamples.map((sample) => {
                                    const isActive = sample.sampleId === selectedSample?.sampleId;

                                    return (
                                        <button
                                            key={sample.sampleId}
                                            type="button"
                                            onClick={() => handleSelectSample(sample)}
                                            className={`w-full text-left px-5 py-4 transition-colors ${
                                                isActive ? 'bg-primary/5' : 'hover:bg-slate-50/70'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between gap-3">
                                                <div>
                                                    <p className="font-bold text-primary">{sample.barcode}</p>
                                                    <p className="text-sm font-medium text-slate-700 mt-1">{sample.patientId}</p>
                                                    <p className="text-xs text-slate-400 mt-1">{sample.orderId}</p>
                                                </div>
                                                <span
                                                    className={`inline-flex items-center px-2 py-1 rounded-lg text-[10px] font-bold ${
                                                        PRIORITY_COLORS[sample.priority as keyof typeof PRIORITY_COLORS] ??
                                                        'bg-slate-100 text-slate-600'
                                                    }`}
                                                >
                                                    {formatStatusLabel(sample.priority)}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-500 mt-2">{sample.testName}</p>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {!selectedSample ? (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 flex items-center justify-center min-h-[420px] px-8 text-center">
                        <div>
                            <p className="text-lg font-semibold text-slate-800">No sample selected</p>
                            <p className="text-sm text-slate-500 mt-2">
                                Choose a collected sample from the verification queue to review pre-analytical checks.
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                        <div className="lg:col-span-2 space-y-5">
                            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                                    <span
                                        className={`text-[11px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                                            SAMPLE_STATUS_COLORS[selectedSample.status] ?? 'bg-slate-100 text-slate-600'
                                        }`}
                                    >
                                        {formatStatusLabel(selectedSample.status)}
                                    </span>
                                </div>
                                <p className="text-[11px] text-primary font-medium mb-0.5">{selectedSample.orderId}</p>
                                <h2 className="text-xl font-bold text-slate-800 mb-5">
                                    Sample ID: {selectedSample.barcode}
                                </h2>

                                <p className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mb-3">
                                    Patient Information
                                </p>
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                                        {patientInitials}
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-800 text-[15px]">
                                            {patientLoading ? 'Loading patient...' : patientDisplayName}
                                        </p>
                                        <p className="text-xs text-slate-400">
                                            {formatPatientMeta(patient, selectedSample.patientId)}
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mb-5">
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Patient Code</p>
                                        <p className="text-sm font-medium text-slate-700">{selectedSample.patientId}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Collected At</p>
                                        <p className="text-sm font-medium text-slate-700">
                                            {selectedSample.collectedAt
                                                ? new Date(selectedSample.collectedAt).toLocaleString()
                                                : 'Not available'}
                                        </p>
                                    </div>
                                </div>

                                <div className="border-t border-slate-100 pt-4">
                                    <p className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mb-3">
                                        Sample Specimen
                                    </p>
                                    <div className="flex items-start gap-3">
                                        <div className="w-2.5 h-10 rounded-full bg-purple-500 mt-1" />
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Test Type</p>
                                            <p className="text-sm font-bold text-slate-800 mb-2">{selectedSample.testName}</p>
                                            <div className="flex gap-6">
                                                <div>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Container Type</p>
                                                    <p className="text-xs text-slate-600">{resolveTubeHint(selectedSample.testName)}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Priority</p>
                                                    <p className="text-xs text-slate-600">{formatStatusLabel(selectedSample.priority)}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="lg:col-span-3">
                            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60">
                                <div className="px-6 pt-6 pb-4">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-800">Pre-Analytical Verification</h3>
                                            <p className="text-xs text-slate-400 mt-0.5">Complete all required physical checks before queuing the sample for analysis.</p>
                                        </div>
                                        <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                            <span className="text-xs font-bold text-emerald-600">
                                                {selectedSample.collectedAt
                                                    ? formatRelativeCollectionTime(selectedSample.collectedAt)
                                                    : 'Collection time pending'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="divide-y divide-slate-100">
                                    {checklist.map((item) => {
                                        const checked = !!checks[item.id];
                                        const isBarcodeCheck = item.id === 'barcode';

                                        return (
                                            <div
                                                key={item.id}
                                                className={`flex items-center gap-4 px-6 py-4 cursor-pointer transition-colors ${
                                                    checked ? 'bg-emerald-50/60' : 'hover:bg-slate-50/50'
                                                }`}
                                            >
                                                <label className="flex items-center gap-4 flex-1 min-w-0 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={checked}
                                                        onChange={() => handleCheck(item.id)}
                                                        className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-200 flex-shrink-0"
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <p className={`text-sm font-semibold ${checked ? 'text-emerald-700' : 'text-slate-700'}`}>
                                                                {item.label}
                                                            </p>
                                                            {item.optional && (
                                                                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                                                    Optional
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className={`text-xs mt-0.5 ${checked ? 'text-emerald-600' : 'text-slate-400'}`}>
                                                            {item.description}
                                                        </p>
                                                        {isBarcodeCheck && !checked && (
                                                            <p className="text-[11px] text-amber-600 mt-2 font-medium">
                                                                If the barcode is damaged but the specimen is otherwise acceptable, print the label before continuing.
                                                            </p>
                                                        )}
                                                    </div>
                                                </label>
                                                {isBarcodeCheck && !checked && (
                                                    <button
                                                        type="button"
                                                        onClick={handleBarcodePrint}
                                                        className="flex items-center gap-1.5 px-3 py-2 border border-primary/20 text-primary text-xs font-bold rounded-xl hover:bg-primary/5 transition-colors flex-shrink-0"
                                                    >
                                                        <span className="material-icons text-sm">qr_code_2</span>
                                                        Print Barcode
                                                    </button>
                                                )}
                                                {checked && (
                                                    <span className="material-icons text-emerald-500 text-lg flex-shrink-0">check</span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                {rejectDraftActive && (
                                    <div className="px-6 py-4 border-t border-slate-100 space-y-4 bg-red-50/30">
                                        <p className="text-xs font-semibold text-red-800">
                                            You are documenting a rejection — complete the fields below, then confirm.
                                        </p>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                                                Rejection Reason
                                            </label>
                                            <select
                                                value={rejectReason}
                                                onChange={(event) => {
                                                    setRejectReason(event.target.value as RejectionReason);
                                                    setError(null);
                                                }}
                                                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-300"
                                            >
                                                {REJECTION_REASONS.map((reason) => (
                                                    <option key={reason} value={reason}>
                                                        {formatStatusLabel(reason)}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                                                {requiresCustomMessage ? 'Custom message' : 'Message'}
                                                {requiresCustomMessage && <span className="text-red-500 ml-1">*</span>}
                                            </p>
                                            <textarea
                                                rows={3}
                                                value={notes}
                                                onChange={(event) => setNotes(event.target.value)}
                                                placeholder={requiresCustomMessage
                                                    ? 'Describe why this sample is being rejected...'
                                                    : 'Optional notes to record with this rejection...'}
                                                className="w-full px-4 py-3 text-sm border border-slate-200 rounded-xl bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-300 transition-all resize-none"
                                            />
                                        </div>
                                    </div>
                                )}

                                <div className="px-6 py-4 border-t border-slate-100">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all duration-500 ${
                                                    allRequiredPassed ? 'bg-emerald-500' : 'bg-primary'
                                                }`}
                                                style={{ width: `${(progress / checklist.length) * 100}%` }}
                                            />
                                        </div>
                                        <span className="text-xs font-bold text-slate-400">{progress}/{checklist.length} checked</span>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-3 justify-end">
                                        {rejectDraftActive && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setRejectDraftActive(false);
                                                    setNotes('');
                                                    setRejectReason(DEFAULT_REASON);
                                                    setError(null);
                                                }}
                                                disabled={selectedSampleIsBusy}
                                                className="mr-auto px-4 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors disabled:opacity-50"
                                            >
                                                Cancel rejection
                                            </button>
                                        )}
                                        {!rejectDraftActive ? (
                                            <button
                                                type="button"
                                                onClick={() => setRejectDraftActive(true)}
                                                disabled={selectedSampleIsBusy}
                                                className="flex items-center gap-1.5 px-5 py-2.5 border border-red-200 text-red-600 text-sm font-bold rounded-xl hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <span className="material-icons text-sm">cancel</span>
                                                Reject Sample
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => void handleReject()}
                                                disabled={selectedSampleIsBusy}
                                                className="flex items-center gap-1.5 px-5 py-2.5 border border-red-300 bg-red-600 text-white text-sm font-bold rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                                            >
                                                <span className="material-icons text-sm">cancel</span>
                                                {submittingAction === 'reject' ? 'Rejecting...' : 'Confirm rejection'}
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => void handleAccept()}
                                            disabled={!allRequiredPassed || selectedSampleIsBusy || rejectDraftActive}
                                            className="flex items-center gap-1.5 px-5 py-2.5 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
                                        >
                                            <span className="material-icons text-sm">verified</span>
                                            {submittingAction === 'accept' ? 'Accepting...' : 'Accept & Queue for Analysis'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
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
        return `Patient Code: ${fallbackPatientCode}`;
    }

    const tokens = [
        patient.gender,
        patient.dob ? calculateAge(patient.dob) : null,
        patient.patientCode || fallbackPatientCode,
    ].filter(Boolean);

    return tokens.join(' • ');
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

    return `${age} Years`;
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
