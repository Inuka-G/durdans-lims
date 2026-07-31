'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AxiosError } from 'axios';
import { getAuditLogs, type AuditLog } from '@/lib/api';
import { PRIORITY_COLORS, SAMPLE_STATUS_COLORS, formatStatusLabel } from '@/constants/sample-lifecycle';

const PAGE_SIZE = 8;
const ACTION_FILTERS = ['All Actions', 'ACCEPTED', 'REJECTED'] as const;

type LogActionFilter = typeof ACTION_FILTERS[number];

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
    timestamp: string;
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
    }, []);

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

    const handleExport = () => {
        if (filtered.length === 0) {
            return;
        }

        const headers = ['Sample ID', 'Patient', 'PID', 'Test', 'Priority', 'Action', 'Status', 'Rejection reason', 'Performed By', 'Timestamp', 'Notes'];
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

        const csvContent = [headers, ...rows]
            .map((row) => row.map(escapeCsvValue).join(','))
            .join('\r\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');

        link.href = url;
        link.download = `accessioning-logs-${timestamp}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
    };

    return (
        <div>
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-800">Accessioning Logs</h1>
                <p className="text-sm text-slate-500 mt-1">Audit trail of all sample accessioning actions.</p>
            </div>

            {error && (
                <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-6">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-5">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center mb-2"><span className="material-icons text-blue-600">history</span></div>
                    <p className="text-2xl font-bold text-slate-800">{logs.length}</p>
                    <p className="text-xs text-slate-500">Total Actions</p>
                </div>
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-5">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center mb-2"><span className="material-icons text-emerald-600">check_circle</span></div>
                    <p className="text-2xl font-bold text-slate-800">{accepted}</p>
                    <p className="text-xs text-slate-500">Accepted</p>
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
                            <input type="text" placeholder="Search sample ID, patient..." className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }} />
                        </div>
                        <select className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20" value={actionFilter} onChange={(e) => { setActionFilter(e.target.value as LogActionFilter); setCurrentPage(1); }}>
                            {ACTION_FILTERS.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                        <button
                            type="button"
                            onClick={handleExport}
                            disabled={filtered.length === 0}
                            className="flex items-center gap-1.5 px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <span className="material-icons text-base">download</span>Export
                        </button>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider">
                                <th className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">Sample ID</th>
                                <th className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">Patient</th>
                                <th className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">Test</th>
                                <th className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">Priority</th>
                                <th className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">Action</th>
                                <th className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">Status</th>
                                <th className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">Details</th>
                                <th className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">By</th>
                                <th className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">Time</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={9} className="text-center py-12 text-slate-400">Loading accessioning logs...</td></tr>
                            ) : paginated.length === 0 ? (
                                <tr><td colSpan={9} className="text-center py-12 text-slate-400">No accessioning logs found</td></tr>
                            ) : paginated.map((log) => (
                                <tr key={log.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                                    <td className="px-5 py-3 font-semibold text-primary">
                                        {log.entityId ? (
                                            <Link href={`/reception/samples/${log.entityId}`} className="hover:underline">
                                                {log.sampleId}
                                            </Link>
                                        ) : (
                                            log.sampleId
                                        )}
                                    </td>
                                    <td className="px-4 py-3"><p className="font-medium text-slate-700">{log.patientName}</p><p className="text-xs text-slate-400">{log.pid}</p></td>
                                    <td className="px-4 py-3 text-slate-700">{log.testType}</td>
                                    <td className="px-4 py-3"><span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${PRIORITY_COLORS[log.priority] ?? 'bg-slate-100 text-slate-600'}`}>{log.priority}</span></td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ${log.action === 'ACCEPTED' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                            <span className="material-icons text-xs">{log.action === 'ACCEPTED' ? 'check_circle' : 'cancel'}</span>{log.action}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3"><span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${SAMPLE_STATUS_COLORS[log.status] ?? 'bg-slate-100 text-slate-600'}`}>{formatStatusLabel(log.status)}</span></td>
                                    <td className="px-4 py-3 text-xs text-slate-600 max-w-[240px]">
                                        {log.action === 'REJECTED' && log.rejectionReason ? (
                                            <p className="font-semibold text-red-700">{formatStatusLabel(log.rejectionReason)}</p>
                                        ) : null}
                                        {log.notes ? (
                                            <p className={`text-slate-500 whitespace-pre-wrap ${log.action === 'REJECTED' && log.rejectionReason ? 'mt-0.5' : ''}`}>{log.notes}</p>
                                        ) : null}
                                        {!log.rejectionReason && !log.notes ? <span className="text-slate-400">—</span> : null}
                                    </td>
                                    <td className="px-4 py-3 text-slate-500 text-xs">{log.performedBy}</td>
                                    <td className="px-4 py-3 text-slate-500">{log.timestamp}</td>
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

function escapeCsvValue(value: string): string {
    const normalized = value.replace(/"/g, '""');
    return `"${normalized}"`;
}
