'use client';

import axios from 'axios';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    approveTechnically,
    getVerificationResultDetails,
    rejectTechnically,
    TestResultDetail,
} from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { PRIORITY_COLORS, formatStatusLabel as formatEnumTokenLabel } from '@/constants/sample-lifecycle';
import { formatDisplayId } from '@/lib/format-id';

const formatReferenceRange = (low?: number | null, high?: number | null) => {
    if (low == null || high == null) {
        return '-';
    }

    return `${low} - ${high}`;
};

const RESULT_FLAG_CONFIG: Record<string, { label: string; className: string }> = {
    NORMAL: { label: 'NORMAL', className: 'bg-slate-100 text-slate-600' },
    LOW: { label: 'LOW', className: 'bg-amber-100 text-amber-700' },
    HIGH: { label: 'HIGH', className: 'bg-amber-100 text-amber-700' },
    CRITICAL_LOW: { label: 'CRITICAL LOW', className: 'bg-red-100 text-red-700' },
    CRITICAL_HIGH: { label: 'CRITICAL HIGH', className: 'bg-red-100 text-red-700' },
};

const getFlagDisplay = (flag?: string | null) => {
    if (!flag) {
        return '-';
    }

    return RESULT_FLAG_CONFIG[flag.toUpperCase()]?.label ?? formatEnumTokenLabel(flag);
};

const getFlagClassName = (flag?: string | null) => {
    if (!flag) {
        return 'text-slate-400';
    }

    return RESULT_FLAG_CONFIG[flag.toUpperCase()]?.className ?? 'bg-slate-100 text-slate-600';
};

const formatWorkflowStatusLabel = (status?: string | null) => {
    if (!status) {
        return 'Pending Verification';
    }

    if (status === 'RETURNED_FOR_RECHECK') {
        return 'Returned to Supervisor';
    }

    return status
        .toLowerCase()
        .split('_')
        .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
        .join(' ');
};

const formatGenderLabel = (gender?: string | null) => {
    if (!gender) {
        return null;
    }

    return gender
        .toLowerCase()
        .split('_')
        .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
        .join(' ');
};

const formatTimestamp = (value?: string | null) => {
    if (!value) {
        return '-';
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return value;
    }

    return parsed.toLocaleString('en-LK', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
};

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

    useEffect(() => {
        const loadResultDetails = async () => {
            try {
                setLoading(true);
                setError(null);
                const response = await getVerificationResultDetails(resultId);
                setResultDetail(response);
            } catch (loadError) {
                console.error('Failed to load verification result details', loadError);
                setError('Failed to load verification result details. Please try again.');
            } finally {
                setLoading(false);
            }
        };

        if (resultId) {
            void loadResultDetails();
        }
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
                parameter: parameter.parameterName,
                result: parameter.resultText ?? parameter.resultValue ?? '-',
                unit: parameter.unit ?? '-',
                flag: getFlagDisplay(parameter.flag),
                rawFlag: parameter.flag,
                referenceRange: formatReferenceRange(parameter.referenceRangeLow, parameter.referenceRangeHigh),
                isAbnormal,
            };
        });
    }, [resultDetail]);

    const abnormalCount = labResults.filter((row) => row.isAbnormal).length;
    const criticalCount = labResults.filter(
        (row) => row.rawFlag === 'CRITICAL_HIGH' || row.rawFlag === 'CRITICAL_LOW'
    ).length;
    const specimenPriorityBadge = useMemo(() => {
        const raw = resultDetail?.priority;
        if (!raw) {
            return null;
        }

        const key = raw.toUpperCase() as keyof typeof PRIORITY_COLORS;

        return {
            label: formatEnumTokenLabel(raw),
            className: PRIORITY_COLORS[key] ?? 'bg-slate-100 text-slate-700',
        };
    }, [resultDetail?.priority]);

    const mltNotesAuthor =
        resultDetail?.mltName?.trim() ||
        resultDetail?.technicianName?.trim() ||
        'Unknown technician';
    const patientDemographics = [
        resultDetail?.patientAge != null ? `${resultDetail.patientAge}Y` : null,
        formatGenderLabel(resultDetail?.patientGender),
    ]
        .filter(Boolean)
        .join(' / ');
    const reviewerName = user?.name || user?.preferred_username || 'Current user';
    const reviewerRole = 'Lab Supervisor';
    const canReviewActions =
        resultDetail?.status === 'ENTERED' || resultDetail?.status === 'RETURNED_FOR_RECHECK';

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

    const handleApprove = async () => {
        if (!canReviewActions) {
            setSubmitError('This case has already been processed. Actions reopen only after a clinical return for recheck.');
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
            });
            setShowApproveModal(false);
            setApproveNote('');
            router.push('/verification/pending');
        } catch (submitError) {
            console.error('Failed to approve result', submitError);
            setSubmitError(resolveSubmitErrorMessage('approve', submitError));
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

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white px-8 py-10 shadow-sm">
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-slate-800" />
                    <p className="text-sm font-medium text-slate-700">Loading verification result...</p>
                </div>
            </div>
        );
    }

    if (error || !resultDetail) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="max-w-md rounded-2xl border border-slate-200 bg-white px-8 py-10 text-center shadow-sm">
                    <p className="text-lg font-bold text-slate-900">Unable to load result details</p>
                    <p className="mt-2 text-sm text-slate-500">
                        {error ?? 'The requested result could not be loaded.'}
                    </p>
                    <button
                        type="button"
                        onClick={() => router.push('/verification/pending')}
                        className="mt-5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary/90"
                    >
                        Back to Pending List
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full space-y-6">
            {showReturnModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                    <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl">
                        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                            <div>
                                <h2 className="text-lg font-bold text-slate-900">Return to MLT</h2>
                                <p className="mt-1 text-sm text-slate-500">
                                    Add the reason this case should be sent back.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    if (isSubmitting) {
                                        return;
                                    }
                                    setShowReturnModal(false);
                                    setReturnReason('');
                                    setReturnError(null);
                                    setSubmitError(null);
                                }}
                                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-50 hover:text-slate-600"
                            >
                                <span className="material-icons text-[18px]">close</span>
                            </button>
                        </div>

                        <div className="px-6 py-5">
                            <label className="block text-sm font-semibold text-slate-700" htmlFor="return-reason">
                                Return Reason
                            </label>
                            <textarea
                                id="return-reason"
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
                                rows={5}
                                placeholder="Enter the reason for return."
                                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                            />
                            {returnError && (
                                <p className="mt-2 text-sm font-medium text-red-600">{returnError}</p>
                            )}
                        </div>

                        <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4 bg-slate-50/60">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowReturnModal(false);
                                    setReturnReason('');
                                    setReturnError(null);
                                    setSubmitError(null);
                                }}
                                disabled={isSubmitting}
                                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleReturn}
                                disabled={isSubmitting}
                                className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                Confirm Return to MLT
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showApproveModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                    <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl">
                        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                            <div>
                                <h2 className="text-lg font-bold text-slate-900">Approve for Clinical Review</h2>
                                <p className="mt-1 text-sm text-slate-500">
                                    Add an optional handoff note.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    if (isSubmitting) {
                                        return;
                                    }
                                    setShowApproveModal(false);
                                    setApproveNote('');
                                    setSubmitError(null);
                                }}
                                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-50 hover:text-slate-600"
                            >
                                <span className="material-icons text-[18px]">close</span>
                            </button>
                        </div>

                        <div className="px-6 py-5">
                            <label className="block text-sm font-semibold text-slate-700" htmlFor="approve-note">
                                Lab Supervisor Note
                            </label>
                            <textarea
                                id="approve-note"
                                value={approveNote}
                                onChange={(event) => {
                                    setApproveNote(event.target.value);
                                    if (submitError) {
                                        setSubmitError(null);
                                    }
                                }}
                                rows={5}
                                placeholder="Add a note for the pathologist."
                                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                            />
                            {submitError && (
                                <p className="mt-2 text-sm font-medium text-red-600">{submitError}</p>
                            )}
                        </div>

                        <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4 bg-slate-50/60">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowApproveModal(false);
                                    setApproveNote('');
                                    setSubmitError(null);
                                }}
                                disabled={isSubmitting}
                                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleApprove}
                                disabled={isSubmitting}
                                className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                Confirm Approval
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white border border-slate-200 rounded-xl px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <button
                        onClick={handleBack}
                        className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-primary transition-colors"
                    >
                        <span className="material-icons text-[18px]">arrow_back</span>
                        Back
                    </button>
                    <div className="hidden sm:block w-px h-6 bg-slate-200" />
                    <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                            Reviewing Case
                        </span>
                        <span className="px-2.5 py-1 bg-slate-100/80 rounded-md text-xs font-bold text-slate-600 font-mono border border-slate-200">
                            {formatDisplayId(resultId, 'RES')}
                        </span>
                        <span className="text-base font-bold text-slate-800">
                            {resultDetail.patientName ?? 'Unknown patient'}
                        </span>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
                    {patientDemographics && (
                        <div className="flex items-center gap-1.5">
                            <span className="material-icons text-[16px] text-slate-400">person</span>
                            <span>{patientDemographics}</span>
                        </div>
                    )}
                    <div className="flex items-center gap-1.5">
                        <span className="material-icons text-[16px] text-slate-400">science</span>
                        <span>{resultDetail.testType ?? 'Lab Result Review'}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="material-icons text-[16px] text-slate-400">pending_actions</span>
                        <span>{formatWorkflowStatusLabel(resultDetail.status)}</span>
                    </div>
                    {specimenPriorityBadge && (
                        <span
                            className={`px-3 py-1 rounded-md text-[11px] font-bold ${specimenPriorityBadge.className}`}
                        >
                            {specimenPriorityBadge.label}
                        </span>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 pb-12">
                <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm overflow-hidden flex flex-col">
                    <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-800">
                            {resultDetail.testType ?? 'Selected Test Group'}
                        </span>
                        <span className="text-[11px] text-slate-400 font-medium">
                            Last updated: {formatTimestamp(resultDetail.updatedAt)}
                        </span>
                    </div>

                    <div className="overflow-x-auto flex-1">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-50/50 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">
                                    <th className="px-5 py-3 border-b border-slate-100">Parameter</th>
                                    <th className="px-4 py-3 border-b border-slate-100">Result</th>
                                    <th className="px-4 py-3 border-b border-slate-100">Unit</th>
                                    <th className="px-4 py-3 border-b border-slate-100">Flag</th>
                                    <th className="px-4 py-3 border-b border-slate-100">Reference Range</th>
                                </tr>
                            </thead>
                            <tbody>
                                {labResults.map((row) => (
                                    <tr
                                        key={row.parameter}
                                        className={`border-b border-slate-50 last:border-0 ${row.isAbnormal ? 'bg-red-50/30' : 'bg-white'}`}
                                    >
                                        <td className="px-5 py-3 text-slate-700 font-semibold text-[13px]">
                                            {row.parameter}
                                        </td>
                                        <td className={`px-4 py-3 text-[15px] font-bold ${row.isAbnormal ? 'text-red-600' : 'text-slate-800'}`}>
                                            {row.result}
                                        </td>
                                        <td className="px-4 py-3 text-xs text-slate-500">
                                            {row.unit}
                                        </td>
                                        <td className="px-4 py-3">
                                            {!row.rawFlag ? (
                                                <span className="text-sm text-slate-400">-</span>
                                            ) : (
                                                <span
                                                    className={`inline-flex items-center justify-center min-h-6 rounded-md px-2 py-1 text-[11px] font-bold ${getFlagClassName(row.rawFlag)}`}
                                                >
                                                    {row.flag}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-xs text-slate-500">
                                            {row.referenceRange}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-end gap-3 mt-auto">
                        {submitError && !showApproveModal && !showReturnModal && (
                            <p className="mr-auto text-sm font-medium text-red-600">{submitError}</p>
                        )}
                        {!canReviewActions && (
                            <p className="mr-auto text-xs font-medium text-slate-500">
                                This case is already reviewed. Actions reopen only when clinical sends it back for recheck.
                            </p>
                        )}
                        <button
                            onClick={() => {
                                if (!canReviewActions) {
                                    setSubmitError('This case has already been processed. Actions reopen only after a clinical return for recheck.');
                                    return;
                                }
                                setShowReturnModal(true);
                                setReturnError(null);
                                setSubmitError(null);
                            }}
                            disabled={isSubmitting || !canReviewActions}
                            className="h-10 px-5 text-sm font-bold border border-slate-200 rounded-lg bg-white text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <span className="material-icons text-[18px]">keyboard_return</span>
                            Return to MLT
                        </button>
                        <button
                            onClick={() => {
                                if (!canReviewActions) {
                                    setSubmitError('This case has already been processed. Actions reopen only after a clinical return for recheck.');
                                    return;
                                }
                                setShowApproveModal(true);
                                setSubmitError(null);
                            }}
                            disabled={isSubmitting || !canReviewActions}
                            className="h-10 px-6 text-sm font-bold border-none rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors flex items-center gap-2 shadow-sm shadow-primary/30 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <span className="material-icons text-[18px]">check_circle</span>
                            Approve &amp; Release
                        </button>
                    </div>
                </div>

                <div className="flex flex-col gap-6">
                    <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm p-5">
                        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                            <span className="text-xs font-bold text-slate-700 uppercase tracking-widest">
                                Review Summary
                            </span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
                                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                    Parameters
                                </div>
                                <div className="mt-2 text-2xl font-bold text-slate-800">
                                    {labResults.length}
                                </div>
                            </div>
                            <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
                                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                    Abnormal
                                </div>
                                <div className="mt-2 text-2xl font-bold text-amber-600">
                                    {abnormalCount}
                                </div>
                            </div>
                            <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
                                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                    Critical
                                </div>
                                <div className="mt-2 text-2xl font-bold text-red-600">
                                    {criticalCount}
                                </div>
                            </div>
                            <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
                                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                    Status
                                </div>
                                <div className="mt-2 text-sm font-bold text-slate-800">
                                    {formatWorkflowStatusLabel(resultDetail.status)}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm p-5">
                        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                            <span className="text-xs font-bold text-slate-700 uppercase tracking-widest">
                                Previous Visits
                            </span>
                        </div>

                        {resultDetail.previousVisits && resultDetail.previousVisits.length > 0 ? (
                            <div className="space-y-3">
                                {resultDetail.previousVisits.map((visit) => (
                                    <button
                                        key={visit.sampleId}
                                        type="button"
                                        onClick={() => router.push(`/verification/review/${visit.resultId}`)}
                                        className="w-full rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 text-left transition hover:border-primary/30 hover:bg-white"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <div className="text-sm font-semibold text-slate-800">
                                                    {formatTimestamp(visit.visitedAt)}
                                                </div>
                                                <div className="mt-1 text-xs text-slate-500">
                                                    {visit.parameterCount ?? 0} parameters
                                                    {' • '}
                                                    {visit.abnormalCount ?? 0} abnormal
                                                    {' • '}
                                                    {visit.criticalCount ?? 0} critical
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-1 shrink-0">
                                                {visit.priorityLevel && (
                                                    <span
                                                        className={`rounded-md px-2.5 py-1 text-[11px] font-bold border border-slate-200 ${
                                                            PRIORITY_COLORS[
                                                                visit.priorityLevel.toUpperCase() as keyof typeof PRIORITY_COLORS
                                                            ] ?? 'bg-slate-50 text-slate-600'
                                                        }`}
                                                    >
                                                        {formatEnumTokenLabel(visit.priorityLevel)}
                                                    </span>
                                                )}
                                                <span className="rounded-md bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600 border border-slate-200">
                                                    {visit.status ? formatWorkflowStatusLabel(visit.status) : '—'}
                                                </span>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-slate-500">
                                No previous visits for this test group.
                            </p>
                        )}
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm p-5">
                        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                            <span className="text-xs font-bold text-slate-700 uppercase tracking-widest">
                                MLT Notes
                            </span>
                        </div>
                        <div className="flex gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                                <span className="text-white text-[10px] font-bold">
                                    {(mltNotesAuthor ?? 'ML')
                                        .split(/\s+/)
                                        .filter(Boolean)
                                        .slice(0, 2)
                                        .map((segment) => segment.charAt(0).toUpperCase())
                                        .join('') || 'ML'}
                                </span>
                            </div>
                            <div className="pt-0.5 flex-1">
                                <div className="flex items-center justify-between mb-1 gap-3">
                                    <span className="text-xs font-bold text-slate-700">{mltNotesAuthor}</span>
                                    <span className="text-[10px] font-medium text-slate-400">
                                        {formatTimestamp(resultDetail.updatedAt)}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-600 leading-relaxed italic bg-slate-50 p-3 rounded-lg border border-slate-100">
                                    &quot;{resultDetail.mltNotes || 'No MLT notes available.'}&quot;
                                </p>
                            </div>
                        </div>
                    </div>

                    {resultDetail.clinicalNote && (
                        <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm p-5">
                            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                                <span className="text-xs font-bold text-slate-700 uppercase tracking-widest">
                                    Clinical Note
                                </span>
                            </div>
                            <div className="flex gap-3">
                                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                                    <span className="text-amber-700 text-[10px] font-bold">
                                        {(resultDetail.pathologistName ?? 'CL')
                                            .split(/\s+/)
                                            .filter(Boolean)
                                            .slice(0, 2)
                                            .map((segment) => segment.charAt(0).toUpperCase())
                                            .join('') || 'CL'}
                                    </span>
                                </div>
                                <div className="pt-0.5 flex-1">
                                    <div className="flex items-center justify-between mb-1 gap-3">
                                        <span className="text-xs font-bold text-slate-700">
                                            {resultDetail.pathologistName ?? 'Pathologist'}
                                        </span>
                                        <span className="text-[10px] font-medium text-slate-400">
                                            {formatTimestamp(resultDetail.updatedAt)}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-600 leading-relaxed italic bg-slate-50 p-3 rounded-lg border border-slate-100">
                                        &quot;{resultDetail.clinicalNote}&quot;
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
