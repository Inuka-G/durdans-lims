'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AxiosError } from 'axios';
import { getMltAllWorklist, type MltAllWorklistItem } from '@/lib/api';
import {
    PRIORITY_COLORS,
    SAMPLE_STATUS_COLORS,
    formatStatusLabel,
} from '@/constants/sample-lifecycle';

const PAGE_SIZE = 8;

export default function MLTAllWorklistPage() {
    const router = useRouter();
    const [samples, setSamples] = useState<MltAllWorklistItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [department, setDepartment] = useState('All Departments');
    const [testType, setTestType] = useState('All Test Types');
    const [currentPage, setCurrentPage] = useState(1);

    const loadSamples = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            setSamples(await getMltAllWorklist());
        } catch (err) {
            console.error('Failed to load all MLT worklist items', err);
            setError(getApiErrorMessage(err, 'Failed to load the all-worklist view. Please try again.'));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadSamples();
    }, [loadSamples]);

    const departments = useMemo(() => {
        const uniqueDepartments = Array.from(
            new Set(samples.map((sample) => sample.department).filter(Boolean))
        ).sort();
        return ['All Departments', ...uniqueDepartments];
    }, [samples]);

    const testTypes = useMemo(() => {
        const uniqueTestTypes = Array.from(
            new Set(samples.map((sample) => sample.testName).filter(Boolean))
        ).sort();
        return ['All Test Types', ...uniqueTestTypes];
    }, [samples]);

    const filtered = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();

        return samples.filter((sample) => {
            const matchesSearch =
                !query ||
                sample.patientName.toLowerCase().includes(query) ||
                sample.patientId.toLowerCase().includes(query) ||
                sample.barcode.toLowerCase().includes(query) ||
                sample.orderId.toLowerCase().includes(query);
            const matchesDept = department === 'All Departments' || sample.department === department;
            const matchesTest = testType === 'All Test Types' || sample.testName === testType;

            return matchesSearch && matchesDept && matchesTest;
        });
    }, [samples, searchQuery, department, testType]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    return (
        <div>
            <div className="mb-6">
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Laboratory / Worklist</p>
                <h1 className="text-2xl font-bold text-slate-800 mt-0.5">All Worklist</h1>
            </div>

            {error && (
                <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                </div>
            )}

            <div className="bg-blue-50 border border-blue-100 rounded-2xl px-5 py-3 flex items-center justify-between mb-6">
                <p className="text-sm text-blue-700 font-medium">
                    Showing <span className="font-bold">{filtered.length}</span> samples
                    {department !== 'All Departments' && ` in ${department}`}
                    {testType !== 'All Test Types' && ` — ${testType}`}
                </p>
                <p className="text-xs text-blue-500">Cross-department view — read-only</p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60">
                    <div className="p-4 border-b border-slate-100">
                        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                            <div className="relative flex-1">
                                <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-lg text-slate-400">search</span>
                                <input
                                    type="text"
                                    placeholder="Search sample ID, patient, patient ID, or order..."
                                    className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                    value={searchQuery}
                                    onChange={(event) => {
                                        setSearchQuery(event.target.value);
                                        setCurrentPage(1);
                                    }}
                                />
                            </div>
                            <select
                                className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                                value={department}
                                onChange={(event) => {
                                    setDepartment(event.target.value);
                                    setCurrentPage(1);
                                }}
                            >
                                {departments.map((item) => (
                                    <option key={item} value={item}>
                                        {item}
                                    </option>
                                ))}
                            </select>
                            <select
                                className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                                value={testType}
                                onChange={(event) => {
                                    setTestType(event.target.value);
                                    setCurrentPage(1);
                                }}
                            >
                                {testTypes.map((item) => (
                                    <option key={item} value={item}>
                                        {item}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {loading ? (
                        <div className="py-16 text-center">
                            <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-primary" />
                            <p className="mt-3 text-sm text-slate-500">Loading all-worklist samples...</p>
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider">
                                            <th className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">Sample ID</th>
                                            <th className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">Patient Details</th>
                                            <th className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">Test Type</th>
                                            <th className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">Priority</th>
                                            <th className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">Status</th>
                                            <th className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginated.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="text-center py-12 text-slate-400">
                                                    {samples.length === 0
                                                        ? 'No samples are currently available in the all-worklist view.'
                                                        : 'No samples match your filters.'}
                                                </td>
                                            </tr>
                                        ) : (
                                            paginated.map((sample) => (
                                                <tr
                                                    key={sample.sampleId}
                                                    className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors"
                                                >
                                                    <td className="px-5 py-3 font-semibold text-primary">{sample.barcode}</td>
                                                    <td className="px-4 py-3">
                                                        <p className="font-medium text-slate-700">{sample.patientName}</p>
                                                        <p className="text-xs text-slate-400">{sample.patientId}</p>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <p className="text-slate-700">{sample.testName}</p>
                                                        <p className="text-[10px] text-slate-400">{sample.department}</p>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${
                                                            PRIORITY_COLORS[sample.priority as keyof typeof PRIORITY_COLORS] ??
                                                            'bg-slate-100 text-slate-600'
                                                        }`}>
                                                            {formatStatusLabel(sample.priority)}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${
                                                            SAMPLE_STATUS_COLORS[sample.status] ?? 'bg-slate-100 text-slate-600'
                                                        }`}>
                                                            {formatStatusLabel(sample.status)}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <div className="flex justify-end gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => router.push(`/mlt/result-entry?sampleId=${sample.sampleId}`)}
                                                                className="px-3 py-1.5 border border-slate-200 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-50 transition-colors"
                                                            >
                                                                <span className="material-icons text-sm mr-1 align-middle">visibility</span>
                                                                View
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => router.push(`/mlt/result-entry?sampleId=${sample.sampleId}&tab=history`)}
                                                                className="px-3 py-1.5 bg-slate-800 text-white text-xs font-bold rounded-lg hover:bg-slate-700 transition-colors"
                                                            >
                                                                <span className="material-icons text-sm mr-1 align-middle">history</span>
                                                                History
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 text-sm text-slate-500">
                                <p>
                                    Showing {filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1} to{' '}
                                    {Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length}
                                </p>
                                <div className="flex items-center gap-2">
                                    <button
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
                                            onClick={() => setCurrentPage(page)}
                                            className={`w-8 h-8 rounded-lg text-sm font-bold transition-colors ${
                                                currentPage === page
                                                    ? 'bg-primary text-white shadow-sm'
                                                    : 'border border-slate-200 hover:bg-slate-50 text-slate-600'
                                            }`}
                                        >
                                            {page}
                                        </button>
                                    ))}
                                    <button
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
