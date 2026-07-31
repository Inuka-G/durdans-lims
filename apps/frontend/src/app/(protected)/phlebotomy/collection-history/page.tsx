'use client';

import { useCallback, useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PRIORITY_COLORS } from '@/constants/sample-lifecycle';
import { getCollectionHistory } from '@/lib/api';
import type { CollectionHistoryEntry } from '@/types/sample-lifecycle';

const PAGE_SIZE = 8;
const STATUS_COLORS: Record<string, string> = {
    COLLECTED: 'bg-emerald-100 text-emerald-700',
    REJECTED: 'bg-red-100 text-red-700',
    RECOLLECTION_REQUIRED: 'bg-orange-100 text-orange-700',
    IN_TRANSIT: 'bg-cyan-100 text-cyan-700'
};
type RawCollectionHistoryItem = {
    id?: string | number;
    sampleId?: string | number;
    patientName?: string;
    pid?: string;
    testCodes?: string[];
    tubeType?: string;
    priority?: CollectionHistoryEntry['priority'];
    status?: CollectionHistoryEntry['status'];
    collectedAt?: string;
    collectedBy?: string;
    waitTime?: number | string;
    rejectionNotes?: string;
    printCount?: number;
};

function formatWaitTime(minutes?: number) {
    const totalMinutes = Math.max(0, Math.floor(minutes ?? 0));
    if (totalMinutes < 60) return `${totalMinutes} min`;

    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const remainingMinutes = totalMinutes % 60;
    if (days > 0) {
        const parts = [`${days}d`];
        if (hours > 0) parts.push(`${hours}h`);
        if (remainingMinutes > 0) parts.push(`${remainingMinutes}m`);
        return parts.join(' ');
    }

    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

function formatEventDateTime(value?: string) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';

    return date.toLocaleString('en-LK', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export default function CollectionHistoryPage() {
    const pathname = usePathname();
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('All Status');
    const [currentPage, setCurrentPage] = useState(1);
    const [collectionHistory, setCollectionHistory] = useState<CollectionHistoryEntry[]>([]);
    const [selectedRejection, setSelectedRejection] = useState<CollectionHistoryEntry | null>(null);

    const loadCollectionHistory = useCallback(async () => {
        try {
            const data = await getCollectionHistory(0, 100);
            const rawItems = data as { content?: RawCollectionHistoryItem[] } | RawCollectionHistoryItem[] | null | undefined;
            const items: RawCollectionHistoryItem[] = Array.isArray(rawItems) ? rawItems : rawItems?.content ?? [];
            const rows: CollectionHistoryEntry[] = [...items].map((item) => ({
                id: String(item?.id ?? item?.sampleId ?? ''),
                sampleId: String(item?.sampleId ?? '-'),
                patientName: item?.patientName ?? '-',
                pid: item?.pid ?? '-',
                testCodes: Array.isArray(item?.testCodes) ? item.testCodes : [],
                tubeType: item?.tubeType ? String(item.tubeType) : undefined,
                priority: item?.priority ?? 'NORMAL',
                status: item?.status ?? 'IN_TRANSIT',
                collectedAt: formatEventDateTime(item?.collectedAt),
                collectedBy: item?.collectedBy ?? '-',
                waitTime: Number(item?.waitTime ?? 0),
                rejectionNotes: item?.rejectionNotes,
                printCount: Number(item?.printCount ?? 0),
            }));
            setCollectionHistory(rows);
        } catch (error) {
            console.error('Failed to fetch collection history:', error);
            setCollectionHistory([]);
        }
    }, []);

    useEffect(() => {
        void loadCollectionHistory();
    }, [loadCollectionHistory, pathname]);

    const filtered = useMemo(() => {
        return collectionHistory.filter((h) => {
            const q = searchQuery.toLowerCase();
            const matchesSearch = !q || h.patientName.toLowerCase().includes(q) || h.sampleId.toLowerCase().includes(q) || h.pid.toLowerCase().includes(q);
            const matchesStatus = statusFilter === 'All Status' || h.status === statusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [collectionHistory, searchQuery, statusFilter]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    const collected = collectionHistory.filter(h => h.status === 'COLLECTED').length;
    const rejected = collectionHistory.filter(h => h.status === 'REJECTED').length;

    return (
        <div>
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-800">Collection History</h1>
                <p className="text-sm text-slate-500 mt-1">Review collected, rejected, and recollection-required specimens from the laboratory system. Open a row for full detail and label printing.</p>
            </div>

            {selectedRejection && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
                    <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-5">
                        <div className="flex items-start justify-between gap-4 mb-4">
                            <div>
                                <h2 className="text-base font-bold text-slate-800">Rejection Message</h2>
                                <p className="text-sm text-slate-500 mt-1">
                                    {selectedRejection.sampleId} • {selectedRejection.patientName}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedRejection(null)}
                                className="text-slate-400 hover:text-slate-600"
                            >
                                <span className="material-icons text-lg">close</span>
                            </button>
                        </div>
                        <div className="rounded-xl bg-red-50 border border-red-100 p-4 text-sm text-red-700 whitespace-pre-wrap">
                            {selectedRejection.rejectionNotes || 'No rejection message recorded.'}
                        </div>
                        <div className="flex justify-end mt-4">
                            <button
                                type="button"
                                onClick={() => setSelectedRejection(null)}
                                className="px-4 py-2 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary/90"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-6">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-5">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center mb-2"><span className="material-icons text-blue-600">history</span></div>
                    <p className="text-2xl font-bold text-slate-800">{collectionHistory.length}</p>
                    <p className="text-xs text-slate-500">Total Collections</p>
                </div>
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-5">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center mb-2"><span className="material-icons text-emerald-600">check_circle</span></div>
                    <p className="text-2xl font-bold text-slate-800">{collected}</p>
                    <p className="text-xs text-slate-500">Successful</p>
                </div>
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-5">
                    <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center mb-2"><span className="material-icons text-red-600">cancel</span></div>
                    <p className="text-2xl font-bold text-slate-800">{rejected}</p>
                    <p className="text-xs text-slate-500">Rejected</p>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60">
                <div className="p-4 border-b border-slate-100">
                    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                        <div className="relative flex-1">
                            <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-lg text-slate-400">search</span>
                            <input type="text" placeholder="Search by patient or sample ID..." className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }} />
                        </div>
                        <select className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}>
                            <option>All Status</option>
                            <option>COLLECTED</option>
                            <option>REJECTED</option>
                            <option>RECOLLECTION_REQUIRED</option>
                            <option>IN_TRANSIT</option>
                        </select>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider">
                                <th className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">Sample ID</th>
                                <th className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">Patient</th>
                                <th className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">Tests</th>
                                <th className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">Priority</th>
                                <th className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">Status</th>
                                <th className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">Collected At</th>
                                <th className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">By</th>
                                <th className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">Wait</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginated.length === 0 ? (
                                <tr><td colSpan={8} className="text-center py-12 text-slate-400">No results found</td></tr>
                            ) : paginated.map((h) => (
                                <tr key={h.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                                    <td className="px-5 py-3">
                                        <Link
                                            href={`/phlebotomy/collection-history/${encodeURIComponent(h.id)}`}
                                            className="font-semibold text-primary hover:underline"
                                        >
                                            {h.sampleId}
                                        </Link>
                                    </td>
                                    <td className="px-4 py-3"><p className="font-medium text-slate-700">{h.patientName}</p><p className="text-xs text-slate-400">{h.pid}</p></td>
                                    <td className="px-4 py-3"><div className="flex gap-1 flex-wrap">{h.testCodes.map(c => <span key={c} className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{c}</span>)}</div></td>
                                    <td className="px-4 py-3"><span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${PRIORITY_COLORS[h.priority]}`}>{h.priority}</span></td>
                                    <td className="px-4 py-3">
                                        {h.status === 'REJECTED' ? (
                                            <button
                                                type="button"
                                                onClick={() => setSelectedRejection(h)}
                                                className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${STATUS_COLORS[h.status]} hover:ring-2 hover:ring-red-200 transition`}
                                            >
                                                {h.status.replace('_', ' ')}
                                            </button>
                                        ) : (
                                            <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${STATUS_COLORS[h.status] || 'bg-slate-100 text-slate-600'}`}>{h.status.replace('_', ' ')}</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-slate-500">{h.collectedAt}</td>
                                    <td className="px-4 py-3 text-slate-500 text-xs">{h.collectedBy}</td>
                                    <td className="px-4 py-3"><span className={`font-semibold ${h.waitTime > 20 ? 'text-red-600' : 'text-slate-600'}`}>{formatWaitTime(h.waitTime)}</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 text-sm text-slate-500">
                    <p>Showing {filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1} to {Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length}</p>
                    <div className="flex items-center gap-2">
                        <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"><span className="material-icons text-base">chevron_left</span>Prev</button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => <button key={page} onClick={() => setCurrentPage(page)} className={`w-8 h-8 rounded-lg text-sm font-bold transition-colors ${currentPage === page ? 'bg-primary text-white shadow-sm' : 'border border-slate-200 hover:bg-slate-50 text-slate-600'}`}>{page}</button>)}
                        <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">Next<span className="material-icons text-base">chevron_right</span></button>
                    </div>
                </div>
            </div>
        </div>
    );
}
