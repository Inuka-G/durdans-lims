'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
    AlertTriangle,
    ChevronDown,
    ClipboardCheck,
    Clock,
    ListChecks,
    RefreshCw,
    Search,
    ShieldCheck,
    Undo2,
    X
} from 'lucide-react';
import { getPendingVerificationResults, type TestResultSummary } from '@/lib/api';
import { displayResultNo, resultStatusLabel, resultStatusTone } from '@/lib/result-display';
import {
    FLAG_FILTER_OPTIONS,
    PRIORITY_FILTER_OPTIONS,
    countFilterOptions,
    isCritical,
    matchesFlagFilter,
    matchesPriorityFilter,
    matchesSearchQuery,
    pageCount,
    type FlagFilter,
    type PriorityFilter
} from '@/lib/review-worklist';
import { cn } from '@/lib/utils';
import Button from '@/components/ui/Button';
import PageHeader from '@/components/ui/PageHeader';
import SectionCard from '@/components/ui/SectionCard';
import EmptyState from '@/components/ui/EmptyState';
import StatusChip from '@/components/ui/StatusChip';
import Pagination from '@/components/ui/Pagination';
import { InputField, SelectField } from '@/components/ui/Field';
import StatCard from '@/components/shared/StatCard';
import PriorityBadge from '@/components/shared/PriorityBadge';
import { formatAuditTime } from '@/components/patient-dashboard/dashboard-data';

const PAGE_SIZE = 10;
/** Server page size used to load the whole queue; search and counts cover every page. */
const FETCH_PAGE_SIZE = 100;
const SKELETON_ROWS = 6;

type StatusFilter = 'ALL' | 'PENDING' | 'RETURNED_TO_SUPERVISOR';

const STATUS_FILTER_OPTIONS: ReadonlyArray<{ value: StatusFilter; label: string }> = [
    { value: 'ALL', label: 'All statuses' },
    { value: 'PENDING', label: 'Pending verification' },
    { value: 'RETURNED_TO_SUPERVISOR', label: 'Returned to supervisor' }
];

const matchesStatusFilter = (result: TestResultSummary, status: StatusFilter) => {
    if (status === 'ALL') {
        return true;
    }
    if (status === 'PENDING') {
        return result.status !== 'RETURNED_FOR_RECHECK';
    }
    return result.status === 'RETURNED_FOR_RECHECK';
};

interface FilterCriteria {
    search: string;
    status: StatusFilter;
    priority: PriorityFilter;
    flag: FlagFilter;
}

const filterResults = (results: TestResultSummary[], criteria: FilterCriteria) =>
    results.filter(
        (result) =>
            matchesSearchQuery(result, criteria.search) &&
            matchesStatusFilter(result, criteria.status) &&
            matchesPriorityFilter(result, criteria.priority) &&
            matchesFlagFilter(result, criteria.flag)
    );

/** Relative "Updated" text for the row meta line; `—` when no timestamp is known. */
const formatUpdated = (value?: string | null) => (value ? formatAuditTime(value) : '—');

/** Full, unambiguous timestamp for tooltips and the expanded panel. */
const formatFullTimestamp = (value?: string | null) => {
    if (!value) {
        return '—';
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return value;
    }

    return parsed.toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
};

export default function PendingVerificationPage() {
    const router = useRouter();
    const pathname = usePathname();
    const [results, setResults] = useState<TestResultSummary[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
    const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('ALL');
    const [flagFilter, setFlagFilter] = useState<FlagFilter>('ALL');
    const [expandedReason, setExpandedReason] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // The queue is loaded whole (every server page) so the search, the filter
    // counts and the summary cards cover every waiting case, not the ten on screen.
    const loadPendingResults = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const firstPage = await getPendingVerificationResults(0, FETCH_PAGE_SIZE);
            const remainingPages =
                firstPage.totalPages > 1
                    ? await Promise.all(
                          Array.from({ length: firstPage.totalPages - 1 }, (_, index) =>
                              getPendingVerificationResults(index + 1, FETCH_PAGE_SIZE)
                          )
                      )
                    : [];

            setResults([
                ...(firstPage.content ?? []),
                ...remainingPages.flatMap((page) => page.content ?? [])
            ]);
            setExpandedReason(null);
        } catch (loadError) {
            console.error('Failed to load pending verification results', loadError);
            setError("Couldn't load pending verification results. Check your connection and retry.");
            setResults([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadPendingResults();
    }, [loadPendingResults, pathname]);

    const criteria = useMemo<FilterCriteria>(
        () => ({
            search: searchQuery.trim().toLowerCase(),
            status: statusFilter,
            priority: priorityFilter,
            flag: flagFilter
        }),
        [searchQuery, statusFilter, priorityFilter, flagFilter]
    );

    const filteredResults = useMemo(() => filterResults(results, criteria), [results, criteria]);

    // A new search or filter re-anchors the list at its first page.
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, statusFilter, priorityFilter, flagFilter]);

    const totalPages = pageCount(filteredResults.length, PAGE_SIZE);
    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    const pagedResults = useMemo(() => {
        const start = (currentPage - 1) * PAGE_SIZE;
        return filteredResults.slice(start, start + PAGE_SIZE);
    }, [filteredResults, currentPage]);

    // Each dropdown counts against the rows that the search and the other two
    // dropdowns already allow, so an option's number is what picking it would show.
    const statusOptions = useMemo(
        () =>
            countFilterOptions(
                filterResults(results, { ...criteria, status: 'ALL' }),
                STATUS_FILTER_OPTIONS,
                matchesStatusFilter
            ),
        [results, criteria]
    );

    const priorityOptions = useMemo(
        () =>
            countFilterOptions(
                filterResults(results, { ...criteria, priority: 'ALL' }),
                PRIORITY_FILTER_OPTIONS,
                matchesPriorityFilter
            ),
        [results, criteria]
    );

    const flagOptions = useMemo(
        () =>
            countFilterOptions(
                filterResults(results, { ...criteria, flag: 'ALL' }),
                FLAG_FILTER_OPTIONS,
                matchesFlagFilter
            ),
        [results, criteria]
    );

    const totalPending = results.filter((result) => result.status !== 'RETURNED_FOR_RECHECK').length;
    const returnedToSupervisorCount = results.filter(
        (result) => result.status === 'RETURNED_FOR_RECHECK'
    ).length;
    const criticalPending = results.filter((result) => isCritical(result)).length;
    const isFiltering =
        searchQuery.trim().length > 0 ||
        statusFilter !== 'ALL' ||
        priorityFilter !== 'ALL' ||
        flagFilter !== 'ALL';

    const handleClearFilters = () => {
        setSearchQuery('');
        setStatusFilter('ALL');
        setPriorityFilter('ALL');
        setFlagFilter('ALL');
    };

    const handleReview = (resultId: string) => {
        router.push(`/verification/review/${resultId}`);
    };

    const showFooter = !error && !loading && filteredResults.length > 0;

    return (
        <div className="mx-auto max-w-[1400px]">
            <PageHeader
                title="Verification dashboard"
                crumbs={[
                    { label: 'Dashboard', href: '/dashboard' },
                    { label: 'Verification', href: '/verification' },
                    { label: 'Pending' }
                ]}
                meta={
                    <>
                        <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>Technical verification</span>
                    </>
                }
                actions={
                    <Button
                        icon={RefreshCw}
                        onClick={() => {
                            void loadPendingResults();
                        }}
                        loading={loading && results.length > 0}
                    >
                        Refresh
                    </Button>
                }
            />

            {/* Screen-reader status for async changes */}
            <p role="status" aria-live="polite" className="sr-only">
                {loading
                    ? 'Loading pending verification results'
                    : error
                      ? 'Pending verification results failed to load'
                      : `Showing ${filteredResults.length} matching of ${results.length} results, page ${currentPage} of ${totalPages}.`}
            </p>

            {/* Summary cards — counts cover the whole queue */}
            <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <StatCard
                    label="Pending verification"
                    value={totalPending}
                    icon={Clock}
                    color="blue"
                    sub="Awaiting technical review"
                    loading={loading}
                />
                <StatCard
                    label="Returned to supervisor"
                    value={returnedToSupervisorCount}
                    icon={Undo2}
                    color="orange"
                    sub="Sent back by the pathologist"
                    loading={loading}
                />
                <StatCard
                    label="Critical cases"
                    value={criticalPending}
                    icon={AlertTriangle}
                    color="red"
                    sub="Panic values needing attention"
                    loading={loading}
                />
            </div>

            <SectionCard title="Results" count={loading ? undefined : filteredResults.length} flush>
                {/* Filter toolbar — status, priority and flag dropdowns preview their counts */}
                <div className="flex flex-wrap items-center gap-2 border-b border-edge bg-surface-muted px-3 py-2">
                    <SelectField
                        label="Filter by status"
                        hideLabel
                        value={statusFilter}
                        onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                        className="w-full sm:w-52"
                    >
                        {statusOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label} ({option.count})
                            </option>
                        ))}
                    </SelectField>

                    <SelectField
                        label="Filter by priority"
                        hideLabel
                        value={priorityFilter}
                        onChange={(event) => setPriorityFilter(event.target.value as PriorityFilter)}
                        className="w-full sm:w-44"
                    >
                        {priorityOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label} ({option.count})
                            </option>
                        ))}
                    </SelectField>

                    <SelectField
                        label="Filter by result flag"
                        hideLabel
                        value={flagFilter}
                        onChange={(event) => setFlagFilter(event.target.value as FlagFilter)}
                        className="w-full sm:w-44"
                    >
                        {flagOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label} ({option.count})
                            </option>
                        ))}
                    </SelectField>

                    <InputField
                        label="Search pending results"
                        hideLabel
                        type="search"
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder="Search patient, patient code, result ID, test group or MLT..."
                        autoComplete="off"
                        className="min-w-[220px] flex-1"
                    />

                    {isFiltering && (
                        <Button
                            variant="ghost"
                            size="sm"
                            icon={X}
                            onClick={handleClearFilters}
                            title="Reset status, priority, flag and search filters"
                        >
                            Reset filters
                        </Button>
                    )}
                </div>

                {/* States live outside the table so they centre on small screens */}
                {loading ? (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[960px] table-fixed text-left text-[13px]">
                            <caption className="sr-only">Results pending technical verification</caption>
                            <thead>
                                <tr className="whitespace-nowrap border-b border-edge text-xs font-medium text-fg-muted">
                                    <th scope="col" className="w-[15%] py-2 pl-4 pr-3 font-medium">
                                        Result ID
                                    </th>
                                    <th scope="col" className="w-[17%] px-3 py-2 font-medium">
                                        Patient
                                    </th>
                                    <th scope="col" className="w-[15%] px-3 py-2 font-medium">
                                        Test group
                                    </th>
                                    <th scope="col" className="w-[13%] px-3 py-2 font-medium">
                                        MLT Name
                                    </th>
                                    <th scope="col" className="w-[9%] px-3 py-2 font-medium">
                                        Priority
                                    </th>
                                    <th scope="col" className="w-[10%] px-3 py-2 font-medium">
                                        QC status
                                    </th>
                                    <th scope="col" className="w-[13%] px-3 py-2 font-medium">
                                        Status
                                    </th>
                                    <th scope="col" className="w-[8%] py-2 pl-2 pr-3 text-right font-medium">
                                        <span className="sr-only">Actions</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {Array.from({ length: 6 }).map((_, index) => (
                                    <tr key={index} className="border-b border-edge">
                                        <td className="py-2.5 pl-4 pr-3">
                                            <span className="block h-4 w-28 rounded bg-skeleton" />
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <span className="block h-4 w-36 rounded bg-skeleton" />
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <span className="block h-4 w-24 rounded bg-skeleton" />
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <span className="block h-4 w-24 rounded bg-skeleton" />
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <span className="block h-5 w-16 rounded bg-skeleton" />
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <span className="block h-5 w-20 rounded bg-skeleton" />
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <span className="block h-5 w-24 rounded bg-skeleton" />
                                        </td>
                                        <td className="py-2.5 pl-2 pr-3 text-right">
                                            <span className="ml-auto block h-7 w-16 rounded bg-skeleton" />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : error ? (
                    <EmptyState
                        icon={AlertTriangle}
                        title="Pending results unavailable"
                        description={error}
                        action={
                            <Button
                                size="sm"
                                icon={RefreshCw}
                                onClick={() => {
                                    void loadPendingResults();
                                }}
                            >
                                Retry
                            </Button>
                        }
                    />
                ) : filteredResults.length === 0 ? (
                    isFiltering ? (
                        <EmptyState
                            icon={Search}
                            title="No cases match"
                            description="Try a different search term, or clear the status, priority and flag filters."
                            action={
                                <Button size="sm" icon={X} onClick={handleClearFilters}>
                                    Clear filters
                                </Button>
                            }
                        />
                    ) : (
                        <EmptyState
                            icon={ClipboardCheck}
                            title="No cases waiting for review"
                            description="Newly entered, returned or critical cases will appear here automatically."
                        />
                    )
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[960px] table-fixed text-left text-[13px]">
                            <caption className="sr-only">Results pending technical verification</caption>
                            <thead>
                                <tr className="whitespace-nowrap border-b border-edge text-xs font-medium text-fg-muted">
                                    <th scope="col" className="w-[15%] py-2 pl-4 pr-3 font-medium">
                                        Result ID
                                    </th>
                                    <th scope="col" className="w-[17%] px-3 py-2 font-medium">
                                        Patient
                                    </th>
                                    <th scope="col" className="w-[15%] px-3 py-2 font-medium">
                                        Test group
                                    </th>
                                    <th scope="col" className="w-[13%] px-3 py-2 font-medium">
                                        MLT Name
                                    </th>
                                    <th scope="col" className="w-[9%] px-3 py-2 font-medium">
                                        Priority
                                    </th>
                                    <th scope="col" className="w-[10%] px-3 py-2 font-medium">
                                        QC status
                                    </th>
                                    <th scope="col" className="w-[13%] px-3 py-2 font-medium">
                                        Status
                                    </th>
                                    <th scope="col" className="w-[8%] py-2 pl-2 pr-3 text-right font-medium">
                                        <span className="sr-only">Actions</span>
                                    </th>
                                </tr>
                            </thead>

                            <tbody className="divide-y divide-edge whitespace-nowrap">
                                {pagedResults.map((result) => {
                                    const isReturned = result.status === 'RETURNED_FOR_RECHECK';
                                    const isExpanded = expandedReason === result.resultId;
                                    const hasCritical = isCritical(result);
                                    const displayId = displayResultNo(result.resultNo, result.resultId);
                                    const technicianName = result.mltName || '';
                                    const panelId = `return-reason-${result.resultId}`;
                                    const fullUpdated = formatFullTimestamp(result.updatedAt);

                                    return (
                                        <React.Fragment key={result.resultId}>
                                            <tr
                                                className={cn(
                                                    'group cursor-pointer transition-colors hover:bg-surface-hover',
                                                    hasCritical && 'bg-status-danger-bg hover:bg-status-danger-edge/60'
                                                )}
                                                onClick={(event) => {
                                                    const target = event.target as HTMLElement;
                                                    if (target.closest('button, a')) {
                                                        return;
                                                    }
                                                    handleReview(result.resultId);
                                                }}
                                            >
                                                <td className="py-2 pl-4 pr-3">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleReview(result.resultId)}
                                                        title={result.resultId}
                                                        className="flex max-w-full items-center gap-1.5 rounded text-left font-mono text-xs font-medium text-fg transition-colors hover:text-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-surface"
                                                    >
                                                        {hasCritical && (
                                                            <>
                                                                <AlertTriangle
                                                                    className="h-3.5 w-3.5 shrink-0 text-status-danger-fg"
                                                                    aria-hidden="true"
                                                                />
                                                                <span className="sr-only">Critical: </span>
                                                            </>
                                                        )}
                                                        <span className="truncate">{displayId}</span>
                                                    </button>
                                                    <p className="mt-0.5 truncate text-xs text-fg-muted">
                                                        Updated{' '}
                                                        <time dateTime={result.updatedAt ?? undefined} title={fullUpdated}>
                                                            {formatUpdated(result.updatedAt)}
                                                        </time>
                                                    </p>
                                                </td>

                                                <td className="px-3 py-2">
                                                    <p className="truncate font-semibold text-fg" title={result.patientName || undefined}>
                                                        {result.patientName || 'Unknown patient'}
                                                    </p>
                                                    {result.patientCode && (
                                                        <p className="mt-0.5 truncate font-mono text-xs text-fg-muted">
                                                            {result.patientCode}
                                                        </p>
                                                    )}
                                                </td>

                                                <td className="truncate px-3 py-2 text-fg-secondary" title={result.testType || undefined}>
                                                    {result.testType || <span className="text-fg-faint">—</span>}
                                                </td>

                                                <td className="truncate px-3 py-2 text-fg-secondary" title={technicianName || undefined}>
                                                    {technicianName || <span className="text-fg-faint">—</span>}
                                                </td>

                                                <td className="px-3 py-2">
                                                    <PriorityBadge priority={result.priorityLevel ?? ''} />
                                                </td>

                                                <td className="px-3 py-2">
                                                    <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-600">
                                                        <span className="h-1.5 w-1.5 rounded-full bg-neutral-400" />
                                                        Not linked
                                                    </span>
                                                </td>

                                                <td className="px-3 py-2">
                                                    <StatusChip
                                                        tone={resultStatusTone(result.status)}
                                                        dot
                                                        title={resultStatusLabel(result.status)}
                                                    >
                                                        {resultStatusLabel(result.status)}
                                                    </StatusChip>
                                                </td>

                                                <td className="py-2 pl-2 pr-3 text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        {isReturned && (
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    setExpandedReason((previous) =>
                                                                        previous === result.resultId
                                                                            ? null
                                                                            : result.resultId
                                                                    )
                                                                }
                                                                aria-expanded={isExpanded}
                                                                aria-controls={isExpanded ? panelId : undefined}
                                                                aria-label={
                                                                    isExpanded
                                                                        ? `Hide return reason for ${displayId}`
                                                                        : `Show return reason for ${displayId}`
                                                                }
                                                                className="inline-flex h-7 w-7 items-center justify-center rounded text-fg-faint transition-colors hover:bg-surface-hover hover:text-fg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                                            >
                                                                <ChevronDown
                                                                    className={cn('h-4 w-4 transition-transform', isExpanded && 'rotate-180')}
                                                                    aria-hidden="true"
                                                                />
                                                            </button>
                                                        )}

                                                        <Button
                                                            size="sm"
                                                            variant="primary"
                                                            onClick={() => handleReview(result.resultId)}
                                                            aria-label={`Review ${displayId}`}
                                                        >
                                                            Review
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>

                                            {isReturned && isExpanded && (
                                                <tr id={panelId} className="bg-surface-muted">
                                                    <td colSpan={7} className="whitespace-normal py-3 pl-4 pr-3">
                                                        <div className="rounded-md border border-status-pending-edge bg-status-pending-bg px-3 py-2.5">
                                                            <p className="text-xs font-semibold text-status-pending-fg">
                                                                {resultStatusLabel(result.status)}
                                                                {result.pathologistName && (
                                                                    <span className="font-normal"> · Returned by {result.pathologistName}</span>
                                                                )}
                                                            </p>
                                                            <p className="mt-1 break-words text-[13px] text-fg">
                                                                {result.returnReason || 'No return reason provided.'}
                                                            </p>
                                                            <p className="mt-1.5 text-xs text-fg-muted">
                                                                Last updated{' '}
                                                                <time dateTime={result.updatedAt ?? undefined} className="tabular-nums">
                                                                    {fullUpdated}
                                                                </time>
                                                            </p>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Footer: paging over the filtered set — "Page X of Y · N matching" */}
                {showFooter && (
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-edge px-4 pt-2 text-xs text-fg-muted">
                        <p className="tabular-nums">
                            Page {currentPage} of {totalPages}
                            <span aria-hidden="true"> · </span>
                            {filteredResults.length.toLocaleString()} matching
                            {isFiltering && ` of ${results.length.toLocaleString()}`}
                        </p>
                        <Pagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            totalItems={filteredResults.length}
                            pageSize={PAGE_SIZE}
                            onPageChange={(page) => setCurrentPage(Math.min(Math.max(page, 1), totalPages))}
                            itemLabel="results"
                            className="w-full border-t-0 px-0 pt-0 sm:w-auto"
                        />
                    </div>
                )}
            </SectionCard>
        </div>
    );
}
