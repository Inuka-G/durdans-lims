'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AxiosError } from 'axios';
import * as XLSX from 'xlsx';
import { AlertTriangle, CheckCircle2, FileSpreadsheet, History, RefreshCw, Search, X, XCircle } from 'lucide-react';
import { getAuditLogs, type AuditLog } from '@/lib/api';
import Button from '@/components/ui/Button';
import PageHeader from '@/components/ui/PageHeader';
import SectionCard from '@/components/ui/SectionCard';
import EmptyState from '@/components/ui/EmptyState';
import Pagination from '@/components/ui/Pagination';
import SegmentedControl from '@/components/ui/SegmentedControl';
import StatusChip, { humanizeStatus, toneForStatus } from '@/components/ui/StatusChip';
import { InputField } from '@/components/ui/Field';
import StatCard from '@/components/shared/StatCard';
import PriorityBadge from '@/components/shared/PriorityBadge';
import { formatAuditTime } from '@/components/patient-dashboard/dashboard-data';

const PAGE_SIZE = 8;
const SKELETON_ROWS = 6;
const ACTION_FILTERS = ['All Actions', 'ACCEPTED', 'REJECTED'] as const;

type LogActionFilter = typeof ACTION_FILTERS[number];

const ACTION_FILTER_LABELS: Record<LogActionFilter, string> = {
    'All Actions': 'All actions',
    ACCEPTED: 'Accepted',
    REJECTED: 'Rejected',
};

type AccessioningLogRow = {
    id: string;
    entityId: string;
    sampleId: string;
    patientName: string;
    pid: string;
    testType: string;
    priority: 'STAT' | 'URGENT' | 'NORMAL';
    action: 'ACCEPTED' | 'REJECTED';
    status: string;
    performedBy: string;
    /** Formatted timestamp (used in the Excel export and as the invalid-date display fallback). */
    timestamp: string;
    /** Raw ISO timestamp for the <time> dateTime, absolute display and relative tooltip. */
    timestampRaw: string;
    notes: string;
    rejectionReason: string;
};

export default function AccessioningLogsPage() {
    const [logs, setLogs] = useState<AccessioningLogRow[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [actionFilter, setActionFilter] = useState<LogActionFilter>('All Actions');
    const [currentPage, setCurrentPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        let active = true;

        const loadLogs = async () => {
            try {
                setLoading(true);
                setError(null);

                const response = await getAuditLogs({
                    entityType: 'SAMPLE_ACCESSIONING',
                    page: 0,
                    size: 100,
                });

                if (!active) {
                    return;
                }

                const mapped = response.content
                    .map(mapAuditLogToRow)
                    .filter((log): log is AccessioningLogRow => log !== null);

                setLogs(mapped);
            } catch (err) {
                if (!active) {
                    return;
                }

                setError(getApiErrorMessage(err));
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        };

        void loadLogs();

        return () => {
            active = false;
        };
    }, [reloadKey]);

    const filtered = useMemo(() => {
        return logs.filter((l) => {
            const q = searchQuery.toLowerCase();
            const matchesSearch = !q
                || l.sampleId.toLowerCase().includes(q)
                || l.patientName.toLowerCase().includes(q)
                || l.pid.toLowerCase().includes(q)
                || l.testType.toLowerCase().includes(q)
                || l.performedBy.toLowerCase().includes(q);
            const matchesAction = actionFilter === 'All Actions' || l.action === actionFilter;
            return matchesSearch && matchesAction;
        });
    }, [logs, searchQuery, actionFilter]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    const accepted = logs.filter(l => l.action === 'ACCEPTED').length;
    const rejected = logs.filter(l => l.action === 'REJECTED').length;

    const hasFilters = Boolean(searchQuery) || actionFilter !== 'All Actions';

    const clearFilters = () => {
        setSearchQuery('');
        setActionFilter('All Actions');
        setCurrentPage(1);
    };

    const retry = () => setReloadKey((k) => k + 1);

    const handleExport = () => {
        if (filtered.length === 0) {
            return;
        }

        const headers = ['Sample ID', 'Patient', 'PID', 'Test', 'Priority', 'Action', 'Status', 'Rejection Reason', 'Performed By', 'Timestamp', 'Notes'];
        const rows = filtered.map((log) => [
            log.sampleId,
            log.patientName,
            log.pid,
            log.testType,
            log.priority,
            log.action,
            log.status,
            log.rejectionReason,
            log.performedBy,
            log.timestamp,
            log.notes,
        ]);

        const worksheetData = [headers, ...rows];
        const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

        // Auto-fit column widths based on content
        const colWidths = headers.map((header, colIdx) => {
            const maxLen = Math.max(
                header.length,
                ...rows.map((row) => String(row[colIdx] ?? '').length),
            );
            return { wch: Math.min(maxLen + 2, 50) };
        });
        worksheet['!cols'] = colWidths;

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Accessioning Logs');

        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
        XLSX.writeFile(workbook, `accessioning-logs-${timestamp}.xlsx`);
    };

    return (
        <div className="mx-auto max-w-[1400px]">
            <PageHeader
                title="Accessioning logs"
                crumbs={[{ label: 'Lab reception', href: '/reception/accessioning' }, { label: 'Accessioning logs' }]}
                meta={
                    <>
                        <History className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>Audit trail of sample accessioning actions</span>
                        {!loading && !error && (
                            <>
                                <span aria-hidden="true">·</span>
                                <span className="tabular-nums">
                                    {logs.length.toLocaleString()} {logs.length === 1 ? 'action' : 'actions'}
                                </span>
                            </>
                        )}
                    </>
                }
                actions={
                    <Button icon={FileSpreadsheet} onClick={handleExport} disabled={loading || filtered.length === 0}>
                        Export to Excel
                    </Button>
                }
            />

            {/* Screen-reader status for async transitions only — filtered/page counts are
                already conveyed visually by the SectionCard count and Pagination summary,
                and announcing them here would re-announce on every search keystroke. */}
            <p role="status" aria-live="polite" className="sr-only">
                {loading
                    ? 'Loading accessioning logs'
                    : error
                        ? 'Accessioning logs failed to load'
                        : `Accessioning logs loaded, ${logs.length} ${logs.length === 1 ? 'action' : 'actions'}.`}
            </p>

            {/* Stats */}
            <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <StatCard label="Total actions" value={logs.length} icon={History} color="blue" loading={loading} />
                <StatCard label="Accepted" value={accepted} icon={CheckCircle2} color="emerald" loading={loading} />
                <StatCard label="Rejected" value={rejected} icon={XCircle} color="red" loading={loading} />
            </div>

            <SectionCard title="Accessioning actions" count={loading || error ? undefined : filtered.length} flush>
                {/* Filter toolbar */}
                <div className="flex flex-wrap items-center gap-2 border-b border-edge bg-surface-muted px-3 py-2">
                    <InputField
                        label="Search accessioning logs"
                        hideLabel
                        type="search"
                        value={searchQuery}
                        onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                        placeholder="Search sample ID, patient, PID, test or user"
                        autoComplete="off"
                        className="min-w-[200px] flex-1"
                    />
                    <SegmentedControl<LogActionFilter>
                        ariaLabel="Filter by action"
                        value={actionFilter}
                        onChange={(next) => { setActionFilter(next); setCurrentPage(1); }}
                        options={ACTION_FILTERS.map((f) => ({
                            value: f,
                            label: ACTION_FILTER_LABELS[f],
                            count: loading ? undefined : f === 'All Actions' ? logs.length : f === 'ACCEPTED' ? accepted : rejected,
                        }))}
                    />
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
                                <span className="hidden h-3 w-28 rounded bg-skeleton md:block" />
                                <span className="h-4 w-14 rounded bg-skeleton" />
                                <span className="h-4 w-20 rounded bg-skeleton" />
                                <span className="hidden h-4 w-24 rounded bg-skeleton lg:block" />
                                <span className="ml-auto h-3 w-1/4 rounded bg-skeleton" />
                            </li>
                        ))}
                    </ul>
                ) : error ? (
                    <EmptyState
                        icon={AlertTriangle}
                        title="Couldn't load accessioning logs"
                        description={error}
                        action={
                            <Button size="sm" icon={RefreshCw} onClick={retry}>
                                Retry
                            </Button>
                        }
                    />
                ) : filtered.length === 0 ? (
                    hasFilters ? (
                        <EmptyState
                            icon={Search}
                            title="No actions match"
                            description="Try a different search term or action filter."
                            action={
                                <Button size="sm" icon={X} onClick={clearFilters}>
                                    Clear filters
                                </Button>
                            }
                        />
                    ) : (
                        <EmptyState
                            icon={History}
                            title="No accessioning actions yet"
                            description="Accepted and rejected samples will be recorded here."
                        />
                    )
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[680px] table-fixed text-left text-sm md:min-w-[800px] lg:min-w-[960px] xl:min-w-[992px]">
                            <caption className="sr-only">Accessioning log entries</caption>
                            <thead>
                                <tr className="whitespace-nowrap border-b border-edge text-xs font-semibold text-fg-muted">
                                    <th scope="col" className="w-28 py-2 pl-4 pr-3 font-semibold">Sample ID</th>
                                    <th scope="col" className="w-32 px-3 py-2 font-semibold">Patient</th>
                                    <th scope="col" className="hidden w-32 px-3 py-2 font-semibold md:table-cell">Test</th>
                                    <th scope="col" className="w-20 px-3 py-2 font-semibold">Priority</th>
                                    <th scope="col" className="w-24 px-3 py-2 font-semibold">Action</th>
                                    <th scope="col" className="hidden w-24 px-3 py-2 font-semibold lg:table-cell">Status</th>
                                    <th scope="col" className="px-3 py-2 font-semibold">Details</th>
                                    <th scope="col" className="hidden w-24 px-3 py-2 font-semibold xl:table-cell">Performed by</th>
                                    <th scope="col" className="w-24 px-3 py-2 font-semibold">Time</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-edge whitespace-nowrap">
                                {paginated.map((log) => {
                                    const hasDetails = Boolean(log.rejectionReason || log.notes);
                                    const showReason = log.action === 'REJECTED' && Boolean(log.rejectionReason);
                                    return (
                                        <tr key={log.id} className="transition-colors hover:bg-surface-hover">
                                            {/* Sample ID */}
                                            <td className="py-2 pl-4 pr-3 font-mono text-xs">
                                                {log.entityId ? (
                                                    <Link
                                                        href={`/reception/samples/${log.entityId}`}
                                                        title={`Open sample ${log.sampleId}`}
                                                        className="inline-block max-w-full truncate rounded align-middle font-medium text-primary-strong hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-surface"
                                                    >
                                                        {log.sampleId}
                                                    </Link>
                                                ) : (
                                                    <span className="inline-block max-w-full truncate align-middle font-medium text-fg-secondary" title={log.sampleId}>
                                                        {log.sampleId}
                                                    </span>
                                                )}
                                            </td>
                                            {/* Patient */}
                                            <td className="px-3 py-2">
                                                <p className="truncate font-medium text-fg" title={log.patientName}>{log.patientName}</p>
                                                <p className="truncate font-mono text-xs text-fg-muted" title={log.pid}>{log.pid}</p>
                                            </td>
                                            {/* Test */}
                                            <td className="hidden truncate px-3 py-2 text-fg-secondary md:table-cell" title={log.testType}>
                                                {log.testType}
                                            </td>
                                            {/* Priority */}
                                            <td className="px-3 py-2">
                                                <PriorityBadge priority={log.priority} />
                                            </td>
                                            {/* Action */}
                                            <td className="px-3 py-2">
                                                <StatusChip tone={log.action === 'ACCEPTED' ? 'success' : 'danger'} dot size="sm">
                                                    {humanizeStatus(log.action)}
                                                </StatusChip>
                                            </td>
                                            {/* Status */}
                                            <td className="hidden px-3 py-2 lg:table-cell">
                                                <StatusChip tone={toneForStatus(log.status)} size="sm" title={humanizeStatus(log.status)}>
                                                    {humanizeStatus(log.status)}
                                                </StatusChip>
                                            </td>
                                            {/* Details */}
                                            <td className="whitespace-normal break-words px-3 py-2 text-xs">
                                                {showReason && (
                                                    <p className="font-medium text-status-danger-fg">{humanizeStatus(log.rejectionReason)}</p>
                                                )}
                                                {log.notes ? (
                                                    <p className={showReason ? 'mt-0.5 whitespace-pre-wrap text-fg-muted' : 'whitespace-pre-wrap text-fg-muted'}>
                                                        {log.notes}
                                                    </p>
                                                ) : null}
                                                {!hasDetails ? <span className="text-fg-faint">—</span> : null}
                                            </td>
                                            {/* Performed by */}
                                            <td className="hidden truncate px-3 py-2 text-xs text-fg-secondary xl:table-cell" title={log.performedBy}>
                                                {log.performedBy}
                                            </td>
                                            {/* Time — absolute date + clock time stay visible; the
                                                relative label lives in the tooltip only. */}
                                            <td className="px-3 py-2 tabular-nums text-fg-secondary">
                                                {(() => {
                                                    const parts = formatAuditDateParts(log.timestampRaw);
                                                    return (
                                                        <time dateTime={log.timestampRaw} title={formatAuditTime(log.timestampRaw)} className="block">
                                                            {parts ? (
                                                                <>
                                                                    <span className="block text-xs">{parts.date}</span>
                                                                    <span className="block text-xs text-fg-muted">{parts.time}</span>
                                                                </>
                                                            ) : (
                                                                <span className="block text-xs">{log.timestamp}</span>
                                                            )}
                                                        </time>
                                                    );
                                                })()}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Footer: paging */}
                {!loading && !error && filtered.length > 0 && (
                    <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        totalItems={filtered.length}
                        pageSize={PAGE_SIZE}
                        onPageChange={setCurrentPage}
                        itemLabel="actions"
                    />
                )}
            </SectionCard>
        </div>
    );
}

function mapAuditLogToRow(log: AuditLog): AccessioningLogRow | null {
    if (log.entityType !== 'SAMPLE_ACCESSIONING') {
        return null;
    }

    const details = parseAuditDetails(log.details);
    const action = log.action === 'REJECTED' ? 'REJECTED' : 'ACCEPTED';
    const priority = toPriority(details.priority);

    return {
        id: log.id,
        entityId: log.entityId?.trim() ?? '',
        sampleId: details.sampleId || log.entityId || 'UNKNOWN_SAMPLE',
        patientName: details.patientName || 'Unknown patient',
        pid: details.pid || log.patientCode || 'UNKNOWN_PATIENT',
        testType: details.testType || 'Accessioning action',
        priority,
        action,
        status: details.status || action,
        performedBy: log.performedBy || 'SYSTEM',
        timestamp: formatTimestamp(log.timestamp),
        timestampRaw: log.timestamp,
        notes: details.notes || '',
        rejectionReason: details.rejectionReason || '',
    };
}

function parseAuditDetails(details: string | undefined): Record<string, string> {
    if (!details) {
        return {};
    }

    try {
        const parsed = JSON.parse(details) as Record<string, unknown>;
        return Object.fromEntries(
            Object.entries(parsed).map(([key, value]) => [key, value == null ? '' : String(value)])
        );
    } catch {
        return {};
    }
}

function toPriority(priority: string | undefined): 'STAT' | 'URGENT' | 'NORMAL' {
    if (priority === 'STAT' || priority === 'URGENT') {
        return priority;
    }

    return 'NORMAL';
}

/** Absolute date + 24h clock time for the Time column (en-GB date per DESIGN.md). */
function formatAuditDateParts(timestamp: string): { date: string; time: string } | null {
    const date = new Date(timestamp);

    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return {
        date: date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        time: date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false }),
    };
}

function formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);

    if (Number.isNaN(date.getTime())) {
        return timestamp;
    }

    return date.toLocaleString('en-LK', {
        dateStyle: 'medium',
        timeStyle: 'short',
    });
}

function getApiErrorMessage(error: unknown): string {
    if (error instanceof AxiosError) {
        const message = error.response?.data?.message;
        if (typeof message === 'string' && message.trim()) {
            return message;
        }
    }

    return 'Unable to load accessioning logs right now. Please try again.';
}
