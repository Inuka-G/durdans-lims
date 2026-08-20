'use client';

import { useCallback, useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AlertTriangle, CheckCircle2, History, RefreshCw, X, XCircle } from 'lucide-react';
import { getCollectionHistory } from '@/lib/api';
import type { CollectionHistoryEntry } from '@/types/sample-lifecycle';
import { cn } from '@/lib/utils';
import Button from '@/components/ui/Button';
import PageHeader from '@/components/ui/PageHeader';
import SectionCard from '@/components/ui/SectionCard';
import EmptyState from '@/components/ui/EmptyState';
import Modal from '@/components/ui/Modal';
import Pagination from '@/components/ui/Pagination';
import StatusChip, { humanizeStatus, toneForStatus, type ChipTone } from '@/components/ui/StatusChip';
import { InputField, SelectField } from '@/components/ui/Field';
import StatCard from '@/components/shared/StatCard';
import PriorityBadge from '@/components/shared/PriorityBadge';
import { formatRegistered } from '@/components/patient-dashboard/dashboard-data';

const PAGE_SIZE = 8;
const SKELETON_ROWS = 6;
const ALL_STATUSES = 'All Status';
const STATUS_OPTIONS: { value: string; label: string }[] = [
    { value: ALL_STATUSES, label: 'All statuses' },
    { value: 'COLLECTED', label: 'Collected' },
    { value: 'REJECTED', label: 'Rejected' },
    { value: 'RECOLLECTION_REQUIRED', label: 'Recollection required' },
    { value: 'IN_TRANSIT', label: 'In transit' },
];

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

/** Collection statuses → chip tone. RECOLLECTION_REQUIRED is not in STATUS_TONE yet, so it is mapped here. */
function collectionTone(status: string): ChipTone {
    if (status === 'RECOLLECTION_REQUIRED') return 'pending';
    return toneForStatus(status);
}

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

/** "Today 09:12", "Yesterday 14:02", otherwise "16 Aug 2026 09:12". */
function formatEventDateTime(value?: string) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';

    const label = formatRegistered(date);
    if (label.startsWith('Today') || label.startsWith('Yesterday')) return label;
    const time = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
    return `${label} ${time}`;
}

export default function CollectionHistoryPage() {
    const pathname = usePathname();
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState(ALL_STATUSES);
    const [currentPage, setCurrentPage] = useState(1);
    const [collectionHistory, setCollectionHistory] = useState<CollectionHistoryEntry[]>([]);
    const [selectedRejection, setSelectedRejection] = useState<CollectionHistoryEntry | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const loadCollectionHistory = useCallback(async () => {
        try {
            setLoading(true);
            setLoadError(null);
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
            setLoadError("Couldn't load collection history.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadCollectionHistory();
    }, [loadCollectionHistory, pathname]);

    const closeRejection = useCallback(() => setSelectedRejection(null), []);

    const filtered = useMemo(() => {
        return collectionHistory.filter((h) => {
            const q = searchQuery.toLowerCase();
            const matchesSearch = !q || h.patientName.toLowerCase().includes(q) || h.sampleId.toLowerCase().includes(q) || h.pid.toLowerCase().includes(q);
            const matchesStatus = statusFilter === ALL_STATUSES || h.status === statusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [collectionHistory, searchQuery, statusFilter]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    /* Clamp so a Refresh that shrinks the list never strands the view on an empty page. */
    const page = Math.min(currentPage, totalPages);
    const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const collected = collectionHistory.filter(h => h.status === 'COLLECTED').length;
    const rejected = collectionHistory.filter(h => h.status === 'REJECTED').length;
    const hasFilters = searchQuery !== '' || statusFilter !== ALL_STATUSES;

    const clearFilters = () => {
        setSearchQuery('');
        setStatusFilter(ALL_STATUSES);
        setCurrentPage(1);
    };

    return (
        <div className="mx-auto w-full min-w-0 max-w-[1400px]">
            <PageHeader
                crumbs={[{ label: 'Phlebotomy', href: '/phlebotomy/worklist' }, { label: 'Collection history' }]}
                title="Collection history"
                meta={<span>Collected, rejected and recollection-required specimens. Open a sample for full detail and label printing.</span>}
                actions={
                    <Button icon={RefreshCw} onClick={() => void loadCollectionHistory()} loading={loading}>
                        Refresh
                    </Button>
                }
            />

            {/* Screen-reader status for async changes */}
            <p role="status" aria-live="polite" className="sr-only">
                {loading
                    ? 'Loading collection history'
                    : loadError
                      ? 'Collection history failed to load'
                      : `Collection history loaded. Showing ${paginated.length} of ${filtered.length} collections${totalPages > 1 ? `, page ${page} of ${totalPages}` : ''}.`}
            </p>

            <Modal
                open={selectedRejection !== null}
                onClose={closeRejection}
                title="Rejection message"
                description={
                    selectedRejection ? (
                        /* Sample IDs and patient names are unbreakable tokens — let them wrap instead of widening the panel. */
                        <span className="block break-words">
                            {selectedRejection.sampleId} · {selectedRejection.patientName}
                        </span>
                    ) : undefined
                }
                size="sm"
                footer={
                    <Button variant="primary" onClick={closeRejection}>
                        Close
                    </Button>
                }
            >
                {/* Free text typed by staff: keep real newlines, but still wrap a long unbroken token. */}
                <div className="whitespace-pre-wrap break-words rounded-md bg-status-danger-bg p-3 text-sm text-status-danger-fg ring-1 ring-inset ring-status-danger-edge">
                    {selectedRejection?.rejectionNotes || 'No rejection message recorded.'}
                </div>
            </Modal>

            {/* Stats */}
            <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <StatCard label="Total collections" value={collectionHistory.length} icon={History} color="blue" loading={loading} />
                <StatCard label="Collected" value={collected} icon={CheckCircle2} color="emerald" loading={loading} />
                <StatCard label="Rejected" value={rejected} icon={XCircle} color="red" loading={loading} />
            </div>

            {/* bodyClassName min-w-0: the card is a column flex container, so its body must be allowed
                to shrink below the table's intrinsic width — the table scrolls inside, never the page. */}
            <SectionCard title="Collections" count={loading ? undefined : filtered.length} flush bodyClassName="min-w-0">
                {/* Filter toolbar */}
                <div className="flex flex-wrap items-center gap-2 border-b border-edge bg-surface-muted px-3 py-2">
                    <InputField
                        label="Search collection history"
                        hideLabel
                        type="search"
                        value={searchQuery}
                        onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                        placeholder="Search by patient, PID or sample ID"
                        autoComplete="off"
                        className="min-w-[200px] flex-1"
                    />
                    <SelectField
                        label="Status"
                        hideLabel
                        value={statusFilter}
                        onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                        className="w-full sm:w-52"
                    >
                        {STATUS_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </SelectField>
                    {hasFilters && (
                        <Button variant="ghost" icon={X} onClick={clearFilters}>
                            Clear filters
                        </Button>
                    )}
                </div>

                {/* States live outside the table so they centre on small screens */}
                {loading ? (
                    <ul aria-hidden="true" className="divide-y divide-edge">
                        {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
                            <li key={i} className="flex items-center gap-3 px-4 py-2.5">
                                <span className="h-3 w-20 shrink-0 rounded bg-skeleton" />
                                <span className="h-4 w-32 shrink-0 rounded bg-skeleton" />
                                <span className="hidden h-3 w-24 rounded bg-skeleton md:block" />
                                <span className="h-4 w-14 rounded bg-skeleton" />
                                <span className="h-4 w-20 rounded bg-skeleton" />
                                <span className="ml-auto hidden h-3 w-28 rounded bg-skeleton lg:block" />
                                <span className="hidden h-3 w-12 rounded bg-skeleton sm:block" />
                            </li>
                        ))}
                    </ul>
                ) : loadError ? (
                    <EmptyState
                        icon={AlertTriangle}
                        title={loadError}
                        description="Check your connection and try again."
                        action={
                            <Button icon={RefreshCw} onClick={() => void loadCollectionHistory()}>
                                Retry
                            </Button>
                        }
                    />
                ) : filtered.length === 0 ? (
                    hasFilters ? (
                        <EmptyState
                            icon={History}
                            title="No collections match"
                            description="Try a different search term or status."
                            action={
                                <Button variant="ghost" icon={X} onClick={clearFilters}>
                                    Clear filters
                                </Button>
                            }
                        />
                    ) : (
                        <EmptyState
                            icon={History}
                            title="No collection history yet"
                            description="Collected and rejected specimens will appear here."
                        />
                    )
                ) : (
                    <div className="overflow-x-auto">
                        {/*
                          table-fixed column budget. Fixed widths: Sample ID 128 + Patient 176 + Priority 96
                          + Status 176 + Collected at 160 + Wait 96 = 832. "Tests" is the only auto column and
                          needs >= 160px to show a row of chips, so min-w must clear fixed-sum + 160 in EVERY band:
                            base (<md, no Tests, no Collected by):  832            -> min-w 860
                            md   (+ Tests):                         832 + 160 = 992 -> md:min-w 1000  (Tests 168)
                            lg   (+ Collected by 144):              976 + 160 = 1136 -> lg:min-w 1140 (Tests 164)
                          The card's overflow-x-auto scrolls the surplus; the page never does.
                        */}
                        <table className="w-full min-w-[860px] table-fixed text-left text-[13px] md:min-w-[1000px] lg:min-w-[1140px]">
                            <caption className="sr-only">Collection history</caption>
                            <thead>
                                <tr className="whitespace-nowrap border-b border-edge text-xs font-medium text-fg-muted">
                                    <th scope="col" className="w-32 py-2 pl-4 pr-3 font-medium">Sample ID</th>
                                    <th scope="col" className="w-44 px-3 py-2 font-medium">Patient</th>
                                    <th scope="col" className="hidden px-3 py-2 font-medium md:table-cell">Tests</th>
                                    <th scope="col" className="w-24 px-3 py-2 font-medium">Priority</th>
                                    <th scope="col" className="w-44 px-3 py-2 font-medium">Status</th>
                                    <th scope="col" className="w-40 px-3 py-2 font-medium">Collected at</th>
                                    <th scope="col" className="hidden w-36 px-3 py-2 font-medium lg:table-cell">Collected by</th>
                                    <th scope="col" className="w-24 px-3 py-2 text-right font-medium">Wait</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-edge whitespace-nowrap">
                                {paginated.map((h) => (
                                    <tr key={h.id} className="transition-colors hover:bg-surface-hover">
                                        <td className="py-2 pl-4 pr-3">
                                            <Link
                                                href={`/phlebotomy/collection-history/${encodeURIComponent(h.id)}`}
                                                title={h.sampleId}
                                                className="block truncate rounded font-medium text-primary-strong hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                            >
                                                {h.sampleId}
                                            </Link>
                                        </td>
                                        {/* Two-line cell: leading-tight on both so the stack sits evenly inside py-2
                                            instead of crowding the row divider set by the single-line cells. */}
                                        <td className="px-3 py-2">
                                            <p className="truncate font-medium leading-tight text-fg" title={h.patientName}>{h.patientName}</p>
                                            <p className="mt-0.5 truncate text-xs leading-tight text-fg-muted" title={h.pid}>{h.pid}</p>
                                        </td>
                                        <td className="hidden px-3 py-2 md:table-cell">
                                            <div className="flex min-w-0 flex-wrap gap-1">
                                                {h.testCodes.length === 0 ? (
                                                    <span className="text-fg-faint">—</span>
                                                ) : (
                                                    h.testCodes.map((c) => (
                                                        <StatusChip key={c} tone="neutral" size="sm" title={c} className="min-w-0">
                                                            {c}
                                                        </StatusChip>
                                                    ))
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-3 py-2">
                                            <PriorityBadge priority={h.priority} />
                                        </td>
                                        <td className="px-3 py-2">
                                            {h.status === 'REJECTED' ? (
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedRejection(h)}
                                                    aria-label={`View rejection message for ${h.sampleId}`}
                                                    aria-haspopup="dialog"
                                                    title="View rejection message"
                                                    className="rounded transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-surface"
                                                >
                                                    <StatusChip tone={collectionTone(h.status)} dot>
                                                        {humanizeStatus(h.status)}
                                                    </StatusChip>
                                                </button>
                                            ) : (
                                                <StatusChip tone={collectionTone(h.status)} dot title={humanizeStatus(h.status)}>
                                                    {humanizeStatus(h.status)}
                                                </StatusChip>
                                            )}
                                        </td>
                                        <td className="truncate px-3 py-2 text-fg-secondary tabular-nums">{h.collectedAt}</td>
                                        <td className="hidden truncate px-3 py-2 text-fg-secondary lg:table-cell" title={h.collectedBy}>
                                            {h.collectedBy}
                                        </td>
                                        <td className="px-3 py-2 text-right tabular-nums">
                                            <span className={cn('font-medium', h.waitTime > 20 ? 'text-status-danger-fg' : 'text-fg-secondary')}>
                                                {formatWaitTime(h.waitTime)}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {!loading && !loadError && filtered.length > 0 && (
                    <Pagination
                        currentPage={page}
                        totalPages={totalPages}
                        totalItems={filtered.length}
                        pageSize={PAGE_SIZE}
                        onPageChange={setCurrentPage}
                        itemLabel="collections"
                    />
                )}
            </SectionCard>
        </div>
    );
}
