'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { usePathname, useRouter } from 'next/navigation';
import { PRIORITY_COLORS, TUBE_COLOR_MAP, formatStatusLabel } from '@/constants/sample-lifecycle';
import { collectSample, getPhlebotomyStats, getPhlebotomyWorklist, rejectPhlebotomySample } from '@/lib/api';
import type { Sample, TubeType } from '@/types/sample-lifecycle';

const PAGE_SIZE = 8;
type RejectionReason = 'HEMOLYZED' | 'INSUFFICIENT_VOLUME' | 'WRONG_CONTAINER' | 'CLOTTED' | 'CONTAMINATED' | 'UNLABELED' | 'OTHER';
type PhlebotomyStats = {
    pendingCollections: number;
    normalPriority: number;
    statPriority: number;
    urgentPriority: number;
};
type RawWorklistItem = {
    id?: string | number;
    sampleId?: string | number;
    orderId?: string;
    patientId?: string | number;
    pid?: string;
    patientName?: string;
    age?: number | string;
    gender?: string;
    wardRoom?: string;
    patient?: {
        id?: string | number;
        pid?: string;
        name?: string;
        age?: number | string;
        gender?: string;
        wardRoom?: string;
    };
    testType?: string;
    testCodes?: string[];
    priority?: Sample['priority'];
    status?: Sample['status'];
    tubeTypes?: TubeType[];
    waitTimeMinutes?: number | string;
    waitTime?: number | string;
};
const PHLEBOTOMY_STAT_CARDS = {
    pending: {
        label: 'Pending Collections',
        icon: 'assignment',
        iconClasses: 'bg-blue-100 text-blue-600',
    },
    stat: {
        label: 'STAT Priority',
        icon: 'emergency',
        iconClasses: 'bg-red-100 text-red-600',
        badgeClasses: 'text-red-600 bg-red-50',
    },
    urgent: {
        label: 'Urgent Priority',
        icon: 'warning',
        iconClasses: 'bg-orange-100 text-orange-600',
        badgeClasses: 'text-orange-600 bg-orange-50',
    },
    normal: {
        label: 'Normal Priority',
        icon: 'schedule',
        iconClasses: 'bg-emerald-100 text-emerald-600',
    },
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

function isRecollectionSample(sample: Sample) {
    return sample.status === 'RECOLLECTION_REQUIRED';
}

export default function PhlebotomyWorklistPage() {
    const router = useRouter();
    const pathname = usePathname();
    const [searchQuery, setSearchQuery] = useState('');
    const [priorityFilter, setPriorityFilter] = useState('ALL');
    const [currentPage, setCurrentPage] = useState(1);
    const [worklist, setWorklist] = useState<Sample[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
    const [stats, setStats] = useState<PhlebotomyStats>({
        pendingCollections: 0,
        normalPriority: 0,
        statPriority: 0,
        urgentPriority: 0,
    });
    const [rejectingSample, setRejectingSample] = useState<Sample | null>(null);
    const [rejectionReason, setRejectionReason] = useState<RejectionReason>('HEMOLYZED');
    const [rejectionNotes, setRejectionNotes] = useState('');
    const [rejectionError, setRejectionError] = useState('');

    const loadWorklist = useCallback(async () => {
        try {
            setIsLoading(true);
            setLoadError('');
            const [data, statsData] = await Promise.all([
                getPhlebotomyWorklist(0, 100),
                getPhlebotomyStats(),
            ]);
            const rawRows = data as { content?: RawWorklistItem[] } | RawWorklistItem[] | null | undefined;
            const rows: RawWorklistItem[] = Array.isArray(rawRows) ? rawRows : rawRows?.content ?? [];
            const list: Sample[] = rows.map((item) => ({
                id: String(item?.id ?? item?.sampleId ?? ''),
                sampleId: String(item?.sampleId ?? '-'),
                orderId: item?.orderId ?? '-',
                patient: {
                    id: String(item?.patient?.id ?? item?.patientId ?? ''),
                    pid: item?.patient?.pid ?? item?.pid ?? '-',
                    name: item?.patient?.name ?? item?.patientName ?? '-',
                    age: Number(item?.patient?.age ?? item?.age ?? 0),
                    gender: (item?.patient?.gender ?? item?.gender ?? 'M') === 'FEMALE' ? 'F' : ((item?.patient?.gender ?? item?.gender ?? 'M') === 'F' ? 'F' : 'M'),
                    wardRoom: item?.patient?.wardRoom ?? item?.wardRoom,
                },
                testType: item?.testType ?? (Array.isArray(item?.testCodes) ? item.testCodes.join(', ') : '-'),
                testCodes: Array.isArray(item?.testCodes) ? item.testCodes : [],
                priority: item?.priority ?? 'NORMAL',
                status: item?.status ?? 'PENDING_COLLECTION',
                tubeTypes: (Array.isArray(item?.tubeTypes) ? item.tubeTypes : ['OTHER']) as TubeType[],
                waitTimeMinutes: Number(item?.waitTimeMinutes ?? item?.waitTime ?? 0),
            }));
            setWorklist(list);
            setStats({
                pendingCollections: Number(statsData?.pendingCollections ?? 0),
                normalPriority: list.filter((sample) => sample.priority === 'NORMAL').length,
                statPriority: list.filter((sample) => sample.priority === 'STAT').length,
                urgentPriority: list.filter((sample) => sample.priority === 'URGENT').length,
            });
        } catch (error) {
            console.error('Failed to load phlebotomy worklist:', error);
            setLoadError('Failed to load worklist. Please try again.');
            setWorklist([]);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadWorklist();
    }, [loadWorklist, pathname]);

    const filtered = useMemo(() => {
        return worklist.filter((s) => {
            const q = searchQuery.toLowerCase();
            const matchesSearch = !q || s.patient.name.toLowerCase().includes(q) || s.patient.pid.toLowerCase().includes(q) || s.orderId.toLowerCase().includes(q);
            const matchesPriority = priorityFilter === 'ALL' || s.priority === priorityFilter;
            return matchesSearch && matchesPriority;
        });
    }, [worklist, searchQuery, priorityFilter]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
    const handleCollect = async (sampleUuid: string, sampleLabel: string) => {
        try {
            setActionLoadingId(sampleUuid);
            await collectSample(sampleUuid, {});
            await loadWorklist();
            router.push(`/phlebotomy/label-print?sampleId=${encodeURIComponent(sampleLabel)}`);
        } catch (error) {
            console.error(`Failed to collect sample ${sampleLabel}:`, error);
            toast.error('Failed to start collection. Please try again.');
        } finally {
            setActionLoadingId(null);
        }
    };

    const openRejectForm = (sample: Sample) => {
        setRejectingSample(sample);
        setRejectionReason('HEMOLYZED');
        setRejectionNotes('');
        setRejectionError('');
    };

    const handleReject = async () => {
        if (!rejectingSample) return;
        const notes = rejectionNotes.trim();
        if (!notes) {
            setRejectionError('Please enter a rejection message.');
            return;
        }

        try {
            setRejectionError('');
            setActionLoadingId(rejectingSample.id);
            await rejectPhlebotomySample(rejectingSample.id, {
                rejectionReason,
                rejectionNotes: notes,
            });
            await loadWorklist();
            setRejectingSample(null);
            setRejectionNotes('');
        } catch (error) {
            console.error(`Failed to reject sample ${rejectingSample.sampleId}:`, error);
            setRejectionError('Failed to reject sample. Please try again.');
        } finally {
            setActionLoadingId(null);
        }
    };

    return (
        <div>
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-800">Sample Collection</h1>
                <p className="text-sm text-slate-500 mt-1">Manage pending laboratory collection orders and patient queues.</p>
            </div>

            {rejectingSample && (
                <div className="bg-white rounded-2xl shadow-sm border border-red-200 p-5 mb-6">
                    <div className="flex items-start justify-between gap-4 mb-4">
                        <div>
                            <h2 className="text-base font-bold text-slate-800">Reject Sample</h2>
                            <p className="text-sm text-slate-500 mt-1">
                                {rejectingSample.sampleId} • {rejectingSample.patient.name} • {rejectingSample.testType}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                setRejectingSample(null);
                                setRejectionError('');
                            }}
                            className="text-slate-400 hover:text-slate-600"
                        >
                            <span className="material-icons text-lg">close</span>
                        </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-3">
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Reason</label>
                            <select
                                value={rejectionReason}
                                onChange={(event) => setRejectionReason(event.target.value as RejectionReason)}
                                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                            >
                                <option value="HEMOLYZED">Hemolyzed</option>
                                <option value="INSUFFICIENT_VOLUME">Insufficient volume</option>
                                <option value="WRONG_CONTAINER">Wrong container</option>
                                <option value="CLOTTED">Clotted</option>
                                <option value="CONTAMINATED">Contaminated</option>
                                <option value="UNLABELED">Unlabeled</option>
                                <option value="OTHER">Other</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Message</label>
                            <textarea
                                value={rejectionNotes}
                                onChange={(event) => setRejectionNotes(event.target.value)}
                                rows={3}
                                maxLength={500}
                                placeholder="Type the rejection message to show in collection history..."
                                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                            />
                        </div>
                    </div>
                    {rejectionError && (
                        <p className="mt-3 text-sm font-medium text-red-600">{rejectionError}</p>
                    )}
                    <div className="flex justify-end gap-2 mt-4">
                        <button
                            type="button"
                            onClick={() => {
                                setRejectingSample(null);
                                setRejectionError('');
                            }}
                            className="px-4 py-2 border border-slate-200 text-slate-600 text-sm font-semibold rounded-xl hover:bg-slate-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            disabled={actionLoadingId === rejectingSample.id}
                            onClick={handleReject}
                            className="px-4 py-2 bg-red-600 text-white text-sm font-bold rounded-xl hover:bg-red-700 disabled:opacity-60"
                        >
                            {actionLoadingId === rejectingSample.id ? 'Submitting...' : 'Submit Rejection'}
                        </button>
                    </div>
                </div>
            )}

            {/* Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
                {[
                    { ...PHLEBOTOMY_STAT_CARDS.pending, value: stats.pendingCollections, badge: undefined, badgeClasses: '' },
                    { ...PHLEBOTOMY_STAT_CARDS.stat, value: stats.statPriority, badge: stats.statPriority > 0 ? 'Action needed' : undefined },
                    { ...PHLEBOTOMY_STAT_CARDS.urgent, value: stats.urgentPriority, badge: stats.urgentPriority > 0 ? 'Action needed' : undefined },
                    { ...PHLEBOTOMY_STAT_CARDS.normal, value: stats.normalPriority, badge: undefined, badgeClasses: '' },
                ].map((s) => (
                    <div key={s.label} className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-5">
                        <div className="flex items-center justify-between mb-2">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.iconClasses}`}>
                                <span className="material-icons">{s.icon}</span>
                            </div>
                            {s.badge && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${s.badgeClasses}`}>{s.badge}</span>}
                        </div>
                        <p className="text-2xl font-bold text-slate-800">{s.value}</p>
                        <p className="text-xs text-slate-500">{s.label}</p>
                    </div>
                ))}
            </div>

            {/* Worklist Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60">
                {/* Filters */}
                <div className="p-4 border-b border-slate-100">
                    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                        <div className="relative flex-1">
                            <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-lg text-slate-400">search</span>
                            <input type="text" placeholder="Search patient name, ID, order..." className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }} />
                        </div>
                        <select className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20" value={priorityFilter} onChange={(e) => { setPriorityFilter(e.target.value); setCurrentPage(1); }}>
                            <option value="ALL">All Priorities</option>
                            <option value="STAT">STAT</option>
                            <option value="URGENT">Urgent</option>
                            <option value="NORMAL">Normal</option>
                        </select>
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider">
                                <th className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">Patient Details</th>
                                <th className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">Priority</th>
                                <th className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">Tests Requested</th>
                                <th className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">Tubes</th>
                                <th className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">Wait Time</th>
                                <th className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr><td colSpan={6} className="text-center py-12 text-slate-400">Loading worklist...</td></tr>
                            ) : loadError ? (
                                <tr><td colSpan={6} className="text-center py-12 text-red-500">{loadError}</td></tr>
                            ) : paginated.length === 0 ? (
                                <tr><td colSpan={6} className="text-center py-12 text-slate-400">No samples match your search criteria</td></tr>
                            ) : paginated.map((sample) => (
                                <tr
                                    key={sample.id}
                                    className={`border-b border-slate-50 last:border-0 transition-colors ${
                                        isRecollectionSample(sample)
                                            ? 'bg-amber-50/35 hover:bg-amber-50/60'
                                            : 'hover:bg-slate-50/50'
                                    }`}
                                >
                                    <td className="px-5 py-3">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <p className="font-semibold text-slate-700">{sample.patient.name}</p>
                                            {isRecollectionSample(sample) && (
                                                <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                                                    Recollection
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-400">{sample.patient.pid} • {sample.patient.age}Y {sample.patient.gender}</p>
                                        {sample.patient.wardRoom && <p className="text-xs text-primary mt-0.5">{sample.patient.wardRoom}</p>}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${PRIORITY_COLORS[sample.priority]}`}>
                                            {sample.priority}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <p className="text-slate-700 font-medium">{sample.testType}</p>
                                        <div className="flex gap-1 mt-1 flex-wrap">
                                            {sample.testCodes.map((c) => (
                                                <span key={c} className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{c}</span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex gap-1">
                                            {sample.tubeTypes.map((t) => (
                                                <div key={t} className={`w-4 h-4 rounded-full ${TUBE_COLOR_MAP[t]} border border-white shadow-sm`} title={formatStatusLabel(t)} />
                                            ))}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`text-sm font-semibold ${(sample.waitTimeMinutes ?? 0) > 30 ? 'text-red-600' : (sample.waitTimeMinutes ?? 0) > 15 ? 'text-amber-600' : 'text-slate-600'}`}>
                                            {formatWaitTime(sample.waitTimeMinutes)}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                disabled={actionLoadingId === sample.id}
                                                onClick={() => handleCollect(sample.id, sample.sampleId)}
                                                className={`px-3 py-1.5 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                                                    isRecollectionSample(sample)
                                                        ? 'bg-amber-600 hover:bg-amber-700'
                                                        : 'bg-primary hover:bg-primary/90'
                                                }`}
                                            >
                                                <span className="material-icons text-sm mr-1 align-middle">
                                                    {isRecollectionSample(sample) ? 'refresh' : 'play_arrow'}
                                                </span>
                                                {isRecollectionSample(sample) ? 'Recollect' : 'Collect'}
                                            </button>
                                            <button disabled={actionLoadingId === sample.id} onClick={() => openRejectForm(sample)} className="px-3 py-1.5 border border-red-200 text-red-600 text-xs font-bold rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                                                <span className="material-icons text-sm mr-1 align-middle">cancel</span>Reject
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 text-sm text-slate-500">
                    <p>Showing {filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1} to {Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length}</p>
                    <div className="flex items-center gap-2">
                        <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                            <span className="material-icons text-base">chevron_left</span>Prev
                        </button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                            <button key={page} onClick={() => setCurrentPage(page)} className={`w-8 h-8 rounded-lg text-sm font-bold transition-colors ${currentPage === page ? 'bg-primary text-white shadow-sm' : 'border border-slate-200 hover:bg-slate-50 text-slate-600'}`}>{page}</button>
                        ))}
                        <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                            Next<span className="material-icons text-base">chevron_right</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
