'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { AxiosError } from 'axios';
import { AlertTriangle, ClipboardList, Clock, Inbox, RefreshCw, SearchX, Siren, X } from 'lucide-react';
import { getReceptionSamples, type MltWorklistItem } from '@/lib/api';
import Button from '@/components/ui/Button';
import PageHeader from '@/components/ui/PageHeader';
import { InputField, SelectField } from '@/components/ui/Field';
import SegmentedControl, { type SegmentOption } from '@/components/ui/SegmentedControl';
import SectionCard from '@/components/ui/SectionCard';
import EmptyState from '@/components/ui/EmptyState';
import Pagination from '@/components/ui/Pagination';
import StatCard from '@/components/shared/StatCard';
import StatusBadge from '@/components/shared/StatusBadge';
import PriorityBadge from '@/components/shared/PriorityBadge';
import { formatRegistered } from '@/components/patient-dashboard/dashboard-data';

const PAGE_SIZE = 8;
const SKELETON_ROWS = 6;
/** Sentinel value of the test-type filter (kept as-is so the filter semantics do not change). */
const ALL_TEST_TYPES = 'All Test Types';

const PRIORITY_OPTIONS: SegmentOption<string>[] = [
    { value: 'ALL', label: 'All priorities' },
    { value: 'STAT', label: 'STAT' },
    { value: 'URGENT', label: 'Urgent' },
    { value: 'NORMAL', label: 'Normal' },
];

/** "Today 09:12", "Yesterday 14:02", otherwise "16 Aug 2026 09:12". */
function formatCollectedAt(iso?: string | null) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    const label = formatRegistered(d);
    if (label.startsWith('Today') || label.startsWith('Yesterday')) return label;
    const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
    return `${label} ${time}`;
}

const PRIORITY_ORDER: Record<string, number> = {
    STAT: 0,
    URGENT: 1,
    NORMAL: 2,
};

export default function ReceptionAccessioningPage() {
    const pathname = usePathname();
    const [samples, setSamples] = useState<MltWorklistItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [priorityFilter, setPriorityFilter] = useState('ALL');
    const [testTypeFilter, setTestTypeFilter] = useState(ALL_TEST_TYPES);
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
        return [ALL_TEST_TYPES, ...uniqueTestNames];
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
                testTypeFilter === ALL_TEST_TYPES || sample.testName === testTypeFilter;

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
    const pendingCount = samples.length;
    const statCount = samples.filter((sample) => sample.priority === 'STAT').length;
    const urgentCount = samples.filter((sample) => sample.priority === 'URGENT').length;
    const normalCount = samples.filter((sample) => sample.priority === 'NORMAL').length;

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    const hasFilters = searchQuery.trim().length > 0 || testTypeFilter !== ALL_TEST_TYPES || priorityFilter !== 'ALL';

    const clearFilters = () => {
        setSearchQuery('');
        setPriorityFilter('ALL');
        setTestTypeFilter(ALL_TEST_TYPES);
        setCurrentPage(1);
    };

    return (
        <div className="mx-auto max-w-[1400px]">
            <PageHeader
                title="Sample accessioning"
                crumbs={[{ label: 'Lab reception', href: '/reception/accessioning' }, { label: 'Reception worklist' }]}
                meta={<span>Open sample details first, then continue to verification from the sample detail view.</span>}
                actions={
                    <Button icon={RefreshCw} loading={loading} onClick={() => void loadSamples()}>
                        Refresh
                    </Button>
                }
            />

            {/* Live region for async state changes */}
            <p role="status" aria-live="polite" className="sr-only">
                {loading
                    ? 'Loading received samples'
                    : error
                      ? 'Reception samples failed to load'
                      : `${filteredSamples.length} of ${samples.length} ${samples.length === 1 ? 'sample' : 'samples'} shown${
                            totalPages > 1 ? `, page ${currentPage} of ${totalPages}` : ''
                        }.`}
            </p>

            {/* A refresh that fails keeps the last loaded list visible; the message sits above it. */}
            {error && !loading && samples.length > 0 && (
                <div
                    role="alert"
                    className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-status-danger-edge bg-status-danger-bg px-4 py-3 text-sm text-status-danger-fg"
                >
                    <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="min-w-0 flex-1">{error}</span>
                    <Button size="sm" onClick={() => void loadSamples()}>
                        Retry
                    </Button>
                </div>
            )}

            <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard label="Samples pending" value={pendingCount} icon={ClipboardList} color="blue" loading={loading} />
                <StatCard
                    label="STAT priority"
                    value={statCount}
                    icon={Siren}
                    color="red"
                    sub={statCount > 0 ? 'Action needed' : undefined}
                    loading={loading}
                />
                <StatCard
                    label="Urgent priority"
                    value={urgentCount}
                    icon={AlertTriangle}
                    color="orange"
                    sub={urgentCount > 0 ? 'Action needed' : undefined}
                    loading={loading}
                />
                <StatCard label="Normal priority" value={normalCount} icon={Clock} color="blue" loading={loading} />
            </div>

            <SectionCard title="Received samples" count={loading ? undefined : filteredSamples.length} flush>
                {/* Filter toolbar */}
                <div className="flex flex-wrap items-center gap-2 border-b border-edge bg-surface-muted px-3 py-2">
                    <InputField
                        label="Search samples"
                        hideLabel
                        type="search"
                        autoComplete="off"
                        value={searchQuery}
                        onChange={(event) => {
                            setSearchQuery(event.target.value);
                            setCurrentPage(1);
                        }}
                        placeholder="Search barcode, patient ID, order ID or test"
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
                                {testType === ALL_TEST_TYPES ? 'All test types' : testType}
                            </option>
                        ))}
                    </SelectField>
                    {hasFilters && (
                        <Button variant="ghost" icon={X} onClick={clearFilters}>
                            Clear filters
                        </Button>
                    )}
                </div>

                <div aria-busy={loading}>
                    {/* States live outside the table so they centre on small screens */}
                    {loading ? (
                        <ul aria-hidden="true" className="divide-y divide-edge">
                            {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
                                <li key={i} className="flex items-center gap-3 px-4 py-2.5">
                                    <span className="h-3 w-24 shrink-0 rounded bg-skeleton" />
                                    <span className="h-3 w-32 rounded bg-skeleton" />
                                    <span className="hidden h-3 w-28 rounded bg-skeleton sm:block" />
                                    <span className="ml-auto hidden h-4 w-14 rounded bg-skeleton md:block" />
                                    <span className="hidden h-4 w-20 rounded bg-skeleton lg:block" />
                                </li>
                            ))}
                        </ul>
                    ) : error && samples.length === 0 ? (
                        <EmptyState
                            icon={AlertTriangle}
                            title="Couldn't load received samples"
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
                                icon={Inbox}
                                title="No samples waiting for accessioning"
                                description="Collected specimens appear here as soon as they reach reception."
                            />
                        ) : (
                            <EmptyState
                                icon={SearchX}
                                title="No samples match your filters"
                                description="Try a different barcode, patient ID, order ID, priority or test type."
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
                                <table className="w-full min-w-[760px] table-fixed text-left text-sm">
                                    <thead>
                                        <tr className="whitespace-nowrap border-b border-edge text-xs font-semibold text-fg-muted">
                                            <th scope="col" className="w-[16%] py-2 pl-4 pr-3 font-semibold">Barcode</th>
                                            <th scope="col" className="w-[18%] px-3 py-2 font-semibold">Patient / order</th>
                                            <th scope="col" className="w-[16%] px-3 py-2 font-semibold">Test</th>
                                            <th scope="col" className="w-[16%] px-3 py-2 font-semibold">Collected</th>
                                            <th scope="col" className="w-[10%] px-3 py-2 font-semibold">Priority</th>
                                            <th scope="col" className="w-[12%] px-3 py-2 font-semibold">Status</th>
                                            <th scope="col" className="w-24 py-2 pl-2 pr-3 text-right font-semibold">
                                                <span className="sr-only">Actions</span>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-edge whitespace-nowrap">
                                        {paginatedSamples.map((sample) => {
                                            const href = `/reception/samples/${sample.sampleId}`;
                                            return (
                                                <tr key={sample.sampleId} className="group transition-colors hover:bg-surface-hover">
                                                    <td className="py-2 pl-4 pr-3">
                                                        <Link
                                                            href={href}
                                                            className="rounded font-mono text-xs font-semibold text-primary-strong hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-surface"
                                                        >
                                                            {sample.barcode}
                                                        </Link>
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        <p className="truncate font-medium text-fg">{sample.patientId}</p>
                                                        <p className="truncate text-xs text-fg-muted">{sample.orderId}</p>
                                                    </td>
                                                    <td className="truncate px-3 py-2 text-fg-secondary" title={sample.testName}>
                                                        {sample.testName}
                                                    </td>
                                                    <td className="px-3 py-2 tabular-nums text-fg-secondary">
                                                        {formatCollectedAt(sample.collectedAt)}
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        <PriorityBadge priority={sample.priority} />
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        <StatusBadge status={sample.status} />
                                                    </td>
                                                    <td className="py-2 pl-2 pr-3 text-right">
                                                        <Button size="sm" href={href} aria-label={`Details for ${sample.barcode}`}>
                                                            Details
                                                        </Button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
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
                </div>
            </SectionCard>
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
