'use client';

import { MOCK_QC_DASHBOARD_DATA } from '@/mock/mlt.mock';
import { getQcDashboard, type QcDashboardData, type QcRunItem } from '@/lib/api';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, FlaskConical, RefreshCw, XCircle } from 'lucide-react';
import RecordQcRunForm from '@/components/mlt/RecordQcRunForm';
import Button from '@/components/ui/Button';
import PageHeader from '@/components/ui/PageHeader';
import SectionCard from '@/components/ui/SectionCard';
import EmptyState from '@/components/ui/EmptyState';
import SegmentedControl, { type SegmentOption } from '@/components/ui/SegmentedControl';
import StatusChip, { humanizeStatus, type ChipTone } from '@/components/ui/StatusChip';
import StatCard from '@/components/shared/StatCard';
import DemoDataBanner from '@/components/shared/DemoDataBanner';
import { cn } from '@/lib/utils';

const SKELETON_ROWS = 6;

/** QC outcome → chip tone (PASS / WARN / FAIL are not part of the shared STATUS_TONE map). */
const QC_TONE: Record<QcRunItem['status'], ChipTone> = {
    PASS: 'success',
    WARN: 'pending',
    FAIL: 'danger',
};

export default function QCDashboardPage() {
    const [dashboard, setDashboard] = useState<QcDashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [demoMode, setDemoMode] = useState(false);
    const [viewMode, setViewMode] = useState<'today' | 'history'>('today');

    const loadDashboard = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            setDemoMode(false);
            const data = await getQcDashboard();
            setDashboard(data);
        } catch (err) {
            console.error('Failed to load QC dashboard', err);
            setDashboard(MOCK_QC_DASHBOARD_DATA);
            setDemoMode(true);
            setError(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadDashboard();
    }, [loadDashboard]);

    const runs = dashboard?.runs ?? [];

    const isTodayRun = (timeStr: string) => {
        if (!timeStr) return false;
        return !timeStr.includes(',') && !/\d{2}\s+[A-Za-z]{3}/.test(timeStr);
    };

    const todayRuns = useMemo(() => runs.filter((r) => isTodayRun(r.timestamp)), [runs]);
    const displayedRuns = viewMode === 'today' ? todayRuns : runs;

    const viewOptions: SegmentOption<'today' | 'history'>[] = useMemo(
        () => [
            { value: 'today', label: "Today's runs", count: todayRuns.length },
            { value: 'history', label: 'Audit history', count: runs.length },
        ],
        [todayRuns.length, runs.length]
    );

    const activePassCount = displayedRuns.filter((r) => r.status === 'PASS').length;
    const activeWarnCount = displayedRuns.filter((r) => r.status === 'WARN').length;
    const activeFailCount = displayedRuns.filter((r) => r.status === 'FAIL').length;

    return (
        <div className="mx-auto max-w-[1400px]">
            <PageHeader
                crumbs={[{ label: 'Laboratory' }, { label: 'Quality control' }]}
                title="QC dashboard"
                meta={<span>Internal control runs recorded today and their Westgard outcome</span>}
                actions={
                    <Button icon={RefreshCw} loading={loading} onClick={loadDashboard}>
                        Refresh
                    </Button>
                }
            />

            {/* Screen-reader status for async changes */}
            <p role="status" aria-live="polite" className="sr-only">
                {loading
                    ? 'Loading QC dashboard'
                    : `QC dashboard loaded. ${displayedRuns.length} runs: ${activePassCount} passed, ${activeWarnCount} warnings, ${activeFailCount} failed.`}
            </p>

            <RecordQcRunForm onRecorded={loadDashboard} />

            {demoMode && (
                <DemoDataBanner note="Demo QC data — no live middleware or analyser interface detected. Showing representative QC runs so training and UI reviews can continue without hardware; live Westgard / L-J summaries replace this automatically when the API is available." />
            )}

            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                    label={viewMode === 'today' ? "Today's QC runs" : 'Total QC runs'}
                    value={displayedRuns.length}
                    icon={FlaskConical}
                    color="blue"
                    loading={loading}
                />
                <StatCard label="Passed" value={activePassCount} icon={CheckCircle2} color="emerald" loading={loading} />
                <StatCard label="Warnings" value={activeWarnCount} icon={AlertTriangle} color="orange" loading={loading} />
                <StatCard label="Failures" value={activeFailCount} icon={XCircle} color="red" loading={loading} />
            </div>

            {activeFailCount > 0 && (
                <div
                    role="alert"
                    className="mb-4 flex items-start gap-2 rounded-md border border-status-danger-edge bg-status-danger-bg px-4 py-2.5 text-sm text-status-danger-fg"
                >
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <p>
                        <span className="font-medium">
                            {activeFailCount} QC {activeFailCount === 1 ? 'run' : 'runs'} failed.
                        </span>{' '}
                        Instruments with failed QC should not be used until corrective action is taken.
                    </p>
                </div>
            )}

            {error && !demoMode && (
                <div
                    role="alert"
                    className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-status-danger-edge bg-status-danger-bg px-4 py-2.5 text-sm text-status-danger-fg"
                >
                    <span className="inline-flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                        {error}
                    </span>
                    <Button size="sm" icon={RefreshCw} onClick={loadDashboard}>
                        Retry
                    </Button>
                </div>
            )}

            <SectionCard
                title={viewMode === 'today' ? "Today's QC runs" : 'QC runs & audit history'}
                count={loading ? undefined : displayedRuns.length}
                actions={
                    <SegmentedControl
                        value={viewMode}
                        onChange={setViewMode}
                        options={viewOptions}
                        ariaLabel="QC view mode"
                        size="sm"
                    />
                }
                flush
            >
                {/* States live outside the table so they centre on small screens */}
                {loading ? (
                    <ul aria-hidden="true" className="divide-y divide-edge">
                        {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
                            <li key={i} className="flex items-center gap-3 px-4 py-2.5">
                                <span className="h-3 w-28 shrink-0 rounded bg-skeleton" />
                                <span className="h-3 w-24 shrink-0 rounded bg-skeleton" />
                                <span className="hidden h-3 w-10 rounded bg-skeleton sm:block" />
                                <span className="h-3 w-14 rounded bg-skeleton" />
                                <span className="hidden h-3 w-14 rounded bg-skeleton md:block" />
                                <span className="hidden h-3 w-10 rounded bg-skeleton md:block" />
                                <span className="h-4 w-12 rounded bg-skeleton" />
                                <span className="ml-auto hidden h-3 w-20 rounded bg-skeleton lg:block" />
                                <span className="h-3 w-12 rounded bg-skeleton" />
                            </li>
                        ))}
                    </ul>
                ) : displayedRuns.length === 0 ? (
                    <EmptyState
                        icon={FlaskConical}
                        title={viewMode === 'today' ? 'No QC runs today' : 'No QC runs recorded'}
                        description={
                            viewMode === 'today'
                                ? 'No control runs have been recorded yet today. Switch to Audit history to view past runs.'
                                : 'Record a control run above to start governing result release.'
                        }
                    />
                ) : (
                    <div className="overflow-x-auto">
                        {/* min-w must cover the sum of the nine fixed columns
                            (44+40+16+24+24+16+20+36+28 = 248 spacing units = 992px);
                            below that `table-fixed` scales every column down and clips
                            the nowrap headers. */}
                        <table className="w-full min-w-[992px] table-fixed text-left text-sm">
                            <caption className="sr-only">QC runs & audit history</caption>
                            <thead>
                                <tr className="whitespace-nowrap border-b border-edge text-xs font-semibold text-fg-muted">
                                    <th scope="col" className="w-44 py-2 pl-4 pr-3 font-semibold">
                                        Instrument
                                    </th>
                                    <th scope="col" className="w-40 px-3 py-2 font-semibold">
                                        Test group
                                    </th>
                                    <th scope="col" className="w-16 px-3 py-2 font-semibold">
                                        Level
                                    </th>
                                    <th scope="col" className="w-24 px-3 py-2 font-semibold">
                                        Result
                                    </th>
                                    <th scope="col" className="w-24 px-3 py-2 font-semibold">
                                        Expected
                                    </th>
                                    <th scope="col" className="w-16 px-3 py-2 font-semibold">
                                        SD
                                    </th>
                                    <th scope="col" className="w-20 px-3 py-2 font-semibold">
                                        Status
                                    </th>
                                    <th scope="col" className="w-36 px-3 py-2 font-semibold">
                                        By
                                    </th>
                                    <th scope="col" className="w-28 px-3 py-2 font-semibold">
                                        Time
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-edge whitespace-nowrap">
                                {displayedRuns.map((run) => {
                                    const failed = run.status === 'FAIL';
                                    return (
                                        <tr
                                            key={run.id}
                                            className={cn(
                                                'transition-colors',
                                                failed ? 'bg-status-danger-bg' : 'hover:bg-surface-hover'
                                            )}
                                        >
                                            <td className="truncate py-2 pl-4 pr-3 font-medium text-fg" title={run.instrument}>
                                                {run.instrument}
                                            </td>
                                            <td className="truncate px-3 py-2 text-fg-secondary" title={run.testGroup}>
                                                {run.testGroup}
                                            </td>
                                            <td className="px-3 py-2 text-fg-muted">{run.level}</td>
                                            <td className="px-3 py-2 font-medium tabular-nums text-fg">{run.result}</td>
                                            <td className="px-3 py-2 tabular-nums text-fg-muted">{run.expected}</td>
                                            <td className="px-3 py-2 tabular-nums text-fg-muted">{run.sd}</td>
                                            <td className="px-3 py-2">
                                                <StatusChip tone={QC_TONE[run.status]} dot size="sm">
                                                    {humanizeStatus(run.status)}
                                                </StatusChip>
                                            </td>
                                            <td className="truncate px-3 py-2 text-xs text-fg-muted" title={run.performedBy}>
                                                {run.performedBy}
                                            </td>
                                            <td className="px-3 py-2 tabular-nums text-fg-muted">{run.timestamp}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </SectionCard>
        </div>
    );
}
