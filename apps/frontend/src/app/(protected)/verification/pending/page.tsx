'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
    AlertTriangle,
    ChevronDown,
    ClipboardCheck,
    Clock,
    RefreshCw,
    Search,
    ShieldCheck,
    Undo2,
    X
} from 'lucide-react';
import { formatStatusLabel } from '@/constants/sample-lifecycle';
import { getPendingVerificationResults, type TestResultSummary } from '@/lib/api';
import { formatDisplayId } from '@/lib/format-id';
import { cn } from '@/lib/utils';
import Button from '@/components/ui/Button';
import PageHeader from '@/components/ui/PageHeader';
import SectionCard from '@/components/ui/SectionCard';
import EmptyState from '@/components/ui/EmptyState';
import SegmentedControl from '@/components/ui/SegmentedControl';
import StatusChip, { type ChipTone } from '@/components/ui/StatusChip';
import Pagination from '@/components/ui/Pagination';
import { InputField } from '@/components/ui/Field';
import StatCard from '@/components/shared/StatCard';
import PriorityBadge from '@/components/shared/PriorityBadge';
import { formatAuditTime } from '@/components/patient-dashboard/dashboard-data';

const PAGE_SIZE = 10;
const SKELETON_ROWS = 6;

type StatusFilter = 'ALL' | 'PENDING' | 'RETURNED_TO_SUPERVISOR' | 'CRITICAL';

/** Any non-normal analyte flag needs supervisor attention. */
const hasCriticalTriage = (result: TestResultSummary) => {
    if (result.hasCriticalFinding === true) {
        return true;
    }
    const flag = result.flag?.toUpperCase();
    return Boolean(flag && flag !== 'NORMAL');
};

const RESULT_FLAG_CONFIG: Record<string, { label: string; tone: ChipTone }> = {
    NORMAL: { label: 'NORMAL', tone: 'neutral' },
    LOW: { label: 'LOW', tone: 'pending' },
    HIGH: { label: 'HIGH', tone: 'pending' },
    CRITICAL_LOW: { label: 'CRITICAL LOW', tone: 'danger' },
    CRITICAL_HIGH: { label: 'CRITICAL HIGH', tone: 'danger' }
};

const getResultFlagBadge = (
    flag?: string | null,
    hasCriticalFinding?: boolean | null
): { label: string; tone: ChipTone } => {
    if (hasCriticalFinding && (!flag || flag.toUpperCase() === 'NORMAL')) {
        return RESULT_FLAG_CONFIG.CRITICAL_HIGH;
    }

    if (!flag) {
        return { label: '—', tone: 'neutral' };
    }

    return (
        RESULT_FLAG_CONFIG[flag.toUpperCase()] ?? {
            label: formatStatusLabel(flag),
            tone: 'neutral'
        }
    );
};

const QC_TONE: Record<string, ChipTone> = {
    PASS: 'success',
    FAIL: 'danger',
    WARN: 'pending'
};

const getQcStatusConfig = (qcStatus?: string | null): { label: string; tone: ChipTone } => {
    if (!qcStatus) {
        return { label: '?', tone: 'neutral' };
    }

    const normalizedStatus = qcStatus.toUpperCase();

    if (normalizedStatus in QC_TONE) {
        return { label: normalizedStatus, tone: QC_TONE[normalizedStatus] };
    }

    return { label: qcStatus, tone: 'neutral' };
};

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

const getVerificationLabel = (status?: string | null) => {
    if (status === 'RETURNED_FOR_RECHECK') {
        return 'Returned to supervisor';
    }

    return 'Pending verification';
};

const getVerificationTone = (status?: string | null): ChipTone =>
    status === 'RETURNED_FOR_RECHECK' ? 'pending' : 'info';

const CHECKBOX_CLASS =
    'h-4 w-4 shrink-0 rounded border-edge-strong accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-50';

export default function PendingVerificationPage() {
    const router = useRouter();
    const pathname = usePathname();
    const [results, setResults] = useState<TestResultSummary[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [expandedReason, setExpandedReason] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalElements, setTotalElements] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [isLastPage, setIsLastPage] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadPendingResults = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await getPendingVerificationResults(currentPage - 1, PAGE_SIZE);

            setResults(response.content || []);
            setTotalElements(response.totalElements ?? 0);
            setTotalPages(Math.max(response.totalPages ?? 1, 1));
            setIsLastPage(response.last ?? true);
            setSelectedIds([]);
            setExpandedReason(null);
        } catch (loadError) {
            console.error('Failed to load pending verification results', loadError);
            setError("Couldn't load pending verification results. Check your connection and retry.");
            setResults([]);
            setTotalElements(0);
            setTotalPages(1);
            setIsLastPage(true);
            setSelectedIds([]);
        } finally {
            setLoading(false);
        }
    }, [currentPage]);

    useEffect(() => {
        void loadPendingResults();
    }, [loadPendingResults, pathname]);

    const filteredResults = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();

        return results.filter((result) => {
            const displayResultId = formatDisplayId(result.resultId, 'RES').toLowerCase();
            const matchesSearch =
                query.length === 0 ||
                result.resultId.toLowerCase().includes(query) ||
                displayResultId.includes(query) ||
                (result.patientCode ?? '').toLowerCase().includes(query) ||
                (result.patientName ?? '').toLowerCase().includes(query) ||
                (result.testType ?? '').toLowerCase().includes(query) ||
                (result.mltName ?? result.technicianName ?? '').toLowerCase().includes(query) ||
                (result.priorityLevel ?? '').toLowerCase().includes(query) ||
                (result.flag ?? '').toLowerCase().includes(query);

            const matchesStatus =
                statusFilter === 'ALL' ||
                (statusFilter === 'PENDING' && result.status === 'ENTERED') ||
                (statusFilter === 'RETURNED_TO_SUPERVISOR' &&
                    result.status === 'RETURNED_FOR_RECHECK') ||
                (statusFilter === 'CRITICAL' && hasCriticalTriage(result));

            return matchesSearch && matchesStatus;
        });
    }, [results, searchQuery, statusFilter]);

    const totalPending = results.filter((result) => result.status === 'ENTERED').length;
    const returnedToSupervisorCount = results.filter(
        (result) => result.status === 'RETURNED_FOR_RECHECK'
    ).length;
    const criticalPending = results.filter((result) => hasCriticalTriage(result)).length;
    const isFiltering = searchQuery.trim().length > 0 || statusFilter !== 'ALL';

    const allVisibleSelected =
        filteredResults.length > 0 && filteredResults.every((result) => selectedIds.includes(result.resultId));

    const handleToggleSelectAll = () => {
        if (allVisibleSelected) {
            setSelectedIds([]);
            return;
        }

        setSelectedIds(filteredResults.map((result) => result.resultId));
    };

    const handleToggleSelectOne = (resultId: string) => {
        setSelectedIds((previous) =>
            previous.includes(resultId)
                ? previous.filter((id) => id !== resultId)
                : [...previous, resultId]
        );
    };

    const handleReview = (resultId: string) => {
        router.push(`/verification/review/${resultId}`);
    };

    const handlePageChange = (page: number) => {
        if (loading) {
            return;
        }
        if (page > currentPage && isLastPage) {
            return;
        }
        setCurrentPage(Math.min(Math.max(page, 1), totalPages));
    };

    const filterOptions: { value: StatusFilter; label: string; count: number }[] = [
        { value: 'ALL', label: 'All', count: results.length },
        { value: 'PENDING', label: 'Pending', count: totalPending },
        { value: 'RETURNED_TO_SUPERVISOR', label: 'Returned', count: returnedToSupervisorCount },
        { value: 'CRITICAL', label: 'Critical', count: criticalPending }
    ];

    const showFooter = !error && (loading || results.length > 0);

    return (
        <div className="mx-auto max-w-[1400px]">
            <PageHeader
                title="Pending verification"
                crumbs={[
                    { label: 'Dashboard', href: '/dashboard' },
                    { label: 'Verification', href: '/verification' },
                    { label: 'Pending' }
                ]}
                meta={
                    <>
                        <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>Technical verification</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">
                            {totalElements.toLocaleString()} {totalElements === 1 ? 'result' : 'results'} awaiting review
                        </span>
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
                      : `Showing ${filteredResults.length} of ${results.length} results on page ${currentPage} of ${totalPages}.${selectedIds.length > 0 ? ` ${selectedIds.length} selected.` : ''}`}
            </p>

            {/* Stat row — counts reflect the results on the current page */}
            <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <StatCard
                    label="Pending verification"
                    value={totalPending}
                    icon={Clock}
                    color="blue"
                    sub="On this page"
                    loading={loading}
                />
                <StatCard
                    label="Returned to supervisor"
                    value={returnedToSupervisorCount}
                    icon={Undo2}
                    color="orange"
                    sub="On this page"
                    loading={loading}
                />
                <StatCard
                    label="Critical cases"
                    value={criticalPending}
                    icon={AlertTriangle}
                    color="red"
                    sub="On this page"
                    loading={loading}
                />
            </div>

            <SectionCard title="Results" count={totalElements.toLocaleString()} flush>
                {/* Filter toolbar */}
                <div className="flex flex-wrap items-center gap-2 border-b border-edge bg-surface-muted px-3 py-2">
                    <SegmentedControl<StatusFilter>
                        ariaLabel="Filter results by status"
                        value={statusFilter}
                        onChange={(next) => {
                            setStatusFilter(next);
                            setSelectedIds([]);
                        }}
                        options={filterOptions}
                    />
                    <InputField
                        label="Search pending results"
                        hideLabel
                        type="search"
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder="Search patient, code, test, result ID or technician"
                        autoComplete="off"
                        className="min-w-[220px] flex-1"
                    />
                    {selectedIds.length > 0 && (
                        <div className="flex items-center gap-1 text-xs text-fg-secondary">
                            <span className="tabular-nums">
                                {selectedIds.length} selected
                            </span>
                            <Button
                                variant="ghost"
                                size="sm"
                                icon={X}
                                onClick={() => setSelectedIds([])}
                            >
                                Clear selection
                            </Button>
                        </div>
                    )}
                </div>

                {/* States live outside the table so they centre on small screens */}
                {loading ? (
                    <ul aria-hidden="true" className="divide-y divide-edge">
                        {Array.from({ length: SKELETON_ROWS }).map((_, index) => (
                            <li key={index} className="flex items-center gap-3 px-4 py-2.5">
                                <span className="h-4 w-4 shrink-0 rounded bg-skeleton" />
                                <span className="h-4 w-24 shrink-0 rounded bg-skeleton" />
                                <span className="h-3 w-32 shrink-0 rounded bg-skeleton" />
                                <span className="hidden h-3 w-28 rounded bg-skeleton md:block" />
                                <span className="hidden h-3 w-24 rounded bg-skeleton lg:block" />
                                <span className="h-4 w-12 rounded-full bg-skeleton" />
                                <span className="h-4 w-16 rounded-full bg-skeleton" />
                                <span className="hidden h-4 w-14 rounded-full bg-skeleton md:block" />
                                <span className="ml-auto h-7 w-16 rounded bg-skeleton" />
                            </li>
                        ))}
                    </ul>
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
                            description="Try a different search term or status filter."
                            action={
                                <Button
                                    size="sm"
                                    icon={X}
                                    onClick={() => {
                                        setSearchQuery('');
                                        setStatusFilter('ALL');
                                        setSelectedIds([]);
                                    }}
                                >
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
                                    <th scope="col" className="w-10 py-2 pl-4 pr-2">
                                        <input
                                            type="checkbox"
                                            checked={allVisibleSelected}
                                            onChange={handleToggleSelectAll}
                                            disabled={filteredResults.length === 0}
                                            aria-label="Select all visible results"
                                            className={CHECKBOX_CLASS}
                                        />
                                    </th>
                                    <th scope="col" className="w-[12%] px-3 py-2 font-medium">
                                        Result ID
                                    </th>
                                    <th scope="col" className="w-[13%] px-3 py-2 font-medium">
                                        Patient
                                    </th>
                                    <th scope="col" className="w-[11%] px-3 py-2 font-medium">
                                        Test type
                                    </th>
                                    <th scope="col" className="hidden w-[9%] px-3 py-2 font-medium lg:table-cell">
                                        MLT
                                    </th>
                                    <th scope="col" className="w-[7%] px-3 py-2 font-medium">
                                        QC
                                    </th>
                                    <th scope="col" className="w-[12%] px-3 py-2 font-medium">
                                        Flag
                                    </th>
                                    <th scope="col" className="w-[8%] px-3 py-2 font-medium">
                                        Priority
                                    </th>
                                    <th scope="col" className="w-[13%] px-3 py-2 font-medium">
                                        Status
                                    </th>
                                    <th scope="col" className="w-[10%] py-2 pl-2 pr-3 text-right font-medium">
                                        <span className="sr-only">Actions</span>
                                    </th>
                                </tr>
                            </thead>

                            <tbody className="divide-y divide-edge whitespace-nowrap">
                                {filteredResults.map((result) => {
                                    const isReturned = result.status === 'RETURNED_FOR_RECHECK';
                                    const isExpanded = expandedReason === result.resultId;
                                    const hasCritical = hasCriticalTriage(result);
                                    const isSelected = selectedIds.includes(result.resultId);
                                    const displayId = formatDisplayId(result.resultId, 'RES');
                                    const qcStatus = getQcStatusConfig(result.qcStatus);
                                    const flag = getResultFlagBadge(result.flag, result.hasCriticalFinding);
                                    const mltName = result.mltName || result.technicianName || '';
                                    const panelId = `return-reason-${result.resultId}`;
                                    const fullUpdated = formatFullTimestamp(result.updatedAt);

                                    return (
                                        <React.Fragment key={result.resultId}>
                                            <tr
                                                className={cn(
                                                    'group cursor-pointer transition-colors hover:bg-surface-hover',
                                                    hasCritical && 'bg-status-danger-bg',
                                                    isSelected && !hasCritical && 'bg-primary-soft'
                                                )}
                                                onClick={(event) => {
                                                    const target = event.target as HTMLElement;
                                                    if (target.closest('button, a, input, label')) {
                                                        return;
                                                    }
                                                    handleReview(result.resultId);
                                                }}
                                            >
                                                <td className="py-2 pl-4 pr-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => handleToggleSelectOne(result.resultId)}
                                                        aria-label={`Select ${displayId}`}
                                                        className={CHECKBOX_CLASS}
                                                    />
                                                </td>

                                                <td className="px-3 py-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleReview(result.resultId)}
                                                        title={result.resultId}
                                                        className="flex max-w-full items-center gap-1.5 rounded text-left font-medium text-fg transition-colors hover:text-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-surface"
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
                                                    <p className="truncate font-medium text-fg" title={result.patientName || undefined}>
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

                                                <td
                                                    className="hidden truncate px-3 py-2 text-fg-secondary lg:table-cell"
                                                    title={mltName || undefined}
                                                >
                                                    {mltName || <span className="text-fg-faint">—</span>}
                                                </td>

                                                <td className="px-3 py-2">
                                                    <StatusChip tone={qcStatus.tone} size="sm" title={qcStatus.label} className="font-semibold tracking-wide">
                                                        {qcStatus.label}
                                                    </StatusChip>
                                                </td>

                                                <td className="px-3 py-2">
                                                    <StatusChip tone={flag.tone} size="sm" title={flag.label} className="font-semibold tracking-wide">
                                                        {flag.label}
                                                    </StatusChip>
                                                </td>

                                                <td className="px-3 py-2">
                                                    <PriorityBadge priority={result.priorityLevel ?? ''} />
                                                </td>

                                                <td className="px-3 py-2">
                                                    <StatusChip
                                                        tone={getVerificationTone(result.status)}
                                                        dot
                                                        title={getVerificationLabel(result.status)}
                                                    >
                                                        {getVerificationLabel(result.status)}
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
                                                    <td colSpan={10} className="whitespace-normal py-3 pl-4 pr-3">
                                                        <div className="rounded-md border border-status-pending-edge bg-status-pending-bg px-3 py-2.5">
                                                            <p className="text-xs font-semibold text-status-pending-fg">
                                                                {getVerificationLabel(result.status)}
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

                {/* Footer: paging — stays mounted while a new page loads */}
                {showFooter && (
                    <div
                        inert={loading || undefined}
                        aria-busy={loading || undefined}
                        className={cn(loading && 'pointer-events-none opacity-60')}
                    >
                        <Pagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            totalItems={totalElements}
                            pageSize={PAGE_SIZE}
                            onPageChange={handlePageChange}
                            itemLabel="results"
                        />
                    </div>
                )}
            </SectionCard>
        </div>
    );
}
