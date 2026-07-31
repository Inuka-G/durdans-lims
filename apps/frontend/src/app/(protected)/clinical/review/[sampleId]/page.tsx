'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import axios from 'axios';
import { useAuth } from '@/hooks/useAuth';
import {
    authorizeClinical,
    downloadPatientDocument,
    getClinicalResultDetails,
    getPatientDocuments,
    returnForRecheck,
    TestResultDetail,
} from '@/lib/api';
import type { PatientDocument } from '@/lib/api';

const getInitials = (value: string) =>
    value
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('') || 'P';

const withDoctorPrefix = (value: string) => (value.startsWith('Dr.') ? value : `Dr. ${value}`);

const formatDateTime = (value?: string | null) => {
    if (!value) {
        return null;
    }

    return new Date(value).toLocaleString([], {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
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
    if (status === 'RETURNED_FOR_RECHECK') {
        return 'Returned to Supervisor';
    }
    return 'Pending Clinical Review';
};

export default function ClinicalReviewPage() {
    const router = useRouter();
    const { user } = useAuth();
    const params = useParams<{ sampleId: string }>();
    const sampleId = Array.isArray(params.sampleId) ? params.sampleId[0] : params.sampleId;
    const resultId = sampleId;

    const [data, setData] = useState<TestResultDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
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

    const rawPathologistName = user?.name || user?.preferred_username || 'Pathologist';
    const pathologistDisplayName = withDoctorPrefix(rawPathologistName);
    const isAuthorized = data?.status === 'CLINICALLY_AUTHORIZED';
    const canActOnCase = data?.status === 'TECHNICALLY_VERIFIED';
    const authorizationActor = withDoctorPrefix(data?.pathologistName || rawPathologistName);
    const authorizationInitials = getInitials(data?.pathologistName || rawPathologistName);

    const handleBack = () => {
        if (typeof window !== 'undefined' && window.history.length > 1) {
            router.back();
            return;
        }
        router.push('/clinical/worklist');
    };

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
    }, [resultId]);

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

    const previousVisits = data?.previousVisits ?? [];

    const handleAuthorize = () => {
        if (!canActOnCase) {
            setActionError(
                data?.status === 'CLINICALLY_AUTHORIZED'
                    ? 'This case is already authorized.'
                    : `This case can no longer be authorized from its current status: ${getStatusLabel(data?.status)}.`
            );
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
            setActionError(
                data?.status === 'CLINICALLY_AUTHORIZED'
                    ? 'This case is already authorized.'
                    : `This case can no longer be authorized from its current status: ${getStatusLabel(data?.status)}.`
            );
            return;
        }
        try {
            setIsSubmittingAuthorize(true);
            setActionError(null);
            setShowSignModal(false);
            const response = await authorizeClinical(resultId, {
                status: 'CLINICALLY_AUTHORIZED',
                clinicalNote: interpretation,
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
            setActionError(
                data?.status === 'RETURNED_FOR_RECHECK'
                    ? 'This case has already been returned to the lab supervisor.'
                    : `This case can no longer be returned from its current status: ${getStatusLabel(data?.status)}.`
            );
            return;
        }
        if (!returnReason.trim()) {
            setActionError('Please enter a reason for returning.');
            return;
        }
        try {
            setIsSubmittingReturn(true);
            setActionError(null);
            await returnForRecheck(resultId, {
                status: 'RETURNED',
                returnReason,
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

    if (loading) {
        return <div>Loading clinical result details...</div>;
    }

    if (error || !data) {
        return <div>{error ?? 'Failed to load clinical result details.'}</div>;
    }

    const noteTimestamp = formatDateTime(data.updatedAt);

    return (
        <div className="flex flex-col h-full space-y-6">
            {showReturnModal && (
                <div
                    className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    onClick={() => setShowReturnModal(false)}
                >
                    <div
                        className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-5">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">Return to Lab Supervisor</h3>
                            </div>
                            <button
                                onClick={() => setShowReturnModal(false)}
                                className="w-8 h-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 flex items-center justify-center transition-colors"
                            >
                                <span className="material-icons text-[18px]">close</span>
                            </button>
                        </div>

                        <div className="mb-4">
                            <label className="text-sm font-semibold text-slate-700 block mb-2">
                                Reason for Return <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                value={returnReason}
                                onChange={(event) => setReturnReason(event.target.value)}
                                placeholder="Describe why this case should be returned to the lab supervisor..."
                                rows={4}
                                className="w-full p-3 text-sm border border-slate-200 rounded-xl bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none"
                            />
                        </div>

                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setShowReturnModal(false)}
                                disabled={isSubmittingReturn}
                                className="px-5 py-2.5 text-sm font-semibold border border-slate-200 rounded-lg bg-white text-slate-600 hover:bg-slate-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleReturn}
                                disabled={isSubmittingReturn}
                                className="px-5 py-2.5 text-sm font-semibold border-none rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                {isSubmittingReturn ? 'Returning...' : 'Confirm Return to Supervisor'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showSignModal && (
                <div
                    className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    onClick={() => setShowSignModal(false)}
                >
                    <div
                        className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="text-center mb-6">
                            <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-4 border border-blue-100">
                                <span className="material-icons text-[28px] text-primary">verified</span>
                            </div>
                            <h3 className="text-lg font-bold text-slate-800">Attach Signature &amp; Authorize</h3>
                        </div>

                        <div className="p-4 bg-slate-50 rounded-xl mb-6 border border-slate-100">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shrink-0">
                                    <span className="text-white text-sm font-bold">{getInitials(rawPathologistName)}</span>
                                </div>
                                <div>
                                    <div className="text-sm font-bold text-slate-800">{pathologistDisplayName}</div>
                                    <div className="text-[11px] text-slate-500 mt-0.5">Pathologist</div>
                                </div>
                            </div>
                            <div className="mt-4 p-3 bg-white rounded-lg border border-slate-200">
                                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Digital Signature</div>
                                <div className="text-lg text-primary italic font-serif opacity-80">{pathologistDisplayName}</div>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowSignModal(false)}
                                disabled={isSubmittingAuthorize}
                                className="flex-1 py-2.5 text-sm font-semibold border border-slate-200 rounded-lg bg-white text-slate-600 hover:bg-slate-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmSign}
                                disabled={isSubmittingAuthorize}
                                className="flex-[1.5] py-2.5 text-sm font-bold border-none rounded-lg bg-primary hover:bg-primary/90 text-white transition-colors shadow-sm shadow-primary/30 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                <span className="material-icons text-[18px]">check_circle</span>
                                {isSubmittingAuthorize ? 'Authorizing...' : 'Confirm Signature'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white border border-slate-200 rounded-xl px-6 py-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4 shadow-sm">
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                    <button
                        onClick={handleBack}
                        className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-primary transition-colors"
                    >
                        <span className="material-icons text-[18px]">arrow_back</span>
                        Back
                    </button>
                    <div className="hidden lg:block w-px h-6 bg-slate-200" />
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Reviewing Case</span>
                        <span className="px-2.5 py-1 bg-slate-100/80 rounded-md text-xs font-bold text-slate-600 font-mono border border-slate-200">
                            {sampleId}
                        </span>
                        <span className="text-base font-bold text-slate-800">{data.patientName ?? 'Unknown patient'}</span>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
                    {data.patientAge != null && formatGender(data.patientGender) && (
                        <div className="flex items-center gap-1.5">
                            <span className="material-icons text-[16px] text-slate-400">person</span>
                            <span>{data.patientAge}Y / {formatGender(data.patientGender)}</span>
                        </div>
                    )}
                    {data.patientCode && (
                        <div className="flex items-center gap-1.5">
                            <span className="material-icons text-[16px] text-slate-400">badge</span>
                            <span>{data.patientCode}</span>
                        </div>
                    )}
                    {data.testType && (
                        <div className="flex items-center gap-1.5">
                            <span className="material-icons text-[16px] text-slate-400">science</span>
                            <span>{data.testType}</span>
                        </div>
                    )}
                    {(data.priority === 'CRITICAL_HIGH' || data.priority === 'CRITICAL_LOW' || data.priority === 'HIGH' || data.priority === 'LOW') && (
                        <span
                            className={`px-3 py-1 text-[11px] font-bold rounded-md border ${
                                data.priority?.includes('CRITICAL')
                                    ? 'bg-red-100 text-red-700 border-red-200'
                                    : 'bg-amber-100 text-amber-700 border-amber-200'
                            }`}
                        >
                            {data.priority === 'CRITICAL_HIGH'
                                ? 'Critical High'
                                : data.priority === 'CRITICAL_LOW'
                                    ? 'Critical Low'
                                    : data.priority === 'HIGH'
                                        ? 'Flagged High'
                                        : 'Flagged Low'}
                        </span>
                    )}
                    <span className="px-3 py-1 bg-blue-50 text-primary text-[11px] font-bold rounded-md border border-blue-100">
                        {getStatusLabel(data.status)}
                    </span>
                </div>
            </div>

            {hasAbnormalBanner && (
                <div
                    className={`rounded-xl border px-5 py-4 shadow-sm flex items-start gap-3 ${
                        criticalResults.length > 0
                            ? 'bg-red-50 border-red-200'
                            : 'bg-amber-50 border-amber-200'
                    }`}
                >
                    <span
                        className={`material-icons mt-0.5 ${
                            criticalResults.length > 0 ? 'text-red-500' : 'text-amber-500'
                        }`}
                    >
                        warning
                    </span>
                    <div className="text-sm leading-relaxed">
                        <span
                            className={`font-bold ${
                                criticalResults.length > 0 ? 'text-red-700' : 'text-amber-700'
                            }`}
                        >
                            {criticalResults.length > 0 ? 'Critical Values Detected' : 'Abnormal Values Detected'}
                        </span>
                        <span className={criticalResults.length > 0 ? 'text-red-600' : 'text-amber-700'}>
                            {' '} - {abnormalSummary}
                            {flaggedResults.length > bannerResults.length && ` and ${flaggedResults.length - bannerResults.length} more flagged value${flaggedResults.length - bannerResults.length > 1 ? 's' : ''}.`}
                        </span>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 pb-12">
                <div className="flex flex-col gap-6">
                    <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm overflow-hidden flex flex-col">
                        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
                            <span className="text-sm font-bold text-slate-800">{data.testType ?? 'Test Results'}</span>
                            <span className="text-[11px] text-slate-500 font-medium">{data.supervisorName ?? 'Lab Supervisor'}</span>
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
                                        <tr key={row.parameter} className={`border-b border-slate-50 last:border-0 ${row.isAbnormal ? 'bg-red-50/30' : 'bg-white'}`}>
                                            <td className="px-5 py-3 text-[13px] text-slate-700 font-semibold">{row.parameter}</td>
                                            <td className={`px-4 py-3 text-[15px] font-bold ${row.isAbnormal ? 'text-red-600' : 'text-slate-800'}`}>{row.result}</td>
                                            <td className="px-4 py-3 text-xs text-slate-500">{row.unit}</td>
                                            <td className="px-4 py-3">
                                                {row.flag === 'NORMAL' ? (
                                                    <span className="text-slate-400 text-sm">-</span>
                                                ) : (
                                                    <span className={`inline-flex items-center justify-center rounded-md px-2 py-1 text-[11px] font-bold ${row.flag === 'HIGH' || row.flag === 'CRITICAL_HIGH' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-800'}`}>
                                                        {row.flag}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-xs text-slate-500">{row.referenceRange}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm p-6">
                        <label className="text-sm font-bold text-slate-800 block mb-3">
                            Clinical Interpretation <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            value={interpretation}
                            onChange={(event) => setInterpretation(event.target.value)}
                            placeholder="Enter your clinical interpretation of these results..."
                            rows={5}
                            className="w-full p-4 text-sm border border-slate-200 rounded-xl bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none shadow-sm"
                        />
                        {actionError && (
                            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                {actionError}
                            </div>
                        )}
                        <div className="flex flex-col sm:flex-row items-center justify-end mt-4 gap-4">
                            <div className="flex items-center gap-3 w-full sm:w-auto order-1 sm:order-2">
                                {canActOnCase && (
                                    <button
                                        onClick={() => {
                                            setActionError(null);
                                            setShowReturnModal(true);
                                        }}
                                        className="flex-1 sm:flex-none h-11 px-5 text-sm font-bold border border-slate-200 rounded-lg bg-white text-slate-600 hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
                                    >
                                        <span className="material-icons text-[18px]">keyboard_return</span>
                                        Return to Supervisor
                                    </button>
                                )}
                                <button
                                    onClick={handleAuthorize}
                                    disabled={!canActOnCase}
                                    className={`flex-[1.5] sm:flex-none h-11 px-6 text-sm font-bold border-none rounded-lg text-white transition-colors shadow-sm flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:shadow-none ${isAuthorized ? 'bg-emerald-600 hover:bg-emerald-600 shadow-emerald-500/30' : canActOnCase ? 'bg-primary hover:bg-primary/90 shadow-primary/30' : 'bg-slate-400'}`}
                                >
                                    <span className="material-icons text-[18px]">{isAuthorized ? 'check_circle' : 'verified'}</span>
                                    {isAuthorized ? 'Authorized for Dispatch' : 'Attach Signature & Authorize'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-6">
                    <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm p-5">
                        <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
                            <span className="text-xs font-bold text-slate-700 uppercase tracking-widest">
                                Patient Documents
                            </span>
                            {data.patientCode && (
                                <button
                                    onClick={() => router.push(`/patients/${data.patientCode}/documents`)}
                                    className="text-[11px] font-bold text-primary hover:text-primary/80 transition-colors"
                                >
                                    View All
                                </button>
                            )}
                        </div>

                        {!data.patientCode ? (
                            <p className="text-sm text-slate-500">Patient document access is unavailable for this case.</p>
                        ) : documentsLoading ? (
                            <div className="flex items-center gap-2 text-sm text-slate-500">
                                <span className="material-icons animate-spin text-primary text-[18px]">sync</span>
                                Loading documents...
                            </div>
                        ) : documentsError ? (
                            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
                                {documentsError}
                            </div>
                        ) : documents.length === 0 ? (
                            <p className="text-sm text-slate-500">No patient documents uploaded.</p>
                        ) : (
                            <div className="flex flex-col gap-3">
                                {documents.map((patientDocument) => (
                                    <div
                                        key={patientDocument.documentId}
                                        className="rounded-xl border border-slate-200 bg-slate-50/50 p-3"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="material-icons text-slate-400 text-[18px]">description</span>
                                                    <p className="truncate text-sm font-bold text-slate-800">
                                                        {patientDocument.originalFileName}
                                                    </p>
                                                </div>
                                                <p className="mt-1 text-[11px] font-semibold text-slate-500">
                                                    {formatDocumentType(patientDocument.documentType)} - {formatFileSize(patientDocument.fileSize)}
                                                </p>
                                                {patientDocument.description && (
                                                    <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-500">
                                                        {patientDocument.description}
                                                    </p>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => void handleDownloadDocument(
                                                    patientDocument.documentId,
                                                    patientDocument.originalFileName
                                                )}
                                                className="h-8 w-8 shrink-0 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-primary hover:border-primary/30 transition-colors flex items-center justify-center"
                                                title="Download document"
                                            >
                                                <span className="material-icons text-[18px]">download</span>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                    </div>

                    <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm p-5">
                        <span className="text-xs font-bold text-slate-700 uppercase tracking-widest block mb-4 pb-3 border-b border-slate-100">
                            Digital Authorization
                        </span>
                        <div className="flex items-center gap-3 mb-4">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isAuthorized ? 'bg-emerald-600' : 'bg-primary'}`}>
                                <span className="text-white text-sm font-bold">{isAuthorized ? authorizationInitials : getInitials(rawPathologistName)}</span>
                            </div>
                            <div>
                                <div className="text-sm font-bold text-slate-800">{isAuthorized ? authorizationActor : pathologistDisplayName}</div>
                                <div className="text-[11px] text-slate-500 mt-0.5">
                                    {isAuthorized ? 'Authorized Pathologist' : 'Signature Pending'}
                                </div>
                            </div>
                        </div>
                        <div className={`p-3 rounded-lg border ${isAuthorized ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100'}`}>
                            <div className="flex items-center justify-between gap-3 mb-2">
                                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                    {isAuthorized ? 'Digitally Authorized' : 'Signature Preview'}
                                </div>
                                {isAuthorized && (
                                    <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                                        Signed
                                    </span>
                                )}
                            </div>
                            <div className={`text-lg italic font-serif opacity-80 ${isAuthorized ? 'text-emerald-700' : 'text-primary'}`}>
                                {isAuthorized ? authorizationActor : pathologistDisplayName}
                            </div>
                            {isAuthorized && (
                                <div className="mt-3 text-[11px] text-slate-500">
                                    {`Authorized at ${formatDateTime(data.authorizedAt) ?? 'Not recorded'}`}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm p-5">
                        <span className="text-xs font-bold text-slate-700 uppercase tracking-widest block mb-4 pb-3 border-b border-slate-100">
                            Previous Visits
                        </span>
                        {previousVisits.length === 0 ? (
                            <p className="text-sm text-slate-500">No previous visits for this test group.</p>
                        ) : (
                            <div className="flex flex-col gap-3">
                                {previousVisits.map((visit) => (
                                    <button
                                        key={visit.resultId}
                                        onClick={() => router.push(`/clinical/review/${visit.resultId}`)}
                                        className="w-full text-left p-4 rounded-xl border border-slate-200 hover:border-primary/30 hover:bg-slate-50 transition-colors"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <div className="text-sm font-bold text-slate-800">
                                                    {formatDateTime(visit.visitedAt) ?? 'Previous visit'}
                                                </div>
                                                <div className="text-xs text-slate-500 mt-1">
                                                    {visit.parameterCount ?? 0} parameters • {visit.abnormalCount ?? 0} abnormal • {visit.criticalCount ?? 0} critical
                                                </div>
                                            </div>
                                            <span className="px-2 py-1 rounded-md bg-slate-100 text-slate-700 text-[11px] font-bold">
                                                {getStatusLabel(visit.status)}
                                            </span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm p-5">
                        <span className="text-xs font-bold text-slate-700 uppercase tracking-widest block mb-4 pb-3 border-b border-slate-100">
                            MLT Notes
                        </span>
                        <div className="flex gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0 border border-blue-100">
                                <span className="text-blue-600 text-[10px] font-bold">ML</span>
                            </div>
                            <div className="pt-0.5 flex-1">
                                <div className="flex items-center justify-between mb-1.5 gap-3">
                                    <span className="text-xs font-bold text-slate-700">
                                        {data.mltName ?? 'Unknown technician'} <span className="text-[10px] font-medium text-slate-400 ml-1">MLT</span>
                                    </span>
                                    {noteTimestamp && (
                                        <span className="text-[10px] font-medium text-slate-400">{noteTimestamp}</span>
                                    )}
                                </div>
                                <p className="text-xs text-slate-600 leading-relaxed italic bg-slate-50 p-3 rounded-lg border border-slate-100">
                                    &quot;{data.mltNotes || 'No MLT notes available.'}&quot;
                                </p>
                            </div>
                        </div>
                    </div>

                    {data.supervisorNote && (
                        <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm p-5">
                            <span className="text-xs font-bold text-slate-700 uppercase tracking-widest block mb-4 pb-3 border-b border-slate-100">
                                Supervisor Note
                            </span>
                            <div className="flex gap-3">
                                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0 border border-amber-200">
                                    <span className="text-amber-700 text-[10px] font-bold">LS</span>
                                </div>
                                <div className="pt-0.5 flex-1">
                                    <div className="flex items-center justify-between mb-1.5 gap-3">
                                        <span className="text-xs font-bold text-slate-700">{data.supervisorName ?? 'Lab Supervisor'}</span>
                                        {noteTimestamp && (
                                            <span className="text-[10px] font-medium text-slate-400">{noteTimestamp}</span>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-600 leading-relaxed italic bg-slate-50 p-3 rounded-lg border border-slate-100">
                                        &quot;{data.supervisorNote}&quot;
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
