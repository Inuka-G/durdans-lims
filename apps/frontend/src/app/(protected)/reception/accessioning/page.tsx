'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { AxiosError } from 'axios';
import { getReceptionSamples, type MltWorklistItem } from '@/lib/api';
import { PRIORITY_COLORS, SAMPLE_STATUS_COLORS, formatStatusLabel } from '@/constants/sample-lifecycle';

const PAGE_SIZE = 8;

export default function ReceptionAccessioningPage() {
    const pathname = usePathname();
    const [samples, setSamples] = useState<MltWorklistItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [testTypeFilter, setTestTypeFilter] = useState('All Test Types');
    const [currentPage, setCurrentPage] = useState(1);

    const loadSamples = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const data = await getReceptionSamples();
            setSamples(data);
        } catch (err) {
            console.error('Failed to load reception samples', err);
            setError(getApiErrorMessage(err, 'Failed to load reception samples. Please try again.'));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadSamples();
    }, [loadSamples, pathname]);

    const testTypes = useMemo(() => {
        const uniqueTestNames = Array.from(new Set(samples.map((sample) => sample.testName))).sort();
        return ['All Test Types', ...uniqueTestNames];
    }, [samples]);

    const filteredSamples = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();

        return samples.filter((sample) => {
            const matchesSearch =
                query.length === 0 ||
                sample.barcode.toLowerCase().includes(query) ||
                sample.patientId.toLowerCase().includes(query) ||
                sample.orderId.toLowerCase().includes(query) ||
                sample.testName.toLowerCase().includes(query);

            const matchesTestType =
                testTypeFilter === 'All Test Types' || sample.testName === testTypeFilter;

            return matchesSearch && matchesTestType;
        });
    }, [samples, searchQuery, testTypeFilter]);

    const totalPages = Math.max(1, Math.ceil(filteredSamples.length / PAGE_SIZE));
    const paginatedSamples = filteredSamples.slice(
        (currentPage - 1) * PAGE_SIZE,
        currentPage * PAGE_SIZE
    );
    const urgentSamples = samples.filter(
        (sample) => sample.priority === 'URGENT' || sample.priority === 'STAT'
    ).length;

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Sample Accessioning</h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Open sample details first, then continue to verification from the sample detail view.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => void loadSamples()}
                    disabled={loading}
                    className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <span className={`material-icons ${loading ? 'animate-spin' : ''}`}>refresh</span>
                </button>
            </div>

            {error && (
                <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-2 lg:grid-cols-2 gap-5 mb-6">
                <StatCard label="Samples Pending" value={samples.length} icon="assignment" iconClasses="bg-blue-100 text-blue-600" />
                <StatCard label="Urgent Samples" value={urgentSamples} icon="warning" iconClasses="bg-orange-100 text-orange-600" />
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60">
                <div className="p-4 border-b border-slate-100">
                    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                        <div className="relative flex-1">
                            <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-lg text-slate-400">
                                search
                            </span>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(event) => {
                                    setSearchQuery(event.target.value);
                                    setCurrentPage(1);
                                }}
                                placeholder="Search barcode, patient ID, order ID, or test..."
                                className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                            />
                        </div>

                        <select
                            value={testTypeFilter}
                            onChange={(event) => {
                                setTestTypeFilter(event.target.value);
                                setCurrentPage(1);
                            }}
                            className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                        >
                            {testTypes.map((testType) => (
                                <option key={testType} value={testType}>
                                    {testType}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {loading ? (
                    <div className="py-16 text-center">
                        <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-primary" />
                        <p className="mt-3 text-sm text-slate-500">Loading received samples...</p>
                    </div>
                ) : filteredSamples.length === 0 ? (
                    <div className="py-16 text-center text-slate-400">
                        <p className="text-sm font-medium">
                            {samples.length === 0
                                ? 'No collected samples are waiting for accessioning.'
                                : 'No samples match your current filters.'}
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider">
                                        <th className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">Barcode</th>
                                        <th className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">Patient / Order</th>
                                        <th className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">Test Type</th>
                                        <th className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">Collection Time</th>
                                        <th className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">Priority</th>
                                        <th className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">Status</th>
                                        <th className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedSamples.map((sample) => (
                                        <tr
                                            key={sample.sampleId}
                                            className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors"
                                        >
                                            <td className="px-5 py-3 font-semibold">
                                                <Link
                                                    href={`/reception/samples/${sample.sampleId}`}
                                                    className="text-primary hover:underline"
                                                >
                                                    {sample.barcode}
                                                </Link>
                                            </td>
                                            <td className="px-4 py-3">
                                                <p className="font-medium text-slate-700">{sample.patientId}</p>
                                                <p className="text-xs text-slate-400">{sample.orderId}</p>
                                            </td>
                                            <td className="px-4 py-3 text-slate-700">{sample.testName}</td>
                                            <td className="px-4 py-3 text-slate-500">
                                                {sample.collectedAt
                                                    ? new Date(sample.collectedAt).toLocaleString()
                                                    : 'N/A'}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span
                                                    className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${PRIORITY_COLORS[sample.priority as keyof typeof PRIORITY_COLORS] ??
                                                        'bg-slate-100 text-slate-600'
                                                        }`}
                                                >
                                                    {formatStatusLabel(sample.priority)}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span
                                                    className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${SAMPLE_STATUS_COLORS[sample.status] ??
                                                        'bg-slate-100 text-slate-600'
                                                        }`}
                                                >
                                                    {formatStatusLabel(sample.status)}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex justify-end">
                                                    <Link
                                                        href={`/reception/samples/${sample.sampleId}`}
                                                        className="px-3 py-1.5 border border-slate-200 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-50 transition-colors"
                                                    >
                                                        Details
                                                    </Link>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 text-sm text-slate-500">
                            <p>
                                Showing {filteredSamples.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1} to{' '}
                                {Math.min(currentPage * PAGE_SIZE, filteredSamples.length)} of {filteredSamples.length}
                            </p>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    disabled={currentPage === 1}
                                    onClick={() => setCurrentPage((page) => page - 1)}
                                    className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                >
                                    <span className="material-icons text-base">chevron_left</span>
                                    Prev
                                </button>
                                {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                                    <button
                                        key={page}
                                        type="button"
                                        onClick={() => setCurrentPage(page)}
                                        className={`w-8 h-8 rounded-lg text-sm font-bold transition-colors ${currentPage === page
                                                ? 'bg-primary text-white shadow-sm'
                                                : 'border border-slate-200 hover:bg-slate-50 text-slate-600'
                                            }`}
                                    >
                                        {page}
                                    </button>
                                ))}
                                <button
                                    type="button"
                                    disabled={currentPage === totalPages}
                                    onClick={() => setCurrentPage((page) => page + 1)}
                                    className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                >
                                    Next
                                    <span className="material-icons text-base">chevron_right</span>
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

type StatCardProps = {
    label: string;
    value: number;
    icon: string;
    iconClasses: string;
};

function StatCard({ label, value, icon, iconClasses }: StatCardProps) {
    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-5">
            <div className="flex items-center justify-between mb-2">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconClasses}`}>
                    <span className="material-icons">{icon}</span>
                </div>
            </div>
            <p className="text-2xl font-bold text-slate-800">{value}</p>
            <p className="text-xs text-slate-500">{label}</p>
        </div>
    );
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
