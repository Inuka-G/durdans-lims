'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
    AlertTriangle,
    ArrowRight,
    CheckCircle2,
    ClipboardList,
    Clock,
    FlaskConical,
    Microscope,
    RefreshCw,
    SearchX,
    Siren,
    X,
} from 'lucide-react';
import { getMltWorklist, type MltWorklistItem } from '@/lib/api';
import Button from '@/components/ui/Button';
import PageHeader from '@/components/ui/PageHeader';
import { InputField, SelectField } from '@/components/ui/Field';
import SegmentedControl, { type SegmentOption } from '@/components/ui/SegmentedControl';
import SectionCard from '@/components/ui/SectionCard';
import EmptyState from '@/components/ui/EmptyState';
import Pagination from '@/components/ui/Pagination';
import StatusChip, { humanizeStatus, toneForStatus, type ChipTone } from '@/components/ui/StatusChip';
import StatCard from '@/components/shared/StatCard';
import PriorityBadge from '@/components/shared/PriorityBadge';

const PAGE_SIZE = 8;
const SKELETON_ROWS = 6;

const PRIORITY_OPTIONS: SegmentOption<string>[] = [
    { value: 'ALL', label: 'All priorities' },
    { value: 'STAT', label: 'STAT' },
    { value: 'URGENT', label: 'Urgent' },
    { value: 'NORMAL', label: 'Normal' },
];

/** Option values stay unchanged so the filter logic keeps matching; only the label is sentence case. */
const OPTION_LABELS: Record<string, string> = {
    'All Test Types': 'All test types',
};

/** Lab-side sample statuses that STATUS_TONE does not cover yet are mapped to a chip tone here. */
const MLT_STATUS_TONE: Record<string, ChipTone> = {
    PENDING_COLLECTION: 'neutral',
    RECOLLECTION_REQUIRED: 'pending',
    RECEIVED_AT_LAB: 'neutral',
    QUALITY_CHECK: 'pending',
    ACCEPTED: 'success',
    IN_TESTING: 'pending',
    RESULT_ENTERED: 'info',
    SENT_FOR_VERIFICATION: 'info',
};

function sampleStatusTone(status: string): ChipTone {
    const key = (status || '').toUpperCase();
    return MLT_STATUS_TONE[key] ?? toneForStatus(key);
}

const PRIORITY_ORDER: Record<string, number> = {
    STAT: 0,
    URGENT: 1,
    NORMAL: 2,
};

export default function MLTWorklistPage() {
    const router = useRouter();
    const pathname = usePathname();
    const [samples, setSamples] = useState<MltWorklistItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [priorityFilter, setPriorityFilter] = useState('ALL');
    const [testTypeFilter, setTestTypeFilter] = useState('All Test Types');
    const [currentPage, setCurrentPage] = useState(1);

    const loadSamples = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const data = await getMltWorklist();
            setSamples(data);
        } catch (err) {
            console.error('Failed to load MLT worklist', err);
            setError("Couldn't load the MLT worklist. Check your connection and retry.");
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

        const filtered = samples.filter((sample) => {
            const matchesSearch =
                query.length === 0 ||
                sample.barcode.toLowerCase().includes(query) ||
                sample.patientId.toLowerCase().includes(query) ||
                sample.orderId.toLowerCase().includes(query) ||
                sample.testName.toLowerCase().includes(query);

            const matchesTestType =
                testTypeFilter === 'All Test Types' || sample.testName === testTypeFilter;

            const matchesPriority =
                priorityFilter === 'ALL' || sample.priority === priorityFilter;

            return matchesSearch && matchesTestType && matchesPriority;
        });

        // Strict Priority Hierarchy: STAT (0) -> URGENT (1) -> NORMAL (2)
        // Secondary: FIFO (oldest collected / registered first within the same priority)
        return filtered.sort((a, b) => {
            const priorityA = PRIORITY_ORDER[a.priority] ?? 3;
            const priorityB = PRIORITY_ORDER[b.priority] ?? 3;
            if (priorityA !== priorityB) {
                return priorityA - priorityB;
            }
            const timeA = a.collectedAt ? new Date(a.collectedAt).getTime() : 0;
            const timeB = b.collectedAt ? new Date(b.collectedAt).getTime() : 0;
            return timeA - timeB;
        });
    }, [samples, searchQuery, testTypeFilter, priorityFilter]);

    const totalPages = Math.max(1, Math.ceil(filteredSamples.length / PAGE_SIZE));
    const paginatedSamples = filteredSamples.slice(
        (currentPage - 1) * PAGE_SIZE,
        currentPage * PAGE_SIZE
    );

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    const pendingTests = samples.length;
    const statCount = samples.filter((sample) => sample.priority === 'STAT').length;
    const urgentCount = samples.filter((sample) => sample.priority === 'URGENT').length;
    const inTestingCount = samples.filter((sample) => sample.status === 'IN_TESTING').length;

    const hasFilters = searchQuery.trim().length > 0 || testTypeFilter !== 'All Test Types' || priorityFilter !== 'ALL';

    const clearFilters = () => {
        setSearchQuery('');
        setPriorityFilter('ALL');
        setTestTypeFilter('All Test Types');
        setCurrentPage(1);
    };

    return (
        <div className="mx-auto max-w-[1400px]">
            <PageHeader
                title="Sample worklist"
                crumbs={[{ label: 'Laboratory' }, { label: 'Worklist' }]}
                meta={
                    <>
                        <ClipboardList className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>Samples waiting for testing</span>
                        {!loading && !error && (
                            <>
                                <span aria-hidden="true">·</span>
                                <span className="tabular-nums">
                                    {pendingTests} {pendingTests === 1 ? 'sample' : 'samples'}
                                </span>
                            </>
                        )}
                    </>
                }
                actions={
                    <Button icon={RefreshCw} onClick={() => void loadSamples()} loading={loading}>
                        Refresh
                    </Button>
                }
            />

            {/* Screen-reader status for async changes */}
            <p role="status" aria-live="polite" className="sr-only">
                {loading
                    ? 'Loading MLT worklist'
                    : error
                      ? 'MLT worklist failed to load'
                      : `MLT worklist loaded. Showing ${paginatedSamples.length} of ${filteredSamples.length} samples${
                            totalPages > 1 ? `, page ${currentPage} of ${totalPages}` : ''
                        }.`}
            </p>

            {/* Stats */}
            <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard label="Pending tests" value={pendingTests} icon={FlaskConical} color="blue" loading={loading} />
                <StatCard
                    label="STAT priority"
                    value={statCount}
                    icon={Siren}
                    color="red"
                    sub={!loading && statCount > 0 ? 'Action needed' : undefined}
                    loading={loading}
                />
                <StatCard
                    label="Urgent priority"
                    value={urgentCount}
                    icon={AlertTriangle}
                    color="orange"
                    sub={!loading && urgentCount > 0 ? 'Priority testing' : undefined}
                    loading={loading}
                />
                <StatCard label="In testing" value={inTestingCount} icon={Microscope} color="violet" loading={loading} />
            </div>

            {/* Worklist */}
            <SectionCard title="Pending samples" count={loading || error ? undefined : filteredSamples.length} flush>
                {/* Filter toolbar */}
                <div className="flex flex-wrap items-center gap-2 border-b border-edge bg-surface-muted px-3 py-2">
                    <InputField
                        label="Search worklist"
                        hideLabel
                        type="search"
                        value={searchQuery}
                        onChange={(event) => {
                            setSearchQuery(event.target.value);
                            setCurrentPage(1);
                        }}
                        placeholder="Search barcode, patient ID, order ID or test"
                        autoComplete="off"
                        className="min-w-[200px] flex-1"
                    />
                    <SegmentedControl
                        value={priorityFilter}
                        onChange={(val) => {
                            setPriorityFilter(val);
                            setCurrentPage(1);
                        }}
                        options={PRIORITY_OPTIONS}
                        ariaLabel="Filter by priority"
                        size="sm"
                    />
                    <SelectField
                        label="Test type"
                        hideLabel
                        value={testTypeFilter}
                        onChange={(event) => {
                            setTestTypeFilter(event.target.value);
                            setCurrentPage(1);
                        }}
                        className="w-full sm:w-48"
                    >
                        {testTypes.map((testType) => (
                            <option key={testType} value={testType}>
                                {OPTION_LABELS[testType] ?? testType}
                            </option>
                        ))}
                    </SelectField>
                    {hasFilters && (
                        <Button variant="ghost" icon={X} onClick={clearFilters}>
                            Clear filters
                        </Button>
                    )}
                </div>

                {/* Refresh failed but the last successful load is still on screen: keep the rows,
                    surface the failure as a compact strip instead of replacing the table. */}
                {!loading && error && samples.length > 0 && (
                    <div className="flex items-center gap-2 bg-status-danger-bg px-4 py-2 text-xs text-status-danger-fg ring-1 ring-inset ring-status-danger-edge">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span className="min-w-0 flex-1 truncate" title={error}>
                            {error}
                        </span>
                        <Button size="sm" variant="ghost" icon={RefreshCw} onClick={() => void loadSamples()}>
                            Retry
                        </Button>
                    </div>
                )}

                {/* States live outside the table so they centre on small screens */}
                {loading ? (
                    <ul aria-hidden="true" className="divide-y divide-edge">
                        {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
                            <li key={i} className="flex items-center gap-3 px-4 py-3">
                                <span className="h-3.5 w-28 shrink-0 rounded bg-skeleton" />
                                <span className="flex w-40 shrink-0 flex-col gap-1.5">
                                    <span className="h-3.5 w-28 rounded bg-skeleton" />
                                    <span className="h-3 w-20 rounded bg-skeleton" />
                                </span>
                                <span className="hidden h-3.5 w-40 rounded bg-skeleton md:block" />
                                <span className="h-4 w-14 rounded bg-skeleton" />
                                <span className="h-4 w-20 rounded bg-skeleton" />
                                <span className="ml-auto h-7 w-16 rounded bg-skeleton" />
                            </li>
                        ))}
                    </ul>
                ) : error && samples.length === 0 ? (
                    <EmptyState
                        icon={AlertTriangle}
                        title="Worklist unavailable"
                        description={error}
                        action={
                            <Button size="sm" icon={RefreshCw} onClick={() => void loadSamples()}>
                                Retry
                            </Button>
                        }
                    />
                ) : filteredSamples.length === 0 ? (
                    samples.length === 0 ? (
                        <EmptyState
                            icon={ClipboardList}
                            title="No samples waiting"
                            description="Samples accepted at the lab will appear here once they are ready for testing."
                        />
                    ) : (
                        <EmptyState
                            icon={SearchX}
                            title="No samples match"
                            description="Try a different search term, priority, or test type."
                            action={
                                <Button size="sm" icon={X} onClick={clearFilters}>
                                    Clear filters
                                </Button>
                            }
                        />
                    )
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[850px] table-fixed text-left text-sm">
                                <caption className="sr-only">Samples waiting for testing</caption>
                                <thead>
                                    <tr className="whitespace-nowrap border-b border-edge text-xs font-semibold text-fg-muted">
                                        <th scope="col" className="w-36 py-2 pl-4 pr-3 font-semibold">
                                            Barcode
                                        </th>
                                        <th scope="col" className="w-44 px-3 py-2 font-semibold">
                                            Patient / order
                                        </th>
                                        <th scope="col" className="px-3 py-2 font-semibold">
                                            Test type
                                        </th>
                                        <th scope="col" className="w-24 px-3 py-2 font-semibold">
                                            Priority
                                        </th>
                                        <th scope="col" className="w-44 px-3 py-2 font-semibold">
                                            Status
                                        </th>
                                        <th scope="col" className="w-24 py-2 pl-2 pr-3 text-right font-semibold">
                                            <span className="sr-only">Actions</span>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-edge whitespace-nowrap">
                                    {paginatedSamples.map((sample) => (
                                        <tr key={sample.sampleId} className="transition-colors hover:bg-surface-hover">
                                            <td className="truncate py-2 pl-4 pr-3 font-mono text-xs font-medium tabular-nums text-primary-strong" title={sample.barcode}>
                                                {sample.barcode}
                                            </td>
                                            <td className="min-w-0 px-3 py-2">
                                                <p className="truncate font-medium text-fg" title={sample.patientId}>
                                                    {sample.patientId}
                                                </p>
                                                <p className="truncate text-xs tabular-nums text-fg-muted" title={sample.orderId}>
                                                    {sample.orderId}
                                                </p>
                                            </td>
                                            <td className="truncate px-3 py-2 text-fg-secondary" title={sample.testName}>
                                                {sample.testName}
                                            </td>
                                            <td className="px-3 py-2">
                                                <PriorityBadge priority={sample.priority} />
                                            </td>
                                            <td className="px-3 py-2">
                                                <div className="flex flex-wrap items-center gap-1">
                                                    <StatusChip
                                                        tone={sampleStatusTone(sample.status)}
                                                        dot
                                                        title={humanizeStatus(sample.status || '—')}
                                                    >
                                                        {humanizeStatus(sample.status || '—')}
                                                    </StatusChip>
                                                    {/* A case the supervisor sent back is not fresh work: it needs re-entry. */}
                                                    {sample.returnedToMlt && (
                                                        <StatusChip
                                                            tone="danger"
                                                            dot
                                                            size="sm"
                                                            title={sample.returnReason ? `Returned by supervisor: ${sample.returnReason}` : 'Returned by supervisor'}
                                                        >
                                                            Returned by supervisor
                                                        </StatusChip>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-2 pl-2 pr-3 text-right">
                                                <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    icon={ArrowRight}
                                                    onClick={() => router.push(`/mlt/result-entry?sampleId=${sample.sampleId}`)}
                                                    aria-label={`Open ${sample.barcode}`}
                                                >
                                                    Open
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <Pagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            totalItems={filteredSamples.length}
                            pageSize={PAGE_SIZE}
                            onPageChange={setCurrentPage}
                            itemLabel="samples"
                        />
                    </>
                )}
            </SectionCard>
        </div>
    );
}
